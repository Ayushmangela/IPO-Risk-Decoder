# Session handoff — 2026-08-15

Scope: what happened in **this session only**. For the project's overall
background and conventions, read `GEMINI.md` first, then `HANDOVER.md`
(2026-08-12).

> **`HANDOVER.md` is now partly stale.** It states the frontend is
> "Desktop-only (1440-1920px), no mobile breakpoints by design (explicit user
> decision)" and describes a **teal** accent. Both were changed this session:
> the app is now mobile-responsive, and the accent is signal-blue `#4c6fff`.
> Where the two documents disagree, this one is newer.

---

## 1. Goal we're working toward

Two threads ran in parallel:

**A. Widen filing coverage.** Get the pipeline to the point where new DRHP
filings can be discovered, fetched, and scored without manual work. Design doc:
`docs/design-auto-refresh-and-shareable-card.md` (3-part plan: PDF auto-fetch →
wire to pipeline → shareable card).

**B. Make the UI a credible fintech product.** Full audit + redesign, not
superficial polish. Audit: `docs/ui-audit-phase1.html`. Design system:
`MASTER.md` (canonical — every colour/size/timing must trace back to it).

**The immediate blocker on thread A is unresolved:** no filing has been fully
processed end-to-end. See §5.

---

## 2. Current state of the code

Branch **`shravan`**, pushed to `origin`. HEAD = `d70880a`.
Working tree clean except one intentional exclusion (§3).

Three commits this session:

| Commit | What |
|---|---|
| `347f04c` | initial backup of project (33 files) |
| `73c3e1b` | Gemini pipeline reliability: model pinning, network retry, pacing |
| `d70880a` | Local (Ollama) backend support for the upload pipeline |

**Working and verified:**
- Frontend builds clean (`npm run build`, 5393 modules, 0 errors)
- All 6 pages render; zero horizontal scroll at 375 / 768 / 1024 / 1440
- Local Ollama backend scores real risk items end-to-end (`qwen3:8b`)
- Shareable risk card endpoints (`/api/companies/{id}/card`, `/share`)
- PDF auto-fetch: 9/15 real filings downloaded and verified as genuine DRHPs

**Known-unfinished:**
- No filing processed through the full pipeline (§5)
- Scheduler/automation — deliberately on hold at user's request
- Local backend works but is **accuracy-unvalidated** (§6)

---

## 3. Files actively edited this session

**Pipeline (Python)**
- `scripts/03_llm_pipeline.py` — model pinning, 503 + network-error retry,
  `LOCAL_LLM_TIMEOUT`
- `scripts/15_process_uploaded_drhp.py` — backend threading, pacing guard
- `scripts/16_fetch_drhp_pdf.py` — **new**, DRHP PDF resolver/downloader
- `backend/card_generator.py` — **new**, shareable PNG risk card
- `backend/main.py` — `/card` + `/share` endpoints
- `requirements.txt` — added Pillow

**Frontend**
- `frontend/src/motion/index.js` — **new**, the *only* file importing gsap
- `frontend/src/composed/RiskVerdict.jsx` — **new**, Overview hero
- `frontend/src/styles/tokens.css` — palette, motion tokens, semantic borders
- `frontend/src/constants.js` — chart colour/font/tooltip mirrors
- Also: `StatTile`, `EmptyState`, `CommandPalette`, `SeverityDonut`,
  `CategoryBarChart`, `OverviewPanel`, `AddCompanyPanel`, and 9 stylesheets

**Docs**
- `MASTER.md` — **new**, canonical design system
- `docs/` — **new**: design doc, UI audit, design thesis preview

**Deliberately NOT committed:** `.claude/skills/threejs-skills/` is an
*embedded git repository*. Committing it stores an empty gitlink — it would
look backed up but restore as an empty folder. Copy it manually to the new
machine, or vendor it properly.

---

## 4. What's been touched — behavioural changes

- **Design system replaced**: teal → signal-blue `#4c6fff`; 4px radius ceiling;
  no gradients/glass/glow; hairline borders instead of shadows
- **Overview hierarchy**: added a dominant risk verdict hero (76px score,
  severity-coloured, proportional distribution bar). Removed the redundant
  "Average severity" tile — metric row is now 3 tiles, not 4
- **Motion added** (GSAP): stagger entrance, number count-up, overlay
  transitions. All reduced-motion guarded, nothing >320ms, no bounce/spring
- **Mobile responsive**: sidebar → bottom tab bar <860px, 44px touch targets,
  safe-area insets, hover gated behind `(hover: hover)`
- **Upload progress**: 6-stage weighted indicator replacing rotating text
- **Empty vs error states** now visually distinct (`tone="error"`, `role="alert"`)

