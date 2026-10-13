# WhatsApp Task Tracker — Plan Review & Suggested Changes

> Review of [whatsapp-task-tracker-plan.md](file:///d:/WhatsApp-Task-Tracker/docs/whatsapp-task-tracker-plan.md)

---

## 🔴 Critical Issues (Must Fix)

### 1. Database Schema — Missing Indexes
**Location:** §9 Data Model (Lines 316–413)

The schema defines no indexes at all. On free-tier Supabase with growing data, this will cause slow dashboard queries very quickly.

**Add these indexes:**
```sql
-- Rate limiting lookups
CREATE INDEX idx_login_attempts_ip_created ON login_attempts(ip, created_at);

-- Most common queries: task lists by group, by date
CREATE INDEX idx_task_lists_group_date ON task_lists(group_id, list_date);
CREATE INDEX idx_task_lists_token ON task_lists(token);  -- unique already implies this, but be explicit

-- Item lookups by list
CREATE INDEX idx_task_items_list ON task_items(task_list_id, position);

-- Completion lookups (dashboard counts)
CREATE INDEX idx_completions_item ON completions(task_item_id);
CREATE INDEX idx_completions_member ON completions(member_id);

-- Members by group
CREATE INDEX idx_members_group ON members(group_id);

-- Opens tracking
CREATE INDEX idx_opens_task_list ON opens(task_list_id);

-- Share log
CREATE INDEX idx_share_log_task_list ON share_log(task_list_id);
```

---

### 2. Database Schema — `completions` Table Allows Duplicate Ticks
**Location:** §9 Data Model, `completions` table (Lines 376–385)

Nothing prevents a member from inserting multiple `done` rows for the same task item. This will break dashboard counts.

**Add a unique constraint:**
```sql
-- A member can only complete a given item once
ALTER TABLE completions
  ADD CONSTRAINT uq_completion_member_item
  UNIQUE (task_item_id, member_id);
```

Also decide: should `member_id = NULL` (professor-ticked) be allowed alongside a member completion? If not, enforce that in application code.

---

### 3. Database Schema — `admin` Table Has No `updated_at` Column
**Location:** §9 Data Model, `admin` table (Lines 317–322)

When the professor changes their PIN (`POST /api/admin/settings/change-pin`), there's no way to record when the PIN was last changed. Add:
```sql
updated_at timestamptz default now()
```

---

### 4. Rate Limiting — No Cleanup Strategy for `login_attempts`
**Location:** §4.1 (Line 125) and §9 (Lines 324–329)

The plan says "max 5 wrong PINs per IP per 15 min" with counters in the DB, but there is:
- No scheduled cleanup of old `login_attempts` rows → table grows unbounded
- No index on `(ip, created_at)` for the 15-minute window query

**Suggestions:**
- Add a periodic cleanup (e.g., in the keep-alive cron, delete rows older than 24h)
- Add the index listed in issue #1 above
- Consider adding `expires_at` to the table for simpler cleanup queries

---

### 5. `wa.me` Link Length Limit
**Location:** §3.3 (Line 82)

The plan says "keep total length well under ~2,000 characters" but the limit is on the **URL** not the message. After `encodeURIComponent`, the URL can be ~3× longer than the raw text (especially with emojis and Unicode). The practical limit for `wa.me` URLs across all platforms is roughly **2,048 characters for the full URL**.

**Suggestion:** Add a character counter to the share preview that shows the **encoded URL length**, and warn when approaching the limit. Truncate item text or limit to fewer items if needed.

---

### 6. JWT Session — No Revocation Mechanism
**Location:** §4.1 (Lines 123–129)

The 30-day JWT with 7-day refresh has **no revocation mechanism**. If the professor's phone is stolen or compromised:
- There's no way to invalidate the session
- The PIN change doesn't invalidate existing sessions

**Suggestions:**
- Add a `session_version` integer to the `admin` table
- Include `session_version` in the JWT payload
- On PIN change, increment `session_version` → all old JWTs become invalid
- Alternatively, store a `last_pin_change_at` timestamp and reject JWTs issued before that time

---

## 🟡 Gaps & Missing Pieces

### 7. No `updated_at` Timestamps on Most Tables
**Location:** §9 Data Model

Only `admin` has `created_at`. Several tables should also track `updated_at` for debugging, audit trails, and conflict resolution:
- `groups` — when was the group last modified?
- `members` — when was a member deactivated?
- `task_lists` — when were items last edited?
- `templates` — when was a template updated?

**Suggestion:** Add `updated_at timestamptz default now()` to `groups`, `members`, `task_lists`, `task_items`, `templates`, and use a trigger or application-level update.

---

### 8. No Soft Delete Strategy
**Location:** §9 Data Model

All foreign keys use `ON DELETE CASCADE`. This means:
- Deleting a group deletes all its task lists, items, completions, and opens → **permanent data loss**
- No way to recover from accidental deletion
- Dashboard historical data is wiped

**Suggestions:**
- Add `deleted_at timestamptz` (soft delete) to `groups`, `members`, `task_lists`
- Change ON DELETE CASCADE to ON DELETE RESTRICT for critical relations
- Filter queries with `WHERE deleted_at IS NULL`
- Phase 1: at minimum add a confirmation dialog and make delete only soft-delete groups

---

### 9. Missing API Endpoint — Member Page Initial Load
**Location:** §11 API Endpoints (Lines 462–483)

The public endpoint `GET /api/t/{token}` returns "task list, items, members, completions" but there's no mention of:
- How the member's previously-selected name is restored (localStorage on client, but no API to validate it?)
- What happens if the token is expired or the list is read-only?

**Suggestion:** The `GET /api/t/{token}` response should include:
```json
{
  "status": "active" | "readonly" | "expired",
  "expires_at": "...",
  "task_list": { ... },
  "items": [ ... ],
  "members": [ ... ],
  "completions": [ ... ]
}
```

---

### 10. No Error Handling Strategy
**Location:** Entire document

The plan defines the happy path well but never discusses:
- What happens when Supabase is down or paused?
- How API errors are returned to the frontend
- Client-side error boundaries
- Retry logic for failed requests
- Offline behavior (it's a PWA but has no offline strategy)

**Suggestion:** Add a section on error handling:
- Standard error response format: `{ error: string, code: string }`
- Toast/notification system on the frontend
- Graceful degradation when DB is unreachable
- PWA: at minimum show cached last-known state if offline

---

### 11. No Input Validation / Sanitization Strategy
**Location:** §11 API Endpoints, §9 Data Model

The plan doesn't mention:
- Max length for text fields (`title`, `text`, `name`, `note`)
- Input sanitization (XSS via task item text, member names, notes)
- Phone number validation format
- Request body validation library (e.g., Zod)

**Suggestion:** Add a subsection to §8 Architecture:
- Use **Zod** for all API request validation
- Define max lengths: task title (100 chars), item text (500 chars), notes (1000 chars)
- Sanitize HTML in user inputs
- Validate phone numbers with a regex: `/^\d{10,15}$/`

---

### 12. Dashboard Query Performance Concern
**Location:** §9, "Dashboard numbers" (Lines 415–419)

The dashboard counts ("Generated", "Completed", "Remaining", "Overdue") are described as "simple queries" but these will be full table scans with JOINs across `task_items`, `completions`, filtered by date range and group. On free-tier Postgres with growing data, this can get slow.

**Suggestions:**
- Pre-compute daily summary counts in a `daily_stats` table (updated on each completion)
- Or: Use Supabase's Postgres views for materialized dashboard data
- At minimum: ensure the indexes from issue #1 are in place

---

### 13. No CORS / CSRF Considerations
**Location:** §8 Architecture

The plan relies on HttpOnly cookies for auth but doesn't mention:
- CSRF protection (SameSite=Lax helps but is not complete protection for all cases)
- CORS headers configuration for the API

**Suggestion:** 
- Add CSRF token for state-changing admin requests, OR verify the `Origin` header in middleware
- Document that SameSite=Lax + Origin verification is the chosen strategy

---

### 14. `opens` Table — No De-duplication
**Location:** §9 Data Model, `opens` table (Lines 396–400)

Every time a member opens the task page, a new row is inserted. This leads to:
- Table bloat (a member refreshing the page 50 times = 50 rows)
- Misleading "opened by" data

**Suggestion:** Either:
- Add a `UNIQUE(task_list_id, member_id)` constraint and `ON CONFLICT DO UPDATE SET opened_at = now()`
- Or insert only the first open, and track open count separately

---

### 15. Template `body` Column Uses Unstructured JSONB
**Location:** §9 Data Model, `templates` table (Lines 347–352)

The `body jsonb` column has no documented schema. What does a checklist template body look like vs. a message template body?

**Suggestion:** Document the expected JSONB structures:
```typescript
// Checklist template body
{ items: string[], default_due_offset_hours?: number }

// Message template body
{ text: string, placeholders: string[] }
```

---

### 16. No Multi-Device Session Handling
**Location:** §4.1 PIN Login

The plan says "signed in for 30 days on his phone" but doesn't address:
- What if he uses both phone and laptop?
- Multiple JWTs can coexist (no session table)
- No way to list/revoke active sessions

**Suggestion:** For Phase 1, multiple sessions are fine (stateless JWT allows this). But document this as a known behavior. For Phase 3, consider a `sessions` table for session management.

---

## 🟢 Enhancements & Improvements

### 17. Add `admin_id` Foreign Key to Relevant Tables
**Location:** §9 Data Model

Even though there's a single admin now, for future multi-admin (Phase 3, co-admins), tables like `task_lists`, `groups`, `templates`, and `share_log` should track **who created them**.

**Suggestion:** Add `created_by uuid references admin(id)` to:
- `groups`
- `task_lists`
- `templates`
- `share_log` (already tracks this somewhat)

---

### 18. Add `position` or `sort_order` to `groups`
**Location:** §9 Data Model, `groups` table

The professor may want to reorder groups on the dashboard (most-used first). Currently there's no ordering field.

**Suggestion:** Add `sort_order int default 0` to `groups`.

---

### 19. Task Item Status Should Be on the Item, Not Only in `completions`
**Location:** §5 Task Status Model, §9 Data Model

The current design requires a JOIN to `completions` to know any item's status. For fast UI rendering and simpler queries, consider denormalizing:

**Suggestion:** Add to `task_items`:
```sql
status text default 'pending' check (status in ('pending','done','verified')),
completed_by uuid references members(id),
completed_at timestamptz,
verified_at timestamptz
```
Keep the `completions` table as an audit log, but use `task_items.status` for fast reads. Update both in a transaction.

---

### 20. Build Roadmap — Day 1 Is Overloaded
**Location:** §15 Build Roadmap (Lines 561–572)

Day 1 includes: Next.js + Tailwind setup, Supabase project + SQL, env vars, AND deploy to Vercel. This is tight, especially with DB schema setup and environment configuration.

**Suggestion:** Split Day 1:
| Day | Work |
|---|---|
| 1 | Next.js + Tailwind scaffolding, project structure, Supabase project creation + SQL schema, env vars |
| 2 | Deploy "hello" to Vercel, PIN auth: login page, bcrypt, JWT cookie, middleware, rate limit |
| 3 | Groups + members CRUD, CSV import |
| ... | *(shift remaining days by 1)* |

---

### 21. Missing: Pagination for Lists
**Location:** §11 API Endpoints

The API has no pagination parameters for list endpoints (`GET /api/admin/groups`, task lists, etc.). After a few months of daily use, the professor could have hundreds of task lists.

**Suggestion:** Add pagination support from day 1:
```
GET /api/admin/task-lists?page=1&limit=20&group_id=&from=&to=
```

---

### 22. Missing: Loading / Empty States
**Location:** §7 Screens

The screens table doesn't mention empty states (no groups yet, no tasks today) or loading states. These are critical for first-use experience.

**Suggestion:** Add a row for UX states:
- Empty state for each screen with helpful CTAs ("Create your first group →")
- Skeleton loading states for dashboard cards
- First-time onboarding flow (create group → add members → create first task list)

---

### 23. Code Sample — `buildTaskMessage` Hardcodes 7 Emojis
**Location:** §3.4 (Lines 94–103)

The `nums` array only has 7 emoji numbers. If a task list has 8+ items (before truncation logic), the code works but only because of `.slice(0, 7)`. However, this means a list with exactly 8 items shows 7 + "…and 1 more" which looks odd.

**Suggestion:** Extend to 10 numbered emojis or use plain numbers after 7:
```ts
const nums = ["1️⃣","2️⃣","3️⃣","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣","🔟"];
```

---

### 24. Missing: Health Check Endpoint
**Location:** §11 API Endpoints

There's a `keepalive` cron but no health check endpoint for the app itself. Useful for monitoring.

**Suggestion:** Add:
```
GET /api/health  → { status: "ok", db: "connected" | "error", timestamp }
```

---

### 25. Missing: Timezone Handling
**Location:** Entire document

The plan uses `timestamptz` (good) and mentions UTC for cron, but doesn't specify:
- What timezone does the professor see dates in?
- Is `list_date` stored in UTC or local date?
- How are "overdue" calculations done — server time or professor's timezone?

**Suggestion:** Add to §8 or §9:
- Store a `timezone` field in the `admin` table (e.g., `Asia/Kolkata`)
- `list_date` is a `date` (no timezone, represents a calendar day)
- All `timestamptz` comparisons use the professor's configured timezone
- Display all times in the professor's timezone on the frontend

---

### 26. Missing: `task_lists` Status Field
**Location:** §9 Data Model, `task_lists` table

There's no explicit status for a task list (draft? active? completed? archived?). Currently the only indicator is `shared_at` being null or not.

**Suggestion:** Add:
```sql
status text default 'draft' check (status in ('draft','active','completed','archived'))
```
- `draft` → created but not shared
- `active` → shared, items pending
- `completed` → all items done/verified
- `archived` → old list, hidden from default views

---

### 27. Missing: Concurrency Handling on Public Member Page
**Location:** §4.2 Member Access, §11 API Endpoints

Multiple members may complete items simultaneously. The plan doesn't discuss:
- Optimistic updates on the member page
- Race conditions on completion counts
- What the member sees when another member ticks an item while they're viewing

**Suggestion:** 
- Use optimistic UI updates with SWR's `mutate` 
- The `UNIQUE` constraint on completions (issue #2) handles duplicate protection at the DB level
- SWR revalidation on focus/interval keeps the page in sync

---

### 28. Missing: Data Retention / Archival Policy
**Location:** Not mentioned

After months of use, old task lists, completions, and opens data will accumulate. Free-tier Supabase has a 500 MB database limit.

**Suggestion:** Add a section on data management:
- Estimate data growth (e.g., 5 groups × 5 tasks/day × 5 items × 365 days ≈ modest but grows)
- Implement auto-archive for lists older than N days
- CSV export before archival
- Dashboard date filter defaults to last 7/30 days to limit query scope

---

### 29. `share_log` — Missing `channel` Info
**Location:** §9 Data Model, `share_log` table (Lines 387–393)

The `kind` field is `share` or `reminder`, but there's no record of **how** it was shared (WhatsApp group link, individual WhatsApp, copy-paste, navigator.share). This matters for the professor to know if he used the group link or individual reminders.

**Suggestion:** Add:
```sql
channel text check (channel in ('whatsapp_group','whatsapp_individual','copy','native_share'))
```

---

### 30. Missing: Accessibility Considerations
**Location:** §7 Screens, §13 Adoption

The plan doesn't mention accessibility (a11y). Given this is a web app used by diverse group members:

**Suggestion:** Add a brief a11y section:
- Semantic HTML and ARIA labels
- Keyboard navigation for the professor's dashboard
- Sufficient color contrast ratios
- Screen reader support for task status announcements

---

## 📋 Summary of All Changes

| # | Category | Severity | Section |
|---|---|---|---|
| 1 | Missing DB indexes | 🔴 Critical | §9 |
| 2 | Duplicate completions allowed | 🔴 Critical | §9 |
| 3 | No `updated_at` on admin | 🔴 Critical | §9 |
| 4 | No rate-limit cleanup | 🔴 Critical | §4.1, §9 |
| 5 | URL length limit misunderstanding | 🔴 Critical | §3.3 |
| 6 | No JWT revocation | 🔴 Critical | §4.1 |
| 7 | Missing `updated_at` on tables | 🟡 Gap | §9 |
| 8 | No soft delete strategy | 🟡 Gap | §9 |
| 9 | Member page API response shape | 🟡 Gap | §11 |
| 10 | No error handling strategy | 🟡 Gap | All |
| 11 | No input validation plan | 🟡 Gap | §8, §11 |
| 12 | Dashboard query performance | 🟡 Gap | §9 |
| 13 | No CORS/CSRF consideration | 🟡 Gap | §8 |
| 14 | `opens` table bloat | 🟡 Gap | §9 |
| 15 | Template body schema undefined | 🟡 Gap | §9 |
| 16 | Multi-device session behavior | 🟡 Gap | §4.1 |
| 17 | Add `created_by` for co-admin prep | 🟢 Enhancement | §9 |
| 18 | Group sort order | 🟢 Enhancement | §9 |
| 19 | Denormalize item status | 🟢 Enhancement | §5, §9 |
| 20 | Day 1 roadmap overload | 🟢 Enhancement | §15 |
| 21 | No pagination | 🟢 Enhancement | §11 |
| 22 | No empty/loading states | 🟢 Enhancement | §7 |
| 23 | Hardcoded 7 emojis | 🟢 Enhancement | §3.4 |
| 24 | No health check endpoint | 🟢 Enhancement | §11 |
| 25 | No timezone handling | 🟢 Enhancement | §8, §9 |
| 26 | No task list status field | 🟢 Enhancement | §9 |
| 27 | No concurrency handling | 🟢 Enhancement | §4.2 |
| 28 | No data retention policy | 🟢 Enhancement | New section |
| 29 | `share_log` missing channel | 🟢 Enhancement | §9 |
| 30 | No accessibility plan | 🟢 Enhancement | §7 |
