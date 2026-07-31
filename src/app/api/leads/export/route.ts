import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { leads } from "@/db/schema";
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
      .from(leads)
      .where(eq(leads.userId, authUser.id))
      .orderBy(leads.createdAt);

    const headers = [
      "Name",
      "Phone Number",
      "Company",
      "Email",
      "Source",
      "Status",
      "Notes",
      "Created At",
    ];

    const csvRows = [headers.join(",")];
    for (const lead of results) {
      csvRows.push(
        [
          escapeCsv(lead.name),
          escapeCsv(lead.phoneNumber),
          escapeCsv(lead.company || ""),
          escapeCsv(lead.email || ""),
          escapeCsv(lead.source || ""),
          escapeCsv(lead.status),
          escapeCsv(lead.notes || ""),
          escapeCsv(lead.createdAt?.toISOString() || ""),
        ].join(",")
      );
    }

    const csv = csvRows.join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="leads-export-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error("Leads export error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
