# Handover — IPO Prospectus Risk Decoder

Last updated: 2026-08-15

> For a session-scoped log of what changed on 2026-08-15 (including every failed
> approach and why), see `handoff.md`. This file is the durable project handover.

## What this project is

A forensic audit tool for Indian IPO DRHP (Draft Red Herring Prospectus) filings. For each company it extracts every disclosed risk factor, scores severity 1-5 via LLM (validated against 100 human-labeled examples before being trusted), computes a Disclosure Distortion Index (is an important risk buried in the document?), cross-checks litigation load, and benchmarks against a cross-company average. See `GEMINI.md` for the full project brief and conventions — read it first, it's the authoritative source of "why things are built this way."

Live deployment: **https://ipo-risk-decoder.vercel.app**

## Current state (as of this handover)

- **3 fully processed companies**: Paytm, Lohia Corp, Zomato — offline pipeline, validated, stable. Do not re-run their pipeline steps casually; scripts `12`/`13` (Shadow Ledger, Proceeds/Promoter) contain hand-researched constants for these three that have no automated regeneration path.
- **Frontend design system lives in `MASTER.md`** — near-black monochrome ground, a single signal-blue accent (`#4c6fff`) reserved for interactive/focus states, IBM Plex Sans/Mono, 4px border-radius ceiling, hairline borders instead of shadows. No gradients, no glassmorphism, no glow. Every colour/size/timing in `frontend/src/` must trace back to a token there.
- **The frontend IS mobile-responsive** (changed 2026-08-15, reversing an earlier desktop-only decision). Sidebar rail becomes a bottom tab bar below 860px, 44px touch targets, safe-area insets, hover styles gated behind `(hover: hover) and (pointer: fine)`. Verified at 375/768/1024/1440.
- **Motion** is centralized in `frontend/src/motion/index.js` — the only file that imports GSAP. Stagger entrance, number count-up, overlay transitions. All reduced-motion guarded, nothing over 320ms, no bounce/spring. ⚠️ Never visually confirmed playing (see "Outstanding verification").
- **Active IPO Browser + PDF Upload pipeline** — browse currently-filing mainboard IPOs, or upload a DRHP to run the full analysis on demand.
- **Shareable risk card** — `GET /api/companies/{id}/card` renders a 1200x630 PNG; `/share` serves an OG-tagged page so links unfurl on social platforms.
- **Deployment bug fixed** (2026-08-12): `data/scored_risks.db` was excluded by `.gitignore`'s `*.db` rule, so it never reached the Vercel bundle and `/risks`/`/summary` 500'd in production while CSV-backed endpoints worked. Fixed via a `!data/scored_risks.db` gitignore exception + committing the file (commit `c5b8ad5`). Confirmed live and working.
- **Known incomplete item**: the upload pipeline **still has not completed a full real run.** The cause is now definitively identified and is not a bug — see "Outstanding verification" below.

## Architecture

```
frontend/          React 18 + Vite, plain CSS (no Tailwind), Recharts, @phosphor-icons/react, GSAP
  src/shell/        AppShell (top bar + left rail nav; rail becomes bottom tab bar <860px)
  src/features/     One file per view: OverviewPanel, RiskRegister, LitigationDocket,
                     BenchmarksPanel, MethodologyPanel, AddCompanyPanel
  src/composed/      CommandPalette, charts, DeltaBar, RiskVerdict (Overview hero)
  src/primitives/    Surface, Badge, StatTile, Skeleton, EmptyState, IconButton
  src/motion/        ONLY file importing gsap — entrance/count-up/overlay hooks
  src/constants.js   Chart colour/font/tooltip mirrors (Recharts needs literals, not CSS vars)
  src/api.js         All backend fetch calls in one place
  src/App.jsx         Routing (plain pushState/popstate, no router lib) + top-level data fetching

MASTER.md          Canonical design system — tokens, components, motion, anti-patterns
docs/              Design doc, UI audit, design thesis preview

backend/main.py     FastAPI. Every route registered twice: bare path (local uvicorn) +
                     /api/-prefixed (Vercel rewrite target). Reads companies.csv,
                     scored_risks.db, and several derived CSVs — never calls an LLM
                     live for the original 3 companies (see GEMINI.md's core rule).
backend/card_generator.py  Shareable PNG risk card (Pillow; pure presentation, no DB/LLM)

scripts/            Numbered offline pipeline, run manually, in order:
  01_extract_risks.py        PDF -> risks_raw.csv (PyMuPDF section location + regex split)
  03_llm_pipeline.py         Library only — Gemini/local/heuristic scoring functions
  04_validate_llm.py         Validates a backend against data/human_labels.csv (--backend)
  05_populate_db.py          risks_raw.csv -> scored_risks.db (LLM scoring)
  06_benchmark.py            scored_risks.db -> peer_stats.csv (pandas only, no LLM)
  07_combined_llm_features.py  Litigation + industry summary (HARDCODED per-company page ranges)
  10_obfuscation_test.py     Readability vs severity correlation (deterministic)
  11_ddi.py                  Disclosure Distortion Index (deterministic)
  12_shadow_ledger.py        100% HARDCODED manually-researched financial cross-check
  13_proceeds_promoter.py    100% HARDCODED manually-researched proceeds/promoter data
  14_fetch_active_ipos.py    Scrapes chittorgarh.com's JSON API -> active_ipos.json
  15_process_uploaded_drhp.py  On-demand upload pipeline (see below)
  16_fetch_drhp_pdf.py       Resolves + downloads the actual DRHP PDF for an active IPO

data/               companies.csv, scored_risks.db (tracked in git!), risks_raw.csv,
                     peer_stats.csv, industry_summaries.csv, litigation_summary.csv,
                     ddi_report.csv, ddi_outliers.csv, obfuscation_report.csv,
                     obfuscation_outliers.csv, active_ipos.json, human_labels.csv,
                     pdfs/ (gitignored), backups/ (gitignored — pre-run safety snapshots)
```

