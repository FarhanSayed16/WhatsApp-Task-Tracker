# WhatsApp Group Task Tracker — Final Plan (v2)

> **Status:** ⚠️ **SUPERSEDED for building.** Keep for historical context and product intent.  
> **Build from:** [`MASTER-EXECUTION-PLAN.md`](./MASTER-EXECUTION-PLAN.md) (v1.1) — schema, roadmap, and checklists there override this file on any conflict.  
> Review fixes: [`plan-review-suggested-changes.md`](./plan-review-suggested-changes.md) · Product vision: [`whatsapp-task-tracker-master-blueprint.md`](./whatsapp-task-tracker-master-blueprint.md)

> **Summary:** A free web app (PWA) where the professor creates task checklists per group, shares them to WhatsApp in 3 taps via `wa.me`, members tick tasks through a link (no login), and he tracks everything on one live dashboard. He logs in with a **6-digit PIN** and stays signed in on his phone for 30 days.

---

## 0. Decisions Locked (v2)

| # | Decision | Final choice | Why |
|---|---|---|---|
| 1 | WhatsApp sharing | **`https://wa.me/?text=<message>` + WhatsApp's group picker** | Free, official, works on phone and WhatsApp Web/Desktop. 3 taps: Share → pick group → Send |
| 2 | Professor login | **Custom 6-digit PIN** (hashed, rate-limited, 30-day device session) | Fast daily access, still secure |
| 3 | Member access | **No login.** Unguessable link per task list + "Who are you?" picker | 7–8 people will not register for anything |
| 4 | Framework | **Next.js (App Router)** — frontend + backend API in one project | One deploy, no separate server to wake up |
| 5 | Hosting | **Vercel** (Hobby, free) | No sleeping server like Render's free tier |
| 6 | Database | **Supabase Postgres**, used server-side only | Real Postgres, free tier, you already know the ecosystem |
| 7 | Auth system | **Own PIN auth, NOT Supabase Auth** | Simpler, and PIN login is not what Supabase Auth is built for |
| 8 | Realtime | **Polling every ~15 s** (SWR) | Works with server-only DB access; no extra security setup |

**Dropped:** Render / FastAPI hosting (cold-start wait), Netlify (a frontend-only deploy cannot hold the secret DB key safely; Next.js belongs on Vercel), Supabase Auth, WhatsApp Business API, unofficial WhatsApp automation, native Flutter app.

---

## 1. Problem Statement

The professor runs **many WhatsApp groups** (sizes ≈ 2–3, 3–4, and 7–8 people) and posts daily/weekly task lists as plain messages. Messages get buried, nobody confirms completion, and he has **no single place** to see how many tasks he assigned, to which group, on which day, and what is done vs. remaining.

**Needs:**
- Create tasks on a web page and share them to a WhatsApp group with one click
- Members clearly see the tasks and can mark them done (member-side checking is optional)
- One dashboard: generated / completed / remaining, per group and per day
- Free, simple, usable every day without friction

---

## 2. How It Works (One Picture)

```
 PROFESSOR (Vercel web app, PIN login)                MEMBERS (any phone)
 ─────────────────────────────────────                ───────────────────
 1. Create group + members (once)
 2. Create task list / pick a template
 3. Tap "Share to WhatsApp"  ─────────────►  WhatsApp opens with message ready:
    (wa.me/?text=...)                         "📋 Task List – Fri 17 Oct
    → picks group → presses Send               1️⃣ Collect forms  2️⃣ Book hall
                                               👉 Tick done: https://app/t/xK9fQ2mP"
                                                          │
                                                          ▼
                                               4. Member taps link → task page opens
                                                  → picks own name → ticks items
                                                          │
 5. Dashboard auto-refreshes  ◄───────────────────────────┘
 6. Professor verifies items / taps "Remind pending"
```

**Key idea:** WhatsApp only *carries the message*. **Tracking lives on the web page** the message links to.

---

## 3. WhatsApp Sharing (Final Method)

### 3.1 What `wa.me` can do

