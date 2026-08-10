# IPO Prospectus Risk Decoder — Project Development Document

## 1. Project Summary

**Problem:** Indian companies filing for IPOs submit a DRHP (Draft Red Herring Prospectus) to SEBI containing a dense 40-80 page "Risk Factors" section. Almost nobody reads it despite it being critical for investor decision-making. SEBI ensures risks are *disclosed* but never scores, categorizes, or benchmarks them.

**Solution:** A tool that extracts, categorizes, and scores the severity of each risk factor using an LLM — validated against a human-labeled rubric — then benchmarks each company against sector peers.

**Why it's credible, not just an API wrapper:** The LLM's severity scores are validated against ~100 manually labeled examples using a defined rubric, before being trusted across the full dataset. This is the core differentiator versus similar tools that just ask an LLM to "judge risk."

---

## 2. Scope (v1)

- **15–20 DRHP PDFs**, spanning 2–3 sectors (so peer comparisons are meaningful)
- Static, pre-processed dataset — no live scraping in v1
- Categorization + severity scoring + peer benchmarking + dashboard
- Auto-ingestion of new IPOs is a **v2 stretch goal**, not core scope

---

## 3. Architecture Overview

```
┌─────────────────┐
│   DRHP PDFs      │  (manually downloaded from SEBI, 15-20 files)
└────────┬─────────┘
         │
         ▼
┌─────────────────────────┐
│ Extraction Script         │  pdfplumber/PyMuPDF + regex splitting
│ (Risk Factors → items)    │
└────────┬───────────────┘
         │
         ▼
┌─────────────────────────┐        ┌──────────────────────┐
│ LLM Pipeline               │◄──────│ Rubric + Few-shot     │
│ - Categorization call      │        │ examples (human-      │
│ - Severity scoring call    │        │ labeled)               │
└────────┬───────────────┘        └──────────────────────┘
         │
         ▼
┌─────────────────────────┐
│ SQLite DB                  │
│ company_id, risk_text,     │
│ category, score, reasoning │
└────────┬───────────────┘
         │
         ├──────────────► Peer Benchmarking (pandas, no LLM)
         │
         ▼
┌─────────────────────────┐
│ FastAPI Backend            │
└────────┬───────────────┘
         │
         ▼
┌─────────────────────────┐
│ React Frontend (dashboard) │
└─────────────────────────┘
```

---

## 4. Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| PDF extraction | `pdfplumber` or `PyMuPDF` | Test both on 2-3 DRHPs first, pick whichever handles the format better |
| Backend | FastAPI | One endpoint set for ingestion, one for serving dashboard data |
| Database | SQLite | No need for Postgres/pgvector — no embeddings, no vector search |
| LLM (categorization) | Local 4B model (test first) or Gemini 2.5 Flash free tier | Categorization is a bounded task — small models likely fine |
| LLM (severity scoring) | Gemini 2.5 Flash free tier (fallback if local 4B underperforms) | Scoring needs nuanced judgment — validate before committing to local model |
| Frontend | React + recharts | Bar charts, severity distribution, peer comparison |
| Automation (v2) | GitHub Actions (free tier) | Scheduled scrape + ingest for new filings |

---

## 5. Build Phases & Timeline

### Phase 0 — Data Collection (Day 1)
- Manually download 15–20 DRHP PDFs from SEBI (`sebi.gov.in/filings/public-issues.html`)
- Choose 2–3 sectors for meaningful peer comparison
- Filter for Mainboard IPOs (skip SME — thinner risk sections)

### Phase 1 — Extraction (Day 1–2)
- Build PDF → raw text pipeline
- Regex/pattern-match to split "Risk Factors" section into individual numbered items
- Get working on 3–4 companies first, then generalize to the rest
- Output: `risks_raw.csv` (company_id, risk_number, risk_text)

### Phase 2 — Rubric + Human Labeling (Day 2–4) — **the credibility step, do not skip**
- Finalize scoring rubric (1–5 severity scale, defined earlier)
- Manually score ~100 risks (5–10 per company) across category + severity
- Output: `human_labels.csv` (risk_text, category, score, reasoning)
- **Budget real time here — this is the least automatable, most important step**

### Phase 3 — LLM Pipeline + Validation (Day 4–6)
- Build categorization + severity scoring prompts (few-shot from human labels)
- Run local 4B model against the 100 human-labeled examples FIRST
  - If agreement is strong (≥80% category match, scores within ±1 on ≥80% of cases) → proceed with local model
  - If weak, especially on severity scoring → fall back to Gemini free tier for scoring, keep local model for categorization only
