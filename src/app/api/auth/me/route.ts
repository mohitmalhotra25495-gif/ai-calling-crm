import { NextRequest, NextResponse } from "next/server";
import { getAuthUserFromRequest, getFullUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(request);
    if (!authUser) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const fullUser = await getFullUser(authUser.id);
    if (!fullUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    return NextResponse.json({
      user: {
        id: fullUser.id,
        email: fullUser.email,
        name: fullUser.name,
        companyName: fullUser.companyName,
        businessLogo: fullUser.businessLogo,
        timezone: fullUser.timezone,
        notificationPreferences: fullUser.notificationPreferences,
      },
    });
  } catch (error) {
    console.error("Auth me error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
