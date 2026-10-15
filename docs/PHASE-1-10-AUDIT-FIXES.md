# Phase 1–10 Audit — Required Fixes & Improvements

> **Audited:** 15 Oct 2026  
> **Fixes applied:** 15 Oct 2026 (P0 + P1 + P2/P3)  
> **Re-verified:** 15 Oct 2026 — leftover `groups/[id]` members `org_id`/`sort_order` bug closed; TZ date filters, modal focus trap, open upsert race, remind roster polished  
> **Baseline:** [`MASTER-EXECUTION-PLAN.md`](./MASTER-EXECUTION-PLAN.md) v1.1 (Phases 1–10) + Core Business Rules  
> **Verdict:** ✅ **Code ready to move to Phase 11.** Typecheck clean. Ops still required once (below).

### Ops checklist (you do once — not code)
1. Set `SESSION_SECRET` (≥32 random chars) in `.env.local` and Vercel  
2. Run SQL: `supabase/migrations/20261015120000_professor_complete_item.sql` on Supabase  
3. Never set `ALLOW_DEV_AUTH=true` on production  

---

## Fix status (final)

| ID | Status | Notes |
|---|---|---|
| P0-1 | ✅ Fixed | Members via group scope; **also fixed** leftover bug in `groups/[id]` GET/DELETE |
| P0-2 | ✅ Fixed | `computeLinkStatus` on public GET/complete/undo |
| P0-3 | ✅ Fixed | No SESSION_SECRET fallback |
| P0-4 | ✅ Fixed | Org-scoped item mutations |
| P0-5 | ✅ Fixed | RPC + fallback professor complete |
| P1-1…P1-8, P1-11, P1-12 | ✅ Fixed | Share columns, ShareSheet items, rate-limit record, dev auth gate, expired status, write gates, quick-verify, Save&Share, verify guard, badges |
| P1-9 | ✅ Code done | Apply migration on live DB (ops) |
| P1-10 | ✅ Accepted | In-memory public limit OK for MVP; login attempts in DB |
| P2/P3 | ✅ Fixed | CSRF, Zod limits, PIN refine, badge colors, due_at TZ, dashboard TZ filters, last-used group, favicon SVG, bcrypt 12, modal focus trap, open race, remind roster, soft-delete 404 |

### Explicitly deferred (not blocking Phase 11)
- Drag-and-drop reorder on **create** form (API reorder exists; detail edit can use it later)
- Per-item due time on create form
- “Share & Create Another” shortcut
- Upstash Redis multi-instance public rate limit (upgrade when traffic grows)

---

## Executive Summary (original)

| Severity | Count | Meaning |
|---|---|---|
| **P0 — Critical** | 5 | Breaks core flows or security; fix immediately |
| **P1 — High** | 12 | Wrong vs locked rules / broken screens; fix before MVP demo |
| **P2 — Medium** | 16 | Plan gaps, consistency, reliability |
| **P3 — Low** | 10 | Polish / nice-to-have |

**Original readiness:** ~80% feature surface · **~60% correctness**.  
**After this fix pass:** critical correctness restored in code; apply DB migration + env before demo.

---

## P0 — Critical (fix first)

### P0-1. Members API uses columns that do not exist on `members`

| | |
|---|---|
| **Phase** | 6 |
| **Files** | `src/app/api/admin/members/route.ts`, `members/[id]/route.ts`, `members/import/route.ts`, `groups/route.ts` (member insert path) |
| **Schema** | `docs/schema.sql` / `supabase/migrations/*` — `members` has **no** `org_id`, **no** `sort_order` |

**Problem:** Create/list/import members filter/insert `org_id` and `sort_order`. On a schema-accurate DB this fails at runtime (group create with members, add member, CSV import).

**Fix (pick one, prefer A):**

