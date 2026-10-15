# Phase 11–15 Audit — Required Fixes & Improvements

> **Audited:** 15 Oct 2026  
> **Baseline:** [`MASTER-EXECUTION-PLAN.md`](./MASTER-EXECUTION-PLAN.md) Phases 11, 12, 13, 15  
> **Out of scope (by design):** Phase 14 (SaaS/billing), Phase 16 (WhatsApp Business API), Phase 17 (Gamification)  
> **Verdict:** Feature surface is largely present (~70–85% per phase) but **not ship-correct**. Critical cron/export bugs and Phase 12/13 metric stubs must be fixed before polish-only work.

---

## Scope decision (locked)

| Phase | In this pass? | Notes |
|---|---|---|
| 11 Export / Settings / PWA / Cron | **Yes** | Must be solid for daily use |
| 12 Templates / Recurring | **Yes** | Fill High gaps |
| 13 Analytics / PDF / Digests | **Yes** | Fix stubbed metrics + `shared_at` |
| 14 Multi-tenant SaaS | **No** | Skipped |
| 15 AI helpers | **Yes** | Fix bugs; light categorize helper |
| 16 WA Business | **No** | Not needed now |
| 17 Gamification | **No** | Not needed now |
| 18 Polish | Later | After this fix pass |

---

## Executive summary

| Severity | Count | Meaning |
|---|---|---|
| **P0 Critical** | 3 | Security / silent data loss |
| **P1 High** | 12 | Plan gaps / wrong metrics / broken UX |
| **P2 Medium** | 14 | Correctness & polish |
| **P3 Low** | 10 | Nice-to-have |

---

## P0 — Critical

### P0-1. Cron open if `CRON_SECRET` unset
- **File:** `src/app/api/cron/keepalive/route.ts`
- **Fix:** Fail closed (401) when secret missing. Prefer `Authorization: Bearer` only (drop `?secret=` or keep as secondary).

### P0-2. CSV export silently truncates (~1000 rows)
- **File:** `src/app/api/admin/export/route.ts`
- **Fix:** Paginate with `.range()` until exhausted (or stream). Never silently cap.

### P0-3. `daily_stats` upsert `onConflict` has spaces
- **File:** `src/app/api/cron/keepalive/route.ts`
- **Fix:** Use `"org_id,group_id,stat_date"` (no spaces).

---

## P1 — High

### Phase 11
| ID | Issue | Fix |
|---|---|---|
| P1-11a | No Dashboard export button | Add Export CSV on dashboard (current filter range) |
| P1-11b | No monthly backup toast on 1st | Show once/month toast → Settings/export |
| P1-11c | PWA icons SVG-only (weak iOS) | Add PNG 192/512 + apple-touch |

### Phase 12
| ID | Issue | Fix |
|---|---|---|
| P1-12a | No “Duplicate Yesterday” | Dashboard shortcut to clone yesterday’s lists |
| P1-12b | No Auto-generated badge | Persist `source: auto` (settings/recurrence jsonb or column) + badge |
| P1-12c | Cron recurrence uses UTC “today” | Use org/admin timezone calendar date |
| P1-12d | Custom every-N-days missing | Add `custom` + `interval_days` in UI + cron |

### Phase 13
| ID | Issue | Fix |
|---|---|---|
| P1-13a | `avg_response` uses `created_at` not `shared_at` | Fix keepalive + reports + recompute |
| P1-13b | Keepalive digest metrics stubbed | Compute real KPIs + top performers |
| P1-13c | Manual digest uses fake numbers | Use same real aggregation as reports |

### Phase 15
| ID | Issue | Fix |
|---|---|---|
| P1-15a | Voice transcript drops earlier finals | Accumulate transcript across `onresult` |
| P1-15b | `suggested_due` discarded in UI | Apply to item draft / list due when present |
| P1-15c | No `categorizeTask` / tags | Add helper + optional suggested_category on parse |

---

## P2 — Medium

| ID | Issue | Fix |
|---|---|---|
| P2-1 | Export multi-completion overwrite | One CSV row per completion |
| P2-2 | Settings member count not org-scoped | Count via groups join |
| P2-3 | Export download with expired session saves JSON as CSV | Fetch blob + check content-type / toast |
| P2-4 | Cron skip archived parents for recurrence | Filter `status != archived` / `deleted_at` |
| P2-5 | Message templates unused in ShareSheet | Load message template option |
| P2-6 | Template PATCH body unvalidated | Zod validate body |
| P2-7 | Digest missing bottom performers | Include bottom 3 |
| P2-8 | Reports page date presets UTC | Use admin timezone helpers |
| P2-9 | AI toast always says “Gemini” on fallback | Return `source: ai \| fallback` |
| P2-10 | Draft-reminder weak “who pending” context | Include incomplete member names |
| P2-11 | Default message format preview on Settings | Show WhatsApp template preview |
| P2-12 | Cron `?secret=` leaks to logs | Header-only auth |
| P2-13 | In-memory AI rate limit on serverless | Document + tighten max text length |
| P2-14 | Recurrence manage UI | Minimal: list lists with recurrence on Templates/Settings |

