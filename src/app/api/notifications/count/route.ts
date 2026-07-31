import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { getAuthUserFromRequest } from "@/lib/auth";
import { eq, and, sql } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(request);
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(
        and(eq(notifications.userId, authUser.id), eq(notifications.isRead, false))
      );
    return NextResponse.json({ count: Number(result[0]?.count || 0) });
  } catch (error) {
    console.error("Notifications count error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
