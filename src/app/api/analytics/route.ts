import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { calls, leads, followUps, appointments } from "@/db/schema";
import { getAuthUserFromRequest } from "@/lib/auth";
import { eq, and, sql, gte, lte } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(request);
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = authUser.id;
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    // Total calls
    const totalCallsResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(calls)
      .where(eq(calls.userId, userId));
    const totalCalls = Number(totalCallsResult[0]?.count || 0);

    // Calls today
    const callsTodayResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(calls)
      .where(
        and(
          eq(calls.userId, userId),
          gte(calls.callTime, todayStart),
          lte(calls.callTime, todayEnd)
        )
      );
    const callsToday = Number(callsTodayResult[0]?.count || 0);

    // Connected calls (Answered or Completed)
    const connectedCallsResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(calls)
      .where(
        and(
          eq(calls.userId, userId),
          sql`${calls.callStatus} IN ('Completed', 'Answered')`
        )
      );
    const connectedCalls = Number(connectedCallsResult[0]?.count || 0);

    // Missed calls
    const missedCallsResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(calls)
      .where(
        and(eq(calls.userId, userId), eq(calls.callStatus, "Missed"))
      );
    const missedCalls = Number(missedCallsResult[0]?.count || 0);

    // Total leads
    const totalLeadsResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(leads)
      .where(eq(leads.userId, userId));
    const totalLeads = Number(totalLeadsResult[0]?.count || 0);

    // Interested leads
    const interestedLeadsResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(leads)
      .where(
        and(eq(leads.userId, userId), eq(leads.status, "Interested"))
      );
    const interestedLeads = Number(interestedLeadsResult[0]?.count || 0);

    // Appointments booked
    const appointmentsResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(appointments)
      .where(eq(appointments.userId, userId));
    const appointmentsBooked = Number(appointmentsResult[0]?.count || 0);

    // Conversion rate
    const conversionRate =
      totalCalls > 0
        ? Math.round((interestedLeads / totalCalls) * 100)
        : 0;

    // Average call duration
    const avgDurationResult = await db
      .select({ avg: sql<number>`avg(${calls.callDuration})` })
      .from(calls)
      .where(eq(calls.userId, userId));
    const avgCallDuration = Math.round(Number(avgDurationResult[0]?.avg || 0));

    // Calls per day (last 7 days)
    const sevenDaysAgo = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);
    const callsPerDayResult = await db
      .select({
        date: sql<string>`DATE(${calls.callTime})`,
        count: sql<number>`count(*)`,
      })
      .from(calls)
      .where(
        and(
          eq(calls.userId, userId),
          gte(calls.callTime, sevenDaysAgo)
        )
      )
      .groupBy(sql`DATE(${calls.callTime})`)
      .orderBy(sql`DATE(${calls.callTime})`);

    // Lead status distribution
    const leadStatusResult = await db
      .select({
        status: leads.status,
        count: sql<number>`count(*)`,
      })
      .from(leads)
      .where(eq(leads.userId, userId))
      .groupBy(leads.status);

    // Call status distribution
    const callStatusResult = await db
      .select({
        status: calls.callStatus,
        count: sql<number>`count(*)`,
      })
      .from(calls)
      .where(eq(calls.userId, userId))
      .groupBy(calls.callStatus);

    // Recent calls
    const recentCalls = await db
      .select()
      .from(calls)
      .where(eq(calls.userId, userId))
      .orderBy(sql`${calls.callTime} DESC`)
      .limit(5);

    // Recent leads
    const recentLeads = await db
      .select()
      .from(leads)
      .where(eq(leads.userId, userId))
      .orderBy(sql`${leads.createdAt} DESC`)
      .limit(5);

    return NextResponse.json({
      kpis: {
        totalCalls,
        callsToday,
        connectedCalls,
        missedCalls,
        totalLeads,
        interestedLeads,
        appointmentsBooked,
        conversionRate,
        avgCallDuration,
      },
      callsPerDay: callsPerDayResult,
      leadStatusDistribution: leadStatusResult,
      callStatusDistribution: callStatusResult,
      recentCalls,
      recentLeads,
    });
  } catch (error) {
    console.error("Analytics error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