## Running locally

```bash
# Backend
source venv/bin/activate
uvicorn backend.main:app --port 8000 --host 127.0.0.1 --reload

# Frontend (separate terminal)
cd frontend && npm run dev   # http://localhost:3000, proxies API calls to :8000
```

`.env` (project root) and/or `backend/.env`:

| Var | Purpose |
|---|---|
| `GEMINI_API_KEY` | Required for the hosted backend |
| `GEMINI_MODEL` | Default `gemini-2.5-flash`. **Do not** use the `gemini-flash-latest` alias — it silently re-points as Google ships models |
| `LLM_BACKEND` | `gemini` (default) or `local` |
| `LOCAL_LLM_MODEL` | Ollama model name when `LLM_BACKEND=local` |
| `LOCAL_LLM_TIMEOUT` | Seconds, default 600. Local inference on a long risk prompt takes minutes |

⚠️ Write `.env` as **UTF-8 without BOM**. PowerShell's `>` redirection defaults to UTF-16, which `python-dotenv` cannot parse.

## Active IPO Browser + PDF Upload Pipeline

Full write-up of the design tradeoffs is in the "On-Demand Upload Pipeline (v2)" section of `GEMINI.md` — read that before touching this code, since it documents *why* certain things (Shadow Ledger) are deliberately excluded rather than automated.

**Part 1 — Active IPO Browser** (discovery only, never triggers processing):
- `scripts/14_fetch_active_ipos.py` calls `https://webnodejs.chittorgarh.com/cloud/report/data-read/158/1/8/2026/2026-27/0/mainboard/0` directly (the real JSON API behind chittorgarh's client-rendered table — plain HTML scraping doesn't work, the page ships empty and hydrates via this endpoint client-side). Fails loudly on any structural surprise.
- `scripts/16_fetch_drhp_pdf.py` resolves the actual PDF link from a filing's detail page and downloads it, verifying Content-Type + `%PDF` magic bytes and writing atomically. Distinguishes three outcomes: downloaded, confidential filing (no public link — expected, not an error), and needs-manual-resolution (a DRHP-titled link that isn't a direct PDF, e.g. a SEBI stub page). Tested on 15 real filings: 9 downloaded, 5 confidential, 1 manual.
- `GET /active-ipos`, `POST /active-ipos/refresh` in `backend/main.py`.
- Frontend: "Add Company" → "Browse active IPOs" tab.

