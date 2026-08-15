# IPO Risk Decoder — Design System (MASTER)

Canonical source of truth for the dashboard redesign. Every color, size, radius, and
timing value used in `frontend/src/**` must trace back to a token in this file.
No magic numbers in components — if a value isn't here, it doesn't belong in the UI.

Validated 2026-08-12 via `/genjutsu:paint`. Supersedes the previous
`frontend/src/styles/tokens.css` values (kept where the new thesis didn't require
a change — spacing scale and radii base are carried forward).

## Visual thesis

> A near-black monochrome dashboard with one sharp signal-blue accent reserved for
> action and focus — IBM Plex Sans/Mono for a disciplined, engineered voice,
> dense-but-organized spacing that opens up between sections and tightens within
> lists, and sharp hairline-bordered panels instead of soft shadowed cards.

## Interaction thesis

> Fast, dry, engineered motion — 140–180ms ease-out on every hover and state
> change, no scale-on-hover, no bounce or elastic easing, no scroll-triggered
> reveals or parallax. This is a working instrument, not a marketing page.

Forbidden: bounce/elastic overshoot, spring physics on simple hovers,
scale-on-hover, parallax, decorative scroll reveals, animation >200ms.

---

## Color

### Surfaces
| Token | Value | Use |
|---|---|---|
| `--bg-app` | `#0a0b10` | Page background |
| `--bg-surface` | `#12141b` | Cards, panels, table rows |
| `--bg-surface-raised` | `#181b24` | Hover state on surfaces |
| `--bg-focused` | `#1d2029` | Active/selected surface |

### Borders
| Token | Value | Use |
|---|---|---|
| `--border-subtle` | `rgba(255,255,255,0.08)` | Default hairline borders, dividers |
| `--border-strong` | `rgba(255,255,255,0.18)` | Emphasized borders, input outlines |

### Text
| Token | Value | Contrast on `--bg-app` | Use |
|---|---|---|---|
| `--text-primary` | `#edeef2` | 15.8:1 (AAA) | Headings, primary content |
| `--text-secondary` | `#9ba0ac` | 7.1:1 (AAA) | Body copy, descriptions |
| `--text-muted` | `#5f6570` | 3.9:1 (AA large only) | Captions, timestamps — never body text |
| `--text-on-accent` | `#08111f` | — | Text on filled accent surfaces |

### Accent — single purposeful signal
| Token | Value | Use |
|---|---|---|
| `--accent` | `#4c6fff` | Links, focus rings, active nav, primary highlight — **never decorative** |
| `--accent-hover` | `#6684ff` | Accent hover state |
| `--accent-wash` | `rgba(76,111,255,0.14)` | Selected-row backgrounds, subtle highlight fills |
| `--accent-border` | `rgba(76,111,255,0.4)` | Focus-visible outlines |

### Severity scale (5→1) — distinct from accent on purpose
| Token | Value | Label |
|---|---|---|
| `--severity-5` | `#f2545b` | Severe |
| `--severity-4` | `#f2994a` | High |
| `--severity-3` | `#e0b430` | Moderate |
| `--severity-2` | `#4caf7d` | Low |
| `--severity-1` | `#5d7a9e` | Minimal |

### Semantic (non-severity status — litigation, DDI flags, form validation)
| Token | Value | Use |
|---|---|---|
| `--positive` | `#4caf7d` | Success, matched/verified state |
| `--positive-wash` | `rgba(76,175,125,0.14)` | Success background fill |
| `--warning` | `#e0b430` | Caution, needs review |
| `--warning-wash` | `rgba(224,180,48,0.14)` | Warning background fill |
| `--critical` | `#f2545b` | Error, mismatch, blocked |
| `--critical-wash` | `rgba(242,84,91,0.14)` | Error background fill |

Rule: severity color = how bad the disclosed risk is. Semantic color = whether an
operation/check succeeded. Never reuse one system for the other's meaning.

---

## Typography

