import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  calls,
  leads,
  transcripts,
  callRecordings,
  appointments,
  notifications,
  agents,
} from "@/db/schema";
import { getAuthUserFromRequest } from "@/lib/auth";
import { eq, and } from "drizzle-orm";

const SAMPLE_RECORDING_URL =
  "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3";

interface Scenario {
  callStatus: "Answered" | "Missed" | "Failed" | "Busy";
  sentiment: string;
  leadStatus: string;
  interestScore: number;
  buyingIntent: string;
  summary: (name: string) => string;
  nextBestAction: string;
  followUpSuggestion: string;
  transcript: (name: string, agent: string) => { speaker: string; text: string; timestamp: string }[];
}

const scenarios: Scenario[] = [
  {
    callStatus: "Answered",
    sentiment: "Interested",
    leadStatus: "Interested",
    interestScore: 8,
    buyingIntent: "High",
    summary: (n) =>
      `${n} showed strong interest in the product. They asked about pricing and features, and requested a follow-up with more details. High conversion potential.`,
    nextBestAction: "Send pricing details and schedule a product demo within 24 hours.",
    followUpSuggestion: "Follow up tomorrow with a detailed proposal and demo link.",
    transcript: (n, a) => [
      { speaker: "AI", text: `Hello ${n}, I'm ${a} calling regarding your recent enquiry about our services. Is this a good time to talk?`, timestamp: "00:00" },
      { speaker: "Customer", text: "Yes, tell me more about it.", timestamp: "00:08" },
      { speaker: "AI", text: "Great! We offer AI-powered calling solutions that automate your outreach and follow-ups. Businesses like yours have seen a 3x increase in lead conversions.", timestamp: "00:15" },
      { speaker: "Customer", text: "That sounds interesting. What about the pricing?", timestamp: "00:32" },
      { speaker: "AI", text: "We have flexible plans starting from a basic package. I can send you the complete pricing details on WhatsApp or email. Which would you prefer?", timestamp: "00:40" },
      { speaker: "Customer", text: "Email works for me. Send me the details.", timestamp: "00:55" },
      { speaker: "AI", text: `Perfect ${n}! I'll email you the pricing right away. Would you also like a quick demo call with our specialist this week?`, timestamp: "01:02" },
      { speaker: "Customer", text: "Yes, that would be helpful.", timestamp: "01:15" },
      { speaker: "AI", text: "Wonderful! I'll arrange that and send you a confirmation. Thank you for your time. Have a great day!", timestamp: "01:20" },
    ],
  },
  {
    callStatus: "Answered",
    sentiment: "Appointment Booked",
    leadStatus: "Appointment Booked",
    interestScore: 9,
    buyingIntent: "Very High",
    summary: (n) =>
      `Excellent call! ${n} agreed to book an appointment for a full product demonstration. Appointment has been scheduled. Very high buying intent detected.`,
    nextBestAction: "Prepare demo presentation and confirm appointment 1 hour before.",
    followUpSuggestion: "Send appointment confirmation and calendar invite immediately.",
    transcript: (n, a) => [
      { speaker: "AI", text: `Hello ${n}, this is ${a}. I'm calling about your enquiry regarding our AI calling solution. How are you today?`, timestamp: "00:00" },
      { speaker: "Customer", text: "I'm good, thanks. I was actually waiting for this call.", timestamp: "00:10" },
      { speaker: "AI", text: "That's great to hear! Based on your enquiry, I believe our solution can really help your business scale. Would you like to book an appointment with our specialist?", timestamp: "00:18" },
      { speaker: "Customer", text: "Yes, I'd like that.", timestamp: "00:35" },
      { speaker: "AI", text: "Perfect! How does tomorrow at 11 AM sound?", timestamp: "00:40" },
      { speaker: "Customer", text: "Tomorrow 11 AM works perfectly.", timestamp: "00:48" },
      { speaker: "AI", text: `Excellent ${n}! Your appointment is booked for tomorrow at 11 AM. You'll receive a confirmation shortly. Thank you and see you soon!`, timestamp: "00:55" },
    ],
  },
  {
    callStatus: "Answered",
    sentiment: "Callback",
    leadStatus: "Follow Up",
    interestScore: 6,
    buyingIntent: "Medium",
    summary: (n) =>
      `${n} was busy but showed interest. They requested a callback at a later time. Medium buying intent - worth following up.`,
    nextBestAction: "Schedule a callback at the customer's preferred time.",
    followUpSuggestion: "Call back in the evening around 6 PM as requested by the customer.",
    transcript: (n, a) => [
      { speaker: "AI", text: `Hello ${n}, I'm ${a} calling about your enquiry. Do you have a moment?`, timestamp: "00:00" },
      { speaker: "Customer", text: "I'm actually in a meeting right now.", timestamp: "00:08" },
      { speaker: "AI", text: "No problem at all! When would be a better time to call you back?", timestamp: "00:14" },
      { speaker: "Customer", text: "Maybe in the evening, around 6 PM.", timestamp: "00:20" },
      { speaker: "AI", text: `Perfect, I'll call you back at 6 PM today. Thank you ${n}, talk to you soon!`, timestamp: "00:26" },
    ],
  },
  {
    callStatus: "Answered",
    sentiment: "Not Interested",
    leadStatus: "Not Interested",
    interestScore: 2,
    buyingIntent: "Low",
    summary: (n) =>
      `${n} politely declined the offer. They are not interested at this time. Low priority - may revisit in 3-6 months.`,
    nextBestAction: "Mark as not interested. Add to long-term nurture campaign.",
    followUpSuggestion: "Re-engage after 3 months with a special offer.",
    transcript: (n, a) => [
      { speaker: "AI", text: `Hello ${n}, I'm ${a} calling regarding our AI calling solution for your business.`, timestamp: "00:00" },
      { speaker: "Customer", text: "I'm not really looking for anything like that right now.", timestamp: "00:10" },
      { speaker: "AI", text: "I completely understand. Would it be okay if we reach out in a few months with any special offers?", timestamp: "00:17" },
      { speaker: "Customer", text: "Sure, maybe later. Thanks.", timestamp: "00:26" },
      { speaker: "AI", text: `Thank you for your time ${n}. Have a wonderful day!`, timestamp: "00:30" },
    ],
  },
  {
    callStatus: "Missed",
    sentiment: "Callback",
    leadStatus: "Follow Up",
    interestScore: 0,
    buyingIntent: "Unknown",
    summary: (n) => `Call to ${n} was not answered. Retry recommended at a different time.`,
    nextBestAction: "Retry call after 2 hours or send a WhatsApp message.",
    followUpSuggestion: "Try calling again tomorrow morning between 10-11 AM.",
    transcript: () => [],
  },
  {
    callStatus: "Busy",
    sentiment: "Callback",
    leadStatus: "Follow Up",
    interestScore: 0,
    buyingIntent: "Unknown",
    summary: (n) => `${n}'s line was busy. Auto-retry scheduled.`,
    nextBestAction: "Retry call in 30 minutes.",
    followUpSuggestion: "Attempt callback within the hour.",
    transcript: () => [],
  },
];

