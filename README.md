# 🤖 AI Calling CRM

A premium, production-ready AI-powered Calling CRM built with Next.js 16, PostgreSQL (Drizzle ORM), and Tailwind CSS 4.

## ✨ Features

- **Authentication** - Login, Signup, JWT-based secure auth
- **Dashboard** - KPI cards, Recent Calls, Recent Leads
- **Leads Module** - CRUD, Search, Filters, Pagination, CSV Export
- **AI Call History** - Detailed call logs with transcript, recording, AI analysis
- **Analytics** - Charts (bar, pie, donut), KPIs, Conversion tracking
- **Settings** - Company info, Timezone, Notification preferences
- **Dark/Light Mode** - Smooth toggle with persistence

## 🚀 Deploy to Vercel (2 min)

### Option 1: Automated (recommended)

```bash
# Ek baar mein sab ho jayega
./deploy.sh
```

### Option 2: Manual

**Step 1: Free PostgreSQL Database**
1. [Neon](https://neon.tech) par jao (free PostgreSQL)
2. Sign up → New Project → `ai-calling-crm`
3. Database create hone ke baad `DATABASE_URL` copy karo
4. URL kuch aisa hoga: `postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/dbname?sslmode=require`

**Step 2: Vercel Deploy**
```bash
# Login to Vercel
npx vercel login

# Deploy (DATABASE_URL with the Neon URL)
npx vercel deploy \
  --yes \
  --env DATABASE_URL="postgresql://..." \
  --env JWT_SECRET="your-random-secret-key" \
  --build-env DATABASE_URL="postgresql://..."
```

**Step 3: Database Schema Push**
```bash
# Vercel deploy ke baad, local machine se:
npx drizzle-kit push
```

Ya fir Vercel Dashboard > Settings > Environment Variables mein daalo:
- `DATABASE_URL`
- `JWT_SECRET`

Phir `drizzle-kit push` Vercel ke build step mein automatically chalega.

### Option 3: GitHub → Vercel

```bash
# 1. GitHub pe repo banao
# 2. Push karo
git remote add origin https://github.com/YOUR_USERNAME/ai-calling-crm.git
git push -u origin main

# 3. Vercel Dashboard: Add New Project > Import GitHub repo
# 4. Environment Variables add karo (DATABASE_URL, JWT_SECRET)
# 5. Deploy click karo
```

## 🛠️ Local Development

```bash
# Install dependencies
npm install

# Set up database
cp .env.example .env
# .env file mein DATABASE_URL daalo

# Push schema
npx drizzle-kit push

# Run dev server
npm run dev
```

## 📁 Project Structure

```
src/
├── app/
│   ├── api/           # API routes (auth, leads, calls, etc.)
│   ├── analytics/     # Analytics page
│   ├── calls/         # Call history pages
│   ├── dashboard/     # Dashboard page
│   ├── leads/         # Leads management
│   ├── login/         # Login page
│   ├── settings/      # Settings page
│   ├── signup/        # Signup page
│   ├── globals.css    # Global styles
│   ├── layout.tsx     # Root layout
│   └── page.tsx       # Home (redirects to dashboard)
├── components/        # Reusable components
├── db/               # Database schema & connection
└── lib/              # Utilities & auth
```

## 🔌 Ready for Integrations

Project architecture AI voice providers (Vapi, Bland AI, Twilio), WhatsApp, ElevenLabs, and external APIs ke saath integrate karne ke liye ready hai.