| Capability | Possible? |
|---|---|
| Open WhatsApp with a pre-filled message and let the user pick the chat/group (`wa.me/?text=`) | ✅ |
| Pre-filled message to one specific number (`wa.me/<number>?text=`) | ✅ |
| Target a group by name/ID | ❌ |
| Send automatically without tapping Send | ❌ |
| Know who read the message | ❌ (we substitute with "opened by" tracking on our page) |

### 3.2 Share flow in the app

1. Professor taps **Share to WhatsApp** → message preview (editable).
2. App opens `wa.me/?text=...` → WhatsApp shows chat picker → he selects the group → **Send**.
3. Back in the app, the card shows a one-tap **"Mark as sent ✔"** (logs the share time).
4. Fallbacks, always visible: **Copy message** button, and on mobile `navigator.share()`.

### 3.3 Rules for the message

- **Short:** title, group, date, up to 5–7 item lines, due time, and the link. Full details live on the task page.
- Use WhatsApp formatting: `*bold*`, `_italic_`. Keep total length well under ~2,000 characters.
- Phone numbers (for individual reminders): international format, no `+`/spaces → `919876543210`.

### 3.4 Code

```ts
// lib/whatsapp.ts
export function waLink(text: string, phone?: string) {
  const base = phone ? `https://wa.me/${phone}` : "https://wa.me/";
  return `${base}?text=${encodeURIComponent(text)}`;
}

