import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { calls, leads, users, notifications } from "@/db/schema";
import { getAuthUserFromRequest } from "@/lib/auth";
import { resolveTabblyConfig } from "@/lib/tabbly";
import { eq, and, inArray } from "drizzle-orm";

/**
 * POST /api/calls/start
 * Initiates an outbound AI call via Tabbly (https://tabbly.io).
 *
 * Tabbly API spec (https://tabbly.gitbook.io/tabbly-docs):
 *  1. POST {base}/create-campaign        → returns { status, data: { campaign_id } }
 *  2. POST {base}/add-campaign-contacts  → returns { status, id }
 *  - Auth: api_key goes in the REQUEST BODY (not Authorization header)
 *  - agent_id is an INTEGER
 *  - Adding a contact to an active campaign triggers the outbound AI call.
 *
 * The API key never leaves the server. Detailed logs on every request.
 */

const DEFAULT_BASE = "https://www.tabbly.io/dashboard/agents/endpoints";

interface TabblyResult {
  ok: boolean;
  status: number;
  body: any;
  rawText: string;
  errorMessage: string;
}

async function tabblyPost(url: string, payload: Record<string, any>): Promise<TabblyResult> {
  const redacted = { ...payload, api_key: "***REDACTED***" };
  console.log(`[Tabbly] → POST ${url}`);
  console.log(`[Tabbly] → Payload: ${JSON.stringify(redacted)}`);

  // Hard 10s timeout so this route can NEVER hang
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const rawText = await res.text().catch(() => "");
    let body: any = null;
    try {
      body = JSON.parse(rawText);
    } catch {
      body = null;
    }

    console.log(`[Tabbly] ← HTTP ${res.status} ${res.statusText}`);
    console.log(`[Tabbly] ← Response: ${rawText.slice(0, 500)}`);

    const apiError =
      body?.status === "error"
        ? body?.message || "Unknown Tabbly error"
        : "";

    return {
      ok: res.ok && body?.status !== "error",
      status: res.status,
      body,
      rawText,
      errorMessage: apiError || (!res.ok ? `HTTP ${res.status}: ${rawText.slice(0, 200)}` : ""),
    };
  } catch (e: any) {
    const msg =
      e?.name === "TimeoutError" || e?.name === "AbortError"
        ? "Tabbly timeout after 10s"
        : e?.cause?.code === "ENOTFOUND"
        ? `DNS lookup failed for ${new URL(url).hostname} — check the Tabbly Base URL in Settings`
        : e?.cause?.code
        ? `Network error (${e.cause.code}): ${e.message}`
        : e?.message || "Network error";
    console.error(`[Tabbly] ✗ FETCH ERROR for ${url}: ${msg}`, e?.cause || "");
    return { ok: false, status: 504, body: null, rawText: "", errorMessage: msg };
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(request);
    if (!authUser) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    if (!body.leadId) {
      return NextResponse.json({ ok: false, error: "leadId is required" }, { status: 400 });
    }

    // Verify lead ownership
    const leadResults = await db
      .select()
      .from(leads)
      .where(and(eq(leads.id, body.leadId), eq(leads.userId, authUser.id)))
      .limit(1);
    if (leadResults.length === 0) {
      return NextResponse.json({ ok: false, error: "Lead not found" }, { status: 404 });
    }
    const lead = leadResults[0];

    // Prevent duplicate active calls
    const activeCalls = await db
      .select({ id: calls.id })
      .from(calls)
      .where(
        and(
          eq(calls.leadId, lead.id),
          eq(calls.userId, authUser.id),
          inArray(calls.callStatus, ["Pending", "Calling", "Ringing", "Connected"])
        )
      )
      .limit(1);
    if (activeCalls.length > 0) {
      return NextResponse.json(
        { ok: false, error: "A call is already in progress for this lead" },
        { status: 409 }
      );
    }

    // Load Tabbly settings (server-side only)
    const userResults = await db
      .select()
      .from(users)
      .where(eq(users.id, authUser.id))
      .limit(1);
    const user = userResults[0];

    // Resolve config: user's own keys OR global env keys (shared account)
    const tabbly = resolveTabblyConfig(user);
    if (tabbly.source === "none") {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Calling is not configured yet. Contact your administrator (or set your own keys in Settings → Tabbly Integration).",
          code: "NOT_CONFIGURED",
        },
        { status: 400 }
      );
    }

    // Tabbly agent_id must be an integer
    const agentIdNum = parseInt(tabbly.agentId, 10);
    if (isNaN(agentIdNum)) {
      return NextResponse.json(
        {
          ok: false,
          error: `Agent ID must be a number (Tabbly uses integer agent IDs). Current value: "${tabbly.agentId}".`,
          code: "INVALID_AGENT_ID",
        },
        { status: 400 }
      );
    }

    const baseUrl = tabbly.baseUrl;
    console.log(`[Tabbly] Using ${tabbly.source} credentials`);

    console.log(`[Tabbly] ===== Starting outbound call =====`);
    console.log(`[Tabbly] Lead: ${lead.name} (${lead.phoneNumber}) | Agent: ${agentIdNum} | Base: ${baseUrl}`);

    // ── Step 1: Ensure campaign exists ──
    let campaignId: number | null = user.tabblyCampaignId
      ? parseInt(user.tabblyCampaignId, 10) || null
      : null;

    if (!campaignId) {
      console.log(`[Tabbly] No campaign yet — creating one...`);
      const campRes = await tabblyPost(`${baseUrl}/create-campaign`, {
        api_key: tabbly.apiKey,
        campaign_name: `CRM Outbound - ${user.companyName || user.name || "AI Calling CRM"}`,
        agent_id: agentIdNum,
        start_time: "00:00",
        end_time: "23:59",
        time_zone: "IST",
        custom_first_line: "Hello, I am calling from " + (user.companyName || "our company") + ".",
        created_by: 1,
      });

      if (!campRes.ok) {
        return NextResponse.json(
          {
            ok: false,
            error: `Tabbly campaign creation failed → ${campRes.errorMessage}`,
            tabblyStatus: campRes.status,
            tabblyResponse: campRes.body || campRes.rawText.slice(0, 300),
          },
          { status: campRes.status === 504 ? 504 : 502 }
        );
      }

      campaignId =
        campRes.body?.data?.campaign_id ?? campRes.body?.campaign_id ?? null;
      if (!campaignId) {
        return NextResponse.json(
          {
            ok: false,
            error: `Tabbly did not return a campaign_id. Response: ${campRes.rawText.slice(0, 200)}`,
          },
          { status: 502 }
        );
      }

      // Save campaign for reuse
      await db
        .update(users)
        .set({ tabblyCampaignId: String(campaignId) })
        .where(eq(users.id, authUser.id));
      console.log(`[Tabbly] ✓ Campaign created & saved: ${campaignId}`);
    } else {
      console.log(`[Tabbly] Reusing existing campaign: ${campaignId}`);
    }

    // ── Step 2: Create CRM call record ──
    const [call] = await db
      .insert(calls)
      .values({
        userId: authUser.id,
        leadId: lead.id,
        agentName: `Tabbly Agent #${agentIdNum}`,
        customerName: lead.name,
        phoneNumber: lead.phoneNumber,
        callStatus: "Pending",
        leadStatus: lead.status,
        sentiment: "Pending",
        callTime: new Date(),
      })
      .returning();

    // ── Step 3: Add contact to campaign (triggers the call) with retry ──
    let lastError = "";
    let lastStatus = 0;
    let lastResponse: any = null;
    let contactId: number | string = "";
    let success = false;

    for (let attempt = 0; attempt <= 1; attempt++) {
      if (attempt > 0) {
        console.log(`[Tabbly] Retry attempt ${attempt}/1...`);
        await new Promise((r) => setTimeout(r, 1000));
      }

      const contactRes = await tabblyPost(`${baseUrl}/add-campaign-contacts`, {
        api_key: tabbly.apiKey,
        phone_number: lead.phoneNumber,
        campaign_id: campaignId,
        participant_identity: lead.name,
        use_agent_id: agentIdNum,
        created_by: "CRM",
        custom_first_line: `Hello ${lead.name}, I am calling regarding your enquiry.`,
        custom_instruction: lead.notes || "Be polite and helpful.",
        sip_call_id: `crm_${call.id}`,
        custom_identifiers: JSON.stringify({
          crm_call_id: call.id,
          crm_lead_id: lead.id,
          crm_user_id: authUser.id,
        }),
      });

      lastStatus = contactRes.status;
      lastResponse = contactRes.body || contactRes.rawText.slice(0, 300);

      if (contactRes.ok) {
        contactId = contactRes.body?.id ?? contactRes.body?.data?.id ?? `tabbly-${Date.now()}`;
        success = true;
        break;
      }

      lastError = contactRes.errorMessage;

      // If campaign was deleted on Tabbly side, reset and recreate next time
      if (
        contactRes.status === 400 &&
        /campaign/i.test(lastError) &&
        /invalid|not found|belong/i.test(lastError)
      ) {
        console.log(`[Tabbly] Campaign seems invalid — clearing saved campaign_id`);
        await db
          .update(users)
          .set({ tabblyCampaignId: "" })
          .where(eq(users.id, authUser.id));
        lastError += " (Saved campaign was invalid — click Start AI Call again to auto-create a new campaign)";
        break;
      }

      // Timeout (504) → return immediately, do NOT retry (route must stay fast)
      if (contactRes.status === 504) {
        await db
          .update(calls)
          .set({ retryCount: attempt + 1 })
          .where(eq(calls.id, call.id));
        break;
      }
      // Retry only on fast transient errors: network, 429, 5xx
      const retryable =
        contactRes.status === 0 ||
        contactRes.status === 429 ||
        contactRes.status >= 500;
      await db
        .update(calls)
        .set({ retryCount: attempt + 1 })
        .where(eq(calls.id, call.id));
      if (!retryable) break;
    }

    if (!success) {
      console.error(`[Tabbly] ✗ CALL FAILED after retries: ${lastError}`);
      await db
        .update(calls)
        .set({
          callStatus: "Failed",
          sentiment: "N/A",
          summary: `Tabbly error: ${lastError}`.slice(0, 500),
        })
        .where(eq(calls.id, call.id));

      await db.insert(notifications).values({
        userId: authUser.id,
        title: "Call Failed ❌",
        message: `Could not call ${lead.name}: ${lastError.slice(0, 150)}`,
        type: "call_complete",
        relatedId: call.id,
      });

      return NextResponse.json(
        {
          ok: false,
          error: lastError,
          tabblyStatus: lastStatus,
          tabblyResponse: lastResponse,
          callId: call.id,
        },
        { status: lastStatus === 504 ? 504 : 502 }
      );
    }

    console.log(`[Tabbly] ✓ Contact added (id: ${contactId}) — AI call queued!`);

    // ── Step 4: Mark call as Calling ──
    const [updated] = await db
      .update(calls)
      .set({ callStatus: "Calling", externalCallId: String(contactId) })
      .where(eq(calls.id, call.id))
      .returning();

    await db.insert(notifications).values({
      userId: authUser.id,
      title: "AI Call Started 📞",
      message: `Tabbly is calling ${lead.name} at ${lead.phoneNumber}...`,
      type: "call_complete",
      relatedId: call.id,
    });

    return NextResponse.json(
      { ok: true, call: updated, campaignId, contactId, success: true },
      { status: 201 }
    );
  } catch (error) {
    console.error("[Tabbly] Start call route error:", error);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
