import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { leads, calls, notifications } from "@/db/schema";
import { getAuthUserFromRequest } from "@/lib/auth";
import { eq, desc, and, or, like, sql, inArray } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(request);
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const source = searchParams.get("source") || "";
    const offset = (page - 1) * limit;

    const conditions = [eq(leads.userId, authUser.id)];

    if (search) {
      conditions.push(
        or(
          like(leads.name, `%${search}%`),
          like(leads.phoneNumber, `%${search}%`),
          like(leads.company, `%${search}%`),
          like(leads.email, `%${search}%`)
        )!
      );
    }

    if (status) {
      conditions.push(eq(leads.status, status));
    }

    if (source) {
      conditions.push(eq(leads.source, source));
    }

    const whereClause = and(...conditions)!;

    const totalCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(leads)
      .where(whereClause);

    const total = Number(totalCount[0]?.count || 0);

    const results = await db
      .select()
      .from(leads)
      .where(whereClause)
      .orderBy(desc(leads.createdAt))
      .limit(limit)
      .offset(offset);

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

    // Fetch latest call per lead (for Last Call / Last Summary / live status)
    const leadIds = results.map((l) => l.id);
    const lastCallMap: Record<string, any> = {};
    if (leadIds.length > 0) {
      const recentCalls = await db
        .select({
          id: calls.id,
          leadId: calls.leadId,
          callStatus: calls.callStatus,
          sentiment: calls.sentiment,
          summary: calls.summary,
          callTime: calls.callTime,
          callDuration: calls.callDuration,
        })
        .from(calls)
        .where(and(eq(calls.userId, authUser.id), inArray(calls.leadId, leadIds)))
        .orderBy(desc(calls.callTime));
      for (const c of recentCalls) {
        if (c.leadId && !lastCallMap[c.leadId]) {
          lastCallMap[c.leadId] = c;
        }
      }
    }

    const leadsWithCalls = results.map((l) => ({
      ...l,
      lastCall: lastCallMap[l.id] || null,
    }));

    return NextResponse.json({
      leads: leadsWithCalls,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Leads fetch error:", error);
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

    if (!body.name || !body.phoneNumber) {
      return NextResponse.json(
        { error: "Name and phone number are required" },
        { status: 400 }
      );
    }

    const [lead] = await db
      .insert(leads)
      .values({
        userId: authUser.id,
        name: body.name,
        phoneNumber: body.phoneNumber,
        company: body.company || "",
        email: body.email || "",
        source: body.source || "Manual",
        status: body.status || "New",
        notes: body.notes || "",
      })
      .returning();

    // Create notification for new lead
    await db.insert(notifications).values({
      userId: authUser.id,
      title: "New Lead Added",
      message: `${lead.name} has been added as a new lead.`,
      type: "new_lead",
      relatedId: lead.id,
    });

    return NextResponse.json({ lead }, { status: 201 });
  } catch (error) {
    console.error("Lead create error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
