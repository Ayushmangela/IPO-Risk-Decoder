# Handover — IPO Prospectus Risk Decoder

Last updated: 2026-08-12

## What this project is

A forensic audit tool for Indian IPO DRHP (Draft Red Herring Prospectus) filings. For each company it extracts every disclosed risk factor, scores severity 1-5 via LLM (validated against 100 human-labeled examples before being trusted), computes a Disclosure Distortion Index (is an important risk buried in the document?), cross-checks litigation load, and benchmarks against a cross-company average. See `GEMINI.md` for the full project brief and conventions — read it first, it's the authoritative source of "why things are built this way."

Live deployment: **https://ipo-risk-decoder.vercel.app**

## Current state (as of this handover)

- **3 fully processed companies**: Paytm, Lohia Corp, Zomato — offline pipeline, validated, stable. Do not re-run their pipeline steps casually; scripts `12`/`13` (Shadow Ledger, Proceeds/Promoter) contain hand-researched constants for these three that have no automated regeneration path.
- **Frontend was fully redesigned** this session into "Disclosure Terminal" — an institutional financial-research aesthetic (5-layer cool-graphite surface hierarchy, single teal accent, IBM Plex Sans/Mono), replacing the old generic-AI-SaaS look. Desktop-only (1440-1920px), no mobile breakpoints by design (explicit user decision).
- **New feature added**: Active IPO Browser + PDF Upload pipeline (see below) — lets you browse currently-filing mainboard IPOs and upload a new DRHP to run the full analysis on demand.
- **Deployment bug fixed**: `data/scored_risks.db` was excluded by `.gitignore`'s `*.db` rule, so it never reached the Vercel bundle and `/risks`/`/summary` 500'd in production while CSV-backed endpoints worked. Fixed via a `!data/scored_risks.db` gitignore exception + committing the file (commit `c5b8ad5`). Confirmed live and working.
- **Known incomplete item**: the upload pipeline has **not yet completed a full real run** — see "Outstanding verification" below. Everything up to the LLM-scoring step is verified against the real Zomato PDF; the full 64-item scoring run has twice been blocked by Gemini free-tier quota exhaustion mid-run (harmlessly — see below).

## Architecture

```
frontend/          React 18 + Vite, plain CSS (no Tailwind), Recharts, @phosphor-icons/react
  src/shell/        AppShell (top bar + left rail nav)
  src/features/     One file per view: OverviewPanel, RiskRegister, LitigationDocket,
                     BenchmarksPanel, MethodologyPanel, AddCompanyPanel
  src/composed/      CommandPalette, charts, DeltaBar
  src/primitives/    Surface, Badge, StatTile, Skeleton, EmptyState, IconButton
  src/api.js         All backend fetch calls in one place
  src/App.jsx         Routing (plain pushState/popstate, no router lib) + top-level data fetching

backend/main.py     FastAPI. Every route registered twice: bare path (local uvicorn) +
                     /api/-prefixed (Vercel rewrite target). Reads companies.csv,
                     scored_risks.db, and several derived CSVs — never calls an LLM
                     live for the original 3 companies (see GEMINI.md's core rule).

scripts/            Numbered offline pipeline, run manually, in order:
  01_extract_risks.py        PDF -> risks_raw.csv (PyMuPDF section location + regex split)
  03_llm_pipeline.py         Library only — Gemini/local/heuristic scoring functions
  05_populate_db.py          risks_raw.csv -> scored_risks.db (LLM scoring)
  06_benchmark.py            scored_risks.db -> peer_stats.csv (pandas only, no LLM)
  07_combined_llm_features.py  Litigation + industry summary (HARDCODED per-company page ranges)
  10_obfuscation_test.py     Readability vs severity correlation (deterministic)
  11_ddi.py                  Disclosure Distortion Index (deterministic)
  12_shadow_ledger.py        100% HARDCODED manually-researched financial cross-check
  13_proceeds_promoter.py    100% HARDCODED manually-researched proceeds/promoter data
  14_fetch_active_ipos.py    NEW — scrapes chittorgarh.com's JSON API -> active_ipos.json
  15_process_uploaded_drhp.py  NEW — on-demand upload pipeline (see below)

data/               companies.csv, scored_risks.db (now tracked in git!), risks_raw.csv,
                     peer_stats.csv, industry_summaries.csv, litigation_summary.csv,
                     ddi_report.csv, ddi_outliers.csv, obfuscation_report.csv,
                     obfuscation_outliers.csv, active_ipos.json, pdfs/ (gitignored),
                     backups/ (gitignored — pre-run safety snapshots, see below)
```

## Running locally

```bash
# Backend
source venv/bin/activate
uvicorn backend.main:app --port 8000 --host 127.0.0.1 --reload

# Frontend (separate terminal)
cd frontend && npm run dev   # http://localhost:3000, proxies API calls to :8000
```

Requires `.env` (project root) and/or `backend/.env` with `GEMINI_API_KEY=...`.

## New feature: Active IPO Browser + PDF Upload Pipeline

Added this session. Full write-up of the design tradeoffs is in the "On-Demand Upload Pipeline (v2)" section of `GEMINI.md` — read that before touching this code, since it documents *why* certain things (Shadow Ledger) are deliberately excluded rather than automated.

**Part 1 — Active IPO Browser** (discovery only, never triggers processing):
- `scripts/14_fetch_active_ipos.py` calls `https://webnodejs.chittorgarh.com/cloud/report/data-read/158/1/8/2026/2026-27/0/mainboard/0` directly (the real JSON API behind chittorgarh's client-rendered table — plain HTML scraping doesn't work, the page ships empty and hydrates via this endpoint client-side). Fails loudly on any structural surprise.
- `GET /active-ipos`, `POST /active-ipos/refresh` in `backend/main.py`.
- Frontend: "Add Company" → "Browse active IPOs" tab.

