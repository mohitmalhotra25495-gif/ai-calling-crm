import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { calls, callRecordings, transcripts } from "@/db/schema";
import { getAuthUserFromRequest } from "@/lib/auth";
import { eq, and, sql } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUserFromRequest(request);
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;

    // Safety net: expire only if NO Tabbly result after 15 minutes.
    // "Connected" (live conversation) is NEVER expired here.
    await db
      .update(calls)
      .set({
        callStatus: "No Answer",
        summary: sql`COALESCE(${calls.summary}, '') || ' [Auto-expired: no Tabbly result within 15 minutes — call was likely never dialed]'`,
      })
      .where(
        and(
          eq(calls.id, id),
          eq(calls.userId, authUser.id),
          sql`${calls.callStatus} IN ('Pending', 'Calling', 'Ringing')`,
          sql`${calls.callTime} < NOW() - INTERVAL '15 minutes'`
        )
      );

    const callResults = await db
      .select()
      .from(calls)
      .where(and(eq(calls.id, id), eq(calls.userId, authUser.id)))
      .limit(1);

    if (callResults.length === 0) {
      return NextResponse.json({ error: "Call not found" }, { status: 404 });
    }

    const recordings = await db
      .select()
      .from(callRecordings)
      .where(eq(callRecordings.callId, id));

    const transcriptResults = await db
      .select()
      .from(transcripts)
      .where(eq(transcripts.callId, id))
      .limit(1);

    return NextResponse.json({
      call: callResults[0],
      recordings,
      transcript: transcriptResults[0] || null,
    });
  } catch (error) {
    console.error("Call detail fetch error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
