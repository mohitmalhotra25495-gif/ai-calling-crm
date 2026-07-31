import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getAuthUserFromRequest } from "@/lib/auth";
import { resolveTabblyConfig } from "@/lib/tabbly";
import { eq } from "drizzle-orm";

/**
 * POST /api/settings/test-tabbly
 * Verifies the saved Tabbly API key by probing the add-campaign-contacts
 * endpoint with only the api_key.
 *  - "Invalid API key"        → key is WRONG
 *  - any "missing field" error → key is VALID (auth passed, validation failed)
 * Returns exact HTTP status + response for debugging.
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

    const tabbly = resolveTabblyConfig(user);
    if (!tabbly.apiKey) {
      return NextResponse.json(
        {
          success: false,
          message:
            "No API key found (neither your own nor global). Enter a key and Save, or ask admin to set TABBLY_API_KEY env.",
        },
        { status: 400 }
      );
    }

    const baseUrl = tabbly.baseUrl;

    const url = `${baseUrl}/add-campaign-contacts`;
    console.log(`[Tabbly Test] → POST ${url} (api_key only probe)`);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: tabbly.apiKey }),
        signal: AbortSignal.timeout(15000),
      });

      const rawText = await res.text().catch(() => "");
      let body: any = null;
      try {
        body = JSON.parse(rawText);
      } catch {
        body = null;
      }

      console.log(`[Tabbly Test] ← HTTP ${res.status}: ${rawText.slice(0, 300)}`);

      const message = body?.message || "";
      const invalidKey = /invalid api key/i.test(message) || res.status === 401;

      if (invalidKey) {
        return NextResponse.json({
          success: false,
          httpStatus: res.status,
          message: `API key is INVALID. Tabbly said: "${message || "401 Unauthorized"}". Copy the correct key from your Tabbly dashboard.`,
          rawResponse: rawText.slice(0, 300),
        });
      }

      // Auth passed (error is about missing fields, which is expected)
      return NextResponse.json({
        success: true,
        httpStatus: res.status,
        message: `API key is VALID! ✅ (using ${tabbly.source === "global" ? "global admin" : "your"} credentials) ${
          !tabbly.agentId
            ? "Agent ID still missing."
            : `Agent ID: ${tabbly.agentId}. Ready to make calls!`
        }`,
        rawResponse: rawText.slice(0, 300),
      });
    } catch (e: any) {
      const msg =
        e?.name === "TimeoutError" || e?.name === "AbortError"
          ? "Request timed out — Tabbly server not responding"
          : e?.cause?.code === "ENOTFOUND"
          ? `DNS lookup failed — Base URL is wrong (${baseUrl}). Reset it to: https://www.tabbly.io/dashboard/agents/endpoints`
          : e?.message || "Network error";
      console.error(`[Tabbly Test] ✗ ${msg}`);
      return NextResponse.json({ success: false, message: msg, url });
    }
  } catch (error) {
    console.error("Test Tabbly error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
