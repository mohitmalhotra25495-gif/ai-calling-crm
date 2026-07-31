import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { followUps } from "@/db/schema";
import { getAuthUserFromRequest } from "@/lib/auth";
import { eq, and } from "drizzle-orm";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUserFromRequest(request);
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    const body = await request.json();

    const existing = await db
      .select()
      .from(followUps)
      .where(and(eq(followUps.id, id), eq(followUps.userId, authUser.id)))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json({ error: "Follow-up not found" }, { status: 404 });
    }

    const [updated] = await db
      .update(followUps)
      .set({
        scheduledDate: body.scheduledDate ? new Date(body.scheduledDate) : existing[0].scheduledDate,
        notes: body.notes ?? existing[0].notes,
        leadStatus: body.leadStatus ?? existing[0].leadStatus,
        isCompleted: body.isCompleted ?? existing[0].isCompleted,
        updatedAt: new Date(),
      })
      .where(eq(followUps.id, id))
      .returning();

    return NextResponse.json({ followUp: updated });
  } catch (error) {
    console.error("Follow-up update error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUserFromRequest(request);
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    await db
      .delete(followUps)
      .where(and(eq(followUps.id, id), eq(followUps.userId, authUser.id)));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Follow-up delete error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