- **A (recommended):** Scope members via join/`group_id` → `groups.org_id`. Remove `org_id` / `sort_order` from member inserts and queries. Order by `name` or `created_at`.
- **B:** Add migration: `members.org_id`, `members.sort_order`, backfill from parent group, update `docs/schema.sql` + migration together.

**Acceptance:** Creating a group with members, adding a member, and CSV import all succeed against current schema.

---

### P0-2. Member link expiry ignores `+ 7 days` when `due_at` is set

| | |
|---|---|
| **Phase** | 9 / Core Rule 1 |
| **Files** | `src/app/api/t/[token]/route.ts`, `src/app/api/t/[token]/items/[id]/complete/route.ts` |
| **Correct helper** | `computeLinkStatus()` in `src/lib/utils.ts` (already implements `due_at + 7 days`) |

**Problem:** Public GET sets `expiresAt = taskList.due_at` (no +7 days). Lists become readonly at due time instead of after the 7-day grace window. Write routes reimplement the same wrong formula and do not call `computeLinkStatus`.

**Fix:**

1. Use `computeLinkStatus(deleted_at, list_date, due_at)` (and admin timezone for null-`due_at` EOD) in GET, complete, and undo.
2. Soft-deleted / missing list: return `{ status: "expired" }` per plan (not only 404).
3. Block writes when computed status is `readonly` or `expired`, including `task_lists.status === "completed"`.

**Acceptance:** List with `due_at` yesterday remains `active` until `due_at + 7d`; after that GET is `readonly` and complete/undo return 4xx.

---

### P0-3. `SESSION_SECRET` hard-coded fallback

| | |
|---|---|
| **Phase** | 3 |
| **Files** | `src/lib/auth.ts`, `middleware.ts` |

**Problem:** Falls back to `"fallback-secret-for-build-purposes-min-32-chars!"` when env is missing. Anyone who knows the fallback can forge admin JWTs if the app is deployed without `SESSION_SECRET`.

**Fix:** Throw / fail boot if `SESSION_SECRET` is missing in runtime (allow build-time only via Next build env if needed). Never sign cookies with a shared fallback.

**Acceptance:** App refuses to issue/verify sessions without a real secret; no fallback string in production code path.

---

### P0-4. Item mutation routes lack org scoping

| | |
|---|---|
| **Phase** | 7 / Core Rule 7 |
| **Files** | `src/app/api/admin/items/[id]/route.ts` (PATCH/DELETE), `.../complete`, `.../verify`, `.../undo` |

**Problem:** `requireAdmin()` is called but item is loaded/updated by `id` only — no join to `task_lists.org_id = admin.orgId`. Cross-org mutation is possible once multi-tenant exists; even single-tenant violates the locked rule.

**Fix:** Shared helper e.g. `getOrgScopedItem(itemId, orgId)` joining `task_items` → `task_lists` with `org_id` check. Use on every item mutation.

**Acceptance:** Admin from org A cannot PATCH/complete/verify/undo org B’s item UUID (returns 404).

---

### P0-5. Professor completions are not transactional (NULL `member_id`)

| | |
|---|---|
| **Phase** | 7 / Core Rule 4 |
| **File** | `src/app/api/admin/items/[id]/complete/route.ts` |

**Problem:** Update item → delete NULL completions → insert completion are separate calls. Partial failure leaves verified item without audit row (or duplicate NULL rows — Postgres UNIQUE allows multiple NULLs). `completed_by` is never cleared/set for professor path.

**Fix:**

1. Postgres RPC / single transaction: update item + delete NULL completion + insert professor completion + maybe list status.
2. Set `completed_by = null` on professor direct tick; clear fields on undo.

**Acceptance:** Mid-failure cannot leave item `verified` without a matching professor completion; at most one NULL-`member_id` row per item.

---

## P1 — High (fix before calling Phase 10 done)

### P1-1. Task detail queries wrong `share_log` / `opens` columns

