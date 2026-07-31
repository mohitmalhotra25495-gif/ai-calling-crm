import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  calls,
  leads,
  transcripts,
  callRecordings,
  appointments,
  notifications,
  users,
} from "@/db/schema";
import { eq, and, or } from "drizzle-orm";

/**
 * POST /api/webhooks/tabbly
 * Public webhook endpoint - Tabbly sends completed call data here.
 * Configure in Tabbly dashboard: https://YOUR-APP.vercel.app/api/webhooks/tabbly
 *
 * Expected payload (flexible - handles common field names):
 * {
 *   call_id / id: external call id,
 *   lead_id: crm lead id (from metadata),
 *   metadata: { crm_call_id, crm_user_id },
 *   status: completed | failed | busy | no_answer | cancelled,
 *   duration: seconds,
 *   transcript: [{ speaker/role, text/content, timestamp }] or string,
 *   summary: string,
 *   recording_url: string,
 *   sentiment: string,
 *   follow_up: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Optional webhook secret verification
    const secretHeader =
      request.headers.get("x-webhook-secret") ||
      request.headers.get("x-tabbly-secret") ||
      "";

    const externalCallId = body.call_id || body.id || body.callId || "";
    const crmCallId = body.metadata?.crm_call_id || body.crm_call_id || "";
    const leadId = body.lead_id || body.leadId || body.metadata?.lead_id || "";

    // Find the call record
    const conditions = [];
    if (crmCallId) conditions.push(eq(calls.id, crmCallId));
    if (externalCallId) conditions.push(eq(calls.externalCallId, externalCallId));

    if (conditions.length === 0) {
      return NextResponse.json(
        { error: "No call identifier in payload" },
        { status: 400 }
      );
    }

    const callResults = await db
      .select()
      .from(calls)
      .where(or(...conditions))
      .limit(1);

    if (callResults.length === 0) {
      return NextResponse.json({ error: "Call not found" }, { status: 404 });
    }
    const call = callResults[0];

    // Verify webhook secret if user has one configured
    const userResults = await db
      .select()
      .from(users)
      .where(eq(users.id, call.userId))
      .limit(1);
    const user = userResults[0];
    if (user?.webhookSecret && user.webhookSecret !== secretHeader) {
      return NextResponse.json({ error: "Invalid webhook secret" }, { status: 401 });
    }

    // Map status
    const rawStatus = String(body.status || "completed").toLowerCase();
    const statusMap: Record<string, string> = {
      completed: "Completed",
      complete: "Completed",
      answered: "Completed",
      failed: "Failed",
      busy: "Busy",
      no_answer: "No Answer",
      "no-answer": "No Answer",
      noanswer: "No Answer",
      cancelled: "Cancelled",
      canceled: "Cancelled",
      ringing: "Ringing",
      connected: "Connected",
      calling: "Calling",
      in_progress: "Connected",
    };
    const callStatus = statusMap[rawStatus] || "Completed";

    // Map sentiment to lead status
    const sentiment = body.sentiment || body.analysis?.sentiment || "";
    const sentimentToLeadStatus: Record<string, string> = {
      interested: "Interested",
      "not interested": "Not Interested",
      not_interested: "Not Interested",
      callback: "Follow Up",
      "appointment booked": "Appointment Booked",
      appointment_booked: "Appointment Booked",
    };
    const newLeadStatus: string =
      sentimentToLeadStatus[String(sentiment).toLowerCase()] ||
      call.leadStatus ||
      "Contacted";

    const duration = Number(body.duration || body.call_duration || 0);
    const summary = body.summary || body.ai_summary || body.analysis?.summary || "";
    const recordingUrl = body.recording_url || body.recordingUrl || body.recording || "";
    const followUp = body.follow_up || body.followUp || body.follow_up_recommendation || "";

    // 1. Update call record
    await db
      .update(calls)
      .set({
        callStatus,
        callDuration: duration,
        sentiment: sentiment || call.sentiment,
        summary: summary || call.summary,
        leadStatus: newLeadStatus || undefined,
        followUpSuggestion: followUp || call.followUpSuggestion || "",
        externalCallId: externalCallId || call.externalCallId || "",
      })
      .where(eq(calls.id, call.id));

    // 2. Save transcript
    if (body.transcript) {
      let messages: { speaker: string; text: string; timestamp: string }[] = [];
      if (Array.isArray(body.transcript)) {
        messages = body.transcript.map((m: any) => ({
          speaker:
            m.speaker || (m.role === "assistant" || m.role === "agent" ? "AI" : "Customer"),
          text: m.text || m.content || m.message || "",
          timestamp: m.timestamp || m.time || "",
        }));
      } else if (typeof body.transcript === "string") {
        messages = body.transcript
          .split("\n")
          .filter((l: string) => l.trim())
          .map((line: string) => {
            const [speaker, ...rest] = line.split(":");
            return {
              speaker: speaker.trim().toLowerCase().includes("ai") || speaker.trim().toLowerCase().includes("agent") ? "AI" : "Customer",
              text: rest.join(":").trim(),
              timestamp: "",
            };
          });
      }
      if (messages.length > 0) {
        await db.insert(transcripts).values({
          callId: call.id,
          messages,
          fullText: messages.map((m) => `${m.speaker}: ${m.text}`).join("\n"),
        });
      }
    }

    // 3. Save recording
    if (recordingUrl) {
      await db.insert(callRecordings).values({
        callId: call.id,
        recordingUrl,
        duration,
        format: "mp3",
      });
    }

    // 4. Update lead status
    if (call.leadId && newLeadStatus && newLeadStatus !== call.leadStatus) {
      await db
        .update(leads)
        .set({ status: newLeadStatus, updatedAt: new Date() })
        .where(eq(leads.id, call.leadId));
    }

    // 5. Create appointment if booked
    if (newLeadStatus === "Appointment Booked" && call.leadId) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(11, 0, 0, 0);
      await db.insert(appointments).values({
        userId: call.userId,
        leadId: call.leadId,
        callId: call.id,
        title: `Appointment with ${call.customerName}`,
        description: "Booked by Tabbly AI agent during call.",
        scheduledAt: body.appointment_time ? new Date(body.appointment_time) : tomorrow,
        status: "Scheduled",
      });
      await db.insert(notifications).values({
        userId: call.userId,
        title: "Appointment Booked! 🎉",
        message: `AI agent booked an appointment with ${call.customerName}.`,
        type: "appointment_booked",
        relatedId: call.id,
      });
    }

    // 6. Call complete notification
    await db.insert(notifications).values({
      userId: call.userId,
      title: `Call ${callStatus} ✅`,
      message: `AI call with ${call.customerName} — ${callStatus}${sentiment ? `, Sentiment: ${sentiment}` : ""}`,
      type: "call_complete",
      relatedId: call.id,
    });

    return NextResponse.json({ success: true, callId: call.id });
  } catch (error) {
    console.error("Tabbly webhook error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Health check for webhook URL verification
export async function GET() {
  return NextResponse.json({ status: "Tabbly webhook endpoint active" });
}
