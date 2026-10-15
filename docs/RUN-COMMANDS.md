# Run Commands — WhatsApp Task Tracker

Use these from the project root: `d:\WhatsApp-Task-Tracker`  
Shell: **PowerShell** (Windows).

> **Status:** Application code through Phase 15 is ready to test.  
> You still need `.env.local` + Supabase schema before login works.

---

## 0) One-time setup (do this first)

### Install dependencies
```powershell
cd d:\WhatsApp-Task-Tracker
npm install
```

### Create env file
```powershell
Copy-Item .env.example .env.local
notepad .env.local
```

Fill at least these in `.env.local`:

| Variable | Required? | Notes |
|---|---|---|
| `SUPABASE_URL` | **Yes** | Project URL from Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | **Yes** | Service role key (server only) |
| `SESSION_SECRET` | **Yes** | Random string, **≥ 32 chars** |
| `CRON_SECRET` | **Yes** | Random string, **≥ 8 chars** |
| `APP_URL` | **Yes** | `http://localhost:3000` for local |
| `GEMINI_API_KEY` | Optional | AI parse / voice / reminders |
| `RESEND_API_KEY` | Optional | Email digests |
| `RESEND_FROM_EMAIL` | Optional | Sender for digests |
| `ALLOW_DEV_AUTH` | Optional | `true` only for local PIN bypass — never on production |

Generate secrets (PowerShell):
```powershell
# SESSION_SECRET (≥32)
-join ((48..57 + 65..90 + 97..122) | Get-Random -Count 48 | ForEach-Object { [char]$_ })

# CRON_SECRET
-join ((48..57 + 65..90 + 97..122) | Get-Random -Count 32 | ForEach-Object { [char]$_ })
```

### Apply database schema (Supabase SQL Editor)

1. Open Supabase → **SQL Editor**
2. Run in order:
   - `supabase/migrations/20261015000000_init_schema.sql`  
     *(or `docs/schema.sql` if that is your single source — prefer the migration that matches your project)*
   - `supabase/migrations/20261015120000_professor_complete_item.sql`
3. Confirm seed admin exists (default PIN from seed is usually `123456` — change it after first login)

### Verify DB connection
```powershell
# Loads vars from .env.local for the script process
Get-Content .env.local | ForEach-Object {
  if ($_ -match '^\s*#' -or $_ -notmatch '=') { return }
  $k,$v = $_.Split('=',2)
  [Environment]::SetEnvironmentVariable($k.Trim(), $v.Trim(), 'Process')
}
npm run test-db
```

---

## 1) Start the app (daily)

```powershell
cd d:\WhatsApp-Task-Tracker
npm run dev
```

Open:
- Admin login: http://localhost:3000/login  
- Dashboard (after PIN): http://localhost:3000/admin  
- Health check: http://localhost:3000/api/health  

Stop: `Ctrl + C` in the terminal.

---

## 2) Useful scripts

```powershell
# Reset admin PIN (6 digits) — needs env vars loaded (see section 0)
npm run reset-pin -- 654321

# Typecheck
npx tsc --noEmit

# Lint
npm run lint

# Production build (catch build errors before deploy)
npm run build
npm run start
```

---

## 3) Cron keepalive (local test)

With the app running (`npm run dev`), in a **second** terminal:

```powershell
$secret = (Get-Content .env.local | Where-Object { $_ -match '^CRON_SECRET=' }) -replace '^CRON_SECRET=',''
Invoke-RestMethod -Uri "http://localhost:3000/api/cron/keepalive" `
  -Headers @{ Authorization = "Bearer $secret" } `
  -Method GET
```

Expect JSON with `ok: true` (and cron job counters). Without the header → `401`.

---

## 4) Suggested smoke-test order

1. `npm run test-db` → tables OK  
2. `npm run dev` → open `/login` with PIN  
3. Create a **group** + 2–3 **members**  
4. Create a **task list** → Share WA / copy link  
5. Open `/t/<token>` as member → tick items  
6. Dashboard: verify / overdue / Export CSV  
7. Templates: create checklist + message template  
8. Reports: date range + PDF / digests (needs Resend for email)  
9. New list: paste multi-line → AI parse (needs Gemini)  
10. Settings: change PIN, export backup, PWA install (HTTPS / phone later)

---

## 5) Deploy notes (later)

```powershell
# Vercel: set the same env vars as .env.local (never ALLOW_DEV_AUTH=true)
# Cron: schedule GET /api/cron/keepalive with Authorization: Bearer <CRON_SECRET>
npm run build
```

---

## Blockers before testing

| Check | Ready? |
|---|---|
| Code Phases 1–13 + 15 | Yes |
| `npm install` | Run once |
| `.env.local` filled | **Required — missing until you create it** |
| Supabase schema + `professor_complete_item` SQL | **Required** |
| Seed / reset admin PIN | **Required** |
| Gemini / Resend | Optional for core checklist flow |

Once env + SQL are done, start with **section 1** and walk **section 4**.
