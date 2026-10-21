# TaskTracker — UI/UX Redesign Spec (Glass Elevation)

> **Date:** 21 Oct 2026  
> **Scope:** Premium visual elevation of the existing WhatsApp Task Tracker — not a rebuild.  
> **Constraint:** Preserve flows, APIs, data, IA, and light-first emerald identity.  
> **Inspiration:** `IMAGES/ReferenceUI` — iDraft (1), Coders (2), start-page frost (3). Texture, chassis, and contrast — not a grayscale clone.  
> **Current UI audited:** `IMAGES/CURRENTUI` 1–11 + live `/admin`, `/login`, `/t/[token]`.

---

## 1. What this product actually is

A professor creates checklists, shares them to WhatsApp groups via `wa.me`, and tracks ticks on a live dashboard. Students open `/t/[token]` in the phone browser — no install, no login.

**Flows that must stay frictionless**

| Flow | Path | Must not add |
|---|---|---|
| A Daily dispatch | Login → Dashboard → New Task List → Share WA | Extra screens, extra clicks |
| B Nudge | Dashboard overdue / Reminders ready → one-tap ShareSheet | Hidden actions |
| C Student tick | WhatsApp link → pick name → 44px checkboxes | Visual noise, slow paint |
| D Verify / export | Task detail + Reports | Chart/table clutter |

If glassmorphism hurts readability, contrast, or tap speed, it is rejected.

---

## 2. Audit of the current UI (what stays, what lifts)

### Keep (already working)

- Light-first class theme (`html.dark`), emerald primary, WhatsApp green CTAs
- Sidebar Work / Tools grouping + sticky New Task List
- Dashboard: Action required → Reminders ready → Today’s lists → Group snapshot → Quick actions
- Guided empty states (Tasks / Groups / Templates)
- Task list cards with progress, Copy Link, Share WA
- Member checklist 44px targets, login PIN pad
- Content max-width ~960px, mobile bottom nav + More sheet

### Problems worth fixing (visual + a little UX)

| ID | Observation | Decision |
|---|---|---|
| V1 | Canvas is a flat cream/charcoal slab. Cards sit on it with identical white/dark fills — no depth | Add a **quiet atmosphere** (soft sage/emerald orbs) and **frosted panels** |
| V2 | Sidebar and top bar are full-bleed rectangles. All three new refs float one glass chassis on silk | **Desktop:** inset rounded chassis (`md:p-3` + 32px radius). **Phone/PWA:** full-bleed. |
| V3 | Typography is Inter-only; headings feel generic | Switch UI sans to **Plus Jakarta Sans**; keep JetBrains Mono for tokens/URLs |
| V4 | All cards have the same visual weight | Cards become glass; interactive cards lift on hover; empty states get a dashed frost well |
| V5 | Dark mode is near-black plastic, not glass | Forest-night canvas + translucent dark glass (not grey iDraft clone) |
| V6 | Active nav is a mint wash; reference uses a high-contrast pill | Light: ink-green filled pill; Dark: soft luminous pill |
| V7 | Login is a solid card on cream | Same atmosphere + glass PIN card |
| V8 | Member page is functional but flat | Same canvas + glass header card (students still get high contrast) |
| F1 | Filter/search bars look like leftover form chrome | Glass pill toolbars (Tasks, Reports) via existing Tabs / Search / Dropdown tokens |

### Explicitly not doing

- Grayscale iDraft / Coders palette (this is a WhatsApp academic tool — green is the brand)
- Cloning clocks, weather, fake donut charts, or file-preview widgets
- Rearranging navigation or adding pages
- WhatsApp Business auto-send, new APIs, schema changes
- Animated silk blobs (static mist only)

---

## 3. Design principles

1. **Clarity over decoration** — glass is a surface, never the content.
2. **One identity** — sage atmosphere + emerald action + WhatsApp send. No purple, no rainbow.
3. **Token-first** — almost all visual change lives in `globals.css` + primitives so pages inherit it.
4. **Professor eyes** — body text ≥ 14px equivalent, contrast ≥ WCAG AA, 44px member ticks stay.
5. **Reduced motion** — disable blur/atmosphere animation when `prefers-reduced-motion: reduce`.

---

## 4. Visual system

### 4.1 Colour

**Light (primary)**

| Token | Hex / value | Role |
|---|---|---|
| Canvas | `#EEF3EF` | Sage mist (warmer than grey, cooler than the old cream) |
| Atmosphere | radial emerald `#0D9E5F` @ 8–12% + cream highlight | Soft depth, not a wallpaper |
| Surface / glass | `rgba(255,255,255,0.68)` + `backdrop-filter: blur(16px)` | Cards, sidebar, top bar |
| Surface raised | `rgba(255,255,255,0.86)` | Modals, popovers |
| Ink | `#14241C` | Primary text (forest, not pure black) |
| Secondary | `#4D6358` | Labels |
| Primary | `#0D9E5F` | Create / save |
| WhatsApp | `#25D366` | Share / remind only |
| Border | `rgba(20,36,28,0.08)` + inner highlight `rgba(255,255,255,0.7)` | Hairline glass edge |

**Dark**