---

## 5. Everything tried that FAILED — read this before retrying

### The Kay Jay Forgings run — still not done, 5 attempts

| # | Failure | Diagnosis at the time | Was it right? |
|---|---|---|---|
| 1-4 | 503 at items 2-3 | "transient overload" | ❌ wrong |
| 5 | 429 after 503 fix | "burst rate-limiting, wait for cooldown" | ❌ wrong |
| 6 | 429 at item 13 | "free-tier RPM ceiling → widen to 5s" | ❌ wrong (still a correct change on its own merits) |
| 7 | 429 at item 1 | "switch to gemini-2.5-flash for bigger quota" | ❌ **wrong — my suggestion, didn't pan out** |
| 8 | ReadTimeout at item 12 | network transient, not quota | ✅ correct, fixed |
| 9 | 429 at item 4 | daily quota exhausted by retries | ✅ correct |

**The actual root cause**, confirmed via the API's own error detail:

```
quotaId: GenerateRequestsPerDayPerProjectPerModel-FreeTier
limit: 20
```

**The Gemini free tier allows 20 requests/day, per model.** One 30-item filing
needs ~32 (30 risk items + litigation/industry + proceeds/promoter). **It can
never complete on the free tier at any pacing.** Confirmed identical on both
`gemini-3.7-flash` and `gemini-2.5-flash` — the model switch does not help, and
verifying that cost a day's quota on both models.

Retries consume the same daily budget, so exceeding the limit compounds rather
than self-corrects.

**Do not retry these:** waiting for cooldown; widening spacing further;
switching Gemini models. All three were tried and disproven.

### Other failures worth not repeating

- **Regex for DRHP links matched site-nav boilerplate.** Every chittorgarh.com
  page carries generic "Mainboard RHP & DRHP" nav links; the first pass resolved
  *all 10* companies to the same generic URL. Fixed with an explicit nav filter.
- **`min-width: 0` was the real mobile fix.** Removing the hardcoded
  `min-width: 1200px` wasn't enough — grid items default to `min-width: auto`,
  so a wide table still forced the whole page wider than the viewport.
- **Overlay unmount depended on GSAP `onComplete`.** rAF pauses in a hidden
  tab, so closing the palette just before backgrounding stranded an invisible
  click-blocking overlay permanently. Fixed with a fallback timer.
- **`extract_proceeds_and_promoter` had no `backend` param** but I added
  `backend=backend` to its body — a `NameError` that `ast.parse` cannot catch.
  Caught by checking signatures against call sites; there is now a static check
  that walks every function for this pattern.

### Environment gotchas (cost real time)

- Browser pane wouldn't composite frames → **screenshots and rAF-driven
  animation could not be visually verified**. Verified functionally instead
  (`window.scrollTo` round-trips, computed styles, mount/unmount state).
  **Motion has never been visually confirmed playing.**
- Vite HMR reports stale `CHART_FONT_MONO is not defined`-style errors after
  editing a module and its importer together. `npm run build` is the
  authoritative check, not the console.
- `.env` was saved UTF-16 with a BOM → `python-dotenv` couldn't parse it.
- Console log buffer persists across reloads; open a fresh tab for clean state.

---

## 6. Next step I'd take

**Immediate: validate a local model on the MacBook (Apple Silicon, 24-36GB).**

```bash
ollama pull qwen2.5:32b
# .env: LLM_BACKEND=local, LOCAL_LLM_MODEL=qwen2.5:32b
python scripts/04_validate_llm.py --backend local
```

Must clear **80% category match and 80% score-within-±1** against
`data/human_labels.csv` (100 labels). That gate is the project's credibility
claim — do not process filings with a model that hasn't passed it.

⚠️ **Every local spot-check so far returned severity 5** — the exact
over-indexing that failed `llama3.2:3b` (23%/59%). Three data points isn't
evidence, and qwen3:8b is much smaller than qwen2.5:32b, but treat the gate as
a genuine open question, not a formality.

Expect ~2h for validation (200 calls) on a 32B model.

**Then, in order:**
1. If validation passes → run Kay Jay locally (`backend="local"`, ~30-55 min).
   If it fails → the honest options are a bigger local model, or billing on
   Gemini (cost is negligible, ~32 short Flash requests).
2. **Build resumability** in `run_full_pipeline` — currently all-or-nothing, so
   any failure at item 29/30 discards everything. This is the single biggest
   robustness gap and it blocks any batch/scheduled processing.
3. Visually confirm the GSAP motion on a working browser (never verified).
4. Then the scheduler (on hold) and the remaining design-doc items.

**Do not** start the scheduler before resumability exists — an unattended job
that discards all progress on one network blip will waste quota and time.