**Part 2 — Upload pipeline** (`scripts/15_process_uploaded_drhp.py`, `POST /upload-drhp`):
- Verifies the PDF looks like a DRHP (scans first 20 pages for standard section markers), extracts risk factors, litigation, and industry overview (all via a **generalized** section locator — script 01's original logic is untouched), scores every risk with **no silent fallback** (unlike the `03_llm_pipeline.py` wrapper functions, which do fall back to a heuristic on LLM failure — this pipeline intentionally bypasses that and fails loudly instead, per the feature's explicit spec).
- **Backend-agnostic** (since 2026-08-15): `run_full_pipeline(..., backend=...)` accepts `gemini` or `local` (Ollama), defaulting to the `LLM_BACKEND` env var. `heuristic` is rejected outright — strict scoring must never write keyword-guessed placeholder data.
- **Backs up `scored_risks.db` + every CSV it might touch to `data/backups/<timestamp>/` before writing anything.** All DB/CSV writes are scoped to the new `company_id` only (never an unscoped wipe of the other companies' rows) — confirmed safe by direct testing.
- **Deliberately does not run Shadow Ledger** (script 12) for uploaded companies — it's 100% hardcoded per-company data with zero extraction logic, so there's nothing to safely automate. Proceeds/Promoter extraction is attempted but non-fatal if it fails (and isn't surfaced in any UI yet — same as the existing 3 companies today).
- **Local-only.** Needs filesystem writes and can run minutes; Vercel's serverless functions can't do either (read-only filesystem outside `/tmp`, default timeout far below that). Don't try to make `/upload-drhp` work on the deployed URL without a real redesign (external storage + background job + polling).
- Frontend: "Add Company" → "Upload PDF" tab, showing a 6-stage weighted progress indicator during the (synchronous, blocking) request. Stage timings are estimates — the endpoint returns once at the end and reports no intermediate position, and the UI says so rather than implying real backend progress. The browse tab's "Get PDF" button opens the source page in a new tab and pre-fills the upload form (it cannot silently auto-download a third-party PDF cross-origin — explicit by design, not a bug).

### Outstanding verification — the upload pipeline has never completed a full run

**Root cause is confirmed and is not a bug in this code.**

The Gemini **free tier allows 20 requests/day, per model** (`GenerateRequestsPerDayPerProjectPerModel-FreeTier`, verified against the API's own error detail on both `gemini-3.7-flash` and `gemini-2.5-flash`). A 30-item filing needs ~32 requests (30 risk items + litigation/industry + proceeds/promoter). **It cannot complete on the free tier at any pacing.** Retries consume the same daily budget, so exceeding the cap compounds rather than self-corrects.

Verified working: DRHP verification, risk extraction (64/64 from the real Zomato PDF; 30/30 from Kay Jay Forgings), litigation section location, and individual real scoring calls returning correct category/score/reasoning on both the Gemini and local backends. Every failed run left `companies.csv` and `scored_risks.db` byte-identical for the existing 3 companies — the fail-loudly design works exactly as intended.

**Do not retry these — all tried and disproven:** waiting for a quota "cooldown"; widening the inter-item sleep further; switching between Gemini models.

**Three real paths forward:**
1. **Enable billing** on the Google Cloud project. Cost is negligible (~32 short Flash requests) and removes the cap entirely.
2. **Use the local backend.** Set `LLM_BACKEND=local` + `LOCAL_LLM_MODEL`. No quota at all. ⚠️ **Validate first** — see below.
3. **Build resumability** into `run_full_pipeline` so partial progress banks across days. Currently all-or-nothing: a failure at item 29/30 discards everything.

**If using a local model, it must clear the project's own gate first:**
```bash
python scripts/04_validate_llm.py --backend local
```
Thresholds: **80% category match** and **80% score-within-±1** against `data/human_labels.csv` (100 labels). That gate is the project's credibility claim. Recorded result for `llama3.2:3b` was 23%/59% — failed, "over-indexed on score 5". Early `qwen3:8b` spot checks also returned 5s, so this needs measuring, not assuming. A 32B-class model on Apple Silicon is a different tier and has real odds, but is unproven.

**Also unverified:** the GSAP motion has never been visually confirmed playing — it was validated functionally only (mount/unmount state, final values, reduced-motion guards) because the dev browser wouldn't composite frames. Worth one visual pass.

**If a test run leaves junk data**, restore from the most recent `data/backups/<timestamp>/` snapshot (created automatically before every run) — simpler than hand-deleting rows across the DB and six CSVs. If deleting by hand, remember to re-run `python scripts/06_benchmark.py` so cross-company averages go back to reflecting the real 3 companies.

## Deployment

- Vercel, connected to `github.com/Ayushmangela/IPO-Risk-Decoder`, auto-deploys on push to `main`.
- ⚠️ Recent work (2026-08-15) is on the **`shravan`** branch and is **not deployed**. Merge to `main` to ship it.
- `vercel.json` uses explicit `builds`/`routes` (not `rewrites`) — `api/index.py` via `@vercel/python`, frontend via `@vercel/static-build`. All `/api/*` routes to the Python backend; everything else falls back to `frontend/index.html` (SPA routing works on refresh/deep-link).
- `data/scored_risks.db` **must stay tracked in git** — don't let anyone re-add `*.db` to `.gitignore` without re-adding the exception, or the production 500s come back.
- `/upload-drhp` and `/active-ipos/refresh` are **not usable on the deployed URL** (see above) — local-only by design.

## Things a new session should know before changing anything

1. **`GEMINI.md` is the source of truth for project conventions** — read it before making architectural decisions, especially around "never fake data" and "fail loudly."
2. **`MASTER.md` is the source of truth for the design system** — no magic numbers in components; if a value isn't a token there, it doesn't belong in the UI.
3. **Scripts 12 & 13 are hand-researched, not code you can safely "fix" or regenerate** — they contain manually verified financial figures with page citations for the 3 original companies. Don't refactor them into something dynamic without understanding this is intentional, not a shortcut someone forgot to finish.
4. **The upload pipeline's backup mechanism (`data/backups/`) is your undo button** — if a test run or a real upload goes wrong, the pre-run snapshot has everything needed to restore.
5. **Never pin the LLM to a `-latest` alias.** `gemini-flash-latest` silently re-pointed to a model with a 20/day free cap and quietly broke the pipeline. Pin explicit versions.
6. **`.claude/skills/threejs-skills/` is an embedded git repo** and is intentionally untracked — committing it would store an empty gitlink that looks backed up but restores empty. Copy it manually or vendor it properly.
7. ~~Desktop-only frontend is an explicit decision~~ — **reversed 2026-08-15.** The frontend is now mobile-responsive; treat breakpoints as supported and maintain them.
