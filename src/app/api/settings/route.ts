import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getAuthUserFromRequest } from "@/lib/auth";
import { eq } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(request);
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const results = await db
      .select()
      .from(users)
      .where(eq(users.id, authUser.id))
      .limit(1);

    if (results.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const user = results[0];
    return NextResponse.json({
      settings: {
        companyName: user.companyName,
        businessLogo: user.businessLogo,
        timezone: user.timezone,
        notificationPreferences: user.notificationPreferences,
        tabblyAgentId: user.tabblyAgentId || "",
        tabblyOrganizationId: user.tabblyOrganizationId || "",
        tabblyBaseUrl: user.tabblyBaseUrl || "https://www.tabbly.io/dashboard/agents/endpoints",
        webhookSecret: user.webhookSecret || "",
        // Never send the full API key to frontend - only a masked hint
        tabblyApiKeySet: !!user.tabblyApiKey,
        tabblyApiKeyHint: user.tabblyApiKey
          ? `${user.tabblyApiKey.slice(0, 4)}...${user.tabblyApiKey.slice(-4)}`
          : "",
      },
    });
  } catch (error) {
    console.error("Settings fetch error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(request);
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await request.json();

    const updateData: Record<string, any> = {};
    if (body.companyName !== undefined) updateData.companyName = body.companyName;
    if (body.businessLogo !== undefined) updateData.businessLogo = body.businessLogo;
    if (body.timezone !== undefined) updateData.timezone = body.timezone;
    if (body.notificationPreferences !== undefined)
      updateData.notificationPreferences = body.notificationPreferences;
    // Tabbly integration settings (API key stored server-side only)
    if (body.tabblyApiKey !== undefined && body.tabblyApiKey !== "")
      updateData.tabblyApiKey = body.tabblyApiKey;
    if (body.tabblyAgentId !== undefined)
      updateData.tabblyAgentId = body.tabblyAgentId;
    if (body.tabblyOrganizationId !== undefined)
      updateData.tabblyOrganizationId = body.tabblyOrganizationId;
    if (body.tabblyBaseUrl !== undefined)
      updateData.tabblyBaseUrl = body.tabblyBaseUrl;
    if (body.webhookSecret !== undefined)
      updateData.webhookSecret = body.webhookSecret;

    const [updated] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, authUser.id))
      .returning();

    return NextResponse.json({
      settings: {
        companyName: updated.companyName,
        businessLogo: updated.businessLogo,
        timezone: updated.timezone,
        notificationPreferences: updated.notificationPreferences,
        tabblyAgentId: updated.tabblyAgentId || "",
        tabblyOrganizationId: updated.tabblyOrganizationId || "",
        tabblyBaseUrl: updated.tabblyBaseUrl || "",
        webhookSecret: updated.webhookSecret || "",
        tabblyApiKeySet: !!updated.tabblyApiKey,
        tabblyApiKeyHint: updated.tabblyApiKey
          ? `${updated.tabblyApiKey.slice(0, 4)}...${updated.tabblyApiKey.slice(-4)}`
          : "",
      },
    });
  } catch (error) {
    console.error("Settings update error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
