# Automated Reminders & Notifications — Plan

> **Goal:** When a checklist is created (or due soon / overdue), students get a clear “you have work + due time” signal, without paying for WhatsApp Business / SMS, and without collecting lots of new student data.  
> **Audience:** College professor + WhatsApp class groups  
> **Constraint:** Free / near-free, minimal new secrets, keep `wa.me` as the student channel

---

## 1. Reality check (what is / isn’t free)

| Channel | Auto-send without professor click? | Cost / setup | Fits this project? |
|---|---|---|---|
| **WhatsApp `wa.me` (current)** | **No** — opens chat; professor taps Send | Free | **Yes — primary for students** |
| **WhatsApp Business API** | Yes | Paid + Meta approval + BSP | **No** (Phase 16, deferred) |
| **SMS (Twilio etc.)** | Yes | Paid + phone numbers | **No** |
| **Email to every student** | Yes | Free tier possible (Resend) | Only if you collect student emails — **you asked to avoid extra data** |
| **Email to professor only** | Yes | Optional Resend (already in app) | **Yes — secondary** |
| **Browser / PWA push (professor)** | Yes (after one “Allow”) | Free (VAPID keys once) | **Optional later** |

**Important:** WhatsApp does **not** allow a free server to silently message a group.  
So “automation” for students = **system prepares the exact message + timing**, professor (or a one-tap dashboard action) opens WhatsApp / copies — **1 tap**, not typing.

That is the feasible, free, professor-friendly model.

---

## 2. What you already have

| Piece | Status | Gap |
|---|---|---|
| Create task list + due time | Done | No auto “assignment notify” after create |
| ShareSheet (Initial Share / Reminder) | Done | Manual only |
| Clean WA message format | Done | Use for all auto templates |
| Dashboard “Action required” / overdue | Done | No “Reminders ready to send” queue |
| Cron `/api/cron/keepalive` | Done | Digests / archive — **no due-reminder queue yet** |
| Professor email digest (Resend) | Optional | Not tied to “list just created” |
| Recurring list drafts | Done | Separate from reminders |

---

## 3. Recommended product model (simple for professor)

```
CREATE LIST (title, group, date, due)
        │
        ▼
┌───────────────────────────────────────┐
│ 1. ASSIGNMENT NOTICE (immediate)      │
│    → Pre-filled WhatsApp message      │
│    → "Open WhatsApp — choose group"   │
│    (professor sends once)             │
└───────────────────────────────────────┘
        │
        ▼  (system watches due_at)
┌───────────────────────────────────────┐
│ 2. DUE-SOON (e.g. 24h before / same day)│
│    → Cron marks list "reminder ready" │
│    → Dashboard: one-tap Open WA       │
└───────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────┐
│ 3. OVERDUE                            │
│    → Dashboard + optional email to    │
│      professor ("3 lists need nudge") │
└───────────────────────────────────────┘
```

Students keep using the **same checklist link** in the message. No new apps, no student phone collection required for group share.

---

## 4. Message content (what “proper reminder” means)

Every automated / one-tap message should include:

1. **What** — list title  
2. **Who** — group name  
3. **When** — list date + due time (human readable)  
4. **What to do** — short task list (or “N pending”)  
5. **Link** — `/t/[token]` (must be HTTPS in production)

### A) Right after create (Assignment)

```
*New checklist assigned*
Lab Batch A
Date: 16 Oct 2026
Due: 5:00 PM

*Tasks*
1) ...
2) ...

Please finish before the due time.
*Open checklist*
https://your-app.vercel.app/t/xxxxx
```

### B) Due soon

```
*Reminder - due soon*
...
Due: today 5:00 PM
*Still pending*
1) ...
```

### C) Overdue

```
*Overdue - please complete*
...
```

(Reuse `buildTaskMessage` / `buildReminderMessage` — already emoji-safe.)

---

## 5. Build plan (phased)

### Phase R0 — UX glue (fast, no new infra) — **start here**

| # | Work | Outcome |
|---|---|---|
| R0.1 | After **Create & Share**, always land in ShareSheet with **Initial Share** + assignment copy (due line included) | Students get notified as soon as list exists |
| R0.2 | Dashboard card: **“Send reminder”** on overdue / pending lists → opens ShareSheet Reminder tab | One tap, not hunting |
| R0.3 | Settings short copy: “WhatsApp cannot auto-send to groups; one tap opens the right message” | Sets professor expectation |

**Effort:** ~0.5–1 day · **Cost:** ₹0 · **New secrets:** none

---

### Phase R1 — Scheduled reminder queue (real automation brain)

