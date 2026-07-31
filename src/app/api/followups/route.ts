import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { followUps, notifications } from "@/db/schema";
import { getAuthUserFromRequest } from "@/lib/auth";
import { eq, desc, and } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(request);
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const results = await db
      .select()
      .from(followUps)
      .where(eq(followUps.userId, authUser.id))
      .orderBy(desc(followUps.scheduledDate));
    return NextResponse.json({ followUps: results });
  } catch (error) {
    console.error("Follow-ups fetch error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(request);
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await request.json();

    if (!body.leadId || !body.scheduledDate) {
      return NextResponse.json(
        { error: "Lead ID and scheduled date are required" },
        { status: 400 }
      );
    }

    const [followUp] = await db
      .insert(followUps)
      .values({
        userId: authUser.id,
        leadId: body.leadId,
        callId: body.callId || null,
        scheduledDate: new Date(body.scheduledDate),
        notes: body.notes || "",
        leadStatus: body.leadStatus || "Follow Up",
        isCompleted: false,
      })
      .returning();

    return NextResponse.json({ followUp }, { status: 201 });
  } catch (error) {
    console.error("Follow-up create error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
