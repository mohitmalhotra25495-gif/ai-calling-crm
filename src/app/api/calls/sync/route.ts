import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  calls,
  leads,
  users,
  transcripts,
  callRecordings,
  notifications,
} from "@/db/schema";
import { getAuthUserFromRequest } from "@/lib/auth";
import { resolveTabblyConfig } from "@/lib/tabbly";
import { eq, and, inArray, sql, desc } from "drizzle-orm";

/**
 * POST /api/calls/sync
 * 1. Expires un-answered calls (Pending/Calling/Ringing) after 2 minutes.
 *    "Connected" (live conversation) is NEVER expired (60-min safety only).
 * 2. Pulls real results from Tabbly call-logs and updates BOTH:
 *    - active calls, AND
 *    - recently auto-expired calls (last 60 min) → backfill real
 *      status/duration/recording/summary/transcript when Tabbly log arrives.
 */
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(request);
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userResults = await db
      .select()
      .from(users)
      .where(eq(users.id, authUser.id))
      .limit(1);
    const user = userResults[0];

    // ── Step 1: Expire un-answered calls after 2 min (NOT Connected) ──
    let expired = 0;
    const expiredRows = await db
      .update(calls)
      .set({
        callStatus: "No Answer",
        summary: sql`COALESCE(${calls.summary}, '') || ' [Auto-expired: no Tabbly result within 15 minutes — call was likely never dialed]'`,
      })
      .where(
        and(
          eq(calls.userId, authUser.id),
          inArray(calls.callStatus, ["Pending", "Calling", "Ringing"]),
          sql`${calls.callTime} < NOW() - INTERVAL '15 minutes'`
        )
      )
      .returning({ id: calls.id });
    expired = expiredRows.length;

    // Safety net: Connected > 60 min
    await db
      .update(calls)
      .set({
        callStatus: "Completed",
        summary: sql`COALESCE(${calls.summary}, '') || ' [Auto-closed: connected call exceeded 60 minutes]'`,
      })
      .where(
        and(
          eq(calls.userId, authUser.id),
          eq(calls.callStatus, "Connected"),
          sql`${calls.callTime} < NOW() - INTERVAL '60 minutes'`
        )
      );

    // ── Step 2: Collect calls to sync with Tabbly ──
    // Active calls + recently ended/expired ones (backfill window: 60 min)
    const syncableCalls = await db
      .select()
      .from(calls)
      .where(
        and(
          eq(calls.userId, authUser.id),
          sql`(
            ${calls.callStatus} IN ('Pending', 'Calling', 'Ringing', 'Connected')
            OR (
              ${calls.callStatus} IN ('No Answer', 'Completed', 'Busy', 'Failed')
              AND ${calls.callTime} > NOW() - INTERVAL '60 minutes'
              AND ${calls.callDuration} = 0
            )
          )`
        )
      );

    if (syncableCalls.length === 0) {
      return NextResponse.json({
        synced: expired,
        message:
          expired > 0
            ? `Expired ${expired} unanswered call(s)`
            : "No calls to sync",
      });
    }

    const tabbly = resolveTabblyConfig(user);
    if (!tabbly.apiKey) {
      return NextResponse.json({
        synced: expired,
        message:
          expired > 0
            ? `Expired ${expired} unanswered call(s). Calling not configured yet.`
            : "Tabbly not configured",
        code: "NOT_CONFIGURED",
      });
    }
    if (!tabbly.organizationId) {
      return NextResponse.json({
        synced: expired,
        message:
          expired > 0
            ? `Expired ${expired} unanswered call(s). Organization ID missing (admin: set TABBLY_ORGANIZATION_ID).`
            : "Organization ID missing for call log sync.",
        code: "NO_ORG_ID",
      });
    }

    // ── Step 3: Fetch recent Tabbly call logs ──
    const baseUrl = tabbly.baseUrl;

    const params = new URLSearchParams({
      api_key: tabbly.apiKey,
      organization_id: tabbly.organizationId,
      limit: "100",
    });
    const url = `${baseUrl}/call-logs-v2?${params.toString()}`;
    console.log(`[Tabbly Sync] → GET ${baseUrl}/call-logs-v2`);

    let logs: any[] = [];
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(url, { method: "GET", signal: controller.signal });
      clearTimeout(timer);
      const rawText = await res.text().catch(() => "");
      console.log(`[Tabbly Sync] ← HTTP ${res.status}: ${rawText.slice(0, 300)}`);
      let body: any = null;
      try {
        body = JSON.parse(rawText);
      } catch {
        body = null;
      }
      if (!res.ok || body?.status === "error") {
        return NextResponse.json({
          synced: expired,
          error: `Tabbly call-logs error: ${body?.message || `HTTP ${res.status}`}`,
        });
      }
      logs = body?.data || [];
    } catch (e: any) {
      const msg =
        e?.name === "AbortError" ? "Tabbly timeout after 10s" : e?.message || "Network error";
      console.error(`[Tabbly Sync] ✗ ${msg}`);
      return NextResponse.json({
        synced: expired,
        error: `Failed to fetch Tabbly logs: ${msg}`,
      });
    }

    // ── Step 4: Match logs & update calls (active + backfill) ──
    const normalize = (p: string) => (p || "").replace(/[^0-9]/g, "").slice(-10);
    let synced = 0;

    for (const call of syncableCalls) {
      const callPhone = normalize(call.phoneNumber);
      const callStart = new Date(call.callTime).getTime();

      // Match: same number, log time >= call start (5 min grace),
      // and not already used by checking external id when available
      const match = logs.find((l) => {
        const logPhone = normalize(l.called_to || "");
        if (logPhone !== callPhone) return false;
        if (call.externalCallId && String(l.id) === String(call.externalCallId)) return true;
        const logTime = new Date(l.called_time || 0).getTime();
        return isNaN(logTime) || logTime >= callStart - 5 * 60 * 1000;
      });

      if (!match) continue;

      const rawStatus = String(match.call_status || "").toLowerCase();
      const statusMap: Record<string, string> = {
        completed: "Completed",
        "call answered": "Completed",
        answered: "Completed",
        voicemail: "No Answer",
        "no answer": "No Answer",
        no_answer: "No Answer",
        busy: "Busy",
        failed: "Failed",
        cancelled: "Cancelled",
        ringing: "Ringing",
        "in progress": "Connected",
        in_progress: "Connected",
        connected: "Connected",
      };
      const newStatus = statusMap[rawStatus] || "Completed";
      const duration = parseInt(match.call_duration || "0", 10) || 0;
      const sentimentRaw = String(match.call_sentiment || "").toLowerCase();
      const sentiment =
        sentimentRaw === "positive"
          ? "Interested"
          : sentimentRaw === "negative"
          ? "Not Interested"
          : match.call_sentiment || call.sentiment;

      // Real Tabbly data overwrites everything (including auto-expired notes)
      await db
        .update(calls)
        .set({
          callStatus: newStatus,
          callDuration: duration,
          sentiment: sentiment || "Neutral",
          summary: match.call_summary || call.summary,
          externalCallId: String(match.id || call.externalCallId || ""),
        })
        .where(eq(calls.id, call.id));

      // Transcript: only insert if not already saved for this call
      if (match.call_transcript && typeof match.call_transcript === "string") {
        const existing = await db
          .select({ id: transcripts.id })
          .from(transcripts)
          .where(eq(transcripts.callId, call.id))
          .limit(1);
        if (existing.length === 0) {
          const messages = match.call_transcript
            .split("\n")
            .filter((l: string) => l.trim())
            .map((line: string) => {
              const [speaker, ...rest] = line.split(":");
              const isAI = /agent|ai|assistant/i.test(speaker);
              return {
                speaker: isAI ? "AI" : "Customer",
                text: rest.length ? rest.join(":").trim() : line.trim(),
                timestamp: "",
              };
            });
          if (messages.length > 0) {
            await db.insert(transcripts).values({
              callId: call.id,
              messages,
              fullText: match.call_transcript,
            });
          }
        }
      }

      // Recording: only insert if not already saved
      if (match.call_recording) {
        const existingRec = await db
          .select({ id: callRecordings.id })
          .from(callRecordings)
          .where(eq(callRecordings.callId, call.id))
          .limit(1);
        if (existingRec.length === 0) {
          await db.insert(callRecordings).values({
            callId: call.id,
            recordingUrl: match.call_recording,
            duration,
            format: "mp3",
          });
        }
      }

      // Lead status update on positive sentiment
      if (call.leadId && sentiment === "Interested") {
        await db
          .update(leads)
          .set({ status: "Interested", updatedAt: new Date() })
          .where(eq(leads.id, call.leadId));
      }

      // Notify only when status actually changed to a terminal state
      if (newStatus !== call.callStatus) {
        await db.insert(notifications).values({
          userId: authUser.id,
          title: `Call ${newStatus} ✅`,
          message: `Call with ${call.customerName}: ${newStatus}${duration ? `, ${duration}s` : ""}${match.call_recording ? " — recording available" : ""}`,
          type: "call_complete",
          relatedId: call.id,
        });
      }

      synced++;
      console.log(`[Tabbly Sync] ✓ Call ${call.id} → ${newStatus} (dur: ${duration}s, rec: ${match.call_recording ? "yes" : "no"})`);
    }

    return NextResponse.json({
      synced: synced + expired,
      matched: synced,
      expired,
      tabblyLogsFound: logs.length,
      message:
        synced > 0
          ? `Updated ${synced} call(s) with real Tabbly data${expired ? `, expired ${expired}` : ""}`
          : expired > 0
          ? `Expired ${expired} unanswered call(s). Tabbly logs will backfill when available.`
          : `No matching Tabbly logs yet.`,
    });
  } catch (error) {
    console.error("[Tabbly Sync] route error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
