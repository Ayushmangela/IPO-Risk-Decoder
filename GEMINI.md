# Project Context: IPO Prospectus Risk Decoder

## Overview
Tool that extracts the "Risk Factors" section from Indian IPO DRHP PDFs (300-400 pages, but only ~40-80 pages are relevant), categorizes and scores each risk item using an LLM, validates those scores against a human-labeled rubric, and benchmarks companies against sector peers. Core credibility mechanism: LLM severity scores are validated against ~100 manually labeled examples before being trusted — this is not a raw "ask the LLM to rate it" tool.

## Scope (v1 — do not expand without explicit instruction)
- 15-20 DRHP PDFs, 2-3 sectors only
- Static, pre-processed dataset — no live scraping in v1
- Features: categorization, severity scoring, peer benchmarking, dashboard
- Explicitly OUT of scope for v1: auto-ingestion of new IPOs, RAG/cross-company search, any feature not tied to Risk Factors analysis (see project doc history — scope was deliberately narrowed)

## Tech Stack
- **PDF extraction:** PyMuPDF (`fitz`) — NOT pdfplumber (too slow at 300-400 pages)
- **Backend:** FastAPI
- **Database:** SQLite (no Postgres/pgvector — no embeddings or vector search in this project)
- **LLM (categorization):** local 4B model first choice; validate before trusting
- **LLM (severity scoring):** validate local 4B against human labels FIRST; fall back to Gemini 2.5 Flash free tier if agreement is weak (<80% category match or scores off by >1 on more than 20% of cases)
- **Frontend:** React + recharts

## Pipeline / Data Flow
1. **Extraction (offline, per company):**
   - Locate Risk Factors section first (use ToC on pages 1-5, or scan for "RISK FACTORS" heading) — do NOT process full 300-400 page PDF
   - Extract only the located page range with PyMuPDF
   - Regex-split into individual numbered risk items → `risks_raw.csv` (company_id, risk_number, risk_text)
2. **Human labeling (offline, manual, ~100 risks):** `human_labels.csv` (risk_text, category, score, reasoning) — this step is manual, do not attempt to automate it
3. **LLM categorization + scoring (offline, per risk item):** uses rubric + few-shot examples from human labels → stored in SQLite (company_id, risk_text, category, score, reasoning)
4. **Validation:** compare LLM output against the 100 human labels — produces agreement %/confusion matrix BEFORE trusting the pipeline on the full dataset
5. **Peer benchmarking (offline, pandas only, NO LLM call):** group by sector + category, compute frequency %, company vs. sector average → `peer_stats.csv`
6. **Serving:** FastAPI reads only from pre-computed SQLite/CSV. The LLM must never be called live during a user session — all scoring happens offline ahead of time.

## Severity Rubric (reference — do not modify without checking with the human-labeled set)
- 5 = Severe: quantified, material, already materialized or highly likely
- 4 = High: specific and material, but contingent/forward-looking
- 3 = Moderate: real but vague, no numbers, generic industry risk
- 2 = Low: boilerplate risk present across nearly every DRHP
- 1 = Minimal: reassurance-style language, no real substance

## Categories
Financial, Legal, Regulatory, Operational, Market, Reputational

## Conventions
- Output of LLM calls must always be forced JSON (see prompt templates in project doc) — never free text
- Every LLM call must include a `reasoning` field even if not displayed, for auditability
- Sector comparisons must only happen within the same sector group — never cross-sector
- Data source: SEBI filings page (`sebi.gov.in/filings/public-issues.html`) — download and archive PDFs locally immediately, links go stale

## Key Files (once project structure exists)
- `risks_raw.csv` — extracted, unlabeled risk items
- `human_labels.csv` — manually scored ground truth (~100 rows)
- `scored_risks.db` — SQLite, full LLM-scored dataset
- `peer_stats.csv` — aggregated benchmarking stats
- `validation_report.md` — LLM vs. human agreement metrics

## What NOT to build in this pass
- No auto-scraping/scheduled ingestion
- No vector DB / embeddings / RAG
- No features unrelated to Risk Factors analysis (litigation tracker, use-of-proceeds, RPT flagger, etc. were considered and explicitly deferred to keep scope tight)

## On-Demand Upload Pipeline (v2 — explicit, deliberate exception to the v1 rules above)

The v1 rules above ("no live LLM calls during a user session," "no auto-ingestion of new IPOs," "static pre-processed dataset") were frozen for the original 3-company offline pipeline. As of this feature, the user explicitly requested a **live, on-demand path** alongside that frozen pipeline — this section documents it so the doc doesn't silently drift out of sync with the code.

- **What it adds:** `POST /upload-drhp` accepts a DRHP PDF + company name, runs the full pipeline synchronously in the request (verification → risk extraction → Gemini scoring → litigation/industry extraction → DDI/Obfuscation recompute), and stores the result exactly like the original 3 companies. `GET /active-ipos` + `POST /active-ipos/refresh` let the user browse currently-filing mainboard IPOs (discovery only — browsing never triggers processing).
- **Still governed by the core principle:** never fabricate or silently degrade data. The upload pipeline fails loudly and names the exact step that failed rather than writing partial/fake results (see `scripts/15_process_uploaded_drhp.py`'s `PipelineStepError`).
- **Explicitly excluded even for uploaded companies:** the Shadow Ledger cross-check (`scripts/12_shadow_ledger.py`) is 100% hardcoded, manually-researched financial figures with page citations — there is no automated extraction logic to fall back on, so it is never run or faked for uploaded companies. Proceeds/Promoter extraction (`scripts/13_proceeds_promoter.py`'s successor logic) is attempted via LLM extraction but is non-fatal if it fails, and isn't surfaced in any endpoint/UI yet (same as the original 3 companies today).
- **Local-only, by design:** this feature requires filesystem writes (new PDF, DB rows, CSV updates) and can run 1-2 minutes — it only works when the backend is run locally via `uvicorn`, not on the Vercel deployment (read-only filesystem outside `/tmp`, no configured timeout override for a request this long).
- **Data safety:** every upload run backs up `scored_risks.db` and every CSV it might touch to `data/backups/<timestamp>/` before writing anything, and all writes are scoped to the new company's `company_id` (never an unscoped wipe of the other companies' rows).
