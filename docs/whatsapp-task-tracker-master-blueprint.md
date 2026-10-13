# WhatsApp Task Tracker — Master Blueprint (v3)

> **Status:** ✅ **Decisions locked** (14 Oct 2026). Product vision + full SQL schema live here; **day-to-day build checklist is** [`MASTER-EXECUTION-PLAN.md`](./MASTER-EXECUTION-PLAN.md) v1.1.  
> **This document combines:** the [original plan (v2)](./whatsapp-task-tracker-plan.md), the [review & suggested fixes](./plan-review-suggested-changes.md), and **5 premium features** that transform this from a personal tool into a sellable product.

---

## Table of Contents

1. [System Overview (What It Is)](#1-system-overview)
2. [Original Plan Summary — What's Already Decided](#2-original-plan-summary)
3. [Review Fixes — What Must Change Before Building](#3-review-fixes)
4. [💰 Premium Features — What Makes This Sellable](#4-premium-features)
5. [Feature Comparison Matrix](#5-feature-comparison-matrix)
6. [Updated Data Model (All Fixes Applied)](#6-updated-data-model)
7. [Updated API Surface](#7-updated-api-surface)
8. [Pricing Strategy](#8-pricing-strategy)
9. [Revised Build Roadmap](#9-revised-build-roadmap)
10. [Final Decision Checklist](#10-final-decision-checklist)

---

## 1. System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                    WhatsApp Task Tracker                            │
│                                                                     │
│  Admin (web app, PIN login)              Members (any phone)        │
│  ────────────────────────                ───────────────────        │
│  1. Create group + members                                          │
│  2. Create task list / template                                     │
│  3. Tap "Share to WhatsApp" ──────►  WhatsApp delivers message      │
│     (wa.me/?text=...)                  with tracking link           │
│                                              │                      │
│                                              ▼                      │
│                                      4. Member taps link            │
│                                         → picks name → ticks items  │
│                                              │                      │
│  5. Dashboard auto-refreshes  ◄──────────────┘                      │
│  6. Verify / Remind / Export                                        │
└─────────────────────────────────────────────────────────────────────┘
```

**Core idea:** WhatsApp only *carries the message*. All tracking lives on the web app. No WhatsApp API required. No member login required.

---

## 2. Original Plan Summary — What's Already Decided

> [!NOTE]
> Full details are in the [original plan](file:///d:/WhatsApp-Task-Tracker/docs/whatsapp-task-tracker-plan.md). This section is a quick reference.

### Stack
| Component | Choice |
|---|---|
| Framework | Next.js (App Router) |
| Hosting | Vercel (Hobby → Pro when selling) |
| Database | Supabase Postgres (server-side only) |
| Auth | Custom 6-digit PIN, bcrypt + JWT (30-day session) |
| Realtime | SWR polling every ~15s |
| WhatsApp | `wa.me/?text=` links (free, official) |

### Features (Original Phases)

| Phase | Features |
|---|---|
| **Phase 1 — MVP** | PIN login, groups/members, task lists, share to WhatsApp, member tick page, dashboard, CSV export |
| **Phase 2 — Comfort** | Templates, duplicate/clone, paste-to-split, recurring lists, reminders, opened-by tracking, PWA |
| **Phase 3 — Power** | Per-member assignment, photo proof, analytics, email digest, push notifications, co-admin, passkeys, AI helpers |

### Key Architecture Decisions
- Browser **never** talks to Supabase directly (service-role key stays server-side)
- RLS enabled on all tables with **no public policies**
- Keep-alive cron prevents Supabase free-tier pause
- Member access via unguessable `nanoid` tokens, no login

---

## 3. Review Fixes — What Must Change Before Building

> [!IMPORTANT]
> These are the 30 issues found during plan review. They are grouped by priority. All should be addressed in the final plan before coding starts.

### 🔴 Critical (Block building if not fixed)

| # | Issue | Fix |
|---|---|---|
| 1 | **No database indexes** — dashboard queries will crawl | Add indexes on all foreign keys and common query paths (see §6) |
| 2 | **Duplicate completions allowed** — a member can tick the same item 100 times | Add `UNIQUE(task_item_id, member_id)` constraint on `completions` |
| 3 | **No `updated_at` on admin table** — can't track PIN changes | Add `updated_at timestamptz` + `session_version int` |
| 4 | **Rate-limit table grows forever** — `login_attempts` never cleaned up | Delete old rows in the daily keep-alive cron |
| 5 | **`wa.me` URL length misunderstand** — emojis + encoding can 3× the URL length | Add encoded-URL-length counter to share preview, warn at limit |
| 6 | **No JWT revocation** — stolen phone = unrevokable 30-day session | Add `session_version` to admin table and JWT payload; increment on PIN change |

### 🟡 Gaps (Must address before launch)

| # | Issue | Fix |
|---|---|---|
| 7 | No `updated_at` on most tables | Add to `groups`, `members`, `task_lists`, `task_items`, `templates` |
| 8 | No soft delete — CASCADE deletes wipe history | Add `deleted_at` to `groups`, `members`, `task_lists`; filter with `WHERE deleted_at IS NULL` |
| 9 | Member page API response shape undefined | Define response with `status: active/readonly/expired` field |
| 10 | No error handling strategy | Standard error format, toast system, error boundaries, retry logic |
| 11 | No input validation | Use **Zod** for all API validation; define max lengths; sanitize inputs |
| 12 | Dashboard query performance on free tier | Add indexes (issue #1), consider `daily_stats` summary table |
| 13 | No CSRF protection | Verify `Origin` header in middleware for state-changing requests |
| 14 | `opens` table bloat — every refresh = new row | `UNIQUE(task_list_id, member_id)` + `ON CONFLICT UPDATE` |
| 15 | Template JSONB body has no defined schema | Document: checklist = `{items, due_offset}`, message = `{text, placeholders}` |
| 16 | Multi-device sessions undocumented | Document that multiple sessions coexist; add session table in Phase 3 |

### 🟢 Enhancements (Include during build)

| # | Issue | Fix |
|---|---|---|
| 17 | No `created_by` for multi-admin prep | Add `created_by uuid` to `groups`, `task_lists`, `templates` |
| 18 | No group sort order | Add `sort_order int` to `groups` |
| 19 | Item status requires JOIN to check | Denormalize: add `status`, `completed_by`, `completed_at`, `verified_at` to `task_items` |
| 20 | Day 1 roadmap is overloaded | Split Day 1 into setup + deploy over 2 days |
| 21 | No API pagination | Add `?page=&limit=` to all list endpoints |
| 22 | No empty/loading states in UI | Design empty states with CTAs + skeleton loaders |
| 23 | Hardcoded 7 number emojis | Extend to 10: `1️⃣` through `🔟` |
| 24 | No health check endpoint | Add `GET /api/health` |
| 25 | No timezone handling | Store `timezone` in admin table; display all times in professor's zone |
| 26 | No `task_lists.status` field | Add `status: draft/active/completed/archived` |
| 27 | No concurrency strategy for member page | Optimistic UI + SWR revalidation + DB unique constraints |
| 28 | No data retention policy | Auto-archive lists older than 90 days; CSV export before purge |
| 29 | `share_log` missing channel info | Add `channel: whatsapp_group/whatsapp_individual/copy/native_share` |
| 30 | No accessibility plan | Semantic HTML, ARIA labels, keyboard nav, contrast ratios |

---

## 4. 💰 Premium Features — What Makes This Sellable

> [!TIP]
> These 5 features are what turn a free personal tool into a product clients will pay for. Each is designed to bolt onto the existing system **without** changing the core simplicity. Read all 5, then decide which ones to include.

---

### 💰 Feature A — Multi-Tenant SaaS Platform ⭐ RECOMMENDED

> **The single most important feature for making money. Without this, you can only sell one copy at a time.**

**What it is:** Instead of one professor hardcoded as admin, turn the system into a platform where **any team lead, manager, coach, or coordinator** can sign up, create their own workspace, and manage their own groups — completely isolated from other users.

**Who pays for this:**
- College department heads managing multiple faculty groups
- Coaching institute owners tracking batches of students
- Small business owners managing field teams
- Event coordinators managing volunteer groups
- NGOs coordinating fieldworkers
- Freelance project managers

**What changes:**

| Current (Single-tenant) | With Multi-tenant |
|---|---|
| One `admin` row, one PIN | `organizations` table → each org has its own admin(s), PIN, groups, data |
| All data in flat tables | Every table gets `org_id` — data is fully isolated |
| One dashboard | Each org sees only their own dashboard |
| One Vercel deploy | Same deploy serves all orgs (shared infrastructure = higher margins) |

**Implementation sketch:**
```
organizations
  ├── id, name, slug, plan (free/pro/business)
  ├── created_at, settings (jsonb)
  └── admins (1 or more per org)
        ├── name, email, pin_hash, role (owner/co-admin)
        └── session_version

Every other table gets: org_id uuid references organizations(id)
Middleware verifies: JWT → org_id → all queries scoped to that org
URL structure: app.domain.com/login OR slug.domain.com
```

**Revenue potential:** ⭐⭐⭐⭐⭐ — This is the foundation. Every paid feature below multiplies against the number of organizations.

**Effort:** Medium-high (restructure DB schema, add org scoping to all queries, signup flow, billing)

**When to build:** Phase 2 — right after MVP works for the professor. Retrofit the schema early.

> [!IMPORTANT]
> **My recommendation:** Build the DB schema with `org_id` from Day 1, even if Phase 1 only has one org. Retrofitting multi-tenancy later is 5× harder than designing for it upfront.

---

### 💰 Feature B — Automated WhatsApp Messages via Business API

**What it is:** Replace the manual "tap Share → pick group → Send" flow with **fully automated** message delivery. The admin creates a task list, and the system sends it to the WhatsApp group automatically. Reminders fire automatically at configurable intervals. No human taps needed.

**Who pays for this:**
- Anyone managing 10+ groups (manual sharing becomes painful)
- Anyone who wants scheduled reminders (7 AM daily task push)
- Anyone who wants delivery receipts (know it actually reached the group)

**What changes:**

| Current (wa.me links) | With Business API |
|---|---|
| 3-tap manual share | One-click auto-send (or scheduled) |
| No delivery confirmation | Delivery + read receipts from WhatsApp |
| Reminders are manual buttons | Auto-reminders at configurable intervals (e.g., 2h before due) |
| Free | Costs: Meta charges ~₹0.50–1.50 per message (conversation-based pricing) |

**Implementation sketch:**
```
WhatsApp Business API (via BSP like Twilio, Gupshup, or Interakt)
  ├── Register a WhatsApp Business number
  ├── Create message templates (approved by Meta)
  ├── API: POST /messages → sends to group or individual
  ├── Webhooks: delivery receipts, read receipts → update share_log
  └── Scheduler: cron-based auto-send + auto-remind

New tables:
  wa_config (org_id, provider, api_key, phone_number, ...)
  wa_message_log (task_list_id, recipient, status, sent_at, delivered_at, read_at)
  scheduled_sends (task_list_id, send_at, reminder_intervals[], status)
```

**Revenue potential:** ⭐⭐⭐⭐ — High perceived value. Charge a monthly fee + pass through message costs with markup.

**Effort:** Medium (API integration with a BSP, template approval process, webhook handling)

**When to build:** Phase 3 — after multi-tenant is stable. Offer as a premium add-on.

> [!WARNING]
> WhatsApp Business API has a **template approval process** (1–3 days) and **conversation-based pricing**. The free `wa.me` flow must always remain as a fallback.

---

### 💰 Feature C — Advanced Analytics & Branded PDF Reports

**What it is:** Go beyond the simple "created/done/pending/overdue" dashboard. Offer deep analytics with **visual charts**, **member performance scoring**, **trend analysis**, and **downloadable branded PDF reports** that admins can present to their superiors or clients.

**Who pays for this:**
- Department heads who need to report to the dean/principal
- Managers who need to justify team performance in reviews
- Coordinators who need audit trails
- Anyone who says "I need a report for the meeting"

**What it includes:**

| Feature | Detail |
|---|---|
| **Completion rate trends** | Line chart: daily/weekly/monthly completion % per group |
| **Member leaderboard** | Ranked by on-time completion rate, response speed, consistency |
| **On-time vs. Late analysis** | Pie chart: % completed before due vs. after due vs. never |
| **Group comparison** | Bar chart: which groups perform best/worst |
| **Response time tracking** | How quickly do members open the link and tick items after sharing? |
| **Heatmap** | Activity calendar showing busy vs. quiet days |
| **Branded PDF export** | Organization logo, professional layout, date range, charts → one-click PDF download |
| **Scheduled email reports** | Weekly/monthly digest emailed automatically with PDF attached |

**Implementation sketch:**
```
Frontend: Chart.js or Recharts for interactive dashboards
Backend: Aggregation queries + daily_stats pre-computation table
PDF: @react-pdf/renderer or Puppeteer (server-side render)
Email: Resend / Nodemailer for digest delivery

New tables:
  daily_stats (org_id, group_id, date, created, done, verified, overdue, avg_response_min)
  report_config (org_id, frequency, recipients[], last_sent_at)
```

**Revenue potential:** ⭐⭐⭐⭐ — Reports are the #1 reason managers upgrade from free to paid in SaaS tools.

**Effort:** Medium (aggregation queries, chart library, PDF rendering)

**When to build:** Phase 2–3. Basic charts in Phase 2, PDF + email in Phase 3.

---

### 💰 Feature D — AI-Powered Smart Task Engine

**What it is:** Use AI (Google Gemini API) to make task creation faster and smarter. The admin types or pastes messy text, voice-notes-to-text, or even a photo of a handwritten list — and the AI structures it into a clean checklist with suggested due dates and priority.

**Who pays for this:**
- Time-pressed managers who don't want to type individual items
- Anyone who currently pastes unstructured text from emails/notes
- Multilingual users (AI translates and structures)

**What it includes:**

| Feature | Detail |
|---|---|
| **Paste-to-checklist (smart)** | Paste any paragraph → AI extracts action items as a structured checklist |
| **Voice-to-tasks** | Record a voice note → speech-to-text → AI structures into tasks |
| **Photo-to-tasks** | Take a photo of whiteboard/handwritten notes → OCR + AI → checklist |
| **Smart due dates** | AI suggests due dates based on task complexity and past patterns |
| **Auto-categorization** | AI tags tasks (urgent, admin, academic, logistics) |
| **Smart reminders** | AI drafts contextual reminder messages based on what's pending and for how long |
| **Multilingual** | Admin speaks/types in Hindi/Marathi → AI outputs structured English checklist (or vice versa) |

**Implementation sketch:**
```
Google Gemini API (free tier: 15 RPM, paid: affordable for low volume)
  ├── Prompt: "Extract action items from this text: ..."
  ├── Prompt: "Suggest due dates for these tasks based on context: ..."
  ├── Prompt: "Draft a WhatsApp reminder for these pending items: ..."
  └── Web Speech API (browser-native, free) for voice input

New env var: GEMINI_API_KEY
New endpoints:
  POST /api/admin/ai/parse-text    { text } → { items[], suggestions }
  POST /api/admin/ai/parse-image   { image_base64 } → { items[] }
  POST /api/admin/ai/draft-reminder { task_list_id } → { message }
```

**Revenue potential:** ⭐⭐⭐ — Cool differentiator, but not the primary reason people pay. Works best as a "wow" feature in demos and as an upsell.

**Effort:** Low-medium (API calls + prompt engineering, browser speech API is free)

**When to build:** Phase 3. Easy to add incrementally.

---

### 💰 Feature E — Accountability Scores & Gamification

**What it is:** Turn task completion into a visible, trackable score per member. Members see their own performance, and the admin sees everyone's. Add streaks, badges, and leaderboards to drive engagement — the members who ignore tasks today start caring when their score is visible.

**Who pays for this:**
- Coaching institutes wanting student engagement metrics
- Sales teams wanting competitive motivation
- Any org where "accountability" is a pain point (which is most of them)

**What it includes:**

| Feature | Detail |
|---|---|
| **Member score** | Weighted formula: on-time completion %, response speed, consistency |
| **Streaks** | "🔥 5-day streak!" — consecutive days of completing all assigned tasks |
| **Badges** | "⚡ Fast Responder", "🏆 100% This Week", "📅 30-Day Streak" |
| **Leaderboard** | Visible to admin (optionally visible to members on the task page) |
| **Nudges** | Auto-generated "You're 1 task away from a perfect week!" messages |
| **Performance trends** | Per-member sparkline: are they improving or declining? |

**Implementation sketch:**
```
New tables:
  member_scores (member_id, org_id, period_start, period_end,
                 on_time_rate, avg_response_min, streak_current, streak_best,
                 total_completed, total_assigned, score float)
  badges (id, name, icon, criteria_jsonb)
  member_badges (member_id, badge_id, earned_at)

Score calculation: daily cron or on-completion trigger
  score = (on_time_rate × 0.5) + (response_speed × 0.3) + (consistency × 0.2)

Frontend: member page shows own score + streak
          admin dashboard shows leaderboard per group
```

**Revenue potential:** ⭐⭐⭐ — Great for retention and engagement. Members start *wanting* to use the tool. Best combined with Feature C (analytics).

**Effort:** Medium (scoring algorithm, badge logic, UI for leaderboards)

**When to build:** Phase 3–4. Requires enough historical data to be meaningful.

---

## 5. Feature Comparison Matrix

| Feature | Revenue Impact | Build Effort | Depends On | Client Demand | My Ranking |
|---|---|---|---|---|---|
| **A. Multi-Tenant SaaS** | ⭐⭐⭐⭐⭐ | High | Nothing | Must-have to sell | **#1 — Do this** |
| **B. WhatsApp Business API** | ⭐⭐⭐⭐ | Medium | Multi-tenant (A) | High (automation) | **#2** |
| **C. Analytics & PDF Reports** | ⭐⭐⭐⭐ | Medium | Nothing | High (managers love reports) | **#3** |
| **D. AI Smart Task Engine** | ⭐⭐⭐ | Low-Medium | Nothing | Medium (wow factor) | **#4** |
| **E. Gamification & Scores** | ⭐⭐⭐ | Medium | Analytics data (C) | Medium (engagement) | **#5** |

> [!TIP]
> **The killer combination:** A (multi-tenant) + C (analytics) + B (WhatsApp API) = a complete SaaS product that solves a real pain point, shows measurable value, and automates the boring parts. Features D and E are excellent upsells to add later.

---

## 6. Updated Data Model (All Fixes Applied)

> This schema incorporates all 30 review fixes + the `org_id` column for multi-tenant readiness.

```sql
-- ════════════════════════════════════════════
-- ORGANIZATION (Multi-tenant foundation)
-- ════════════════════════════════════════════
CREATE TABLE organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,              -- URL-safe identifier
  plan text DEFAULT 'free' CHECK (plan IN ('free','pro','business','enterprise')),
  settings jsonb DEFAULT '{}',            -- timezone, language, branding, etc.
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ════════════════════════════════════════════
-- ADMIN (supports multiple admins per org)
-- ════════════════════════════════════════════
CREATE TABLE admin (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text,                              -- for reports, recovery
  pin_hash text NOT NULL,
  role text DEFAULT 'owner' CHECK (role IN ('owner','co_admin')),
  timezone text DEFAULT 'Asia/Kolkata',
  session_version int DEFAULT 1,           -- increment to revoke all JWTs
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ════════════════════════════════════════════
-- RATE LIMITING
-- ════════════════════════════════════════════
CREATE TABLE login_attempts (
  id bigserial PRIMARY KEY,
  ip text NOT NULL,
  org_id uuid REFERENCES organizations(id),
  success boolean NOT NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_login_attempts_ip_created ON login_attempts(ip, created_at);

-- ════════════════════════════════════════════
-- GROUPS
-- ════════════════════════════════════════════
CREATE TABLE groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  verify_required boolean DEFAULT true,
  sort_order int DEFAULT 0,
  created_by uuid REFERENCES admin(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz                   -- soft delete
);
CREATE INDEX idx_groups_org ON groups(org_id);

-- ════════════════════════════════════════════
-- MEMBERS
-- ════════════════════════════════════════════
CREATE TABLE members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES groups(id) ON DELETE RESTRICT,
  name text NOT NULL,
  phone text,                              -- international format, no +
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz                   -- soft delete
);
CREATE INDEX idx_members_group ON members(group_id);

-- ════════════════════════════════════════════
-- TEMPLATES
-- ════════════════════════════════════════════
CREATE TABLE templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type text CHECK (type IN ('checklist','message')),
  name text NOT NULL,
  body jsonb NOT NULL,
  -- checklist body: { "items": ["..."], "default_due_offset_hours": 24 }
  -- message body:   { "text": "...", "placeholders": ["{title}", "{link}"] }
  created_by uuid REFERENCES admin(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ════════════════════════════════════════════
-- TASK LISTS
-- ════════════════════════════════════════════
CREATE TABLE task_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  group_id uuid REFERENCES groups(id) ON DELETE RESTRICT,
  title text NOT NULL,
  list_date date NOT NULL,
  due_at timestamptz,
  token text UNIQUE NOT NULL,              -- public link token (nanoid)
  status text DEFAULT 'draft' CHECK (status IN ('draft','active','completed','archived')),
  recurrence jsonb,                        -- {"freq":"weekly","days":[1]}
  shared_at timestamptz,
  created_by uuid REFERENCES admin(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz                   -- soft delete
);
CREATE INDEX idx_task_lists_org_date ON task_lists(org_id, list_date);
CREATE INDEX idx_task_lists_group_date ON task_lists(group_id, list_date);
CREATE INDEX idx_task_lists_token ON task_lists(token);

-- ════════════════════════════════════════════
-- TASK ITEMS (denormalized status for fast reads)
-- ════════════════════════════════════════════
CREATE TABLE task_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_list_id uuid REFERENCES task_lists(id) ON DELETE CASCADE,
  text text NOT NULL,
  position int NOT NULL,
  priority text DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  assigned_member_id uuid REFERENCES members(id),
  due_at timestamptz,
  -- Denormalized status (source of truth for reads; completions table is audit log)
  status text DEFAULT 'pending' CHECK (status IN ('pending','done','verified')),
  completed_by uuid REFERENCES members(id),
  completed_at timestamptz,
  verified_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX idx_task_items_list ON task_items(task_list_id, position);

-- ════════════════════════════════════════════
-- COMPLETIONS (audit log — tracks every state change)
-- ════════════════════════════════════════════
CREATE TABLE completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_item_id uuid REFERENCES task_items(id) ON DELETE CASCADE,
  member_id uuid REFERENCES members(id),   -- null if professor ticked it
  status text CHECK (status IN ('done','verified')) DEFAULT 'done',
  note text,
  proof_path text,
  completed_at timestamptz DEFAULT now(),
  verified_at timestamptz,
  UNIQUE (task_item_id, member_id)          -- prevent duplicate ticks
);
CREATE INDEX idx_completions_item ON completions(task_item_id);

-- ════════════════════════════════════════════
-- SHARE LOG
-- ════════════════════════════════════════════
CREATE TABLE share_log (
  id bigserial PRIMARY KEY,
  task_list_id uuid REFERENCES task_lists(id) ON DELETE CASCADE,
  kind text CHECK (kind IN ('share','reminder')),
  channel text CHECK (channel IN ('whatsapp_group','whatsapp_individual','copy','native_share')),
  member_id uuid REFERENCES members(id),   -- null for group shares
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_share_log_task_list ON share_log(task_list_id);

-- ════════════════════════════════════════════
-- OPENS (de-duplicated per member per list)
-- ════════════════════════════════════════════
CREATE TABLE opens (
  id bigserial PRIMARY KEY,
  task_list_id uuid REFERENCES task_lists(id) ON DELETE CASCADE,
  member_id uuid REFERENCES members(id),
  first_opened_at timestamptz DEFAULT now(),
  last_opened_at timestamptz DEFAULT now(),
  open_count int DEFAULT 1,
  UNIQUE (task_list_id, member_id)
);
CREATE INDEX idx_opens_task_list ON opens(task_list_id);

-- ════════════════════════════════════════════
-- DAILY STATS (pre-computed for fast dashboard)
-- ════════════════════════════════════════════
CREATE TABLE daily_stats (
  id bigserial PRIMARY KEY,
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  group_id uuid REFERENCES groups(id),
  stat_date date NOT NULL,
  tasks_created int DEFAULT 0,
  tasks_done int DEFAULT 0,
  tasks_verified int DEFAULT 0,
  tasks_overdue int DEFAULT 0,
  avg_response_minutes float,
  UNIQUE (org_id, group_id, stat_date)
);

-- ════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ════════════════════════════════════════════
ALTER TABLE organizations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin            ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_attempts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups           ENABLE ROW LEVEL SECURITY;
ALTER TABLE members          ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates        ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_lists       ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE completions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE share_log        ENABLE ROW LEVEL SECURITY;
ALTER TABLE opens            ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_stats      ENABLE ROW LEVEL SECURITY;
```

---

## 7. Updated API Surface

### Public Endpoints

```
POST /api/auth/login                         { org_slug?, pin }  → session cookie
POST /api/auth/logout
GET  /api/health                             → { status, db, timestamp }

GET  /api/t/{token}                          → { status, expires_at, task_list, items, members, completions }
POST /api/t/{token}/open                     { member_id }
POST /api/t/{token}/items/{id}/complete      { member_id, note? }
POST /api/t/{token}/items/{id}/undo          { member_id }
```

### Admin Endpoints (PIN session required, org-scoped)

```
GET    /api/admin/dashboard?from=&to=&group_id=      → KPIs, group stats
GET    /api/admin/groups?page=&limit=                 → paginated
POST   /api/admin/groups                              { name, description, members[] }
PATCH  /api/admin/groups/{id}
DELETE /api/admin/groups/{id}                          (soft delete)

CRUD   /api/admin/members
CRUD   /api/admin/task-lists?page=&limit=&group_id=&status=&from=&to=
CRUD   /api/admin/items
CRUD   /api/admin/templates

POST   /api/admin/task-lists/{id}/share                { channel }  → logs share
POST   /api/admin/task-lists/{id}/remind               { member_id?, channel }
POST   /api/admin/items/{id}/verify
POST   /api/admin/items/{id}/complete                  (professor ticks directly)

GET    /api/admin/export?format=csv&from=&to=
GET    /api/admin/reports?type=completion|member|group&from=&to=
GET    /api/admin/reports/pdf?from=&to=                → branded PDF download

POST   /api/admin/settings/change-pin                  { old_pin, new_pin }
PATCH  /api/admin/settings                             { timezone, language, ... }

POST   /api/admin/ai/parse-text                        { text } → { items[], suggestions }
POST   /api/admin/ai/draft-reminder                    { task_list_id } → { message }
```

### Cron / Internal

```
GET    /api/cron/keepalive                             (daily, cleans login_attempts, updates daily_stats)
```

---

## 8. Pricing Strategy

> [!NOTE]
> This only applies if you build Feature A (Multi-tenant). Without multi-tenancy, you're selling a custom deployment per client, which is less scalable.

| Plan | Price (suggested) | What's Included |
|---|---|---|
| **Free** | ₹0/month | 1 admin, 3 groups, 15 members, 50 tasks/month, `wa.me` sharing, basic dashboard |
| **Pro** | ₹499–999/month | Unlimited groups/members/tasks, templates, recurring lists, analytics charts, CSV + PDF export, 2 admins |
| **Business** | ₹1,999–2,999/month | Everything in Pro + WhatsApp Business API integration (auto-send, auto-remind), AI task parsing, 5 admins, email digests, priority support |
| **Enterprise** | Custom pricing | White-label branding, custom domain, unlimited admins, SSO, API access, dedicated support |

**Revenue math (conservative):**
- 50 paying clients × ₹999/month = **₹49,950/month** (~₹6 lakh/year)
- 20 Business clients × ₹2,499/month = **₹49,980/month** (~₹6 lakh/year)
- Combined = **₹12 lakh/year** from just 70 clients

**Hosting costs at scale:**
- Vercel Pro: ~$20/month
- Supabase Pro: ~$25/month
- WhatsApp API: pass-through + markup
- **Total overhead: ~₹4,000/month** → margins are excellent

---

## 9. Revised Build Roadmap

### Phase 1 — MVP (Week 1–2)
> Goal: Working system for the professor. One tenant hardcoded.

| Day | Work |
|---|---|
| 1 | Next.js + Tailwind scaffolding, project structure, Supabase project + full SQL schema (with `org_id` columns), env vars |
| 2 | Deploy to Vercel, PIN auth (login page, bcrypt, JWT cookie, `session_version`, middleware, rate limit) |
| 3 | Groups + members CRUD (with soft delete, sort order, pagination) |
| 4 | Task lists + items (status field, token generation), message builder, Share to WhatsApp, Mark as sent |
| 5 | Public member page: name picker, tick/undo, progress bar, opened tracking (de-duped), concurrency handling |
| 6 | Dashboard (KPIs, per-group cards, filters, SWR polling), professor tick/verify, share log (with channel) |
| 7 | CSV export, keep-alive cron (with login_attempts cleanup), health endpoint, PWA manifest |
| 8 | Zod validation on all endpoints, error handling, empty states, loading skeletons, mobile polish |
| 9–10 | Testing with real group, bug fixes, accessibility pass |
| **MVP ready** | **~10 days** |

### Phase 2 — Daily-Use Comfort + Analytics Foundation (Week 3–4)
> Goal: Templates, recurring, and basic analytics. Prep for multi-tenant.

- Templates (checklist + message), duplicate/clone, paste-to-split
- Recurring lists (daily/weekly/custom)
- Reminder buttons (group + individual via `wa.me`)
- Calendar/timeline view
- Basic analytics charts (completion trends, group comparison)
- `daily_stats` pre-computation
- Onboarding flow for first-time users

### Phase 3 — Multi-Tenant + Premium Features (Week 5–8)
> Goal: Turn it into a SaaS product.

- **Multi-tenant:** organizations table, signup flow, org-scoped queries, slug-based routing
- **Advanced analytics:** member leaderboard, on-time vs late, response time, heatmap
- **PDF reports:** branded export with charts
- **AI task parsing:** Gemini API integration, paste-to-checklist, draft reminders
- Per-member assignment + personal links
- Photo/file proof upload
- Co-admin access
- Billing integration (Razorpay / Stripe)

### Phase 4 — Growth Features (Month 3+)
> Goal: Differentiation and retention.

- WhatsApp Business API integration (auto-send, auto-remind, delivery receipts)
- Gamification (scores, streaks, badges, leaderboard)
- Email digests (scheduled weekly/monthly)
- Web push notifications
- Passkey/fingerprint login
- Multilingual support (Hindi/Marathi templates + UI)
- White-label / custom domain for Enterprise
- API access for Enterprise integrations

---

## 10. Final Decision Checklist

> [!IMPORTANT]
> Locked 14 Oct 2026 for execution. See also **Decisions Locked** in [`MASTER-EXECUTION-PLAN.md`](./MASTER-EXECUTION-PLAN.md).

### Review Fixes
- [x] Apply all 6 critical fixes to the plan
- [x] Apply all 10 gap fixes to the plan
- [x] Apply all 14 enhancement fixes to the plan

### Premium Features
- [x] **Feature A — Multi-Tenant SaaS** — `org_id` from Day 1; signup/billing in Execution Phase 14
- [x] **Feature B — WhatsApp Business API** — Execution Phase 16
- [x] **Feature C — Analytics & PDF Reports** — Execution Phase 13
- [x] **Feature D — AI Smart Task Engine** — Execution Phase 15
- [x] **Feature E — Gamification & Scores** — Execution Phase 17

### Architecture Decisions
- [x] Keep Vercel Hobby for now, upgrade to Pro when selling
- [x] Keep Supabase free tier for MVP, upgrade when multi-tenant scale needs it
- [x] Use **Razorpay** for billing
- [x] Custom domain later (Enterprise / after multi-tenant)

### Explicitly deferred (documented in Master Execution Plan)
- Calendar/timeline view — only if professor asks
- Personal member links (Mode B) — after MVP
- Photo proof upload UI — schema keeps `proof_path`; UI after MVP
- Passkeys / web push / full i18n — post Phase 18 backlog

---

> **Next step:** Start building from [`MASTER-EXECUTION-PLAN.md`](./MASTER-EXECUTION-PLAN.md) Phase 1. Tick checkboxes there as you go. MVP ship gate is after Phase 11.
