import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { notifications } from "@/db/schema";
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
      .from(notifications)
      .where(eq(notifications.userId, authUser.id))
      .orderBy(desc(notifications.createdAt))
      .limit(50);
    return NextResponse.json({ notifications: results });
  } catch (error) {
    console.error("Notifications fetch error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(request);
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Mark all as read
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.userId, authUser.id));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Notifications update error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