Faces: **IBM Plex Sans** (UI, headings, body) + **IBM Plex Mono** (every number —
scores, percentages, counts, dates). Self-hosted (`@font-face`, woff2), no CDN.

| Token | Size | Weight | Line-height | Use |
|---|---|---|---|---|
| `--text-display` | 40px | 600 | 1.15 | Company name on detail pages |
| `--text-h1` | 26px | 600 | 1.25 | Page titles |
| `--text-h2` | 18px | 600 | 1.3 | Section headers |
| `--text-body` | 15px | 400 | 1.55 | Descriptions, risk text |
| `--text-body-sm` | 13px | 400 | 1.5 | Secondary metadata |
| `--text-data` | 20px | 500 (mono) | 1.2 | Featured numbers (severity score) |
| `--text-data-sm` | 13px (mono) | 500 | 1.2 | Inline numbers in tables/rows |
| `--text-eyebrow` | 12px | 600 | 1.2 | Uppercase labels, 0.08em tracking |
| `--text-caption` | 11px | 500 | 1.3 | Timestamps, fine print |

Letter-spacing: -0.015em on display/h1 (tightens large sizes), 0 on body,
+0.08em on eyebrows/uppercase labels only.

`font-variant-numeric: tabular-nums` on every mono/data token — scores and
percentages must align in columns.

---

## Spacing

Carried forward from the existing 4px-base scale (still correct for this thesis):
`--space-1` 4px · `--space-2` 8px · `--space-3` 12px · `--space-4` 16px ·
`--space-5` 20px · `--space-6` 24px · `--space-8` 32px · `--space-10` 40px ·
`--space-12` 48px · `--space-16` 64px.

Rule: `--space-8` and up **between** sections/panels. `--space-2`–`--space-4`
**within** a list/table row. Never uniform airiness — density is intentional
where data is dense, generous where it isn't.

---

## Radius

| Token | Value | Use |
|---|---|---|
| `--radius-sm` | 3px | Chips, badges, small controls |
| `--radius-md` | 4px | Cards, panels, buttons, inputs — **the ceiling**, nothing rounder |

No `--radius-lg` exists on purpose. Sharp-edged is the point.

---

## Shadow

| Token | Value | Use |
|---|---|---|
| `--shadow-float` | `0 16px 40px -12px rgba(0,0,0,0.55), 0 2px 8px -2px rgba(0,0,0,0.4)` | Reserved for genuinely floating elements only: command palette, dropdown menus, toasts. Never on static cards — those use `--border-subtle` instead. |

---

## Motion

CSS-level (hover/state transitions):

| Token | Value | Use |
|---|---|---|
| `--duration-fast` | 140ms | Hover, color/background transitions |
| `--duration-move` | 180ms | Positional moves, panel expand/collapse |
| `--ease-out` | `ease-out` | Default for color/opacity transitions |
| `--ease-move` | `cubic-bezier(0.16, 1, 0.3, 1)` | Positional moves ("ease-out-expo") |

JS-level (GSAP, `src/motion/index.js` — the **only** file that imports gsap):

| Token | Value | Use |
|---|---|---|
| `DUR.entrance` | 320ms | Staggered panel entrance (covers real layout distance, so longer than a hover) |
| `DUR.count` | 500ms | Number count-up on changed financial figures |
| `EASE.out` / `EASE.move` | `power2.out` / `power3.out` | GSAP equivalents of the CSS easings above |

Available hooks — components import these, never gsap directly, so timing and
easing rules stay enforceable in one place:

- `useStaggerEntrance(key)` — 8px/40ms-stagger entrance for a container's
  children; re-runs when `key` changes (e.g. switching company).
- `useCountUp(value, format)` — counts a number to its target, snapping to the
  exact value on completion so no rounding artifact is ever the final figure.
- `useOverlayTransition(open)` — mount/exit transition for overlay surfaces.
  Unmount is guaranteed by a fallback timer, never solely by the tween's
  `onComplete` (rAF pauses in a hidden tab; a close fired just before backgrounding
  would otherwise strand a click-blocking overlay in the DOM).