| Token | Value | Role |
|---|---|---|
| Canvas | `#0B110F` | Forest night |
| Glass | `rgba(22, 32, 28, 0.62)` + blur 16px | Panels |
| Text | `#E8F0EB` | High contrast on glass |
| Primary | `#34D399` | Readable on dark glass |
| Border | `rgba(255,255,255,0.08)` | Hairline |

Status colours (pending amber, done blue, verified emerald, overdue red) **stay semantic** — they are not restyled to grey.

### 4.2 Typography

| Role | Face | Weight | Size |
|---|---|---|---|
| UI / body | **Plus Jakarta Sans** | 400–700 | 13–16px |
| Display / page title | Plus Jakarta Sans | 700, tracking `-0.03em` | 18–22px |
| Captions / nav | Plus Jakarta Sans | 600 | 11–12px |
| Tokens, URLs, PIN helper | JetBrains Mono | 500 | 11–12px |

Plus Jakarta Sans is geometric and editorial — closer to the reference’s clean sans — without looking like a startup landing page.

### 4.3 Shape, glass, motion

| Token | Value |
|---|---|
| Radius card | 18px |
| Radius shell / empty | 22–24px |
| Radius pill (nav, tabs) | 999px or 14px inner |
| Blur | 16px default, 20px overlays |
| Shadow card | soft sage-tinted, not harsh grey |
| Hover | translateY(-2px) + slightly stronger glass highlight |
| Transition | 180ms ease-out |

### 4.4 Layout

- **Desktop (≥768px):** silk canvas + floating chassis (`rounded-[32px]`, inner sidebar 232px, content scrolls inside the window). Matches refs 1–3 without becoming a tiny widget.
- **Phone:** full-bleed; bottom nav + More sheet stay frosted. Chassis padding collapses so PWA remains usable.
- Top bar: transparent inside the chassis, 72px, circular icon buttons (theme / logout) like ref 2.
- Dashboard: real-data **ink Overview** card (lists / overdue / verify / reminders) — iDraft contrast, no fake KPIs.

---

## 5. Page-by-page intent (no IA change)

| Page | Improvement |
|---|---|
| **Login** | Atmosphere + glass PIN card; keypad buttons as frosted tiles |
| **Dashboard** | Inherit glass cards; empty “today” well is a dashed frost panel; reminders banner uses warning glass |
| **Task lists** | Toolbar (tabs, search, sort) sits in one glass strip; cards lift |
| **Groups / detail** | Same cards; snapshot strip as compact glass |
| **Templates** | Empty guided steps as nested frost chips |
| **Reports** | Period bar + chart shell as glass (empty chart stays message-only) |
| **Settings** | Section cards glass; reminder copy unchanged |
| **Create list** | Form cards glass; voice remains ghost/secondary |
| **ShareSheet** | Modal already overlay — make panel glass, keep assignment copy |
| **Member `/t`** | Atmosphere + glass header; checklist rows slightly frosted |

---

## 6. Implementation plan (code)

**Phase A — Tokens & atmosphere** (`src/app/globals.css`, `src/app/layout.tsx`)  
New CSS variables for glass, blur, radii, ink. Body atmosphere pseudo-elements. Font swap.

**Phase B — Shell** (`AdminLayout`, `Sidebar`, `TopBar`, mobile nav)  
Frosted chrome, active pill, New Task List stays the loudest control.

**Phase C — Primitives** (`Card`, `Button`, `Modal`, `Input`, `SearchInput`, `Dropdown`, `Tabs`, `EmptyState`, `ConfirmDialog`)  
Glass variants; interactive lift; inputs with translucent fills.

**Phase D — Surfaces that are not primitives**  
Login, member page wrapper. TaskListCard / GroupCard inherit Card.

**Phase E — Verify**  
Typecheck. Browser: login, dashboard, tasks, reports (light + dark), member checklist contrast.

**Phase F — Chassis lift** (new refs 1–3, 21 Oct evening)  
Desktop floating glass window, silk atmosphere, ink overview card, circular header chips. Mobile unchanged in IA.

No API, schema, or route changes.

---

## 7. Accessibility & performance gates

- Text on glass: never drop below ~12:1 for primary, ~4.5:1 for secondary.
- `backdrop-filter` omitted when `prefers-reduced-motion: reduce` or when `@supports not (backdrop-filter: blur(1px))` — opaque fallback.
- Blur radius capped; no animated blobs.
- Hit targets: buttons ≥ 36px admin, 44px member.
- Theme toggle and logout remain in the top bar.

---

## 8. Done when

- [x] Spec exists at project root (this file)
- [x] Light and dark both use frost, not plastic fills
- [x] Emerald / WhatsApp actions still obvious
- [x] Create → Share → tick still ≤ same tap count
- [x] Empty states still teach the 3-step flow
- [x] No layout jump vs current IA
- [x] Login + dashboard + task cards verified in browser
- [x] Phase F chassis lift from new refs 1–3 (desktop floating glass; phone full-bleed)

---

## 9. Related docs

- `docs/UI-UX-REDESIGN-PLAN.md` — original identity (light-first, emerald) — still the brand north star  
- `docs/UI-UX-PWA-GAP-PLAN.md` — prior polish (empties, badges, PWA)  
- `docs/AUTO-REMINDERS-PLAN.md` — one-tap reminder behaviour (unchanged)  
- `IMAGES/CURRENTUI` — before  
- `IMAGES/ReferenceUI` — glass language only  