**Part 2 — Upload pipeline** (`scripts/15_process_uploaded_drhp.py`, `POST /upload-drhp`):
- Verifies the PDF looks like a DRHP (scans first 20 pages for standard section markers), extracts risk factors, litigation, and industry overview (all via a **new, generalized** section locator — script 01's original logic is untouched), scores every risk via Gemini with **no silent fallback** (unlike the existing `03_llm_pipeline.py` wrapper functions, which do fall back to a heuristic on LLM failure — the new pipeline intentionally bypasses that and fails loudly instead, per the feature's explicit spec).
- **Backs up `scored_risks.db` + every CSV it might touch to `data/backups/<timestamp>/` before writing anything.** All DB/CSV writes are scoped to the new `company_id` only (never an unscoped wipe of the other companies' rows) — confirmed safe by direct testing.
- **Deliberately does not run Shadow Ledger** (script 12) for uploaded companies — it's 100% hardcoded per-company data with zero extraction logic, so there's nothing to safely automate. Proceeds/Promoter extraction is attempted but non-fatal if it fails (and isn't surfaced in any UI yet — same as the existing 3 companies today).
- **Local-only.** Needs filesystem writes and can run 1-2 minutes; Vercel's serverless functions can't do either (read-only filesystem outside `/tmp`, default timeout far below 1-2 minutes). Don't try to make `/upload-drhp` work on the deployed URL without a real redesign (external storage + background job + polling).
- Frontend: "Add Company" → "Upload PDF" tab, with a rotating status message during the (synchronous, blocking) request, and a "Get PDF" button on browse-tab rows that opens the source page in a new tab + pre-fills the upload form (it cannot silently auto-download a third-party PDF cross-origin — this is explicit by design, not a bug).

### Outstanding verification — please finish this before trusting the upload pipeline on a real new company

I validated everything **except** a complete real run:
- ✅ DRHP verification, risk extraction (64/64 risk items correctly extracted from the real Zomato PDF), litigation section location (precisely bounded, verified against real page content), 2 individual real Gemini scoring calls (correct category/score/reasoning).
- ❌ **Full 64-item scoring run has failed twice**, both times due to **Gemini free-tier quota exhaustion mid-run** (not a bug — confirmed independently both times, and the pipeline's fail-loudly design worked exactly as intended: named the exact step and risk number, logged every completed step, and both times left `companies.csv`/`scored_risks.db` completely untouched for the existing 3 companies, confirmed byte-identical after).

**To finish verification** (do this before uploading a real new company's DRHP):
```bash
curl -X POST http://127.0.0.1:8000/upload-drhp \
  -F "file=@data/pdfs/zomato.pdf;type=application/pdf" \
  -F "company_name=Zomato Test Co" \
  -F "sector=Consumer Internet Test"
```
Expect it to take ~3-4 minutes (64 risk items × ~1.5-2.5s each, rate-limited). If it succeeds, check the new `zomato-test-co` (or similar, whatever the derived company_id is) company renders correctly in the frontend, then **delete the test data**:
- Remove its row from `data/companies.csv`
- `DELETE FROM scored_risks WHERE company_id = '...'` and `DELETE FROM litigation_scores WHERE company_id = '...'` in `data/scored_risks.db`
- Remove its rows from `data/industry_summaries.csv`, `data/peer_stats.csv`, `data/ddi_report.csv`, `data/ddi_outliers.csv`, `data/obfuscation_report.csv`, `data/obfuscation_outliers.csv` if present
- Re-run `python scripts/06_benchmark.py` afterward so the cross-company benchmark averages go back to reflecting just the real 3 companies
- Or, simpler: restore everything from the most recent `data/backups/<timestamp>/` snapshot (the pipeline creates one automatically before every run)

Consider checking Gemini API quota/billing tier if this keeps happening — free tier limits are quite low for a 60+ item batch.

## Deployment

- Vercel, connected to `github.com/Ayushmangela/IPO-Risk-Decoder`, auto-deploys on push to `main`.
- `vercel.json` uses explicit `builds`/`routes` (not `rewrites`) — `api/index.py` via `@vercel/python`, frontend via `@vercel/static-build`. All `/api/*` routes to the Python backend; everything else falls back to `frontend/index.html` (SPA routing works on refresh/deep-link now).
- `data/scored_risks.db` **must stay tracked in git** — don't let anyone re-add `*.db` to `.gitignore` without re-adding the exception, or this exact bug comes back.
- `/upload-drhp` and `/active-ipos/refresh` are **not usable on the deployed URL** (see above) — local-only by design.

## Things a new session should know before changing anything

1. **`GEMINI.md` is the source of truth for project conventions** — read it before making architectural decisions, especially around "never fake data" and "fail loudly."
2. **Scripts 12 & 13 are hand-researched, not code you can safely "fix" or regenerate** — they contain manually verified financial figures with page citations for the 3 original companies. Don't refactor them into something dynamic without understanding this is intentional, not a shortcut someone forgot to finish.
3. **The upload pipeline's backup mechanism (`data/backups/`) is your undo button** — if a test run or a real upload goes wrong, the pre-run snapshot has everything needed to restore.
4. **Desktop-only frontend is an explicit decision**, not an oversight — don't "fix" it by adding mobile breakpoints without checking with the user first.