---

## P3 — Low / deferred

- PDF page numbers / chart images in PDF  
- Verified series on trend chart  
- Streaming CSV (pagination sufficient for MVP)  
- Separate “Download Backup” vs Export label  
- PIN change force re-login (current session refresh is OK)  
- Voice `lang` matching AI reminder language  
- `daily_stats` read path in reports (optional optimization)  
- Drag-reorder on create (already deferred from 1–10)  

---

## Phase completeness (pre-fix)

| Phase | Built? | Correct? | Blockers |
|---|---|---|---|
| 11 | Yes | No | P0-1, P0-2, dashboard export, backup toast |
| 12 | Mostly | No | Duplicate Yesterday, auto badge, TZ, custom N-days |
| 13 | Mostly | No | stub digests, `shared_at` response time |
| 15 | Mostly | Partial | voice bug, suggested_due, categorize |

---

## Recommended fix order

1. P0 cron secret + export pagination + onConflict  
2. P1-13 metrics (`shared_at` + real digests)  
3. P1-12 recurrence TZ + auto badge + Duplicate Yesterday + custom N  
4. P1-11 dashboard export + monthly toast + icons  
5. P1-15 voice + due + categorize  
6. P2 polish batch  

---

## Explicitly NOT doing now

- Phase 14 multi-tenant / Razorpay  
- Phase 16 WhatsApp Business API  
- Phase 17 scores / badges / leaderboards  

---

---

## Fix status (15 Oct 2026)

### P0 Critical — done
- [x] **P0-1** Cron fail-closed when `CRON_SECRET` unset; header-only auth
- [x] **P0-2** CSV export paginates with `.range()` (no silent 1000-row cap)
- [x] **P0-3** `daily_stats` upsert `onConflict: "org_id,group_id,stat_date"`

### P1 High — done
- [x] **P1-11a** Dashboard Export CSV (current filter range, blob + content-type check)
- [x] **P1-11b** Monthly backup toast on 1st (localStorage once/month)
- [x] **P1-11c** PWA PNG icons 192/512 + apple-touch-icon
- [x] **P1-12a** “Duplicate Yesterday” API + dashboard button
- [x] **P1-12b** Auto-generated badge (`recurrence.auto_generated` + UI)
- [x] **P1-12c** Cron recurrence uses org/admin timezone calendar date
- [x] **P1-12d** Custom every-N-days (`freq: custom` + `interval_days`) in UI + cron
- [x] **P1-13a** `avg_response` uses `shared_at || created_at` (reports / pdf / recompute / digests)
- [x] **P1-13b** Keepalive digests use `buildOrgDigestMetrics`
- [x] **P1-13c** Manual digest route uses same real aggregation
- [x] **P1-15a** Voice transcript accumulates finals across `onresult`
- [x] **P1-15b** `suggested_due` applied to list due time when present
- [x] **P1-15c** `categorizeTask` + `suggested_category` on parse

### P2 Medium — done (this pass)
- [x] **P2-1** Export multi-completion → one CSV row per completion
- [x] **P2-2** Settings member count org-scoped via `groups!inner`
- [x] **P2-3** Export download via fetch + toast on auth/JSON failure
- [x] **P2-4** Cron skips archived parents for recurrence
- [x] **P2-5** ShareSheet loads message templates
- [x] **P2-6** Template PATCH Zod-validated
- [x] **P2-7** Digest includes bottom performers
- [x] **P2-8** Reports date presets use admin timezone helpers
- [x] **P2-9** Parse API returns `source: ai | fallback`
- [x] **P2-10** Draft-reminder includes pending assignee names
- [x] **P2-11** Settings shows default WhatsApp message format preview
- [x] **P2-12** Cron header-only auth (no `?secret=`)
- [x] **P2-13** AI input length soft-cap documented in code
- [x] **P2-14** Recurrence manage UI on Templates page (list + Stop)

### Follow-up leftovers closed in verification pass
- [x] Recompute `onConflict` spaces (same bug class as P0-3)
- [x] Parse `source` reflects actual ai vs fallback (not just env key presence)
- [x] Monthly backup toast uses admin timezone calendar day

### Still ops / out of scope
- Env: `SESSION_SECRET`, `CRON_SECRET`, `GEMINI_API_KEY`, `RESEND_API_KEY` as needed
- SQL: `professor_complete_item` RPC if not applied yet (Phase 1–10)
- Phase 14 / 16 / 17 intentionally skipped
- P3 nice-to-haves (PDF charts, streaming CSV, etc.) — not blockers

### Post-fix phase completeness

| Phase | Built? | Correct? |
|---|---|---|
| 11 | Yes | Yes |
| 12 | Yes | Yes |
| 13 | Yes | Yes |
| 15 | Yes | Yes |

`npx tsc --noEmit` — pass. **Audit punch list: all P0/P1/P2 closed.**
