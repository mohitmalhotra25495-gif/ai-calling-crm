import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { calls, leads } from "@/db/schema";
import { getAuthUserFromRequest } from "@/lib/auth";
import { eq, desc, and, or, like, sql } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(request);
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const search = searchParams.get("search") || "";
    const offset = (page - 1) * limit;

    // Safety net: expire only if NO Tabbly result after 15 min (Connected never expired here)
    await db
      .update(calls)
      .set({
        callStatus: "No Answer",
        summary: sql`COALESCE(${calls.summary}, '') || ' [Auto-expired: no Tabbly result within 15 minutes — call was likely never dialed]'`,
      })
      .where(
        and(
          eq(calls.userId, authUser.id),
          sql`${calls.callStatus} IN ('Pending', 'Calling', 'Ringing')`,
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
          sql`${calls.callStatus} = 'Connected'`,
          sql`${calls.callTime} < NOW() - INTERVAL '60 minutes'`
        )
      );

    const conditions = [eq(calls.userId, authUser.id)];

    if (search) {
      conditions.push(
        or(
          like(calls.customerName, `%${search}%`),
          like(calls.phoneNumber, `%${search}%`)
        )!
      );
    }

    const whereClause = and(...conditions)!;

    const totalCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(calls)
      .where(whereClause);

    const total = Number(totalCount[0]?.count || 0);

    const results = await db
      .select()
      .from(calls)
      .where(whereClause)
      .orderBy(desc(calls.callTime))
      .limit(limit)
      .offset(offset);

    return NextResponse.json({
      calls: results,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Calls fetch error:", error);
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

    if (!body.customerName || !body.phoneNumber) {
      return NextResponse.json(
        { error: "Customer name and phone number are required" },
        { status: 400 }
      );
    }

    const [call] = await db
      .insert(calls)
      .values({
        userId: authUser.id,
        leadId: body.leadId || null,
        agentId: body.agentId || null,
        customerName: body.customerName,
        phoneNumber: body.phoneNumber,
        callDuration: body.callDuration || 0,
        callStatus: body.callStatus || "Completed",
        leadStatus: body.leadStatus || "New",
        sentiment: body.sentiment || "Neutral",
        summary: body.summary || "",
        interestScore: body.interestScore || 0,
        buyingIntent: body.buyingIntent || "Unknown",
        nextBestAction: body.nextBestAction || "",
        followUpSuggestion: body.followUpSuggestion || "",
        callTime: body.callTime ? new Date(body.callTime) : new Date(),
      })
      .returning();

    return NextResponse.json({ call }, { status: 201 });
  } catch (error) {
    console.error("Call create error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