| | |
|---|---|
| **Files** | `src/app/api/admin/task-lists/[id]/route.ts`, `src/app/admin/tasks/[id]/page.tsx` |

**Problem:** API orders by `share_log.shared_at` and `opens.opened_at`. Schema columns are `share_log.created_at` and `opens.first_opened_at` / `last_opened_at`. UI reads `log.shared_at` / `open.opened_at`.

**Fix:** Select/order real columns; map to UI fields (`created_at`, `last_opened_at`).

---

### P1-2. `TaskListCard` ShareSheet sends empty checklist

| | |
|---|---|
| **File** | `src/components/admin/TaskListCard.tsx` |

**Problem:** Opens ShareSheet with card props only — no `items` / `members` → WhatsApp message has empty item list.

**Fix:** Fetch list detail on share open, or pass items into the card, or open ShareSheet only from detail with full data.

---

### P1-3. Login attempt recording can silently fail

| | |
|---|---|
| **File** | `src/lib/rateLimit.ts` |

**Problem:** `recordLoginAttempt` insert errors are not checked → rate limiting may never engage.

**Fix:** Check `{ error }` and log/throw; ensure failed attempts always persist.

---

### P1-4. Dev PIN / session bypass in non-production

| | |
|---|---|
| **Files** | `src/app/api/auth/login/route.ts`, `src/lib/auth.ts` (`requireAdmin`) |

**Problem:** Non-production paths accept PIN `123456` / synthetic sessions / continue when DB session_version check fails. Easy to ship accidentally if `NODE_ENV` is wrong.

**Fix:** Gate behind explicit `ALLOW_DEV_AUTH=true`; never enable on Vercel Production. Document in `.env.example`.

---

### P1-5. Soft-deleted token does not return `status: "expired"`

| | |
|---|---|
| **File** | `src/app/api/t/[token]/route.ts` |

**Problem:** Filters `deleted_at IS NULL` then 404. Plan: soft-deleted → `{ status: "expired" }`. Page has expired UI but API never returns it.

**Fix:** Fetch without soft-delete filter (or second query); if deleted → success body with `status: "expired"`.

---

### P1-6. Complete/undo write gates incomplete

| | |
|---|---|
| **Files** | `.../complete/route.ts`, `.../undo/route.ts` |

**Problem:** Complete may not block `status === "completed"` lists; undo may ignore time-based expiry (only blocks archived).

**Fix:** Same `computeLinkStatus` + list status checks on both write routes.

---

### P1-7. Dashboard missing quick-verify (Phase 10.3)

| | |
|---|---|
| **File** | `src/app/admin/page.tsx` |

**Problem:** Plan requires quick-verify for member-ticked `done` items. Only Mark Done + Remind exist.

**Fix:** Add Verify action for overdue/`done` items calling `/api/admin/items/[id]/verify`.

---

### P1-8. “Save & Share” skips ShareSheet / may skip share log

| | |
|---|---|
| **File** | `src/app/admin/tasks/new/page.tsx` (and related) |

**Problem:** Plan: Save & Share opens ShareSheet. Implementation opens `wa.me` and navigates — no preview edit, may not log share.

**Fix:** After create, open ShareSheet with full list data; Mark as Sent / Open WhatsApp from there.

---

### P1-9. Migration drifts from `docs/schema.sql`

| | |
|---|---|
| **Files** | `supabase/migrations/20261015000000_init_schema.sql` vs `docs/schema.sql` |

**Problem:** Migration reportedly missing / incomplete vs docs (e.g. `pgcrypto`, `updated_at` triggers, partial indexes). Risk: production schema ≠ documented schema.

**Fix:** Diff both files; make migration the applied source of truth and regenerate `docs/schema.sql` from it (or vice versa). One SQL story only.

---

### P1-10. Public rate limit is in-memory only

| | |
|---|---|
| **File** | `src/lib/rateLimit.ts` |

**Problem:** Ineffective across Vercel serverless instances.