export function buildTaskMessage(t: {
  title: string; group: string; date: string; due?: string;
  items: string[]; link: string;
}) {
  const nums = ["1️⃣","2️⃣","3️⃣","4️⃣","5️⃣","6️⃣","7️⃣"];
  const shown = t.items.slice(0, 7).map((x, i) => `${nums[i]} ${x}`).join("\n");
  const more = t.items.length > 7 ? `\n…and ${t.items.length - 7} more` : "";
  return `📋 *${t.title}*\n👥 ${t.group}  |  📅 ${t.date}\n\n${shown}${more}\n\n` +
         (t.due ? `⏰ Due: ${t.due}\n` : "") + `👉 Tick done here: ${t.link}`;
}
```

---

## 4. Roles and Login

| Role | Login | What they do |
|---|---|---|
| **Professor (admin)** | **6-digit PIN** | Everything: groups, tasks, share, dashboard, verify, remind |
| **Member** | None (link only) | View tasks, tick done, add note/photo |
| **Co-admin (Phase 3, optional)** | Name + PIN | TA/coordinator with admin rights |

### 4.1 PIN login design (built by us, no Supabase Auth)

**Goal:** open the app → already signed in. PIN only on a new device or after 30 days.

| Piece | Decision |
|---|---|
| PIN length | **6 digits** (4 digits = only 10,000 combinations; 6 = 1,000,000) |
| Storage | PIN is **hashed with bcrypt** (`bcryptjs`) in an `admin` table. Never stored in plain text |
| Session | On success, server issues a **signed JWT** (`jose`) in an **HttpOnly, Secure, SameSite=Lax cookie**, valid **30 days**, refreshed when older than 7 days |
| Brute-force protection | Table `login_attempts`: max **5 wrong PINs per IP per 15 min**, plus a global cap (e.g. 30/hour). Serverless has no memory, so counters live in the DB |
| UX | Large numeric keypad, **auto-submits on the 6th digit**, shake animation on error |
| Route protection | `middleware.ts` verifies the cookie for `/admin/*` and `/api/admin/*`; everything else is public |
| PIN reset | You run a script (`npm run reset-pin`) with the DB key, or set a new hash in Supabase. No email flow needed |
| Later upgrade | Passkey / fingerprint login (WebAuthn) for one-touch access |

```ts
// lib/auth.ts (core idea)
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";

const secret = new TextEncoder().encode(process.env.SESSION_SECRET!);

export async function checkPin(pin: string, hash: string) {
  return bcrypt.compare(pin, hash);
}
export async function createSession() {
  return new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret);
}
export async function verifySession(token?: string) {
  if (!token) return null;
  try { return (await jwtVerify(token, secret)).payload; } catch { return null; }
}
```

```ts
// middleware.ts
import { NextResponse, type NextRequest } from "next/server";
import { verifySession } from "@/lib/auth";

export async function middleware(req: NextRequest) {
  const ok = await verifySession(req.cookies.get("session")?.value);
  if (!ok) {
    return req.nextUrl.pathname.startsWith("/api")
      ? NextResponse.json({ error: "unauthorized" }, { status: 401 })
      : NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.next();
}
export const config = { matcher: ["/admin/:path*", "/api/admin/:path*"] };
```

### 4.2 Member access (no login)

| Mode | How | Use |
|---|---|---|
| **A. Group link (default)** | One link per task list, posted in the group. Member opens it and **picks their name** once (remembered in the browser) | Normal daily use |
| **B. Personal link** | Unique link per member, sent through `wa.me/<number>` | Important tasks, exact attribution |

- Tokens are random 10-char URL-safe strings (`nanoid`), unguessable.
- Optional expiry: due date + N days, after which the page becomes read-only.
- Server checks the picked member actually belongs to that group.

---

## 5. Task Status Model

```
Pending ──(member ticks)──► Done ──(professor confirms)──► Verified
   │                                                          ▲
   └──────────(professor ticks directly)──────────────────────┘
```

- Member ticking is **optional**. If members never tick, the professor marks items himself and tracking still works.
- Verification can be switched off per group (simple groups: Done = final).
- **Overdue** = not completed and past due time.

---

## 6. Features (Ranked)

### 🟢 Phase 1 — MVP (must-have)

1. PIN login with 30-day device session
2. Groups and members (name + phone)
3. Task lists with checklist items, date, due time
4. **Share to WhatsApp** (`wa.me/?text=`), Copy message, "Mark as sent"
5. **Public member page** (token link): name picker, tick items, progress bar
6. Professor can tick/verify items himself
7. **Dashboard:** totals (created / done / pending / overdue), per-group cards, filter by day/week/group
8. Share log (when each list was pushed)
9. **CSV export** (doubles as backup; see §10 on free-tier backups)

### 🟡 Phase 2 — Daily-use comfort

10. **Templates** (checklists and message wording)
11. **Duplicate yesterday** / clone any previous list
12. **Quick-add by paste:** paste his usual WhatsApp text → auto-split into checklist items
13. **Recurring lists** (daily / weekly / custom days) generated automatically; he just hits Share
14. **Reminder buttons:** remind whole group (`wa.me/?text=`) or each pending member (`wa.me/<number>`)
15. **"Opened by" tracking:** records who opened the task page (the read-receipt WhatsApp doesn't give)
16. Member notes/comments
17. Calendar/timeline view
18. PWA install (home-screen icon, full-screen)

### 🔵 Phase 3 — Power features

19. Per-member item assignment and personal links
20. Photo/file proof (Supabase Storage via signed upload URLs)
21. Analytics: completion rate by group/member, on-time vs late, trends
22. Daily/weekly email digest to the professor
23. Web push notification when members complete items
24. Priority, tags, subtasks
25. Co-admin access (name + PIN)
26. Passkey / fingerprint login
27. Marathi/Hindi message templates
28. AI helpers: turn a messy paragraph into a checklist, suggest due dates, draft reminder wording

---

## 7. Screens

| # | Screen | Key elements |
|---|---|---|
| 1 | **Login** | PIN keypad, auto-submit |
| 2 | **Dashboard** | KPI cards, today's lists, overdue alerts, group progress rings, date filter |
| 3 | **Groups** | List, members, CSV import |
| 4 | **Group detail** | Members, history, completion % |
| 5 | **New/Edit task list** | Title, group, date, items (reorder), template picker, Share |
| 6 | **Share sheet** | Message preview, Open WhatsApp, Copy, Mark as sent |
| 7 | **Task list detail** | Item status, who/when, notes, Verify, Remind |
| 8 | **Templates** | Checklist + message templates |
| 9 | **Reports** | Filters, export |
| 10 | **Settings** | Change PIN, default message format, language |
| 11 | **Member page (public)** | Name picker, checklist, progress bar, notes |

**Usability rules:** login → shared in **≤ 3 clicks**; large buttons; sensible defaults (today, last-used group); phone-first layout.

---

## 8. Architecture

```
Browser (Professor PWA / Member page)
        │  HTTPS
        ▼
Vercel — Next.js App Router
  ├─ Pages (React + Tailwind)
  ├─ Route handlers  /api/admin/*  (PIN session required)
  ├─ Route handlers  /api/t/[token]/*  (public, token-checked)
  └─ /api/cron/keepalive  (daily, secret-protected)
        │  server-side only, service-role key
        ▼
Supabase Postgres (Mumbai region recommended)
  └─ RLS ON for all tables, no public policies
```

### 8.1 Why server-only database access

- The browser **never talks to Supabase directly**. Only Next.js server code does, using the **service-role key** stored in Vercel environment variables.
- **Enable Row Level Security on every table with no policies.** Even if the public anon key leaks, it can read nothing.
- Consequence: we do not use Supabase Realtime (it needs client-side access). Dashboard uses **SWR polling every ~15 s**, and refetches when the tab regains focus. For one professor, this is effectively live.

### 8.2 Project structure

```
app/
  login/page.tsx
  admin/
    page.tsx                  # dashboard
    groups/…  tasks/…  templates/…  reports/…  settings/…
  t/[token]/page.tsx          # public member page
  api/
    auth/login/route.ts       auth/logout/route.ts
    admin/…                   # protected CRUD, dashboard summary, export
    t/[token]/…               # complete / undo / note / opened
    cron/keepalive/route.ts
lib/
  supabase.ts  auth.ts  whatsapp.ts  templates.ts  rateLimit.ts  tokens.ts
middleware.ts
vercel.json
```

### 8.3 Environment variables (Vercel)

| Variable | Purpose |
|---|---|
| `SUPABASE_URL` | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only DB key (**never** prefix with `NEXT_PUBLIC_`) |
| `SESSION_SECRET` | Signs the PIN-session JWT (long random string) |
| `CRON_SECRET` | Protects the keep-alive route |
| `APP_URL` | Base URL for generating member links |

---

## 9. Data Model (Supabase SQL)

```sql
create table admin (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  pin_hash text not null,
  created_at timestamptz default now()
);

create table login_attempts (
  id bigserial primary key,
  ip text not null,
  success boolean not null,
  created_at timestamptz default now()
);

create table groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  verify_required boolean default true,
  created_at timestamptz default now()
);

create table members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references groups(id) on delete cascade,
  name text not null,
  phone text,                       -- international format, no +
  active boolean default true
);

create table templates (
  id uuid primary key default gen_random_uuid(),
  type text check (type in ('checklist','message')),
  name text not null,
  body jsonb not null
);

create table task_lists (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references groups(id) on delete cascade,
  title text not null,
  list_date date not null,
  due_at timestamptz,
  token text unique not null,       -- public link token
  recurrence jsonb,                 -- e.g. {"freq":"weekly","days":[1]}
  shared_at timestamptz,            -- set by "Mark as sent"
  created_at timestamptz default now()
);

create table task_items (
  id uuid primary key default gen_random_uuid(),
  task_list_id uuid references task_lists(id) on delete cascade,
  text text not null,
  position int not null,
  priority text default 'normal',
  assigned_member_id uuid references members(id),
  due_at timestamptz
);

create table completions (
  id uuid primary key default gen_random_uuid(),
  task_item_id uuid references task_items(id) on delete cascade,
  member_id uuid references members(id),   -- null if professor ticked it
  status text check (status in ('done','verified')) default 'done',
  note text,
  proof_path text,
  completed_at timestamptz default now(),
  verified_at timestamptz
);

create table share_log (
  id bigserial primary key,
  task_list_id uuid references task_lists(id) on delete cascade,
  kind text check (kind in ('share','reminder')),
  member_id uuid references members(id),
  created_at timestamptz default now()
);

create table opens (
  id bigserial primary key,
  task_list_id uuid references task_lists(id) on delete cascade,
  member_id uuid references members(id),
  opened_at timestamptz default now()
);

-- Lock everything down; only the server (service role) can access
alter table admin           enable row level security;
alter table login_attempts  enable row level security;
alter table groups          enable row level security;
alter table members         enable row level security;
alter table templates       enable row level security;
alter table task_lists      enable row level security;
alter table task_items      enable row level security;
alter table completions     enable row level security;
alter table share_log       enable row level security;
alter table opens           enable row level security;
```

**Dashboard numbers (simple queries):**
- Generated = count of `task_items` in range
- Completed = items with a `completions` row (`done` or `verified`)
- Remaining = generated − completed
- Overdue = not completed and `due_at < now()`

---

## 10. Free-Tier Reality Check (Verified)

| Item | Fact | What we do |
|---|---|---|
| **Supabase free projects pause after 1 week of inactivity** and need manual restore | Confirmed in current 2026 sources | Add a **daily keep-alive cron** (below). Also he will use it daily, which keeps it active |
| **Supabase free has no automatic backups** | Reported in a 2026 comparison | **CSV export** in Phase 1, plus a monthly reminder to download one |
| **Vercel Hobby cron: once per day max, fires anywhere within the scheduled hour, UTC only** | Confirmed in Vercel docs | One daily keep-alive is all we need. Do not use cron for precise reminders |
| **Vercel Hobby is for personal, non-commercial use** | Vercel's own terms | Fine for a professor's personal tool. If you later charge for it or resell it, move to Pro (≈$20/month) |
| No sleeping server | Vercel serverless starts on demand (typically well under a second), unlike a free Render server that can take much longer to wake | This is why we moved off Render |

**Keep-alive route:**

```ts
// app/api/cron/keepalive/route.ts
import { supabase } from "@/lib/supabase";

export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  await supabase.from("groups").select("id").limit(1);
  return Response.json({ ok: true });
}
```

```json
// vercel.json
{ "crons": [{ "path": "/api/cron/keepalive", "schedule": "0 3 * * *" }] }
```

> **Check after the first week:** open the Supabase dashboard and confirm the project shows as active. If it ever pauses despite the cron, the fallback is switching the database to Neon (its free compute wakes in a few hundred milliseconds), which only changes the DB layer.

**Latency tip:** create the Supabase project in the **Mumbai** region, and set Vercel's function region to Mumbai (`bom1`) in project settings if your plan allows it.

---

## 11. API Endpoints

**Public**

```
POST /api/auth/login                      { pin }  → sets session cookie
POST /api/auth/logout
GET  /api/t/{token}                       task list, items, members, completions
POST /api/t/{token}/open                  { member_id }   (opened-by tracking)
POST /api/t/{token}/items/{id}/complete   { member_id, note }
POST /api/t/{token}/items/{id}/undo       { member_id }
```

**Admin (PIN session required)**

```
GET    /api/admin/dashboard?from=&to=&group_id=
CRUD   /api/admin/groups, /members, /task-lists, /items, /templates
POST   /api/admin/task-lists/{id}/shared       (Mark as sent)
POST   /api/admin/task-lists/{id}/remind-log
POST   /api/admin/items/{id}/verify
POST   /api/admin/items/{id}/complete          (professor ticks directly)
GET    /api/admin/export?format=csv&from=&to=
POST   /api/admin/settings/change-pin          { old_pin, new_pin }
```

---

## 12. Message Templates

Placeholders: `{group}` `{title}` `{date}` `{due}` `{items}` `{link}` `{name}` `{pending_count}`

**New list**
```
📋 *{title}*
👥 {group}  |  📅 {date}

{items}

⏰ Due: {due}
👉 Tick done here: {link}
```

**Group reminder**
```
⏰ *Reminder – {title}*
{pending_count} item(s) still pending.
Please update: {link}
```

**Individual reminder**
```
Hi {name}, you have {pending_count} pending item(s) in "{title}".
Please update here: {link}
```

**Overdue**
```
⚠️ *Overdue – {title}* (due {due})
Kindly complete and update: {link}
```

**Closure**
```
✅ All tasks for *{title}* are complete. Thank you, team!
```

---

## 13. Easy Adoption for the Professor

| Barrier | Solution |
|---|---|
| "Another login?" | 6-digit PIN, signed in for 30 days on his phone |
| "Is it secure?" | Hashed PIN, lockout on wrong attempts, private database |
| "Will members use it?" | No login, one tap from WhatsApp |
| "What if they don't tick?" | He ticks items himself; dashboard still works |
| "Retyping tasks?" | Templates, paste-to-split, duplicate yesterday, recurring lists |
| "Setup effort?" | You pre-load his groups, members, and 3–4 templates |
| "What if it breaks?" | **Copy message** always works; CSV export keeps his data |

**Handover:** pre-load data → 15-minute walkthrough → one-page cheat sheet → install to home screen → **pilot with one group for one week**, then roll out.

---

## 14. Risks and Limits

| Risk | Mitigation |
|---|---|
| Cannot auto-post to groups | 3-tap flow, "Mark as sent" log |
| Members ignore the link | Professor-side ticking, reminders, "opened by" tracking |
| Link forwarded outside the group | Unguessable tokens, expiry, optional PIN on a list |
| 6-digit PIN guessed | Rate limiting + lockout + bcrypt + 30-day session only on his device |
| Service-role key leaks | Server-only env var, never in client code; RLS blocks anon key |
| Supabase pause / no backups | Keep-alive cron + CSV export + dashboard check |
| Phone numbers are personal data | Store only name + number; admin-only access; delete on request |
| Vercel Hobby terms | Personal non-commercial use; upgrade if it becomes a product |

---

## 15. Build Roadmap

| Day | Work |
|---|---|
| 1 | Next.js + Tailwind setup, Supabase project + SQL, env vars, deploy "hello" to Vercel |
| 2 | PIN auth: login page, bcrypt, JWT cookie, middleware, rate limit, reset script |
| 3 | Groups + members CRUD, CSV import |
| 4 | Task lists + items, token generation, message builder, **Share to WhatsApp**, Mark as sent |
| 5 | Public member page: name picker, tick/undo, progress, opened tracking |
| 6 | Dashboard (KPIs, filters, polling), professor tick/verify, share log |
| 7 | CSV export, keep-alive cron, PWA manifest, mobile polish, deploy + test with a real group |
| **MVP ready** | ≈ 7 days solo |
| Week 2 | Templates, duplicate/paste-to-split, recurring, reminders |
| Week 3 | Per-member assignment, proof uploads, analytics, email digest |

---

## 16. Questions for the Professor

1. How many groups and members in total?
2. Are tasks for the **whole group** or assigned to **specific people**?
3. Does he want member ticking **plus his verification**, or only his own tracking?
4. Daily lists, weekly lists, or both? Do the same tasks repeat?
5. Mostly phone or laptop?
6. Is tapping **Send** himself in WhatsApp fine?
7. Does he need reports/exports for records?
8. Message language: English / Hindi / Marathi?
9. Any concern about members' phone numbers being stored?
10. Will anyone else (TA/coordinator) need access?

---

## 17. Final Recommendation

**Build, in this order:**
1. **Phase 1 MVP:** PIN login → groups → task lists → `wa.me/?text=` share → member tick page → dashboard.
2. **Phase 2:** templates, recurring lists, reminders, paste-to-split.
3. **Phase 3:** personal links, proof uploads, analytics, passkeys.

**Stack:** Next.js (App Router) + Tailwind on **Vercel**, **Supabase Postgres** (server-only, RLS on, Mumbai region), **custom PIN auth** with `bcryptjs` + `jose`, SWR polling, installable PWA.

**Bottom line:** Free, fast to open (no sleeping server), and simple. The professor keeps sending from WhatsApp as he does now, but every message now links to a trackable checklist and a single dashboard.
