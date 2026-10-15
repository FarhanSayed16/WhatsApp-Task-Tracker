# WhatsApp Task Tracker — MASTER EXECUTION PLAN

> **Version:** Final v1.2 (Execution-Ready)  
> **Created:** 13 Oct 2026 · **Reviewed & locked:** 14 Oct 2026 · **Scope lock:** 15 Oct 2026  
> **Purpose:** This is the **single source of truth** for building the entire WhatsApp Task Tracker system. Use it as a checklist — tick each item as you complete it. Nothing should be built that isn't in this document, and nothing in this document should be skipped.

> **Product scope (locked):** One professor’s daily tool — create groups/members, add tasks, share via WhatsApp, track completions, verify, export. **Not** a commercial SaaS. No public signup, no paid plans, no payment gateway.

> **Source Documents (reference only — this file wins on conflict):**
> - [Original Plan (v2)](./whatsapp-task-tracker-plan.md) — core decisions (superseded schema/roadmap)
> - [Plan Review & Fixes](./plan-review-suggested-changes.md) — 30 issues (all incorporated here)
> - [Master Blueprint (v3)](./whatsapp-task-tracker-master-blueprint.md) — premium features & pricing (decisions locked below)

---

## How To Use This Document

- **Each Phase** = a major milestone. Complete phases in order (respect [Phase Dependencies](#phase-dependencies)).
- **Each Sub-phase** = a logical unit of work within the phase.
- **Each checkbox** `[ ]` = one specific task. Tick it `[x]` when done.
- **Files listed** = exact files you need to create or modify.
- **Endpoints listed** = exact API routes to implement.
- **Acceptance criteria** = how you know the sub-phase is done.
- **MVP ship gate** = after Phase 11 the professor can use the product daily. Phases 12–13 / 15–17 are optional comfort/premium for that same single user. Phase 14 (SaaS) is **out**. Phase 18 is polish for whatever you ship.

---

## Decisions Locked (v1.1)

| Decision | Choice |
|---|---|
| Product audience | **Single professor** — personal/work tool, not a product for sale |
| All 30 review fixes | **In** — applied in schema + phases from Day 1 |
| Multi-tenant DB (`org_id`) | **In from Day 1** — seed **one** org only; never build public multi-org signup |
| Feature A Multi-Tenant SaaS | **Out** — not commercializing |
| Feature B WhatsApp Business API | **Phase 16** (optional; only if professor wants auto-send) |
| Feature C Analytics & PDF | **Phase 13** (basic charts + PDF + email digests) |
| Feature D AI Smart Tasks | **Phase 15** |
| Feature E Gamification | **Phase 17** |
| Billing / Razorpay / Stripe | **Out** — no payments, no plans, no upgrade UI |
| Hosting | Vercel Hobby (enough for one professor) |
| Supabase | Free tier |
| Custom domain | **Out** unless professor asks later |
| Calendar/timeline view | **Deferred** — not required for MVP; add only if professor asks |
| Personal member links (Mode B) | **Deferred** post-MVP (group link Mode A is default) |
| Photo proof upload | Schema keeps `proof_path`; **upload UI deferred** until after MVP (post Phase 11) |
| Passkeys / web push / full i18n | **Out of this plan** (post Phase 18 backlog) |

---

## Core Business Rules (Locked)

These rules were underspecified across earlier docs. Follow them exactly while coding:

1. **Member link expiry:** A list becomes `readonly` when `due_at + 7 days` has passed (if `due_at` is null, use `list_date` end-of-day in admin timezone + 7 days). Soft-deleted lists (`deleted_at IS NOT NULL`) return `expired`.
2. **`verify_required` (per group):** If `true`, member tick → `done`, professor confirm → `verified`. If `false`, member tick sets status to `verified` immediately (Done = final).
3. **Professor direct tick:** Always sets `verified` and inserts `completions` with `member_id = NULL`.
4. **Completions uniqueness:** `UNIQUE (task_item_id, member_id)` prevents duplicate *member* ticks. Postgres allows multiple `NULL` `member_id` rows — **application must** upsert/replace a single professor completion per item (delete previous null-member row, then insert, in one transaction).
5. **Overdue:** `status = 'pending'` AND `due_at IS NOT NULL` AND `due_at < now()` — computed, never stored.
6. **Sharing:** Always keep free `wa.me` flow. Business API (Phase 16) is additive with fallback.
7. **Org scoping:** Every admin query filters by `org_id` from the JWT from Phase 6 onward (even with one seeded org).

---

## Tech Stack (Locked)

| Component | Technology | Version/Notes |
|---|---|---|
| Framework | Next.js (App Router) | Latest stable |
| Language | TypeScript | Strict mode |
| Styling | Tailwind CSS | v3+ |
| Database | Supabase Postgres | Mumbai region, server-side only |
| Auth | Custom PIN (bcryptjs + jose JWT) | NOT Supabase Auth |
| Validation | Zod | All API inputs |
| Data Fetching | SWR | Polling every ~15s for dashboard |
| Token Generation | nanoid | 10-char URL-safe strings |
| Hosting | Vercel | Hobby |
| Charts | Recharts | Analytics (Phase 13) |
| PDF | @react-pdf/renderer | Reports (Phase 13) |
| Email | Resend | Digests (Phase 13) |
| AI | Google Gemini API | Smart features (Phase 15) |

---

## Environment Variables

| Variable | Purpose | Phase Added |
|---|---|---|
| `SUPABASE_URL` | Supabase project URL | Phase 1 |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only DB key (NEVER `NEXT_PUBLIC_`) | Phase 1 |
| `SESSION_SECRET` | Signs JWT cookies (long random string) | Phase 1 |
| `CRON_SECRET` | Protects keep-alive cron route | Phase 1 |
| `APP_URL` | Base URL for member links (e.g., `https://your-app.vercel.app`) | Phase 1 |
| `RESEND_API_KEY` | Email digests (Resend) | Phase 13 |
| `GEMINI_API_KEY` | Google Gemini API key | Phase 15 |

---

# ═══════════════════════════════════════════════
# PHASE 1 — PROJECT SETUP & INFRASTRUCTURE
# ═══════════════════════════════════════════════
> **Goal:** Scaffold the project, set up all tooling, create the Supabase project, configure environment, and deploy a "hello world" to Vercel.  
> **Estimated Time:** 1 day

---

## 1.1 — Next.js Project Scaffolding

- [x] Initialize Next.js project with App Router and TypeScript **into this existing repo** (docs/ already present — do not wipe it):
  ```
  npx -y create-next-app@latest ./ --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
  ```
  > If the CLI refuses a non-empty directory, scaffold into a temp folder and move `src/`, config files, and `package.json` into the repo root, keeping `docs/` intact.
- [x] Verify project runs locally with `npm run dev`
- [x] Set up Tailwind CSS configuration with custom design tokens:
  - [x] Color palette (primary, secondary, accent, success, warning, danger, neutral)
  - [x] Typography scale (font-family: Inter from Google Fonts)
  - [x] Border radius tokens
  - [x] Shadow tokens
  - [x] Animation/transition tokens
- [x] Create global CSS file `src/app/globals.css` with base styles
- [x] Set up `layout.tsx` with:
  - [x] Google Fonts (Inter) import
  - [x] Meta tags (title, description, viewport, theme-color)
  - [x] Favicon

**Files created:**
```
src/app/layout.tsx
src/app/globals.css
src/app/page.tsx              (temporary hello world)
tailwind.config.ts
tsconfig.json
next.config.ts
```

---

## 1.2 — Project Folder Structure

- [x] Create the complete folder structure:

```
src/
  app/
    login/
      page.tsx
    admin/
      page.tsx                          # dashboard
      groups/
        page.tsx                        # groups list
        [id]/
          page.tsx                      # group detail
        new/
          page.tsx                      # create group
      tasks/
        page.tsx                        # task lists
        [id]/
          page.tsx                      # task list detail
        new/
          page.tsx                      # create task list
      templates/
        page.tsx
      reports/
        page.tsx
      settings/
        page.tsx
    t/
      [token]/
        page.tsx                        # public member page
    api/
      auth/
        login/route.ts
        logout/route.ts
      health/route.ts
      admin/
        me/route.ts                       # session bootstrap + session_version check
        dashboard/route.ts
        groups/route.ts
        groups/[id]/route.ts
        members/route.ts
        members/[id]/route.ts
        task-lists/route.ts
        task-lists/[id]/route.ts
        task-lists/[id]/share/route.ts
        task-lists/[id]/remind/route.ts
        members/import/route.ts           # CSV import
        items/route.ts
        items/[id]/route.ts
        items/[id]/verify/route.ts
        items/[id]/complete/route.ts
        items/[id]/undo/route.ts
        items/reorder/route.ts            # batch position update
        templates/route.ts
        templates/[id]/route.ts
        export/route.ts
        reports/route.ts
        reports/pdf/route.ts
        settings/change-pin/route.ts
        settings/route.ts
        ai/
          parse-text/route.ts             # Phase 15
          draft-reminder/route.ts         # Phase 15
      t/
        [token]/route.ts
        [token]/open/route.ts
        [token]/items/[id]/complete/route.ts
        [token]/items/[id]/undo/route.ts
      cron/
        keepalive/route.ts
  lib/
    supabase.ts                         # Supabase client (server-only)
    auth.ts                             # PIN check, JWT create/verify
    whatsapp.ts                         # wa.me link builder, message builder
    tokens.ts                           # nanoid token generator
    rateLimit.ts                        # Rate limiting logic (login + public APIs)
    validation.ts                       # Zod schemas for all inputs
    errors.ts                           # Standard error response helpers
    utils.ts                            # Date formatting, timezone helpers
    constants.ts                        # App constants
  components/
    ui/                                 # Reusable UI primitives
      Button.tsx
      Input.tsx
      Card.tsx
      Badge.tsx
      Modal.tsx
      Toast.tsx
      Skeleton.tsx
      EmptyState.tsx
      ProgressBar.tsx
      Spinner.tsx
    admin/                              # Admin-specific components
      Sidebar.tsx
      TopBar.tsx
      AdminLayout.tsx
      KpiCard.tsx
      GroupCard.tsx
      TaskListCard.tsx
      ShareSheet.tsx                      # Phase 8
    member/                             # Member page components
      NamePicker.tsx
      TaskChecklist.tsx
      MemberProgress.tsx
  hooks/
    useSession.ts                       # Check if admin is logged in
    useSWRFetch.ts                      # SWR wrapper with polling
  types/
    index.ts                            # All TypeScript interfaces
  scripts/
    reset-pin.ts                        # Phase 3 — npm run reset-pin
middleware.ts                           # Route protection
vercel.json                             # Cron config
```

- [x] Create placeholder files for Phase 1–11 routes only (defer Phase 12+ stubs until those phases start, except keep folder notes above as the target map)
- [x] Verify the folder structure compiles without errors

---

## 1.3 — Supabase Project Setup

- [x] Note down the `Project URL` and `service_role` key structure
- [x] **DO NOT** use the `anon` key anywhere in the project
- [x] Install Supabase client: `npm install @supabase/supabase-js`
- [x] Create `src/lib/supabase.ts`:
  ```typescript
  import { createClient } from "@supabase/supabase-js";
  
  export const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  ```
- [x] Implement resilient server-side Supabase client proxy with validation

---

## 1.4 — Environment & Deployment

- [x] Create `.env.local` with all Phase 1 environment variables
- [x] Ensure `.env.local` is in `.gitignore` (never commit secrets)
- [x] Create `.env.example` documenting **all** variables from the env table (Phase 1–15), values blank
- [x] Repo is already a git repository — **do not** re-run `git init`; standard Next.js `.gitignore` in place
- [x] Create `vercel.json` with cron configuration
- [ ] Connect remote Supabase project URL and keys to `.env.local`
- [ ] Connect repository to Vercel and deploy live

**Acceptance Criteria:**
> ✅ Project runs locally, passes Next.js production build (`next build`), folder structure complete, `docs/` preserved.

---

# ═══════════════════════════════════════════════
# PHASE 2 — DATABASE SCHEMA & MIGRATIONS
# ═══════════════════════════════════════════════
> **Goal:** Run the complete SQL schema in Supabase, including all tables, indexes, constraints, and RLS. This schema incorporates ALL 30 review fixes from day one.  
> **Estimated Time:** 0.5 day

---

## 2.1 — Core Tables

- [x] Defined complete SQL in `docs/schema.sql` and `supabase/migrations/20261015000000_init_schema.sql`:
  - `organizations` table: `id`, `name`, `slug` (unique), `plan`, `settings` (jsonb), `created_at`, `updated_at`
  - Plan check constraint: `free`, `pro`, `business`, `enterprise`
- [x] Created `admin` table specification:
  - Columns: `id`, `org_id` (FK → organizations), `name`, `email`, `pin_hash`, `role`, `timezone`, `session_version`, `created_at`, `updated_at`
  - Role check constraint: `owner`, `co_admin`
  - Default timezone: `Asia/Kolkata`
  - Default session_version: `1`
- [x] Created `login_attempts` table specification:
  - Columns: `id` (bigserial), `ip`, `org_id` (FK), `success`, `created_at`
  - Index: `idx_login_attempts_ip_created` on `(ip, created_at)`
- [x] Created `groups` table specification:
  - Columns: `id`, `org_id` (FK, NOT NULL), `name`, `description`, `verify_required`, `sort_order`, `created_by` (FK → admin), `created_at`, `updated_at`, `deleted_at`
  - Index: `idx_groups_org` on `(org_id)`
  - Soft delete via `deleted_at`
- [x] Created `members` table specification:
  - Columns: `id`, `group_id` (FK → groups, ON DELETE RESTRICT), `name`, `phone`, `active`, `created_at`, `updated_at`, `deleted_at`
  - Index: `idx_members_group` on `(group_id)`
- [x] Created `templates` table specification:
  - Columns: `id`, `org_id` (FK, NOT NULL), `type`, `name`, `body` (jsonb), `created_by` (FK → admin), `created_at`, `updated_at`
  - Type check constraint: `checklist`, `message`
  - JSONB schema documented in comments

---

## 2.2 — Task Tables

- [x] Created `task_lists` table specification:
  - Columns: `id`, `org_id` (FK, NOT NULL), `group_id` (FK → groups, ON DELETE RESTRICT), `title`, `list_date` (date), `due_at` (timestamptz), `token` (unique), `status`, `recurrence` (jsonb), `shared_at`, `created_by` (FK → admin), `created_at`, `updated_at`, `deleted_at`
  - Status check constraint: `draft`, `active`, `completed`, `archived`
  - Indexes: `idx_task_lists_org_date`, `idx_task_lists_group_date`, `idx_task_lists_token`
- [x] Created `task_items` table specification (with denormalized status):
  - Columns: `id`, `task_list_id` (FK, ON DELETE CASCADE), `text`, `position`, `priority`, `assigned_member_id` (FK → members), `due_at`, `status`, `completed_by` (FK → members), `completed_at`, `verified_at`, `created_at`, `updated_at`
  - Priority check: `low`, `normal`, `high`, `urgent`
  - Status check: `pending`, `done`, `verified`
  - Index: `idx_task_items_list` on `(task_list_id, position)`
- [x] Created `completions` table specification (audit log):
  - Columns: `id`, `task_item_id` (FK, ON DELETE CASCADE), `member_id` (FK → members, nullable), `status`, `note`, `proof_path`, `completed_at`, `verified_at`
  - Status check: `done`, `verified`
  - **UNIQUE constraint**: `(task_item_id, member_id)` — prevents duplicate *member* ticks
  - Indexes: `idx_completions_item` on `(task_item_id)`, `idx_completions_member` on `(member_id)`
  - **Note:** Postgres treats `NULL` member_id as distinct — enforce single professor completion in app code (see Core Business Rules)

---

## 2.3 — Tracking Tables

- [x] Created `share_log` table specification:
  - Columns: `id` (bigserial), `task_list_id` (FK, ON DELETE CASCADE), `kind`, `channel`, `member_id` (FK, nullable), `created_at`
  - Kind check: `share`, `reminder`
  - Channel check: `whatsapp_group`, `whatsapp_individual`, `copy`, `native_share`
  - Index: `idx_share_log_task_list`
- [x] Created `opens` table specification (de-duplicated):
  - Columns: `id` (bigserial), `task_list_id` (FK, ON DELETE CASCADE), `member_id` (FK), `first_opened_at`, `last_opened_at`, `open_count`
  - **UNIQUE constraint**: `(task_list_id, member_id)`
  - Index: `idx_opens_task_list`
- [x] Created `daily_stats` table specification (pre-computed):
  - Columns: `id` (bigserial), `org_id` (FK, ON DELETE CASCADE), `group_id` (FK), `stat_date` (date), `tasks_created`, `tasks_done`, `tasks_verified`, `tasks_overdue`, `avg_response_minutes`
  - **UNIQUE constraint**: `(org_id, group_id, stat_date)`

---

## 2.4 — Security & Seed Data

- [x] Enabled Row Level Security on ALL 12 tables (with NO public policies):
  ```sql
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
- [x] Seed data written into SQL:
  - [x] One organization (slug: `default`, plan: `free`)
  - [x] One admin (name: 'Professor', pin_hash: bcrypt of PIN 123456, timezone: `Asia/Kolkata`, role: `owner`)
- [x] Saved the complete SQL as `docs/schema.sql` and `supabase/migrations/20261015000000_init_schema.sql` for version control
- [x] Added `update_modified_column()` trigger helper for automatic `updated_at` maintenance on all tables
- [x] Created CLI verification test script `src/scripts/test-db-connection.ts` (`npm run test-db`)
- [x] Verified Phase 13–17 tables remain separated for future phases

**Acceptance Criteria:**
> ✅ All 12 tables created with correct columns, indexes, constraints, RLS enabled, seed data inserted, SQL saved to repo.

---

# ═══════════════════════════════════════════════
# PHASE 3 — AUTHENTICATION SYSTEM (PIN LOGIN)
# ═══════════════════════════════════════════════
> **Goal:** Complete PIN-based authentication with JWT sessions, rate limiting, session revocation, and route protection.  
> **Estimated Time:** 1.5 days

---

## 3.1 — Auth Library (`src/lib/auth.ts`)

- [x] Install dependencies: `npm install bcryptjs jose`
- [x] Install types: `npm install -D @types/bcryptjs`
- [x] Implement `checkPin(pin: string, hash: string): Promise<boolean>` — bcrypt compare
- [x] Implement `createSessionToken(payload: SessionPayload): Promise<string>`:
  - JWT payload: `{ role: "owner"|"co_admin", sub, orgId, sessionVersion, name, timezone }`
  - Algorithm: `HS256`
  - Expiry: `30d`
  - Signs with `SESSION_SECRET`
- [x] Implement `verifySessionToken(token?: string): Promise<SessionPayload | null>`:
  - Returns null if token missing, expired, or invalid
  - Catches all errors gracefully
- [x] Implement `shouldRefreshSession(payload: JWTPayload): boolean`:
  - Returns true if JWT was issued more than 7 days ago
- [x] Implement `requireAdmin(): Promise<AdminContext | null>` for all `/api/admin/*` routes:
  - Verify JWT, load admin row, compare `session_version`
  - If mismatch → treat as revoked (null / throw `UNAUTHORIZED`)
  - Return `{ adminId, orgId, role, timezone, sessionVersion }`
- [x] Implement `getServerSession` helper for Server Components and Route Handlers

---

## 3.2 — Rate Limiting (`src/lib/rateLimit.ts`)

- [x] Implement `checkLoginRateLimit(ip: string): Promise<{ allowed: boolean; remainingAttempts: number; retryAfterSeconds?: number }>`:
  - Query `login_attempts` for this IP in the last 15 minutes
  - If ≥ 5 failed attempts → blocked
  - Also check global cap: ≥ 30 total failed attempts in last hour → blocked
  - Return seconds until retry is allowed
- [x] Implement `recordLoginAttempt(ip: string, success: boolean, orgId?: string | null): Promise<void>`:
  - Insert row into `login_attempts`
- [x] Implement `cleanupOldAttempts(): Promise<{ deleted: boolean; error?: string }>`:
  - Delete rows older than 24 hours (called by keepalive cron)
- [x] Implement `checkPublicTokenRateLimit(ip: string, token: string): Promise<{ allowed: boolean; retryAfter?: number }>` for `/api/t/*` write routes:
  - Cap abusive complete/undo/open calls (60 writes / IP / minute via in-memory tracking)
  - Return `429` with standard error shape when exceeded

---

## 3.3 — Login API (`src/app/api/auth/login/route.ts`)

- [x] Accept `POST` with body: `{ pin: string }`
- [x] Validate input with Zod: pin must be exactly 6 digits
- [x] Extract client IP from request headers (`x-forwarded-for` or `127.0.0.1`)
- [x] Check rate limit → if blocked, return `429 Too Many Requests` with `retryAfter`
- [x] Fetch admin record from DB (single-tenant: first admin row, dev PIN fallback)
- [x] Compare PIN with bcrypt hash
- [x] Record attempt (success or failure)
- [x] If wrong PIN → return `401 { error: "Invalid PIN", code: "INVALID_CREDENTIALS" }`
- [x] If correct:
  - Create JWT session token
  - Set `HttpOnly`, `Secure`, `SameSite=Lax` cookie named `wt_session`, max-age 30 days
  - Return `200 { success: true }`

---

## 3.4 — Logout API (`src/app/api/auth/logout/route.ts`)

- [x] Accept `POST`
- [x] Clear the `wt_session` cookie (set max-age to 0)
- [x] Return `200 { success: true }`

---

## 3.5 — Middleware (`src/middleware.ts`)

- [x] Intercept requests matching `/admin/:path*` and `/api/admin/:path*`
- [x] Extract `wt_session` cookie
- [x] Call `jwtVerify()` (JWT signature + expiry only) → if null, redirect to `/login` (pages) or return `401` (API)
- [x] Verify `Origin` / `Host` alignment on state-changing methods (`POST`/`PATCH`/`PUT`/`DELETE`) for CSRF protection
- [x] If JWT `iat` is older than 7 days → refresh and set new cookie (same `sessionVersion`)
- [x] All other routes (`/login`, `/t/*`, `/api/t/*`, `/api/auth/*`, `/api/health`, `/api/cron/*`) pass through unchanged
- [x] **`session_version` DB check:** do **not** hit Supabase from Edge middleware. Enforce revocation inside shared `requireAdmin()` helper used by every `/api/admin/*` route and `/api/admin/me`. On mismatch → clear cookie + 401.

---

## 3.6 — Login Page UI (`src/app/login/page.tsx`)

- [x] Full-screen centered layout, mobile-first
- [x] App logo/name at top
- [x] Large numeric keypad (0-9 buttons + backspace + clear)
- [x] 6 PIN dots showing entered digits (filled/empty)
- [x] Auto-submit when 6th digit is entered
- [x] Loading spinner during verification
- [x] Shake animation on wrong PIN
- [x] Error message: "Wrong PIN" / "Too many attempts, try again in X minutes"
- [x] Rate limit countdown timer visible when locked out
- [x] Accessible: keyboard input works (0-9, Backspace, Escape), ARIA labels on buttons

---

## 3.7 — PIN Management

- [x] Create `npm run reset-pin` script (`src/scripts/reset-pin.ts`):
  - Prompts/CLI arg for new 6-digit PIN
  - Hashes with bcrypt (salt rounds: 10)
  - Updates admin row in DB
  - Increments `session_version` (revokes all existing sessions)
- [x] Change PIN API (`src/app/api/admin/settings/change-pin/route.ts`):
  - Accept `POST { old_pin, new_pin }`
  - Validate: both must be 6 digits, new_pin ≠ old_pin
  - Verify old PIN against DB
  - Hash new PIN, update DB
  - Increment `session_version`
  - Set new session cookie with updated version
  - Return `200 { success: true }`

**Acceptance Criteria:**
> ✅ Can log in with PIN, stays logged in for 30 days, auto-refreshes at 7 days, rate limiting works (5 attempts/15 min), wrong PIN shows shake animation, session revokes on PIN change via `session_version` (enforced in `requireAdmin`), middleware blocks unauthenticated `/admin` and `/api/admin` access.

---

# ═══════════════════════════════════════════════
# PHASE 4 — CORE LIBRARIES & UTILITIES
# ═══════════════════════════════════════════════
> **Goal:** Build all shared libraries that other phases depend on.  
> **Estimated Time:** 1 day

---

## 4.1 — TypeScript Types (`src/types/index.ts`)

- [x] Define all interfaces matching the database schema:
  - `Organization`, `Admin`, `Group`, `Member`, `Template`
  - `TaskList`, `TaskItem`, `Completion`, `ShareLog`, `Open`, `DailyStat`
- [x] Define API response types:
  - `ApiResponse<T>` — `ApiSuccess<T> | ApiError`
  - `PaginatedResponse<T>` — `{ data: T[], total: number, page: number, limit: number, totalPages: number }`
  - `DashboardData` — KPIs, group stats, recent lists
  - `MemberPageData` — `{ status, expires_at, task_list, items, members, completions }`
- [x] Define form/input types:
  - `CreateGroupInput`, `UpdateGroupInput`, `CreateMemberInput`, `UpdateMemberInput`
  - `CreateTaskListInput`, `UpdateTaskListInput`, `CreateTaskItemInput`, `UpdateTaskItemInput`
  - `CreateTemplateInput`, `ChangePinInput`, `PaginationParams`, `DateRangeFilter`

---

## 4.2 — Zod Validation Schemas (`src/lib/validation.ts`)

- [x] Install Zod: `npm install zod`
- [x] Define schemas for every API input:
  - `loginSchema` — `{ pin: string }` (exactly 6 digits)
  - `createGroupSchema` — `{ name: string (max 100), description?: string (max 500), members?: array }`
  - `createMemberSchema` — `{ group_id, name (max 100), phone? (regex: /^\d{10,15}$/) }`
  - `createTaskListSchema` — `{ group_id, title (max 200), list_date, due_at?, items: array }`
  - `createTaskItemSchema` — `{ text (max 500), position, priority?, assigned_member_id?, due_at? }`
  - `completeItemSchema` — `{ member_id, note? (max 1000) }`
  - `changePinSchema` — `{ old_pin (6 digits), new_pin (6 digits) }`
  - `paginationSchema` — `{ page?: number (min 1), limit?: number (min 1, max 100) }`
  - `dateRangeSchema` — `{ from?: date string, to?: date string, group_id?: uuid }`
- [x] Create helper: `validateBody<T>(schema, body): T` — throws standardized error on failure

---

## 4.3 — Error Handling (`src/lib/errors.ts`)

- [x] Define standard error response format:
  ```typescript
  { success: false, error: { code: string, message: string, details?: any } }
  ```
- [x] Create error codes enum:
  - `INVALID_INPUT`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`
  - `RATE_LIMITED`, `DUPLICATE`, `DB_ERROR`, `INTERNAL_ERROR`
- [x] Create helper functions:
  - `apiError(message, code, status, details)` → `NextResponse`
  - `apiSuccess(data, meta?, status)` → `NextResponse`
  - `handleApiError(error)` → catches unknown errors, logs, returns safe response

---

## 4.4 — WhatsApp Utilities (`src/lib/whatsapp.ts`)

- [x] Implement `waLink(text: string, phone?: string): string`:
  - Without phone: `https://wa.me/?text=${encodeURIComponent(text)}`
  - With phone: `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
- [x] Implement `buildTaskMessage(params): string`:
  - Params: `{ title, groupName, dateStr, dueTimeStr?, items[], link }`
  - Number emojis: extend to 10 (`1️⃣` through `🔟`)
  - Show up to 10 items, then "…and N more"
  - Format: title, group, date, items, due time, link
  - Use WhatsApp formatting: `*bold*`, `_italic_`
- [x] Implement `buildReminderMessage(params): string`:
  - Group reminder template
  - Individual reminder template
  - Overdue template
  - Closure template
- [x] Implement `getEncodedUrlLength(text: string): number`:
  - Returns the length of the full `wa.me` URL after encoding
  - Used to warn when approaching the ~2048 character URL limit (`inspectWaUrl`)
- [x] Placeholder interpolation helper: `interpolateTemplate(template, data)` supporting `{group}`, `{title}`, `{date}`, `{due}`, `{items}`, `{link}`, `{name}`, `{pending_count}`

---

## 4.5 — Token Generator (`src/lib/tokens.ts`)

- [x] Install nanoid: `npm install nanoid`
- [x] Implement `generateToken(length?: number): string`:
  - Default length: 10 characters
  - URL-safe alphabet
  - Unguessable
- [x] Implement `generateUniqueTaskToken(): Promise<string>` used on task list create:
  - Generate → insert attempt → on unique violation retry up to 3 times → fallback to longer token

---

## 4.6 — Utility Helpers (`src/lib/utils.ts`)

- [x] `formatDate(date, timezone)` — display dates in admin's timezone
- [x] `formatRelativeTime(date)` — "2 hours ago", "just now"
- [x] `isOverdue(dueAt, status)` — checks if a task is overdue
- [x] `computeLinkStatus(deletedAt, listDate, dueAt)` — computes active, readonly, or expired
- [x] `getDateRange(filter: 'today' | 'week' | 'month' | 'custom', from?, to?)`
- [x] `sanitizeHtml(input: string)` — strip HTML tags from user inputs
- [x] `truncateText(text, maxLength)` — for message previews
- [x] `cn(...classes)` — conditional class merging

---

## 4.7 — Constants (`src/lib/constants.ts`)

- [x] `MAX_PIN_ATTEMPTS = 5`
- [x] `RATE_LIMIT_WINDOW_MINUTES = 15`
- [x] `GLOBAL_RATE_LIMIT_HOUR = 30`
- [x] `SESSION_MAX_AGE_DAYS = 30`
- [x] `SESSION_REFRESH_AFTER_DAYS = 7`
- [x] `DEFAULT_PAGE_SIZE = 20`
- [x] `MAX_PAGE_SIZE = 100`
- [x] `TOKEN_LENGTH = 10`
- [x] `MAX_TASK_ITEMS = 50`
- [x] `MAX_WHATSAPP_URL_LENGTH = 2048`
- [x] `SWR_POLL_INTERVAL_MS = 15000`
- [x] `MEMBER_LINK_EXPIRY_DAYS = 7`
- [x] `PUBLIC_WRITE_RATE_LIMIT_PER_MINUTE = 60`
- [x] `BCRYPT_SALT_ROUNDS = 10`

**Acceptance Criteria:**
> ✅ All types defined, Zod schemas validate correctly, error helpers return standard format, WhatsApp message builder produces correct messages, token generator creates unique tokens.

---

# ═══════════════════════════════════════════════
# PHASE 5 — REUSABLE UI COMPONENTS
# ═══════════════════════════════════════════════
> **Goal:** Build the complete UI component library — buttons, cards, modals, toasts, layout — so all pages look consistent and premium.  
> **Estimated Time:** 1.5 days

---

## 5.1 — Design System Setup

- [x] Define CSS custom properties in `globals.css` for the design system:
  - Colors (dark mode ready): background, foreground, card, border, primary, muted
  - Spacing scale
  - Border radius tokens
  - Shadow tokens (sm, md, lg, xl)
  - Transition durations
- [x] Import Google Fonts (Inter) in layout
- [x] Set dark/light mode support via `prefers-color-scheme` or manual toggle

---

## 5.2 — Primitive UI Components (`src/components/ui/`)

- [x] `Button.tsx` — variants: primary, secondary, outline, ghost, danger; sizes: sm, md, lg; loading state with spinner; disabled state
- [x] `Input.tsx` — text input with label, error message, helper text; variants: default, error
- [x] `Card.tsx` — container with padding, shadow, rounded corners; variants: default, interactive (hover effect)
- [x] `Badge.tsx` — status badges: pending (yellow), done (green), verified (blue), overdue (red), draft (gray)
- [x] `Modal.tsx` — overlay dialog with title, body, actions; close on backdrop click / Escape; focus trap
- [x] `Toast.tsx` + `ToastProvider` — success/error/info notifications; auto-dismiss after 5s; stack multiple
- [x] `Skeleton.tsx` — loading placeholders: line, circle, card, table row
- [x] `EmptyState.tsx` — illustration + message + CTA button; reusable for all empty screens
- [x] `ProgressBar.tsx` — animated fill bar with percentage label; color changes by progress (red → yellow → green)
- [x] `Spinner.tsx` — loading spinner in 3 sizes
- [x] `Dropdown.tsx` — select/menu component
- [x] `ConfirmDialog.tsx` — "Are you sure?" modal for destructive actions
- [x] `Tabs.tsx` — tab navigation component
- [x] `DatePicker.tsx` — date input with calendar
- [x] `SearchInput.tsx` — search box with debounce

---

## 5.3 — Admin Layout Components (`src/components/admin/`)

- [x] `AdminLayout.tsx` — wrapper with sidebar (desktop) / bottom nav (mobile) + top bar + main content area
- [x] `Sidebar.tsx` — navigation links: Dashboard, Groups, Tasks, Templates, Reports, Settings; active state highlighting; collapsible on desktop
- [x] `TopBar.tsx` — page title, breadcrumbs, action buttons area, logout button
- [x] `KpiCard.tsx` — number + label + trend arrow (up/down) + color coding
- [x] `GroupCard.tsx` — group name, member count, completion ring, last activity
- [x] `TaskListCard.tsx` — title, group badge, date, status badge, item count, progress bar, quick actions (share, edit, delete)
- [x] `MemberRow.tsx` — name, phone (masked), status indicator, action buttons

---

## 5.4 — Member Page Components (`src/components/member/`)

- [x] `NamePicker.tsx` — dropdown/list of group members; remembers selection in localStorage; validates against server
- [x] `TaskChecklist.tsx` — list of items with checkboxes; tick/undo animation; disabled for read-only/expired lists
- [x] `MemberProgress.tsx` — progress bar + "X of Y done" text + confetti animation on 100%

---

## 5.5 — SWR Hook (`src/hooks/useSWRFetch.ts`)

- [x] Install SWR: `npm install swr`
- [x] Create typed wrapper around `useSWR`:
  - Default fetcher using `fetch` with credentials
  - Polling interval: 15 seconds (configurable)
  - Revalidate on focus: true
  - Error retry: 3 times with exponential backoff
  - Loading / error / data states

---

## 5.6 — Session Hook (`src/hooks/useSession.ts`)

- [x] Client-side hook that checks if admin session is valid
- [x] Redirects to `/login` if not authenticated
- [x] Provides admin info (name, org) to components

**Acceptance Criteria:**
> ✅ All UI components render correctly, look premium, are responsive (mobile-first), support dark mode foundations, have loading/error/empty states, admin layout works on phone and desktop.

---

# ═══════════════════════════════════════════════
# PHASE 6 — GROUPS & MEMBERS MANAGEMENT
# ═══════════════════════════════════════════════
> **Goal:** Full CRUD for groups and members, including CSV import, soft delete, and sorting.  
> **Estimated Time:** 1.5 days

---

## 6.1 — Groups API

- [ ] `GET /api/admin/groups` — List all groups (paginated, org-scoped):
  - Query params: `page`, `limit`, `search`
  - Filter: `WHERE deleted_at IS NULL AND org_id = ?`
  - Order by: `sort_order ASC, name ASC`
  - Include: member count, active task list count, last activity date
  - Return: `PaginatedResponse<Group>`
- [ ] `POST /api/admin/groups` — Create group:
  - Validate with Zod: name (required, max 100), description (optional, max 500)
  - Set `org_id` and `created_by` from session
  - Return created group
- [ ] `GET /api/admin/groups/[id]` — Get group detail:
  - Include: all members (active and inactive), recent task lists, completion stats
- [ ] `PATCH /api/admin/groups/[id]` — Update group:
  - Updateable: name, description, verify_required, sort_order
  - Set `updated_at = now()`
- [ ] `DELETE /api/admin/groups/[id]` — Soft delete:
  - Set `deleted_at = now()` (NOT hard delete)
  - Confirmation required on frontend (ConfirmDialog)
  - Also soft-delete associated task_lists

---

## 6.2 — Members API

- [ ] `GET /api/admin/members?group_id=` — List members of a group:
  - Filter: `WHERE deleted_at IS NULL AND group_id = ?`
  - Include: completion stats for each member
- [ ] `POST /api/admin/members` — Add member:
  - Validate: name (required, max 100), phone (optional, regex), group_id (required)
  - Check member doesn't already exist in group (by name)
- [ ] `PATCH /api/admin/members/[id]` — Update member:
  - Updateable: name, phone, active
- [ ] `DELETE /api/admin/members/[id]` — Soft delete:
  - Set `deleted_at = now()`
  - Set `active = false`
- [ ] `POST /api/admin/members/import` — CSV import:
  - Accept CSV: `name,phone` per line
  - Parse and validate each row
  - Insert in batch
  - Return: count of imported, count of skipped (duplicates), errors

---

## 6.3 — Groups List Page (`src/app/admin/groups/page.tsx`)

- [ ] Page header: "Groups" title + "New Group" button
- [ ] Search box to filter groups by name
- [ ] Grid/list of `GroupCard` components:
  - Group name, description preview
  - Member count badge
  - Completion percentage ring
  - Last active date
  - Click → navigate to group detail
- [ ] Empty state: "No groups yet. Create your first group →"
- [ ] Loading state: skeleton cards
- [ ] SWR polling for live updates

---

## 6.4 — Create Group Page (`src/app/admin/groups/new/page.tsx`)

- [ ] Form: group name (required), description (optional)
- [ ] "Add Members" section:
  - Add one by one: name + phone fields with "Add" button
  - CSV paste/upload: textarea or file upload
  - Preview list of members to be added
  - Remove individual members before saving
- [ ] verify_required toggle: "Require professor verification after member marks done?"
- [ ] Save button → creates group + members in one API call
- [ ] Success: redirect to group detail page with toast

---

## 6.5 — Group Detail Page (`src/app/admin/groups/[id]/page.tsx`)

- [ ] Group header: name, description, edit button, delete button
- [ ] Members section:
  - List of members with name, phone (partially masked), active/inactive badge
  - "Add Member" button
  - Edit/deactivate/delete actions per member
  - CSV import button
- [ ] Task History section:
  - Recent task lists for this group
  - Completion stats
  - Filter by date range
- [ ] Overall stats: total tasks assigned, completion rate, average response time

**Acceptance Criteria:**
> ✅ Can create/edit/delete groups, add/edit/delete/import members, soft delete works (data recoverable), pagination works, search works, empty states shown correctly.

---

# ═══════════════════════════════════════════════
# PHASE 7 — TASK LISTS & TASK ITEMS
# ═══════════════════════════════════════════════
> **Goal:** Full CRUD for task lists and items, including token generation, status management, and the task detail view.  
> **Estimated Time:** 2 days

---

## 7.1 — Task Lists API

- [ ] `GET /api/admin/task-lists` — List task lists (paginated):
  - Query params: `page`, `limit`, `group_id`, `status`, `from`, `to`
  - Filter: `WHERE deleted_at IS NULL AND org_id = ?`
  - Order by: `list_date DESC, created_at DESC`
  - Include: group name, item count, completion stats
- [ ] `POST /api/admin/task-lists` — Create task list:
  - Validate: title (max 100), group_id, list_date, due_at (optional), items[] (max 50)
  - Generate unique token via `nanoid`
  - Set status = `draft`
  - Create task_items in batch with position numbers
  - Return created task list with items
- [ ] `GET /api/admin/task-lists/[id]` — Get task list detail:
  - Include: all items (ordered by position), completions, share log, opens
  - Include: group info, member list
- [ ] `PATCH /api/admin/task-lists/[id]` — Update task list:
  - Updateable: title, list_date, due_at, status
  - Set `updated_at = now()`
- [ ] `DELETE /api/admin/task-lists/[id]` — Soft delete:
  - Set `deleted_at = now()`, status = `archived`

---

## 7.2 — Task Items API

- [ ] `POST /api/admin/items` — Add item to existing list:
  - Validate: task_list_id, text (max 500), position, priority, assigned_member_id, due_at
- [ ] `PATCH /api/admin/items/[id]` — Update item:
  - Updateable: text, position, priority, assigned_member_id, due_at
- [ ] `DELETE /api/admin/items/[id]` — Delete item:
  - Hard delete (items don't need soft delete)
  - Recalculate positions
- [ ] `POST /api/admin/items/[id]/complete` — Professor marks done directly:
  - Set `task_items.status = 'verified'`, `completed_at = now()`, `verified_at = now()`
  - Insert into `completions` with `member_id = null`
  - Update parent `task_lists.status` if all items are done
- [ ] `POST /api/admin/items/[id]/verify` — Professor verifies member's tick:
  - Set `task_items.status = 'verified'`, `verified_at = now()`
  - Update `completions.status = 'verified'`, `verified_at = now()`
- [ ] `POST /api/admin/items/[id]/undo` — Professor undoes completion:
  - Reset `task_items.status = 'pending'`, clear completion fields
  - Delete from `completions`
- [ ] Batch reorder endpoint: `PATCH /api/admin/items/reorder`:
  - Accept array of `{ id, position }`
  - Update all positions in one transaction

---

## 7.3 — Task Status Flow (Business Logic)

- [ ] Implement the status state machine (respect group `verify_required` — see Core Business Rules):
  ```
  Pending ──(member ticks, verify_required=true)──► Done ──(professor verifies)──► Verified
     │                                              │
     │                                              └──(member ticks, verify_required=false)──► Verified
     │
     └──────────(professor ticks directly)───────────────────────────────────────────────────► Verified
  ```
- [ ] When an item is completed:
  - Update `task_items` (denormalized status)
  - Insert/replace into `completions` (audit log) in the **same transaction**
  - For professor ticks: delete any existing `completions` row with `member_id IS NULL` for that item, then insert
- [ ] When all items in a list are `done` or `verified` (if `verify_required`, require all `verified` to mark list completed — or treat `done`+`verified` as complete for list status; **lock:** list completes when **no item remains `pending`**):
  - Auto-update `task_lists.status = 'completed'`
- [ ] Overdue detection:
  - `status = 'pending' AND (due_at IS NOT NULL AND due_at < now())`
  - Calculated dynamically, not stored

---

## 7.4 — Create/Edit Task List Page (`src/app/admin/tasks/new/page.tsx`)

- [ ] Form fields:
  - Title (required, max 100)
  - Group (dropdown — default: last-used group)
  - Date (date picker — default: today)
  - Due time (optional time picker)
- [ ] Checklist items section:
  - Add items one by one (text input + "Add" button, Enter key submits)
  - Drag-to-reorder items
  - Delete individual items (X button)
  - Priority dropdown per item (low/normal/high/urgent)
  - Assign to member dropdown per item (optional)
  - Individual due time per item (optional)
- [ ] Template picker button: select from saved templates to pre-fill items (full template CRUD is Phase 12 — for Phase 7, allow empty picker / skip until templates exist)
- [ ] **Basic quick-add:** paste multi-line text → split by newline → strip numbering → items (enhanced AI parse is Phase 15; richer paste UI is Phase 12.4 — reuse the same helper)
- [ ] Item count + warning if exceeding 50 items
- [ ] Save as Draft / Save & Share buttons
- [ ] "Save & Share" → saves then opens share sheet (Phase 8)

---

## 7.5 — Task List Detail Page (`src/app/admin/tasks/[id]/page.tsx`)

- [ ] Header: title, group badge, date, status badge, due time
- [ ] Action buttons: Edit, Share, Remind, Delete
- [ ] Progress section: progress bar + "X of Y done" + overdue count
- [ ] Items list:
  - Each item shows: text, status badge, assigned member (if any), completed by/at, verified by/at
  - Professor actions per item: Mark Done, Verify, Undo
  - Notes/comments on each item
- [ ] Activity timeline: share events, completion events, open events (chronological)
- [ ] "Opened by" section: which members opened the link, when, how many times
- [ ] Share log: when was this list shared, via which channel

---

## 7.6 — Task Lists Page (`src/app/admin/tasks/page.tsx`)

- [ ] Page header: "Task Lists" title + "New Task List" button
- [ ] Filters: date range (today/this week/this month/custom), group, status
- [ ] List/grid of `TaskListCard` components:
  - Title, group badge, date, status badge
  - Progress bar with completion count
  - Quick actions: Share, Edit, Delete
- [ ] Tabs: "Active" / "Completed" / "Archived" / "All"
- [ ] Empty state per tab
- [ ] Loading skeletons
- [ ] SWR polling

**Acceptance Criteria:**
> ✅ Can create task lists with items, edit/delete items, reorder items, professor can mark done/verify/undo, status flow works correctly, task list auto-completes when all items done, overdue detection works, quick-add paste works.

---

# ═══════════════════════════════════════════════
# PHASE 8 — WHATSAPP SHARING SYSTEM
# ═══════════════════════════════════════════════
> **Goal:** Complete WhatsApp sharing flow — message preview, wa.me link, copy fallback, native share, "Mark as sent" logging.  
> **Estimated Time:** 1 day

---

## 8.1 — Share API

- [ ] `POST /api/admin/task-lists/[id]/share` — Log a share event:
  - Accept: `{ channel: 'whatsapp_group' | 'whatsapp_individual' | 'copy' | 'native_share' }`
  - Insert into `share_log`
  - Update `task_lists.shared_at = now()` (first share only)
  - Update `task_lists.status = 'active'` (if was 'draft')
  - Return: `{ success: true, shared_at }`

---

## 8.2 — Share Sheet Component (`src/components/admin/ShareSheet.tsx`)

- [ ] Modal or slide-up panel triggered from task list card/detail
- [ ] Message preview:
  - Shows the formatted WhatsApp message with emojis
  - Editable text area — admin can modify before sending
  - Character count showing **encoded URL length** (not just text length)
  - Warning badge when approaching 2048 URL character limit
- [ ] Action buttons:
  - **"Open WhatsApp"** (primary) → opens `wa.me/?text=...` in new tab
  - **"Copy Message"** → copies to clipboard with success toast
  - **"Share via..."** (mobile only) → uses `navigator.share()` API
  - **"Send to Individual"** → shows member list with phone numbers, opens `wa.me/<number>?text=...`
- [ ] "Mark as Sent ✔" button:
  - Shown after WhatsApp opens (or always visible)
  - Logs the share event via API
  - Shows timestamp of last share
- [ ] Member link display:
  - Shows the public member link (`APP_URL/t/<token>`)
  - Copy button for the link itself
- [ ] Previous shares section:
  - When was this list last shared
  - Via which channel

---

## 8.3 — Share from Task List Card

- [ ] Quick "Share" button on `TaskListCard` → opens share sheet
- [ ] Quick "Share" button on task list detail page
- [ ] "Share & Create Another" flow after creating a new task list

---

## 8.4 — Reminder Flow

- [ ] `POST /api/admin/task-lists/[id]/remind` — Log a reminder:
  - Accept: `{ member_id?: uuid, channel: string }`
  - If `member_id` is null → group reminder; else → individual reminder
  - Insert into `share_log` with `kind = 'reminder'`
- [ ] "Remind" button on task list detail:
  - "Remind All" → generates group reminder message → opens wa.me
  - "Remind Pending" → shows list of members who haven't completed all items → individual wa.me links
  - "Remind Overdue" → generates overdue message template

**Acceptance Criteria:**
> ✅ Can share to WhatsApp in 3 taps (Share → pick group → Send), message preview is editable, URL length is tracked, copy and native share work as fallbacks, share events are logged with channel, Mark as Sent updates the card, reminders work for group and individuals.

---

# ═══════════════════════════════════════════════
# PHASE 9 — PUBLIC MEMBER PAGE
# ═══════════════════════════════════════════════
> **Goal:** The page members see when they tap the link in WhatsApp. Name picker, task checklist, tick/undo, progress bar, opened-by tracking. No login required.  
> **Estimated Time:** 1.5 days

---

## 9.1 — Member Page API (Public)

- [ ] `GET /api/t/[token]` — Get task list data:
  - Look up `task_lists` by token (join group for name + `verify_required`)
  - Compute status using **Core Business Rules** (expiry = due_at or list_date + 7 days):
    - If not found OR `deleted_at IS NOT NULL` → `{ status: 'expired' }`
    - If past expiry OR list `status` is `archived` → `{ status: 'readonly' }`
    - If list `status` is `completed` → `{ status: 'readonly' }` (viewable, no new ticks)
    - Else → `{ status: 'active' }`
  - Include: task list info, all items (ordered), **active** group members only, completions
  - Response shape:
    ```json
    {
      "status": "active" | "readonly" | "expired",
      "expires_at": "ISO-8601",
      "verify_required": true,
      "task_list": { "title": "...", "group_name": "...", "list_date": "...", "due_at": "..." },
      "items": [{ "id": "...", "text": "...", "position": 1, "priority": "normal", "status": "pending", "completed_by": null, "completed_at": null }],
      "members": [{ "id": "...", "name": "..." }],
      "completions": [{ "task_item_id": "...", "member_id": "...", "status": "done", "note": null, "completed_at": "..." }]
    }
    ```
- [ ] `POST /api/t/[token]/open` — Track page open:
  - Accept: `{ member_id }`
  - Apply public write rate limit
  - Upsert into `opens`: `ON CONFLICT (task_list_id, member_id) DO UPDATE SET last_opened_at = now(), open_count = open_count + 1`
- [ ] `POST /api/t/[token]/items/[id]/complete` — Member ticks item:
  - Accept: `{ member_id, note? }`
  - Apply public write rate limit
  - Validate: member belongs to this group and `active = true`
  - Validate: computed list status is `active` (not readonly/expired)
  - Set `task_items.status` to `done` if `verify_required`, else `verified` (+ set `verified_at` when skipping verify)
  - Set `completed_by`, `completed_at`
  - Insert into `completions` (`ON CONFLICT DO NOTHING` — prevents duplicate ticks)
  - If all items non-pending → auto-update list status to `completed`
  - Return updated item
- [ ] `POST /api/t/[token]/items/[id]/undo` — Member undoes tick:
  - Accept: `{ member_id }`
  - Apply public write rate limit
  - Validate: the completion belongs to this member
  - Block undo if item is already `verified` and `verify_required` is true (only professor can undo verified)
  - Reset `task_items` status to `pending`; clear completion fields
  - Delete from `completions`
  - Return updated item

---

## 9.2 — Member Page UI (`src/app/t/[token]/page.tsx`)

- [ ] **First visit flow:**
  - Show task list title, group name, date at top
  - "Who are you?" prompt with `NamePicker` component
  - List of group members as selectable buttons
  - On selection: save to `localStorage`, call `/open` API, show checklist
- [ ] **Returning visit flow:**
  - Read saved member from `localStorage`
  - Validate member still exists in group (API check)
  - If valid → show checklist directly
  - If invalid → show name picker again
  - "Not you? Switch" link to re-pick name
- [ ] **Checklist view:**
  - Task list header: title, group, date, due time
  - Progress bar: "X of Y done" with animated fill
  - List of items:
    - Checkbox + text
    - Tap to toggle done/undo
    - Smooth tick animation (check mark draws in)
    - Note icon — tap to add a note to an item
    - Status indicators: pending (empty), done (green check), verified (blue double-check)
    - Items completed by other members shown with "✓ Done by [Name]" label
  - Confetti/celebration animation when all items are done 🎉
- [ ] **Read-only state:**
  - Show all items but checkboxes are disabled
  - Banner: "This list is read-only (expired or completed)"
- [ ] **Expired state:**
  - Show message: "This task list has expired"
  - No items shown
- [ ] **Responsive design:**
  - Full-width on mobile
  - Centered card on desktop
  - Large touch targets for checkboxes
  - Smooth transitions
- [ ] **Optimistic updates:**
  - Tick immediately on tap (don't wait for API)
  - Revert if API fails with error toast
  - SWR revalidation on focus to sync with other members' changes

---

## 9.3 — Concurrency & Edge Cases

- [ ] Multiple members ticking simultaneously: DB unique constraint prevents duplicates
- [ ] Member ticks item then another member tries: second member sees "Done by [Name]"
- [ ] Network failure during tick: optimistic update reverts, retry button shown
- [ ] Token not found: 404 page with friendly message
- [ ] localStorage cleared: name picker shown again

**Acceptance Criteria:**
> ✅ Member taps WhatsApp link → page loads → picks name (remembered) → sees checklist → ticks items → progress bar updates → professor's dashboard sees the change within 15s. Works on all phones, no login needed, handles expired/readonly states.

---

# ═══════════════════════════════════════════════
# PHASE 10 — ADMIN DASHBOARD & KPIs
# ═══════════════════════════════════════════════
> **Goal:** The professor's home screen — live KPIs, today's task lists, overdue alerts, per-group progress, date filters. Auto-refreshes via SWR polling.  
> **Estimated Time:** 1.5 days

---

## 10.1 — Dashboard API

- [ ] `GET /api/admin/dashboard` — Aggregated dashboard data:
  - Query params: `from`, `to`, `group_id`
  - Default range: today
  - Returns:
    ```json
    {
      "kpis": {
        "total_created": 45,
        "total_done": 30,
        "total_verified": 25,
        "total_pending": 15,
        "total_overdue": 3,
        "completion_rate": 66.7
      },
      "groups": [
        {
          "id": "...", "name": "...",
          "created": 10, "done": 7, "pending": 3, "overdue": 1,
          "completion_rate": 70,
          "members_opened": 5, "members_total": 8
        }
      ],
      "recent_lists": [
        { "id": "...", "title": "...", "group_name": "...", "status": "...", "progress": 70 }
      ],
      "overdue_items": [
        { "id": "...", "text": "...", "task_list_title": "...", "group_name": "...", "due_at": "..." }
      ]
    }
    ```
  - Performance: use indexes; consider `daily_stats` table for historical queries

---

## 10.2 — Dashboard Page (`src/app/admin/page.tsx`)

- [ ] **Top bar:** "Good morning, [Name]" + date + logout
- [ ] **Date filter:** Today / This Week / This Month / Custom range (date picker)
- [ ] **Group filter:** All Groups / specific group dropdown
- [ ] **KPI Cards row (4 cards):**
  - Total Created (📋 blue)
  - Completed (✅ green)
  - Pending (⏳ yellow)
  - Overdue (⚠️ red, pulses if > 0)
  - Each card shows number + percentage change from previous period
- [ ] **Today's Task Lists section:**
  - List of today's task lists as `TaskListCard` components
  - Quick actions: Share, View, Edit
  - Status badges: Draft, Active, Completed
  - "New Task List" button if empty
- [ ] **Overdue Alerts section:**
  - Red-highlighted list of overdue items
  - Each shows: item text, task list name, group, how long overdue
  - Quick action: "Remind" button per item
  - Collapsible if many items
- [ ] **Per-Group Progress section:**
  - Grid of cards, one per group
  - Each shows: group name, circular progress ring (0-100%), member count, today's tasks
  - Click → navigate to group detail
- [ ] **SWR polling:** auto-refresh every 15 seconds, refresh on tab focus
- [ ] **Loading state:** skeleton placeholders for all sections
- [ ] **Empty state:** "No tasks for today. Create your first task list →"
- [ ] **Mobile layout:** cards stack vertically, touch-friendly

---

## 10.3 — Professor Actions from Dashboard

- [ ] Quick-tick: professor can mark items done directly from the dashboard overdue list
- [ ] Quick-verify: tap to verify pending items from the dashboard
- [ ] Quick-share: share button on each task list card
- [ ] Quick-remind: remind button on overdue items → opens WhatsApp with reminder message

**Acceptance Criteria:**
> ✅ Dashboard loads fast, shows correct numbers, auto-refreshes, filters work (date + group), overdue items are highlighted, professor can take actions directly from dashboard, works on mobile.

---

# ═══════════════════════════════════════════════
# PHASE 11 — EXPORT, BACKUP, MAINTENANCE & SETTINGS
# ═══════════════════════════════════════════════
> **Goal:** CSV export, keep-alive cron (with cleanup), health endpoint, PWA manifest, settings page.  
> **Estimated Time:** 1 day

---

## 11.1 — CSV Export

- [ ] `GET /api/admin/export` — Export data as CSV:
  - Query params: `format=csv`, `from`, `to`, `group_id`
  - Generates CSV with columns: Date, Group, Task List, Item, Status, Completed By, Completed At, Verified At, Notes
  - Sets headers: `Content-Type: text/csv`, `Content-Disposition: attachment; filename=tasks-export-{date}.csv`
  - Streams data for large exports
- [ ] Export button on Reports page and Dashboard
- [ ] Monthly backup reminder: show toast on 1st of each month "Download your monthly backup →"

---

## 11.2 — Keep-Alive Cron

- [ ] `GET /api/cron/keepalive` (`src/app/api/cron/keepalive/route.ts`):
  - Verify `Authorization: Bearer ${CRON_SECRET}` header
  - Ping Supabase: `SELECT 1 FROM groups LIMIT 1`
  - Clean up old `login_attempts` rows (older than 24 hours)
  - Update `daily_stats` table (aggregate previous day's data)
  - Auto-archive task lists older than 90 days (set status = `archived`)
  - Return: `{ ok: true, cleaned: N, archived: M }`
- [ ] Configure in `vercel.json`:
  ```json
  { "crons": [{ "path": "/api/cron/keepalive", "schedule": "0 3 * * *" }] }
  ```
  > Vercel Hobby cron is **UTC**. `0 3 * * *` ≈ 8:30 AM IST — fine for keepalive/cleanup; do **not** use this cron for precise user-facing reminder times.

---

## 11.3 — Health Endpoint

- [ ] `GET /api/health`:
  - Check Supabase connectivity (quick SELECT)
  - Return: `{ status: "ok" | "degraded", db: "connected" | "error", timestamp, version }`
  - No auth required (for monitoring)

---

## 11.4 — PWA Setup

- [ ] Create `public/manifest.json`:
  - Name, short_name, description
  - Icons (192x192, 512x512)
  - Theme color, background color
  - Display: `standalone`
  - Start URL: `/admin`
- [ ] Create service worker (`public/sw.js`):
  - Cache static assets (CSS, JS, fonts)
  - Cache-first for static, network-first for API
  - Offline fallback page: "You're offline. Your data is safe."
- [ ] Add manifest link and meta tags to `layout.tsx`
- [ ] Add Apple-specific meta tags for iOS PWA
- [ ] Generate icons in multiple sizes
- [ ] "Install App" button in settings page with install prompt

---

## 11.5 — Settings Page (`src/app/admin/settings/page.tsx`)

- [ ] **Change PIN section:**
  - Current PIN input (6 digits)
  - New PIN input (6 digits)
  - Confirm New PIN input
  - Submit → API call → success toast → re-login
- [ ] **Profile section:**
  - Admin name (editable)
  - Timezone selector (default: Asia/Kolkata)
  - Language preference (English for now)
- [ ] **App section:**
  - Default message format preview
  - Install PWA button
  - App version display
- [ ] **Data section:**
  - "Export All Data (CSV)" button
  - "Download Backup" button
  - Data storage usage indicator
- [ ] **Danger zone:**
  - "Delete Account" — omit (single-professor install; wipe via Supabase if ever needed)

**Acceptance Criteria:**
> ✅ CSV export downloads correct data, keep-alive cron runs daily and cleans up old data, health endpoint works, PWA installs on phone home screen, settings page allows PIN change and preferences.

---

# ═══════════════════════════════════════════════
# PHASE 12 — TEMPLATES & RECURRING TASKS
# ═══════════════════════════════════════════════
> **Goal:** Save checklist templates and message templates. Duplicate/clone lists. Paste-to-split. Recurring daily/weekly schedules.  
> **Estimated Time:** 1.5 days

---

## 12.1 — Templates API

- [ ] `GET /api/admin/templates` — List templates:
  - Filter by `type`: `checklist` or `message`
  - Org-scoped
- [ ] `POST /api/admin/templates` — Create template:
  - Validate: name, type, body (JSONB — schema-checked)
  - Checklist body: `{ items: string[], default_due_offset_hours?: number }`
  - Message body: `{ text: string, placeholders: string[] }`
- [ ] `PATCH /api/admin/templates/[id]` — Update template
- [ ] `DELETE /api/admin/templates/[id]` — Delete template

---

## 12.2 — Templates Page (`src/app/admin/templates/page.tsx`)

- [ ] Two tabs: "Checklist Templates" / "Message Templates"
- [ ] Grid of template cards: name, type badge, item count (checklist) or preview (message)
- [ ] Create template form:
  - Name
  - Type selector
  - Checklist: add items (same UI as task creation)
  - Message: text editor with placeholder buttons ({title}, {group}, etc.)
- [ ] Edit / Delete actions
- [ ] "Use Template" quick action → navigates to new task list with template pre-filled

---

## 12.3 — Duplicate / Clone Task Lists

- [ ] "Duplicate" button on task list card/detail:
  - Creates a new task list with same items, for today
  - Opens in edit mode so admin can tweak
- [ ] "Duplicate Yesterday" shortcut on dashboard:
  - Shows yesterday's task lists
  - One-tap duplicate for today
- [ ] Clone from any previous list:
  - On task list detail: "Clone as New" button
  - Copies title, items, group — changes date to today

---

## 12.4 — Quick-Add by Paste (enhanced UI)

> Phase 7 already ships a basic newline splitter. This sub-phase upgrades UX only — reuse `parsePastedTasks()` from `lib/utils.ts` (or equivalent). Do not duplicate parser logic.

- [ ] On task creation page: dedicated "Paste Tasks" button + modal
- [ ] Opens a textarea: paste multi-line text
- [ ] Parser (shared helper):
  - Split by newlines
  - Remove numbering (1., 2., -, •, etc.)
  - Trim whitespace
  - Remove empty lines
  - Each line becomes a task item
- [ ] Preview: show parsed items with edit/delete before adding
- [ ] "Add All" button → adds to checklist

---

## 12.5 — Recurring Lists

- [ ] On task list creation: "Repeat" toggle
- [ ] Recurrence options:
  - Daily (every day)
  - Weekly (select days: Mon, Tue, etc.)
  - Custom (every N days)
- [ ] Store recurrence rule in `task_lists.recurrence` JSONB:
  ```json
  { "freq": "weekly", "days": [1, 3, 5], "end_date": "2026-12-31" }
  ```
- [ ] Generation logic (in keep-alive cron or separate endpoint):
  - Check all active recurrence rules
  - If today matches a rule, auto-create the task list (status = draft)
  - Admin still needs to review and share manually
- [ ] Dashboard shows auto-generated lists with "Auto-generated" badge
- [ ] Manage recurrences in settings or templates page

**Acceptance Criteria:**
> ✅ Can save/use/edit/delete checklist and message templates, duplicate any list for today, paste multi-line text → items, set up recurring schedules, auto-generated lists appear on dashboard.

---

# ═══════════════════════════════════════════════
# PHASE 13 — ADVANCED ANALYTICS & REPORTS
# ═══════════════════════════════════════════════
> **Goal:** Visual analytics dashboards with charts, member performance tracking, branded PDF export, email digests.  
> **Estimated Time:** 2 days

---

## 13.1 — Daily Stats Pre-computation

- [ ] In keep-alive cron: compute and upsert daily stats per group per day:
  - `tasks_created`: count of task_items for that group + date
  - `tasks_done`: count with status = done or verified
  - `tasks_verified`: count with status = verified
  - `tasks_overdue`: count overdue items
  - `avg_response_minutes`: average time between `shared_at` and first completion
- [ ] Also: manual recompute endpoint for backfilling historical data

---

## 13.2 — Reports API

- [ ] `GET /api/admin/reports` — Analytics data:
  - Query params: `type` (completion | member | group), `from`, `to`, `group_id`
  - `type=completion`: daily completion counts and rates over time
  - `type=member`: per-member stats (completion rate, avg response time, on-time %)
  - `type=group`: per-group comparison stats
- [ ] `GET /api/admin/reports/pdf` — Generate branded PDF:
  - Date range filter
  - Includes: KPI summary, group charts, member table, trends
  - Returns: PDF file download

---

## 13.3 — Reports Page (`src/app/admin/reports/page.tsx`)

- [ ] Install Recharts: `npm install recharts`
- [ ] **Filters bar:** date range, group selector, report type tabs
- [ ] **Completion Trends chart (line chart):**
  - X-axis: dates, Y-axis: count/percentage
  - Lines: created, done, verified, overdue
  - Toggle between count and percentage view
- [ ] **Group Comparison chart (bar chart):**
  - Bars for each group showing completion rate
  - Color coded: green (>80%), yellow (50-80%), red (<50%)
- [ ] **On-time vs Late chart (pie/donut chart):**
  - Segments: on-time, late, never completed
- [ ] **Member Performance table:**
  - Columns: Name, Tasks Assigned, Completed, On-time %, Avg Response Time, Score
  - Sortable columns
  - Highlight top/bottom performers
- [ ] **Activity Heatmap (calendar view):**
  - Color intensity by activity level per day
  - Hover to see details
- [ ] **Export buttons:**
  - "Download CSV" → existing CSV export
  - "Download PDF Report" → branded PDF
- [ ] **Responsive:** charts resize for mobile

---

## 13.4 — PDF Report Generation

- [ ] Install: `npm install @react-pdf/renderer`
- [ ] Create PDF template with:
  - Header: org name/logo, report title, date range
  - KPI summary section
  - Group completion table
  - Member performance table
  - Footer: generated date, page numbers
- [ ] Generate server-side and stream as download

---

## 13.5 — Email Digests

- [ ] Install: `npm install resend`
- [ ] Store digest config in `organizations.settings` JSONB first (avoid extra table unless needed):
  ```json
  { "report_digest": { "frequency": "weekly", "recipients": ["a@b.com"], "last_sent_at": null } }
  ```
  - Frequency: `daily` / `weekly` / `monthly` / `off`
- [ ] Digest content: KPI summary, overdue alerts, top/bottom performers
- [ ] Send via Resend API (triggered from keepalive cron when due — still once/day max on Hobby)
- [ ] Configure in settings page
- [ ] Add `RESEND_API_KEY` to Vercel env

**Acceptance Criteria:**
> ✅ Analytics page shows charts for completion trends, group comparison, member performance. PDF report downloads correctly with branding. Email digests send on schedule.

---

# ═══════════════════════════════════════════════
# PHASE 14 — MULTI-TENANT SAAS / BILLING — OUT OF SCOPE
# ═══════════════════════════════════════════════
> **Status:** Cancelled (15 Oct 2026). Do **not** build this phase.

This phase previously covered public signup, co-admins, paid plan limits, and Razorpay billing. The product is **one professor’s tool** only:

- Seed a single organization + one admin PIN in Phase 2 / 3.
- Keep `org_id` on tables (already decided Day 1) so queries stay consistent — still **one** org in practice.
- No `/signup`, no plan meters, no upgrade prompts, no Razorpay/Stripe, no payment webhooks, no billing page.

If a second helper ever needs access, handle it manually later (extra admin row) — not as a SaaS product.

**Skip to Phase 15** (or Phase 16) after Phase 13 when you want optional extras. Phase 16 no longer depends on Phase 14.

---

# ═══════════════════════════════════════════════
# PHASE 15 — AI-POWERED FEATURES
# ═══════════════════════════════════════════════
> **Goal:** AI-assisted task creation — smart paste, voice-to-tasks, AI-drafted reminders, auto-categorization.  
> **Estimated Time:** 1.5 days

---

## 15.1 — AI Integration Setup

- [ ] Install Google AI SDK: `npm install @google/generative-ai`
- [ ] Create `src/lib/ai.ts`:
  - Initialize Gemini client with API key
  - Helper: `parseTextToTasks(text: string): Promise<TaskItem[]>`
  - Helper: `draftReminder(context: ReminderContext): Promise<string>`
  - Helper: `categorizeTask(text: string): Promise<string>`
  - Rate limiting: max 15 requests/minute (free tier)
  - Error handling: fallback gracefully if API is down

---

## 15.2 — Smart Paste-to-Checklist

- [ ] `POST /api/admin/ai/parse-text`:
  - Accept: `{ text: string }`
  - Send to Gemini: "Extract action items from this text as a JSON array"
  - Return: `{ items: [{ text, suggested_priority, suggested_due }] }`
- [ ] UI: on task creation page, "AI Parse" button next to paste area
  - Paste messy text → click "AI Parse" → items appear in checklist
  - Admin can edit/remove before saving

---

## 15.3 — Voice-to-Tasks

- [ ] Use browser `Web Speech API` (free, no server needed):
  - "Speak Tasks" button → starts recording
  - Real-time transcription display
  - On stop → send transcript to AI parse endpoint
  - Results appear as task items
- [ ] Fallback: show "Voice input not supported in this browser"

---

## 15.4 — AI-Drafted Reminders

- [ ] `POST /api/admin/ai/draft-reminder`:
  - Accept: `{ task_list_id }`
  - Fetch: pending items, who hasn't completed, how long overdue
  - Send context to Gemini: "Draft a polite WhatsApp reminder..."
  - Return: `{ message: string }`
- [ ] UI: on remind flow, "AI Draft" button → generates contextual message → editable → share
- [ ] Multilingual: "Draft in Hindi/Marathi" toggle

**Acceptance Criteria:**
> ✅ Admin can paste text and AI structures it into tasks. Voice input works on supported browsers. AI drafts contextual reminders. All AI features degrade gracefully if API is unavailable.

---

# ═══════════════════════════════════════════════
# PHASE 16 — WHATSAPP BUSINESS API INTEGRATION
# ═══════════════════════════════════════════════
> **Goal:** Automated WhatsApp message delivery — auto-send, auto-remind, delivery receipts. Premium feature for Business plan.  
> **Estimated Time:** 2 days

---

## 16.1 — WhatsApp Business Setup

- [ ] Choose BSP (Business Solution Provider): Twilio / Gupshup / Interakt
- [ ] Create `wa_config` table:
  - `org_id`, `provider`, `api_key_encrypted`, `phone_number`, `status`, `created_at`
- [ ] Create `wa_message_log` table:
  - `id`, `org_id`, `task_list_id`, `recipient_phone`, `template_name`, `status` (queued/sent/delivered/read/failed), `sent_at`, `delivered_at`, `read_at`, `error`
- [ ] Create `scheduled_sends` table:
  - `id`, `org_id`, `task_list_id`, `send_at`, `reminder_intervals` (jsonb, e.g., [2h, 1h, 30m before due]), `status` (pending/sent/cancelled)
- [ ] Settings page section: configure WhatsApp Business API credentials

---

## 16.2 — Message Templates (Meta Approval)

- [ ] Create Meta-approved message templates:
  - New task list notification
  - Reminder notification
  - Overdue notification
  - Completion confirmation
- [ ] Template management: list approved templates, track approval status

---

## 16.3 — Auto-Send & Auto-Remind

- [ ] One-click auto-send: admin clicks "Auto-Send" → API sends via WhatsApp Business
- [ ] Scheduled send: admin schedules send for specific time (e.g., 7 AM)
- [ ] Auto-reminders: fire at configured intervals (2h before due, at due time)
- [ ] Webhook handler for delivery/read receipts → update `wa_message_log`
- [ ] Dashboard: show delivery status per message (sent ✓, delivered ✓✓, read ✓✓)

---

## 16.4 — Fallback

- [ ] Always keep `wa.me` free flow as fallback
- [ ] If Business API fails → toast "Auto-send failed. Use manual share instead" → open share sheet

**Acceptance Criteria:**
> ✅ Business plan clients can auto-send and auto-remind via WhatsApp Business API. Delivery receipts shown. Scheduled sends work. Graceful fallback to manual sharing.

---

# ═══════════════════════════════════════════════
# PHASE 17 — GAMIFICATION & ACCOUNTABILITY
# ═══════════════════════════════════════════════
> **Goal:** Member scores, streaks, badges, leaderboards — drive engagement and give admins performance metrics.  
> **Estimated Time:** 1.5 days

---

## 17.1 — Scoring System

- [ ] Create `member_scores` table:
  - `member_id`, `org_id`, `period_start`, `period_end`
  - `on_time_rate` (float), `avg_response_minutes` (float), `consistency` (float)
  - `streak_current` (int), `streak_best` (int)
  - `total_completed`, `total_assigned`, `score` (float)
- [ ] Score formula: `score = (on_time_rate × 0.5) + (response_speed_score × 0.3) + (consistency × 0.2)`
- [ ] Compute scores: daily cron or on each completion event
- [ ] Score history: track weekly/monthly snapshots for trends

---

## 17.2 — Badges

- [ ] Create `badges` table: `id`, `name`, `icon`, `description`, `criteria` (jsonb)
- [ ] Create `member_badges` table: `member_id`, `badge_id`, `earned_at`
- [ ] Default badges:
  - ⚡ Fast Responder — responded within 30 min
  - 🏆 Perfect Week — 100% completion in a week
  - 🔥 5-Day Streak, 🔥 30-Day Streak
  - ⭐ Top Performer — highest score in group
  - 📅 Consistent — no missed tasks for 2 weeks
- [ ] Badge check: run after each completion, award new badges

---

## 17.3 — Leaderboard & Member Page

- [ ] Admin dashboard: member leaderboard per group (sortable)
- [ ] Member page: show own score, current streak, earned badges
- [ ] Optional: make leaderboard visible to members (admin toggleable per group)
- [ ] Nudge messages: "You're 1 task away from a perfect week!"

**Acceptance Criteria:**
> ✅ Scores computed accurately, badges awarded correctly, leaderboard visible to admin, members see their own scores, streaks track correctly.

---

# ═══════════════════════════════════════════════
# PHASE 18 — POLISH, TESTING & LAUNCH
# ═══════════════════════════════════════════════
> **Goal:** Final quality pass — accessibility, performance, testing, documentation, and production launch.  
> **Estimated Time:** 2 days

---

## 18.1 — Accessibility (a11y)

- [ ] Semantic HTML throughout (header, main, nav, section, article)
- [ ] All interactive elements have ARIA labels
- [ ] Keyboard navigation works on all pages (Tab, Enter, Escape)
- [ ] Color contrast ratios meet WCAG AA (4.5:1 for text)
- [ ] Focus indicators visible on all focusable elements
- [ ] Screen reader testing (announce task status changes)
- [ ] Touch targets ≥ 44px on mobile

---

## 18.2 — Performance Optimization

- [ ] Lighthouse audit: aim for 90+ on all scores
- [ ] Optimize images: WebP format, lazy loading
- [ ] Code splitting: dynamic imports for heavy components (charts, PDF)
- [ ] API response times < 500ms for all endpoints
- [ ] Database query optimization: verify all queries use indexes (EXPLAIN ANALYZE)
- [ ] Bundle size check: no unnecessary dependencies

---

## 18.3 — Error Handling Audit

- [ ] Every API endpoint has try/catch with standard error responses
- [ ] Frontend has Error Boundary wrapping admin and member pages
- [ ] Toast notifications for all user-facing errors
- [ ] Offline detection: show "You're offline" banner
- [ ] API timeout handling: show retry button after 10s
- [ ] 404 page: friendly "Page not found" with navigation links
- [ ] 500 page: friendly "Something went wrong" with retry button

---

## 18.4 — Testing

- [ ] Manual testing checklist:
  - [ ] PIN login (correct, wrong, rate-limited)
  - [ ] Create group + members
  - [ ] Create task list with items
  - [ ] Share to WhatsApp (message correct, link works)
  - [ ] Member page: pick name, tick items, undo, progress
  - [ ] Dashboard: numbers match, filters work
  - [ ] CSV export: data correct
  - [ ] Settings: change PIN (old sessions revoked)
  - [ ] Mobile: all pages work on phone
  - [ ] PWA: installs, works offline
- [ ] Edge case testing:
  - [ ] Empty groups, empty task lists
  - [ ] 50 items in one list
  - [ ] Rapid ticking by multiple members
  - [ ] Expired token access
  - [ ] Very long task text (500 chars)

---

## 18.5 — Documentation

- [ ] `README.md`: project overview, setup instructions, environment variables
- [ ] `docs/schema.sql`: complete database schema (keep updated)
- [ ] `docs/api.md`: all API endpoints with request/response examples
- [ ] One-page cheat sheet for end users (PDF, shareable)
- [ ] Deployment guide: Vercel + Supabase setup steps

---

## 18.6 — Production Launch

- [ ] Final Vercel deployment
- [ ] Verify all environment variables set correctly
- [ ] Verify Supabase cron keepalive fires
- [ ] Verify health endpoint returns OK
- [ ] Set up Vercel Analytics (free)
- [ ] Seed initial data: professor's groups, members, templates
- [ ] 15-minute walkthrough with professor
- [ ] Pilot with one group for one week
- [ ] Gather feedback → iterate
- [ ] Roll out to all groups

**Acceptance Criteria:**
> ✅ All accessibility checks pass, Lighthouse 90+, all manual tests pass, documentation complete, deployed to production, professor using it daily.

---

# ═══════════════════════════════════════════════
# PROGRESS TRACKER
# ═══════════════════════════════════════════════

| Phase | Name | Est. Time | Status | Gate |
|---|---|---|---|---|
| 1 | Project Setup & Infrastructure | 1 day | ✅ Completed | |
| 2 | Database Schema & Migrations | 0.5 day | ✅ Completed | |
| 3 | Authentication System | 1.5 days | ✅ Completed | |
| 4 | Core Libraries & Utilities | 1 day | ✅ Completed | |
| 5 | Reusable UI Components | 1.5 days | ✅ Completed | |
| 6 | Groups & Members Management | 1.5 days | ⬜ Not Started | |
| 7 | Task Lists & Task Items | 2 days | ⬜ Not Started | |
| 8 | WhatsApp Sharing System | 1 day | ⬜ Not Started | |
| 9 | Public Member Page | 1.5 days | ⬜ Not Started | |
| 10 | Admin Dashboard & KPIs | 1.5 days | ⬜ Not Started | |
| 11 | Export, Backup, Maintenance & Settings | 1 day | ⬜ Not Started | **🟢 MVP SHIP GATE** — professor can use daily |
| 12 | Templates & Recurring Tasks | 1.5 days | ⬜ Not Started | Comfort |
| 13 | Advanced Analytics & Reports | 2 days | ⬜ Not Started | Premium |
| 14 | Multi-Tenant SaaS / Billing | — | ⛔ Out of scope | Not commercializing |
| 15 | AI-Powered Features | 1.5 days | ⬜ Not Started | Optional premium |
| 16 | WhatsApp Business API Integration | 2 days | ⬜ Not Started | Optional (no Phase 14 dependency) |
| 17 | Gamification & Accountability | 1.5 days | ⬜ Not Started | Optional (needs 13) |
| 18 | Polish, Testing & Launch | 2 days | ⬜ Not Started | Run after the slice you ship |
| | **MVP (Phases 1–11)** | **~14–15 days** | | **Build this first** |
| | **Comfort + optional (12–13, 15–18)** | **~10–12 days** | | Skip 14 entirely |

---

## Phase Dependencies

```
Phase 1 (Setup)
    → Phase 2 (DB)
    → Phase 3 (Auth)
    → Phase 4 (Libraries)
    → Phase 5 (UI)
    → Phase 6 (Groups & Members)
    → Phase 7 (Tasks)
    → Phase 8 (WhatsApp Share)
         ├─→ Phase 9 (Member Page)      [needs 7 + 8 for real share links]
         ├─→ Phase 10 (Dashboard)       [needs 7]
         └─→ Phase 11 (Export/Settings) [needs 6–10 data]
                    ║
                    ╠════ 🟢 MVP SHIP GATE ════
                    ║
                    → Phase 12 (Templates / Recurring)
                         ├─→ Phase 13 (Analytics / PDF / Email)
                         │        → Phase 17 (Gamification)
                         ├─→ Phase 15 (AI)   [independent after 12]
                         └─→ Phase 16 (WA Business API)  [optional; no SaaS prerequisite]
                                    │
                                    → Phase 18 (Polish & Launch)

                    Phase 14 (SaaS / Billing) — ⛔ OUT OF SCOPE (do not build)
```

**Parallelism after Phase 8:** Phase 9, 10, and 11 can proceed in parallel once Phase 7–8 APIs exist. After MVP, Phases 13 / 15 / 16 can proceed in parallel; 17 needs 13. Skip Phase 14.

---

## Pre-Execution Checklist (do once before Phase 1)

- [ ] Supabase account ready; plan Mumbai (`ap-south-1`) region
- [ ] Vercel account ready
- [ ] Choose professor display name + initial 6-digit PIN (hash only at seed time — never commit the PIN)
- [ ] Generate `SESSION_SECRET` and `CRON_SECRET` (long random strings)
- [ ] Confirm this document (v1.1) is the only build checklist you follow

---

## Changelog (planning review)

| Date | Change |
|---|---|
| 15 Oct 2026 | v1.2 — Scope locked to single professor; removed Razorpay/billing/payments; Phase 14 (multi-tenant SaaS) marked out of scope; Phase 16 no longer depends on 14 |
| 14 Oct 2026 | v1.1 — Locked decisions; fixed env/tech phase mismatches; documented business rules (expiry, verify_required, NULL completions); Edge middleware vs `session_version`; public API rate limits; missing routes; MVP ship gate; corrected dependency graph; existing-repo scaffolding notes |

---

> **This document is the single source of truth. Tick each checkbox as you complete it. Prefer finishing Phases 1–11 so the professor can use it daily. Skip Phase 14 forever unless the product goal changes. If a phase needs changes during building, update this document first, then build.**