**Fix (MVP-acceptable):** Document limitation + keep login attempts in DB (already). Prefer Upstash Redis or DB counters for public writes before public launch. At minimum remove GET from public write limiter (see P2).

---

### P1-11. Verify has no state guard

| | |
|---|---|
| **File** | `src/app/api/admin/items/[id]/verify/route.ts` |

**Problem:** Can verify a still-`pending` item without a member completion.

**Fix:** Only allow verify when `status === "done"` (or professor uses complete endpoint instead).

---

### P1-12. `TaskListCard` status badge type mismatch

| | |
|---|---|
| **Files** | `TaskListCard.tsx`, dashboard / tasks pages |

**Problem:** Card types expect `active | readonly | expired` while pages pass `draft | active | completed | archived` → broken badges (drafts look active).

**Fix:** Align prop type with `task_lists.status` and Badge variants.

---

## P2 — Medium

| ID | Phase | Issue | Fix |
|---|---|---|---|
| P2-1 | 3 | CSRF skipped when `Origin` header absent | Require Origin on state-changing methods, or compare `Sec-Fetch-Site` / custom header |
| P2-2 | 4 | `generateUniqueTaskToken` is check-then-return (TOCTOU), not insert-retry | Retry on unique violation at insert time |
| P2-3 | 9 | GET `/api/t/[token]` counts against public write rate limit | Rate-limit only open/complete/undo |
| P2-4 | 9 | Complete uses plain insert, not `ON CONFLICT DO NOTHING` | Upsert / ignore conflict → clean 409 or idempotent success |
| P2-5 | 9 | No retry button after network failure on member page | Toast + Retry control |
| P2-6 | 9 | Notes on already-done items don’t update (complete early-returns) | Dedicated note PATCH or allow note update when done |
| P2-7 | 10 | KPI overdue scope ≠ overdue list scope (filtered vs all-org) | Same date/group filters for both |
| P2-8 | 10 | Dashboard date filters use UTC day boundaries, not admin TZ | Use admin timezone from session/settings |
| P2-9 | 7 | Due time built as `...Z` (local clock treated as UTC) | Compose due_at in admin timezone |
| P2-10 | 7 | Reorder loops updates (not one transaction) | Single RPC / batched SQL |
| P2-11 | 7 | Undo doesn’t clear `completed_by` | Clear completion fields fully |
| P2-12 | 7 | `createTaskListSchema`: title max 200 vs plan 100; no max 50 items | Align Zod with plan constants |
| P2-13 | 7 | No drag-reorder on create UI; no per-item due on create | Add or defer explicitly |
| P2-14 | 8 | No “Share & Create Another”; ShareSheet lacks previous shares; Remind Pending roster incomplete | Add or defer |
| P2-15 | 6 | CSV import soft-fails bad phones (inserts with null phone + error) | Skip invalid rows entirely |
| P2-16 | 1 | Missing favicon at `/favicon.ico`; design tokens only in CSS `@theme` | Add favicon; optional `tailwind.config` or document Tailwind v4 approach |

---

## P3 — Low / Enhancements

| ID | Issue | Suggestion |
|---|---|---|
| P3-1 | Login page says “Admin Access” not app branding | Show product name/logo |
| P3-2 | Badge colors: done/verified inverted vs plan | Align Badge variants |
| P3-3 | Modal: no focus trap | Add focus trap for a11y |
| P3-4 | Soft-delete group returns success even if 0 rows | Return 404 when nothing updated |
| P3-5 | `changePinSchema` doesn’t enforce `new ≠ old` (route does) | Add Zod refine |
| P3-6 | bcrypt salt hardcodes `10` instead of `BCRYPT_SALT_ROUNDS` | Use constant (plan: 12) |
| P3-7 | Error code strings drift from `ERROR_CODES` enum | Centralize |
| P3-8 | Seed PIN `123456` documented in SQL comments | Change via `reset-pin` before real use; scrub comments in prod docs |
| P3-9 | Member localStorage key not token-scoped | Scope key by token/group |
| P3-10 | Last-used group default not persisted | localStorage last group id |