| # | Work | Outcome |
|---|---|---|
| R1.1 | Table or JSON on `task_lists`: `reminder_state` (`none` / `due_soon_ready` / `overdue_ready` / `sent_at` timestamps) | Track what was offered |
| R1.2 | Extend cron: every run, find active lists where `due_at` within 24h / past due → set flags | System “knows” timing |
| R1.3 | Dashboard section **Reminders ready** — list + **Open WhatsApp** / **Copy** / **Snooze** / **Mark sent** | Professor clears queue in seconds |
| R1.4 | Optional: default reminder offsets in Settings (`24h before`, `on due day morning`) — org setting only | No per-student data |

**Effort:** ~1–2 days · **Cost:** ₹0 · **Secrets:** existing `CRON_SECRET` + Vercel Cron schedule

Cron example (Vercel):
```
GET /api/cron/keepalive   (already)
→ add reminder scan inside same job OR /api/cron/reminders
Schedule: every hour (or every 15 min if needed)
```

---

### Phase R2 — Professor email nudges (optional, still free-ish)

Only if `RESEND_API_KEY` is already set (you already support digests):

| # | Work | Outcome |
|---|---|---|
| R2.1 | Email professor when cron finds new `due_soon` / `overdue` batches | “3 lists need a WhatsApp nudge” + deep links to dashboard |
| R2.2 | Optional: email when a list is created (professor confirmation) | Audit trail |

**Does not email students** (avoids collecting student emails).  
**Effort:** ~0.5 day · **Cost:** Resend free tier · **Data:** professor email only (already in settings/digest)

---

### Phase R3 — Nice-to-have (later, still free)

| # | Work | Notes |
|---|---|---|
| R3.1 | PWA push to **professor phone** when reminders ready | Needs one-time VAPID keys; students still via WA |
| R3.2 | Member page: “Remind me on this phone” (browser notification) | Only works if student opened the link and allowed notify — weak for class use |
| R3.3 | WhatsApp Business API auto-send | **Out of scope** until budget + Meta approval |

---

## 6. What we will NOT do (by design)

- Auto-post into WhatsApp groups without a human tap (impossible for free / against WA rules without Business API)
- SMS gateways
- Force every student to register email/phone for notifications
- Rebuild ShareSheet around purple “AI” marketing — keep emerald, clean ASCII messages

---

## 7. Success criteria (demo for professor)

1. Create a list with due time → ShareSheet opens with full assignment message → Open WhatsApp → choose class group → Send.  
2. Next day (or after moving clock / due_at) → Dashboard shows **Reminders ready** → one tap opens overdue/due-soon message.  
3. Cron runs on Vercel without manual visit.  
4. (Optional) Professor gets one email: “You have N lists needing a nudge.”  
5. Students never install an app; they only tap the checklist link.

---

## 8. Suggested build order (when you say “start”)

```
R0.1 Create → ShareSheet assignment   ─┐
R0.2 Dashboard one-tap remind         ├── ship first (demo-ready)
R0.3 Settings helper text             ─┘
R1.1–R1.3 Reminder queue + cron          ← core automation
R2.x Professor email (if Resend on)      ← optional same week
R3.x Push / Business API                 ← later
```

---

## 9. Decision (recommended)

**Adopt R0 + R1 as the product.**  
That gives “automated awareness of timing + terms + due date” in the **system**, and **reliable free delivery** via WhatsApp with one professor tap — matching how your app already works, without new paid services or student data collection.

## 10. Implementation status (built)

| Item | Status |
|---|---|
| R0.1 Create → ShareSheet assignment copy | **Done** (`isAssignment`, clean due formatting) |
| R0.2 Dashboard one-tap Send reminder | **Done** (`Reminders ready` + ShareSheet) |
| R0.3 Settings helper + offsets | **Done** (reminders enabled + due_soon_hours) |
| R1.1 `task_lists.reminder` jsonb | **Done** (migration file — **run in Supabase SQL Editor**) |
| R1.2 Cron flags due-soon / overdue | **Done** (inside `/api/cron/keepalive`) |
| R1.3 Mark sent / snooze API | **Done** (`PATCH .../reminder`) |
| R2 Professor email nudges | **Not built** (optional later) |
| R3 Push / Business API | **Not built** (deferred) |

### One-time DB step (required for persist / snooze)

In Supabase → SQL Editor, run:

`supabase/migrations/20261016140000_task_list_reminders.sql`

Without it, dashboard still **computes** reminders from `due_at`; mark-sent/snooze may not persist until the column exists.

### How to use (professor)

1. Create list with due time → **Save & Dispatch** → assignment message → Open WhatsApp → pick group → Send  
2. When due soon / overdue → Dashboard **Reminders ready** → **Send reminder** → Send  
3. Settings → adjust “hours before due” if needed  

Cron on Vercel should hit `/api/cron/keepalive` hourly (existing) to flag lists.
