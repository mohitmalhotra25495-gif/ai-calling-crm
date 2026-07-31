import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { leads } from "@/db/schema";
import { getAuthUserFromRequest } from "@/lib/auth";
import { eq, and } from "drizzle-orm";

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
    const results = await db
      .select()
      .from(leads)
      .where(and(eq(leads.id, id), eq(leads.userId, authUser.id)))
      .limit(1);

    if (results.length === 0) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    return NextResponse.json({ lead: results[0] });
  } catch (error) {
    console.error("Lead fetch error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

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
      .from(leads)
      .where(and(eq(leads.id, id), eq(leads.userId, authUser.id)))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const [updated] = await db
      .update(leads)
      .set({
        name: body.name ?? existing[0].name,
        phoneNumber: body.phoneNumber ?? existing[0].phoneNumber,
        company: body.company ?? existing[0].company,
        email: body.email ?? existing[0].email,
        source: body.source ?? existing[0].source,
        status: body.status ?? existing[0].status,
        notes: body.notes ?? existing[0].notes,
        updatedAt: new Date(),
      })
      .where(eq(leads.id, id))
      .returning();

    return NextResponse.json({ lead: updated });
  } catch (error) {
    console.error("Lead update error:", error);
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
      .delete(leads)
      .where(and(eq(leads.id, id), eq(leads.userId, authUser.id)));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Lead delete error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