---

## Phase-by-phase completeness (1–10)

| Phase | Surface built? | Plan-correct? | Blockers |
|---|---|---|---|
| 1 Setup | Yes | Mostly | Favicon; confirm `.env.local` + deploy outside repo |
| 2 Schema | Yes | Partial | Migration ↔ `docs/schema.sql` drift (P1-9) |
| 3 Auth | Yes | Partial | P0-3 secret fallback; P1-3/P1-4 rate limit & dev bypass |
| 4 Libraries | Yes | Mostly | Token TOCTOU; expiry helper unused by routes |
| 5 UI | Yes | Mostly | Focus trap, badge colors |
| 6 Groups/Members | Yes | **No** | **P0-1 members columns** |
| 7 Tasks | Yes | Partial | P0-4 org scope; P0-5 transactions; verify guard |
| 8 WhatsApp | Yes | Partial | P1-2 empty share from card; P1-8 Save & Share |
| 9 Member page | Yes | **No** | **P0-2 expiry**; P1-5/P1-6 write gates |
| 10 Dashboard | Yes | Partial | P1-7 quick-verify; badge/filter consistency |

---

## Phase 11+ early stubs (out of Phase 1–10 grade)

Present but incomplete — do **not** count as Phase 11 done:

| Artifact | State |
|---|---|
| `GET /api/admin/export` | Stub / header-only CSV |
| `GET /api/cron/keepalive` | Partial (ping + login cleanup; no daily_stats / auto-archive) |
| `GET /api/health` | Basic OK |
| Settings page | Shell; Change PIN UI may not be fully wired |
| Templates / Reports pages & APIs | Placeholders (“Phase 12/13”) |
| PWA `manifest.json` / `sw.js` | Absent |

**Risk:** Nav links to unfinished Settings/Templates/Reports can confuse MVP demos — hide or label “Coming soon” until those phases.

---

## Recommended fix order

```
1. P0-1  Members schema ↔ API alignment
2. P0-2  Expiry: use computeLinkStatus everywhere (+ write gates P1-5/P1-6)
3. P0-3  Remove SESSION_SECRET fallback
4. P0-4  Org-scope all item mutations
5. P0-5  Transactional professor complete
6. P1-1  share_log / opens column fix
7. P1-2  TaskListCard ShareSheet items
8. P1-3 / P1-4  Rate-limit recording + lock down dev auth
9. P1-7 / P1-8 / P1-11 / P1-12  Dashboard verify, Save&Share, verify guard, badges
10. P1-9  Schema single source of truth
11. Remaining P2 → P3
```

---

## Suggested regression checklist (after fixes)

- [ ] Create group with 3 members + CSV import
- [ ] Create task list → Share from **card** → message shows all items
- [ ] Share from detail → Mark as Sent → share log shows correct time
- [ ] Member link: before due, after due, after due+7d, soft-deleted
- [ ] Member tick / undo / verify_required on/off
- [ ] Professor complete / verify / undo; list auto-completes
- [ ] Dashboard KPIs match filters; overdue Mark Done + Verify
- [ ] Wrong PIN ×5 → lockout; change PIN → old session dies
- [ ] Deploy without `SESSION_SECRET` → must fail closed

---

## Document control

| Field | Value |
|---|---|
| Created | 15 Oct 2026 |
| Related | [`MASTER-EXECUTION-PLAN.md`](./MASTER-EXECUTION-PLAN.md) |
| Next action | Work P0 → P1 in order above; then re-audit or start Phase 11 |

> When a fix lands, tick it here (`[x]`) or move the ID to a “Fixed” section with PR/commit reference so this file stays the punch list until Phase 10 is truly closed.
