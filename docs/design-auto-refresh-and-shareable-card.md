# Design: Auto-Refresh Coverage + Shareable Risk Card

**Date:** 2026-08-12
**Mode:** Builder (learning/portfolio project)
**Status:** Approved — ready to scope into tasks

## Problem

The dashboard currently covers a small, manually-curated set of DRHP filings.
Growing that set today means someone manually downloading a PDF and hitting
`/upload-drhp`. The product vision — "drop in any DRHP, get an instant
severity-scored verdict" — is real for the *scoring* step, but coverage
doesn't grow on its own, and there's no artifact built for the actual
audience (retail investors scrolling IPO discussions on X/Reddit) to share.

## What I noticed

- Real, working end-to-end pipeline already in production (extraction →
  Gemini scoring against a human-labeled rubric → litigation/industry/
  proceeds/promoter extraction → peer benchmarking → live dashboard on
  Vercel). That's not a small thing to have shipped.
- Specific, concrete answers throughout this session — named the actual
  audience (retail investors on forums, not a vague "users"), named the
  actual differentiator (peer benchmarking) and checked it against real
  competitors instead of assuming none existed.
- Good instinct to defer the live-upload/general-purpose direction and
  stay scoped to what's already proven.

## Premises (agreed)

1. The core problem — dense/under-read DRHP risk sections — is real.
2. Peer benchmarking is the genuine differentiator vs. the two competitors
   found in landscape research (DRHP Analyzer, an AI-powered IPO dashboard
   referenced in a Shikshan Nivesh blog post) — neither publicly claims
   sector-relative severity comparison.
3. Since the goal is learning/portfolio, competitive crowding is a minor
   concern, not a blocker.
4. Reusable infrastructure already exists — new work is "widen coverage,"
   not "build from scratch."
5. Distribution is already solved (live URL on Vercel).

## Landscape

- [DRHP Analyzer](https://altiusinvestech.com/analysis/) — jargon-free
  financial/risk/red-flag breakdowns for Indian IPOs.
- ["Alpha with AI" IPO dashboard](https://blog.shikshannivesh.com/alpha-with-ai-ipo-financial-strategic-dashboard-df38b8fa7fdb) —
  reads full prospectus, extracts financial tables, maps promoter history,
  scans risks.
- [sec-parser](https://github.com/alphanome-ai/sec-parser) / [edgar-crawler](https://github.com/lefterisloukas/edgar-crawler) —
  open-source SEC filing parsers; no SEBI/India equivalent exists, so the
  extraction step here has no off-the-shelf substitute.
- No competitor found publicly claims sector peer benchmarking or
  DRHP-to-RHP version diffing.

## Alternatives considered

| | Summary | Effort | Risk |
|---|---|---|---|
| **A — Auto-refresh + shareable card** (chosen) | Scheduled discovery + auto-fetch of new DRHP PDFs feeding the existing scoring pipeline, plus a shareable risk-card generator | S–M | Low |
| B — Filing lifecycle tracker | Diff risk factors across DRHP→RHP versions, flag what changed | L | Medium (SEBI has no structured API for this) |
| C — General filing decoder + community scoring | Generalize beyond DRHPs, add crowd-verified scoring | XL | High (scope creep for a portfolio project) |

Second opinion (independent subagent) flagged two things worth carrying
forward even though A was chosen: the diff-tracker idea (Approach B) is the
most inherently "gotcha"-shareable feature once coverage is solid, and the
actual excitement in this session is about *demystifying the document*
rather than the ML pipeline — which is what makes the shareable card matter
more than the dashboard UI itself for this audience.

## Recommended approach: A, corrected scope

Initial framing assumed A meant building a scraper + pipeline from
scratch. Reading the actual code changed that:

**Already built (verified in `scripts/14_fetch_active_ipos.py`,
`scripts/15_process_uploaded_drhp.py`, `backend/main.py`):**
- `scripts/14_fetch_active_ipos.py` — discovery-only fetch of upcoming/
  filed mainboard IPOs from chittorgarh.com's data API, written to
  `data/active_ipos.json`. Fails loudly on shape changes, never writes
  partial data.
- `scripts/15_process_uploaded_drhp.py` — full on-demand pipeline for a
  supplied PDF: DRHP verification → risk extraction → strict Gemini
  scoring → litigation/industry extraction → proceeds/promoter extraction
  → scoped DB/CSV writes → derived-metric recompute (obfuscation, DDI,
  benchmarks). Backs up every file before writing; never touches other
  companies' rows.
- `POST /upload-drhp` and `POST /refresh-active-ipos` endpoints in
  `backend/main.py` wire both scripts to the API.

**Actually missing:**
1. **No scheduler.** Nothing calls `/refresh-active-ipos` on a cadence —
   there's no `.github/workflows/` and no `crons` block in `vercel.json`.
2. **No PDF auto-fetch.** Script 14 only returns metadata + a
   `source_url` pointing at a chittorgarh.com listing page, not a direct
   PDF link. `/upload-drhp` expects a human to supply the file. Closing
   this gap means finding where the actual DRHP PDF lives for each newly
   discovered filing (likely the exchange's own filing page or SEBI) and
   downloading it — this is the one genuinely new piece of scraping work.
3. **No shareable card.** Nothing in `frontend/` generates a shareable
   image or OG page per company — confirmed by search, no `share`/`card`/
   `og` files exist.

## The Assignment

Ship this in three small, independently-testable pieces — don't build all
three before testing any of them:

1. **PDF auto-fetch for one company first.** Pick one filing from the
   current `data/active_ipos.json` output and manually trace where its
   actual DRHP PDF is hosted (check the `source_url` chittorgarh.com page,
   or SEBI's public filing index). Write a small function that, given one
   row from `active_ipos.json`, returns a direct PDF URL or raises loudly
   if it can't find one. Test on 3-5 real filings before automating
   further — the failure mode to watch for is a source that requires JS
   rendering or auth, which would need a different approach entirely.
2. **Wire it to the existing pipeline manually first, schedule second.**
   Once PDF fetch works, call it + `scripts/15_process_uploaded_drhp.py`
   by hand for one new filing end-to-end. Only after that works should you
   add a scheduler (Vercel Cron if the plan supports it, otherwise a
   GitHub Actions workflow on a schedule calling the API).
3. **Shareable card, scoped tight.** One company, one static image (or a
   server-rendered OG-tag page) showing: company name, overall risk
   verdict, top 2-3 highest-severity risk categories. No new UI framework —
   reuse existing scored-risk data via the API. Test by actually posting
   it somewhere (even a private test post) to see if it reads well at
   thumbnail size before generalizing to every company.

Do (1) and (2) before (3) — a shareable card for a coverage set that isn't
actually growing doesn't move the needle on the stated goal.
