# UI/UX + PWA Gap Plan

> **Audited:** 16 Oct 2026  
> **Against:** [`UI-UX-REDESIGN-PLAN.md`](./UI-UX-REDESIGN-PLAN.md)  
> **Verdict:** Redesign is **demo-complete** (~95%). Remaining work is **ops deploy to Vercel** for real phone PWA install.  
> **PWA:** **Yes, possible.** Professor installs from HTTPS (Vercel). Members use `/t/[token]` in browser — no install.

---

## Executive answers

| Question | Answer |
|---|---|
| Is the UI/UX plan fully done? | **Yes for demos** — G0 + G1 + core G2 closed. Optional: pull-to-refresh, tablet icon rail |
| Can the professor install as a PWA? | **Yes**, after deploy to HTTPS. Add to Home Screen (iOS) or Install App (Android/Chrome) |
| Do members need to install? | **No.** They tap the WhatsApp `/t/[token]` link in the browser |
| What’s left? | **Deploy to Vercel** with env vars — only blocking item for phone install |

---

## What’s already solid (do not rebuild)

- Light-first theme + class-based dark toggle (`ThemeProvider`, `globals.css` tokens)
- Admin shell: sidebar Work/Tools groups, TopBar (real name), content max-width ~960px
- Dashboard: Action Required, Today’s lists, Group Snapshot, Quick Actions (KPI spam removed)
- Login: branded light PIN pad + theme toggle
- Settings: profile / PIN / digest / backup / PWA install
- WhatsApp button variant + ShareSheet wa.me flow (emerald, not purple)
- Manifest + service worker + install banner / Settings install CTA
- Guided empties on Tasks / Groups / Templates
- Badge glyphs, TaskListCard, 44px member checkboxes, sort, reports empty message

---

## PWA — how it works for the professor

```
Professor phone (HTTPS Vercel URL)
  → Open site once → “Install App” / Add to Home Screen
  → Icon on home screen → opens /admin → PIN login
  → Create lists, share wa.me links as usual

Student phone
  → WhatsApp message → tap /t/xxxxx → browser checklist
  → No install required (by design)
```

| Environment | Install? | Notes |
|---|---|---|
| Localhost desktop | Partial | SW can register; fine for UI testing |
| Phone → localhost | No | Phone can’t reach your PC without a tunnel |
| **Vercel HTTPS** | **Yes** | This is the real professor path |

### PWA ship checklist

| # | Task | Status | Priority |
|---|---|---|---|
| PWA-1 | Deploy to Vercel with env vars | **Ops — you do this** | **P0** |
| PWA-2 | Light splash `background_color` in manifest | **Done** (`#F8F7F4`) | P0 |
| PWA-3 | Real 192 / 512 / apple-touch icon sizes | **Done** | P0 |
| PWA-4 | Light offline page in `sw.js` | **Done** | P1 |
| PWA-5 | Confirm Install CTA on Settings + banner | **Done** | — |
| PWA-6 | Document PIN after install (session cookies work in standalone) | **Done** | — |

---

## Gap status

### P0 — Demo-complete

| ID | Gap | Status |
|---|---|---|
| G0.1 | ShareSheet purple “AI” panel | **Done** (emerald) |
| G0.2 | PWA dark splash / oversized icons | **Done** |
| G0.3 | Guided empty `steps` unused | **Done** (Tasks / Groups / Templates) |
| G0.4 | Mobile “More” bottom sheet | **Done** |

### P1 — High polish

| ID | Gap | Status |
|---|---|---|
| G1.1 | Status badge glyphs + TaskListCard | **Done** |
| G1.2 | Create Task List density + ghost voice | **Done** (recurrence folded into List Details) |
| G1.3 | Member checklist ≥ 44px | **Done** |
| G1.4 | Group detail KPI → snapshot strip | **Done** |
| G1.5 | Login theme toggle | **Done** |
| G1.6 | Reports empty chart message-only | **Done** |
| G1.7 | ALL CAPS → title-case | **Done** |
| G1.8 | Task lists Sort dropdown | **Done** |

### P2 — Nice-to-have

| ID | Gap | Status |
|---|---|---|
| G2.1 | `--type-*` tokens + JetBrains Mono | **Done** |
| G2.2 | Check-draw animation on member tick | **Done** (`check-pop`) |
| G2.3 | Pull-to-refresh in PWA | **Skipped** (optional; browser refresh works) |
| G2.4 | Offline top banner | **Done** |
| G2.5 | Tablet 56px icon rail | **Skipped** (optional; sidebar already compact) |
| G2.6 | Sidebar “N active lists” | **Done** |
| G2.7 | TopBar real professor name | **Done** |

---

## Definition of “done”

Redesign + PWA are **demo-complete** when:

- [x] No purple leftover panels
- [x] Light splash + correct icon sizes
- [x] Mobile More sheet works
- [x] First-run empties teach the 3-step flow
- [ ] Deployed HTTPS URL installs on professor’s phone ← **only remaining**
- [x] Member link from WhatsApp still works without install

---

## Related docs

- [`UI-UX-REDESIGN-PLAN.md`](./UI-UX-REDESIGN-PLAN.md) — full design spec  
- [`RUN-COMMANDS.md`](./RUN-COMMANDS.md) — local run / env  
- [`PHASE-11-15-AUDIT-FIXES.md`](./PHASE-11-15-AUDIT-FIXES.md) — feature audit (separate from UI)

*Next action: deploy to Vercel (PWA-1).*