export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(request);
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    if (!body.leadId) {
      return NextResponse.json({ error: "leadId is required" }, { status: 400 });
    }

    // Verify lead
    const leadResults = await db
      .select()
      .from(leads)
      .where(and(eq(leads.id, body.leadId), eq(leads.userId, authUser.id)))
      .limit(1);

    if (leadResults.length === 0) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }
    const lead = leadResults[0];

    // Pick an active agent if exists
    const agentResults = await db
      .select()
      .from(agents)
      .where(and(eq(agents.userId, authUser.id), eq(agents.isActive, true)))
      .limit(1);
    const agentName = agentResults[0]?.agentName || "AI Agent Riya";
    const agentId = agentResults[0]?.id || null;

    // Weighted random scenario (answered scenarios more likely)
    const weights = [30, 20, 15, 15, 12, 8];
    const total = weights.reduce((a, b) => a + b, 0);
    let rand = Math.random() * total;
    let idx = 0;
    for (let i = 0; i < weights.length; i++) {
      rand -= weights[i];
      if (rand <= 0) {
        idx = i;
        break;
      }
    }
    const scenario = scenarios[idx];

    const isAnswered = scenario.callStatus === "Answered";
    const duration = isAnswered ? 45 + Math.floor(Math.random() * 150) : 0;

    // 1. Save Call
    const [call] = await db
      .insert(calls)
      .values({
        userId: authUser.id,
        leadId: lead.id,
        agentId,
        agentName,
        customerName: lead.name,
        phoneNumber: lead.phoneNumber,
        callDuration: duration,
        callStatus: scenario.callStatus,
        leadStatus: scenario.leadStatus,
        sentiment: scenario.sentiment,
        summary: scenario.summary(lead.name),
        interestScore: scenario.interestScore,
        buyingIntent: scenario.buyingIntent,
        nextBestAction: scenario.nextBestAction,
        followUpSuggestion: scenario.followUpSuggestion,
        callTime: new Date(),
      })
      .returning();

    // 2. Save Transcript (if answered)
    const messages = scenario.transcript(lead.name, agentName);
    if (messages.length > 0) {
      await db.insert(transcripts).values({
        callId: call.id,
        messages,
        fullText: messages.map((m) => `${m.speaker}: ${m.text}`).join("\n"),
      });
    }

    // 3. Save Recording (if answered)
    if (isAnswered) {
      await db.insert(callRecordings).values({
        callId: call.id,
        recordingUrl: SAMPLE_RECORDING_URL,
        duration,
        format: "mp3",
      });
    }

    // 4. Update Lead Status
    await db
      .update(leads)
      .set({ status: scenario.leadStatus, updatedAt: new Date() })
      .where(eq(leads.id, lead.id));

    // 5. Create Appointment (if booked)
    if (scenario.sentiment === "Appointment Booked") {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(11, 0, 0, 0);
      await db.insert(appointments).values({
        userId: authUser.id,
        leadId: lead.id,
        callId: call.id,
        title: `Demo appointment with ${lead.name}`,
        description: "Product demonstration scheduled by AI agent during call.",
        scheduledAt: tomorrow,
        status: "Scheduled",
      });
      await db.insert(notifications).values({
        userId: authUser.id,
        title: "Appointment Booked! 🎉",
        message: `AI agent booked an appointment with ${lead.name} for tomorrow 11 AM.`,
        type: "appointment_booked",
        relatedId: call.id,
      });
    }

    // 6. Call complete notification
    await db.insert(notifications).values({
      userId: authUser.id,
      title: "AI Call Completed",
      message: `${agentName} called ${lead.name} — Status: ${scenario.callStatus}, Sentiment: ${scenario.sentiment}`,
      type: "call_complete",
      relatedId: call.id,
    });

    return NextResponse.json({ call, success: true }, { status: 201 });
  } catch (error) {
    console.error("Simulate call error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
