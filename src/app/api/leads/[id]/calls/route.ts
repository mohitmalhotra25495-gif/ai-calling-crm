import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { calls, leads } from "@/db/schema";
import { getAuthUserFromRequest } from "@/lib/auth";
import { eq, and, desc, inArray, sql } from "drizzle-orm";

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

    // Verify lead belongs to user
    const leadResults = await db
      .select()
      .from(leads)
      .where(and(eq(leads.id, id), eq(leads.userId, authUser.id)))
      .limit(1);

    if (leadResults.length === 0) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // Safety net: expire only if NO Tabbly result after 15 minutes (never dialed).
    // IMPORTANT: "Connected" (active conversation) is NEVER expired here —
    // only a 60-minute safety net applies to Connected calls.
    await db
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
      );
    // Safety net: Connected calls stuck for over 60 minutes
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

    const callResults = await db
      .select()
      .from(calls)
      .where(and(eq(calls.leadId, id), eq(calls.userId, authUser.id)))
      .orderBy(desc(calls.callTime));

    return NextResponse.json({
      lead: leadResults[0],
      calls: callResults,
    });
  } catch (error) {
    console.error("Lead calls fetch error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