- Run full pipeline across all extracted risks
- Output: `scored_risks.db` (SQLite)
- Produce a validation report (confusion matrix or agreement %) — this becomes your methodology page

### Phase 4 — Peer Benchmarking (Day 6)
- Pure pandas aggregation, no LLM
- Group by sector + category, compute frequency %, compare company vs. sector average
- Output: `peer_stats.csv`

### Phase 5 — Backend + Frontend (Day 6–8)
- FastAPI endpoints:
  - `GET /companies` — list of processed companies
  - `GET /companies/{id}/risks` — full risk list with category/score
  - `GET /companies/{id}/summary` — category breakdown + peer comparison stats
- React dashboard:
  - Screen 1: Company selector
  - Screen 2: Risk dashboard (category bar chart, severity distribution, peer comparison)
  - Screen 3: Risk list drill-down (click to see LLM reasoning)
  - Screen 4 (optional): Methodology page showing rubric + validation numbers

### Phase 6 — Polish (Day 8–9)
- Clean up UI, add loading states
- Write up methodology/README
- Prepare talking points: what makes the scoring defensible, what the validation numbers show

**Total estimated timeline: ~8–9 days**, assuming labeling is timeboxed and not allowed to sprawl.

---

## 6. Data Flow — What Runs When

| Stage | When it runs | LLM involved? | User-facing? |
|---|---|---|---|
| PDF extraction | Once per company, offline | No | No |
| Human labeling | Once, offline, before trusting pipeline | No | No |
| LLM categorization + scoring | Once per company, offline | Yes | No |
| Validation check | Once, offline | No | No (feeds methodology page) |
| Peer benchmarking | Once, after all companies processed | No | No |
| Dashboard viewing | Every time, live | No — reads pre-computed DB | Yes |

**Key principle:** the LLM never runs during a live user session. All processing is done ahead of time and stored, keeping the app fast and API costs low.

---

## 7. LLM Prompts (Reference)

### Categorization prompt
```
SYSTEM:
Classify the following risk factor into exactly one of these categories:
Financial, Legal, Regulatory, Operational, Market, Reputational.
Return ONLY valid JSON: {"category": "<category>", "confidence": "<high|medium|low>"}

USER:
Risk Factor: "<risk text>"
```

### Severity scoring prompt
```
SYSTEM:
Score the severity of this risk factor using the rubric below (built from
100 manually scored examples).

RUBRIC:
5 - Severe: Quantified, material, already materialized or highly likely
4 - High: Specific and material, but contingent/forward-looking
3 - Moderate: Real but vague, no numbers, generic industry risk
2 - Low: Boilerplate risk present across nearly every DRHP
1 - Minimal: Reassurance-style language, no real substance

FEW-SHOT EXAMPLES:
[2-3 human-labeled examples per score band]

Return ONLY valid JSON: {"score": <1-5>, "reasoning": "<one sentence>"}

USER:
Risk Factor: "<risk text>"
```

---

## 8. Risks to the Project Itself (meta, but worth tracking)

| Risk | Mitigation |
|---|---|
| DRHP formatting varies across companies, extraction breaks | Get extraction working on 3-4 companies before generalizing; don't over-engineer for edge cases in v1 |
| Local 4B model scores poorly on severity | Validate against human labels early (Phase 3, step 1); fall back to Gemini free tier if needed |
| Labeling step sprawls past its timebox | Hard cap at 100 risks; treat it as a fixed deliverable, not an open-ended task |
| Peer comparison feels arbitrary with mismatched sectors | Only compare within the same sector group, never across |
| SEBI links go stale during data collection | Download and archive PDFs locally immediately — don't rely on re-fetching later |

---

## 9. v2 Stretch Goals (not in v1 scope)

- Automated weekly detection of new DRHP filings via SEBI listings page scrape (GitHub Actions, free tier)
- Auto-ingestion pipeline: new filing → extraction → LLM scoring → DB update, no manual step
- Notification/alert when a new high-severity risk is detected in an upcoming IPO
- Expand from Mainboard-only to include SME IPOs with adjusted rubric weighting

---

## 10. Deliverables Checklist

- [ ] 15-20 DRHP PDFs collected and archived
- [ ] Extraction pipeline working across all companies
- [ ] Rubric finalized
- [ ] 100 risks manually labeled
- [ ] LLM pipeline built and validated against human labels
- [ ] Validation report (agreement %, confusion matrix)
- [ ] Peer benchmarking stats computed
- [ ] FastAPI backend with 3 core endpoints
- [ ] React dashboard (3-4 screens)
- [ ] README / methodology writeup
