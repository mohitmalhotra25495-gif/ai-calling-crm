import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  integer,
  boolean,
  decimal,
  json,
  uuid,
} from "drizzle-orm/pg-core";

// ───── Users ─────
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).unique().notNull(),
  passwordHash: text("password_hash").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  companyName: varchar("company_name", { length: 255 }).default(""),
  businessLogo: text("business_logo").default(""),
  timezone: varchar("timezone", { length: 100 }).default("UTC"),
  tabblyApiKey: text("tabbly_api_key").default(""),
  tabblyAgentId: varchar("tabbly_agent_id", { length: 255 }).default(""),
  tabblyCampaignId: varchar("tabbly_campaign_id", { length: 255 }).default(""),
  tabblyOrganizationId: varchar("tabbly_organization_id", { length: 255 }).default(""),
  tabblyBaseUrl: text("tabbly_base_url").default(
    "https://www.tabbly.io/dashboard/agents/endpoints"
  ),
  webhookSecret: varchar("webhook_secret", { length: 255 }).default(""),
  notificationPreferences: json("notification_preferences")
    .$type<{
      emailCallComplete: boolean;
      emailAppointmentBooked: boolean;
      emailFollowUpDue: boolean;
      emailNewLead: boolean;
    }>()
    .default({
      emailCallComplete: true,
      emailAppointmentBooked: true,
      emailFollowUpDue: true,
      emailNewLead: true,
    }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ───── Leads ─────
export const leads = pgTable("leads", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  phoneNumber: varchar("phone_number", { length: 20 }).notNull(),
  company: varchar("company", { length: 255 }).default(""),
  email: varchar("email", { length: 255 }).default(""),
  source: varchar("source", { length: 100 }).default("Manual"),
  status: varchar("status", { length: 30 })
    .default("New")
    .notNull(),
  notes: text("notes").default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ───── AI Agents ─────
export const agents = pgTable("agents", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  agentName: varchar("agent_name", { length: 255 }).notNull(),
  voice: varchar("voice", { length: 100 }).default("Default"),
  language: varchar("language", { length: 100 }).default("English"),
  prompt: text("prompt").default(""),
  businessType: varchar("business_type", { length: 255 }).default(""),
  workingHoursStart: varchar("working_hours_start", { length: 10 }).default(
    "09:00"
  ),
  workingHoursEnd: varchar("working_hours_end", { length: 10 }).default(
    "18:00"
  ),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ───── Calls ─────
export const calls = pgTable("calls", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  leadId: uuid("lead_id")
    .references(() => leads.id, { onDelete: "set null" }),
  agentId: uuid("agent_id")
    .references(() => agents.id, { onDelete: "set null" }),
  agentName: varchar("agent_name", { length: 255 }).default("AI Agent"),
  externalCallId: varchar("external_call_id", { length: 255 }).default(""),
  retryCount: integer("retry_count").default(0),
  customerName: varchar("customer_name", { length: 255 }).notNull(),
  phoneNumber: varchar("phone_number", { length: 20 }).notNull(),
  callDuration: integer("call_duration").default(0), // in seconds
  callStatus: varchar("call_status", { length: 30 }).default("Completed"),
  leadStatus: varchar("lead_status", { length: 30 }).default("New"),
  sentiment: varchar("sentiment", { length: 50 }).default("Neutral"),
  summary: text("summary").default(""),
  interestScore: integer("interest_score").default(0),
  buyingIntent: varchar("buying_intent", { length: 100 }).default("Unknown"),
  nextBestAction: text("next_best_action").default(""),
  followUpSuggestion: text("follow_up_suggestion").default(""),
  callTime: timestamp("call_time").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ───── Call Recordings ─────
export const callRecordings = pgTable("call_recordings", {
  id: uuid("id").primaryKey().defaultRandom(),
  callId: uuid("call_id")
    .references(() => calls.id, { onDelete: "cascade" })
    .notNull(),
  recordingUrl: text("recording_url").notNull(),
  duration: integer("duration").default(0),
  fileSize: integer("file_size").default(0),
  format: varchar("format", { length: 20 }).default("mp3"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ───── Transcripts ─────
export const transcripts = pgTable("transcripts", {
  id: uuid("id").primaryKey().defaultRandom(),
  callId: uuid("call_id")
    .references(() => calls.id, { onDelete: "cascade" })
    .notNull(),
  messages: json("messages")
    .$type<{ speaker: string; text: string; timestamp: string }[]>()
    .notNull(),
  fullText: text("full_text").default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ───── Follow-ups ─────
export const followUps = pgTable("follow_ups", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  leadId: uuid("lead_id")
    .references(() => leads.id, { onDelete: "cascade" })
    .notNull(),
  callId: uuid("call_id")
    .references(() => calls.id, { onDelete: "set null" }),
  scheduledDate: timestamp("scheduled_date").notNull(),
  notes: text("notes").default(""),
  leadStatus: varchar("lead_status", { length: 30 }).default("Follow Up"),
  isCompleted: boolean("is_completed").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ───── Appointments ─────
export const appointments = pgTable("appointments", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  leadId: uuid("lead_id")
    .references(() => leads.id, { onDelete: "cascade" })
    .notNull(),
  callId: uuid("call_id")
    .references(() => calls.id, { onDelete: "set null" }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").default(""),
  scheduledAt: timestamp("scheduled_at").notNull(),
  status: varchar("status", { length: 30 }).default("Scheduled"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ───── Notifications ─────
export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  type: varchar("type", { length: 50 }).default("info"), // call_complete, appointment_booked, follow_up_due, new_lead
  isRead: boolean("is_read").default(false),
  relatedId: uuid("related_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
