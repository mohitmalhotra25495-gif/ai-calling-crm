-- 🚀 Neon Database Schema Setup
-- Ye SQL Neon Dashboard > SQL Editor mein paste karo agar drizzle-kit push fail kare

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name VARCHAR(255) NOT NULL,
  company_name VARCHAR(255) DEFAULT '',
  business_logo TEXT DEFAULT '',
  timezone VARCHAR(100) DEFAULT 'UTC',
  notification_preferences JSONB DEFAULT '{"emailCallComplete":true,"emailAppointmentBooked":true,"emailFollowUpDue":true,"emailNewLead":true}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Leads table
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(255) NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  company VARCHAR(255) DEFAULT '',
  email VARCHAR(255) DEFAULT '',
  source VARCHAR(100) DEFAULT 'Manual',
  status VARCHAR(30) DEFAULT 'New' NOT NULL,
  notes TEXT DEFAULT '',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- AI Agents table
CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  agent_name VARCHAR(255) NOT NULL,
  voice VARCHAR(100) DEFAULT 'Default',
  language VARCHAR(100) DEFAULT 'English',
  prompt TEXT DEFAULT '',
  business_type VARCHAR(255) DEFAULT '',
  working_hours_start VARCHAR(10) DEFAULT '09:00',
  working_hours_end VARCHAR(10) DEFAULT '18:00',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Calls table
CREATE TABLE IF NOT EXISTS calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  agent_name VARCHAR(255) DEFAULT 'AI Agent',
  customer_name VARCHAR(255) NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  call_duration INTEGER DEFAULT 0,
  call_status VARCHAR(30) DEFAULT 'Completed',
  lead_status VARCHAR(30) DEFAULT 'New',
  sentiment VARCHAR(50) DEFAULT 'Neutral',
  summary TEXT DEFAULT '',
  interest_score INTEGER DEFAULT 0,
  buying_intent VARCHAR(100) DEFAULT 'Unknown',
  next_best_action TEXT DEFAULT '',
  follow_up_suggestion TEXT DEFAULT '',
  call_time TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Call Recordings table
CREATE TABLE IF NOT EXISTS call_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID REFERENCES calls(id) ON DELETE CASCADE NOT NULL,
  recording_url TEXT NOT NULL,
  duration INTEGER DEFAULT 0,
  file_size INTEGER DEFAULT 0,
  format VARCHAR(20) DEFAULT 'mp3',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Transcripts table
CREATE TABLE IF NOT EXISTS transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID REFERENCES calls(id) ON DELETE CASCADE NOT NULL,
  messages JSONB NOT NULL DEFAULT '[]',
  full_text TEXT DEFAULT '',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Follow-ups table
CREATE TABLE IF NOT EXISTS follow_ups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE NOT NULL,
  call_id UUID REFERENCES calls(id) ON DELETE SET NULL,
  scheduled_date TIMESTAMP NOT NULL,
  notes TEXT DEFAULT '',
  lead_status VARCHAR(30) DEFAULT 'Follow Up',
  is_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Appointments table
CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE NOT NULL,
  call_id UUID REFERENCES calls(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT DEFAULT '',
  scheduled_at TIMESTAMP NOT NULL,
  status VARCHAR(30) DEFAULT 'Scheduled',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(50) DEFAULT 'info',
  is_read BOOLEAN DEFAULT false,
  related_id UUID,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_leads_user_id ON leads(user_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_calls_user_id ON calls(user_id);
CREATE INDEX IF NOT EXISTS idx_calls_call_time ON calls(call_time);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_user_id ON follow_ups(user_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_scheduled_date ON follow_ups(scheduled_date);

-- Migration for existing databases (safe to run multiple times)
ALTER TABLE calls ADD COLUMN IF NOT EXISTS agent_name VARCHAR(255) DEFAULT 'AI Agent';
ALTER TABLE calls ADD COLUMN IF NOT EXISTS external_call_id VARCHAR(255) DEFAULT '';
ALTER TABLE calls ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS tabbly_api_key TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS tabbly_agent_id VARCHAR(255) DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS tabbly_base_url TEXT DEFAULT 'https://www.tabbly.io/dashboard/agents/endpoints';
ALTER TABLE users ADD COLUMN IF NOT EXISTS tabbly_campaign_id VARCHAR(255) DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS webhook_secret VARCHAR(255) DEFAULT '';
-- Fix old wrong Tabbly base URL
UPDATE users SET tabbly_base_url = 'https://www.tabbly.io/dashboard/agents/endpoints'
WHERE tabbly_base_url = 'https://api.tabbly.ai/v1' OR tabbly_base_url IS NULL OR tabbly_base_url = '';

-- Done!
SELECT '✅ All tables created successfully!' as result;
ALTER TABLE users ADD COLUMN IF NOT EXISTS tabbly_organization_id VARCHAR(255) DEFAULT '';