- `useReducedMotion()` — live-updating flag.

All transitions animate `transform`/`opacity`/`background-color`/`border-color`
only — never `width`/`height`/`top`/`left` (repaint cost, per ui-ux-pro-max
Transform Performance rule). Every animation respects
`prefers-reduced-motion` — reduce to `0ms` / no-op, state still changes, it just
doesn't move. Nothing bounces, springs, or overshoots. Nothing exceeds 320ms.

**Where motion is deliberately absent:** scroll-triggered reveals, parallax,
chart draw-on animations, hover scale. This is an instrument that gets reloaded
all day; motion appears only where it communicates hierarchy (entrance order),
state (overlay open/close), or change (a figure that just updated).

---

## Base components — 5-state rule

Every interactive element defines: **default, hover, focus-visible, active,
disabled.** No exceptions.

### Button — primary
- Default: `background: var(--text-primary)`, `color: var(--bg-app)`, no border
- Hover: `background: #ffffff`
- Focus-visible: `outline: 2px solid var(--accent); outline-offset: 2px`
- Active: `transform: scale(0.98)`
- Disabled: `background: var(--bg-surface); color: var(--text-muted); cursor: not-allowed`

### Button — secondary
- Default: `background: transparent; border: 1px solid var(--border-strong); color: var(--text-primary)`
- Hover: `border-color: var(--accent); color: var(--accent)`
- Focus-visible: same outline as primary
- Active: `transform: scale(0.98)`
- Disabled: `border-color: var(--border-subtle); color: var(--text-muted)`

### Card / panel row (e.g. risk register row)
- Default: `background: var(--bg-surface); border: 1px solid var(--border-subtle)`
- Hover: `background: var(--bg-surface-raised)` (cursor: pointer if it navigates)
- Focus-visible: `outline: 2px solid var(--accent); outline-offset: -2px`
- Active/selected: `background: var(--accent-wash); border-color: var(--accent-border)`
- Disabled: n/a (rows aren't disabled, only loading — use skeleton, not opacity)

### Risk verdict (hero — Overview only)
The single dominant element in the app. 76px mono score (58px below 860px),
severity-coloured, paired with a verdict label and a proportional stacked
severity-distribution bar. Deliberately **not** a `.surface` card — giving it
the same treatment as the panels below is what flattened the previous
four-equal-tiles layout. Only one of these per page, ever.

Verdict bands mirror `backend/card_generator.py`'s `SEVERITY_BUCKETS` so the
dashboard and the shareable PNG never disagree about what a score is called:
≥4.5 Severe · ≥3.5 High · ≥2.5 Moderate · ≥1.5 Low · else Minimal.

### Empty state
Two tones. `neutral` (default) = "nothing here yet". `error` = risk-coloured
icon + title, `role="alert"`. Colour is never the only differentiator — icon and
copy differ too.

### Chip / badge
- Default: `border: 1px solid var(--border-strong); color: var(--text-secondary)`, mono, uppercase, `--radius-sm`
- Severity chip variant: border/text colored by `--severity-{1-5}` instead of neutral
- No hover/focus/active/disabled states — chips are not interactive

### Input
- Default: `background: var(--bg-surface); border: 1px solid var(--border-subtle)`
- Hover: `border-color: var(--border-strong)`
- Focus: `border-color: var(--accent); outline: 2px solid var(--accent-wash)`
- Disabled: `background: var(--bg-app); color: var(--text-muted)`

---

## Anti-patterns (do not do these)

- No emoji as icons — Phosphor icons only (already a dependency)
- No `box-shadow` on static cards — hairline border instead
- No border-radius above 4px anywhere
- No scale-on-hover on cards or rows — only on primary/secondary buttons' `:active`
- No gradients
- No decorative use of `--accent` — if it's not clickable, focusable, or the
  single most important number on the page, it isn't blue
- Severity colors and semantic colors (`--positive`/`--warning`/`--critical`)
  must never be cross-used
