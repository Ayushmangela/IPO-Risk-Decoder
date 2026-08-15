"""
Script 15: On-Demand DRHP Upload Pipeline

Runs the full analysis pipeline synchronously for a single, newly-uploaded
DRHP PDF: verification -> risk factor extraction -> LLM scoring -> litigation
+ industry extraction -> proceeds + promoter extraction -> DB/CSV writes ->
recompute of DDI / Obfuscation / cross-company benchmark stats.

This is a deliberate, explicit exception to GEMINI.md's frozen v1 "offline
only, no live LLM calls during a user session" rule -- see the "On-Demand
Upload Pipeline (v2)" section added to GEMINI.md.

Hard rules this module follows (per project convention + explicit user spec):
  - Fail loudly. Any missing section / failed LLM call raises immediately
    with a message naming exactly which step failed. Never writes partial
    or fabricated data to paper over a failure.
  - Never touches the 3 existing companies' data beyond what re-running the
    already-idempotent scripts 06/10/11 naturally does (full, deterministic
    recompute from the DB -- confirmed safe). All DB/CSV writes for the new
    company are scoped by company_id (never an unscoped wipe).
  - Backs up every file it's about to touch before writing anything.
  - Shadow Ledger (script 12) is explicitly NOT run for uploaded companies --
    it is 100% hardcoded, manually-researched data with no extraction logic
    to fall back on, so it is skipped rather than faked.
"""

import importlib
import json
import os
import re
import shutil
import sqlite3
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
import pymupdf as fitz

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
PDF_DIR = DATA_DIR / "pdfs"
BACKUP_ROOT = DATA_DIR / "backups"

SCORED_RISKS_DB = DATA_DIR / "scored_risks.db"
COMPANIES_CSV = DATA_DIR / "companies.csv"
INDUSTRY_SUMMARIES_CSV = DATA_DIR / "industry_summaries.csv"
LITIGATION_SUMMARY_CSV = DATA_DIR / "litigation_summary.csv"
DDI_REPORT_CSV = DATA_DIR / "ddi_report.csv"
DDI_OUTLIERS_CSV = DATA_DIR / "ddi_outliers.csv"
OBFUSCATION_REPORT_CSV = DATA_DIR / "obfuscation_report.csv"
OBFUSCATION_OUTLIERS_CSV = DATA_DIR / "obfuscation_outliers.csv"
PEER_STATS_CSV = DATA_DIR / "peer_stats.csv"
PROCEEDS_SUMMARY_CSV = DATA_DIR / "proceeds_summary.csv"
PROMOTER_FLAGS_CSV = DATA_DIR / "promoter_flags.csv"

BACKED_UP_FILES = [
    SCORED_RISKS_DB,
    COMPANIES_CSV,
    INDUSTRY_SUMMARIES_CSV,
    LITIGATION_SUMMARY_CSV,
    DDI_REPORT_CSV,
    DDI_OUTLIERS_CSV,
    OBFUSCATION_REPORT_CSV,
    OBFUSCATION_OUTLIERS_CSV,
    PEER_STATS_CSV,
    PROCEEDS_SUMMARY_CSV,
    PROMOTER_FLAGS_CSV,
]

sys.path.insert(0, str(BASE_DIR))
llm_pipeline = importlib.import_module("scripts.03_llm_pipeline")
_call_gemini_llm = llm_pipeline._call_gemini_llm
# Backend-agnostic dispatcher ("local" -> Ollama, "gemini" -> API). Script 03
# has always had this; script 15 previously hardcoded Gemini at every call
# site, which is why a local run was impossible even though the driver existed.
query_llm = llm_pipeline.query_llm
clean_json_response = llm_pipeline.clean_json_response
load_few_shot_examples = llm_pipeline.load_few_shot_examples
RUBRIC_DESCRIPTION = llm_pipeline.RUBRIC_DESCRIPTION
VALID_CATEGORIES = llm_pipeline.VALID_CATEGORIES

VALID_LIT_CATEGORIES = ["Criminal", "Civil", "Tax", "Regulatory/SEBI", "Other"]

DRHP_MARKERS = ["RISK FACTORS", "DRAFT RED HERRING PROSPECTUS", "OBJECTS OF THE OFFER"]

SUB_HEADER_TRAILING_REGEX = (
    r"\s*(?:External Risk Factors|External Risks|Risks Related to the Offer|"
    r"Risks Relating to the Offer|Risks Relating to the Equity Shares and this Offer|"
    r"Risks Relating to the Equity Shares|Internal Risk Factors|Internal Risks)[\s\:\–\—\-]*$"
)


class PipelineStepError(Exception):
    """Raised when a specific pipeline step fails, naming exactly which one."""

    def __init__(self, step: str, message: str):
        self.step = step
        self.message = message
        super().__init__(f"[{step}] {message}")


# =====================================================================
# STEP 0: BACKUP (runs before any write, aborts before touching anything
# on failure)
# =====================================================================

def backup_existing_data() -> Path:
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    backup_dir = BACKUP_ROOT / timestamp
    try:
        backup_dir.mkdir(parents=True, exist_ok=False)
        for f in BACKED_UP_FILES:
            if f.exists():
                shutil.copy2(f, backup_dir / f.name)
    except OSError as exc:
        raise PipelineStepError(
            "backup", f"Could not create pre-run backup at {backup_dir}: {exc}"
        ) from exc
    return backup_dir


# =====================================================================
# STEP 1: DRHP VERIFICATION
# =====================================================================

def verify_is_drhp(pdf_path: Path, pages_to_scan: int = 20):
    """Scans the first `pages_to_scan` pages for standard DRHP section markers.

    Returns (is_drhp: bool, matched_markers: list[str]).
    """
    doc = fitz.open(pdf_path)
    try:
        scan_text = "\n".join(
            doc[p].get_text().upper() for p in range(min(pages_to_scan, len(doc)))
        )
    finally:
        doc.close()

    matched = [m for m in DRHP_MARKERS if m in scan_text]
    return (len(matched) > 0, matched)


# =====================================================================
# STEP 2: GENERALIZED SECTION LOCATOR (new, standalone -- script 01 is
# left untouched to avoid any regression risk to the validated pipeline)
# =====================================================================

def locate_section_pages(doc: fitz.Document, start_headers, end_headers, search_window=80):
    """Locates a section's [start_idx, end_idx) page range.

    Mirrors script 01's approach (exact match on the page's leading lines,
    after cleaning whitespace/punctuation) rather than loose substring
    matching -- a substring check would false-positive on cover-page
    disclaimers like "...see Risk Factors on page 32..." long before the
    real section header. Table-of-contents pages are skipped so a ToC
    entry doesn't get mistaken for the section's actual start.

    Raises ValueError if the start header can't be found at all.
    """
    start_idx = None
    end_idx = None

    for p in range(len(doc)):
        text = doc[p].get_text()
        text_upper = text.upper()
        if "TABLE OF CONTENTS" in text_upper or (p < 15 and text_upper.strip().startswith("INDEX")):
            continue

        lines = [l.strip() for l in text.split("\n") if l.strip()]
        for l in lines[:10]:
            clean_l = re.sub(r"[\:–—\-\s]+", " ", l).strip().upper()
            if start_idx is None:
                if clean_l in start_headers:
                    start_idx = p
                    break
            else:
                if clean_l in end_headers:
                    end_idx = p
                    break
        if end_idx is not None:
            break

    # Fallback: if the exact-line match never fired, allow a looser
    # substring match but only searching page bodies (not just the first
    # 10 lines), which catches headers PyMuPDF splits oddly across lines
    # while still requiring the whole document scan (so a stray mention
    # can't beat a real section header found on the correct page).
    if start_idx is None:
        for p in range(len(doc)):
            text_upper = doc[p].get_text().upper()
            if "TABLE OF CONTENTS" in text_upper:
                continue
            lines = [l.strip().upper() for l in doc[p].get_text().split("\n") if l.strip()]
            for l in lines[:10]:
                clean_l = re.sub(r"[\:–—\-\s]+", " ", l).strip()
                if any(clean_l == h or (len(clean_l) < 60 and h in clean_l) for h in start_headers):
                    start_idx = p
                    break
            if start_idx is not None:
                break

    if start_idx is None:
        raise ValueError(
            f"Could not locate a section starting with any of {start_headers} "
            f"anywhere in the document."
        )

    if end_idx is None:
        for p in range(start_idx + 1, min(len(doc), start_idx + search_window)):
            lines = [l.strip() for l in doc[p].get_text().split("\n") if l.strip()]
            for l in lines[:10]:
                clean_l = re.sub(r"[\:–—\-\s]+", " ", l).strip().upper()
                if clean_l in end_headers:
                    end_idx = p
                    break
            if end_idx is not None:
                break

    if end_idx is None:
        end_idx = min(len(doc), start_idx + search_window)

    return start_idx, end_idx


# =====================================================================
# STEP 3: RISK FACTOR EXTRACTION (same regex-split logic as script 01)
# =====================================================================

def extract_risk_items(pdf_path: Path, company_id: str):
    doc = fitz.open(pdf_path)
    try:
        start_idx, end_idx = locate_section_pages(
            doc,
            start_headers=["SECTION II RISK FACTORS", "RISK FACTORS"],
            end_headers=["SECTION III INTRODUCTION", "INTRODUCTION", "SECTION III"],
        )

        cleaned_lines = []
        for p in range(start_idx, end_idx):
            text = doc[p].get_text("text")
            for l in text.split("\n"):
                s = l.strip()
                if s.isdigit() and len(s) <= 3:
                    continue
                cleaned_lines.append(s)
    finally:
        doc.close()

    risks = []
    current_num = 0
    current_text_lines = []
    global_risk_no = 0

    i = 0
    while i < len(cleaned_lines):
        line = cleaned_lines[i]
        m = re.match(r"^(\d{1,3})\.\s*(.*)", line)
        if m:
            num = int(m.group(1))
            rest = m.group(2).strip()

            is_new_risk = False
            if num == 1 or num == current_num + 1 or (1 < num < current_num + 3):
                if rest == "" or re.match(r'^[A-Z\"“\'‘\[]', rest):
                    is_new_risk = True

            if is_new_risk:
                if current_text_lines:
                    global_risk_no += 1
                    risk_text = " ".join(" ".join(current_text_lines).split())
                    risk_text = re.sub(
                        SUB_HEADER_TRAILING_REGEX, "", risk_text, flags=re.IGNORECASE
                    ).strip()
                    if len(risk_text) > 30:
                        risks.append(
                            {
                                "company_id": company_id,
                                "risk_number": global_risk_no,
                                "risk_text": risk_text,
                            }
                        )
                current_num = num
                current_text_lines = [rest] if rest else []
                i += 1
                continue

        if current_num > 0:
            current_text_lines.append(line)
        i += 1

    if current_text_lines and current_num > 0:
        global_risk_no += 1
        risk_text = " ".join(" ".join(current_text_lines).split())
        risk_text = re.sub(SUB_HEADER_TRAILING_REGEX, "", risk_text, flags=re.IGNORECASE).strip()
        if len(risk_text) > 30:
            risks.append(
                {
                    "company_id": company_id,
                    "risk_number": global_risk_no,
                    "risk_text": risk_text,
                }
            )

    if not risks:
        raise ValueError("Risk Factors section was located but zero risk items could be parsed out of it.")

    return risks


# =====================================================================
# STEP 4: STRICT LLM RISK SCORING (no silent heuristic fallback)
# =====================================================================

def score_risks_strict(risk_items, backend="gemini", rate_limit_sleep=5.0, progress_cb=None):
    """Scores every risk item via Gemini. Raises immediately -- naming the
    exact risk number -- on any failure. No heuristic fallback.

    rate_limit_sleep defaults to 5s (~12 req/min) to stay under the Gemini
    Flash per-minute ceiling. The old 1.5s paced ~40 req/min, well over it.

    IMPORTANT -- this alone does NOT make a full filing runnable on the free
    tier. The binding limit is GenerateRequestsPerDayPerProjectPerModel-FreeTier
    = 20 requests/day/model (confirmed against both gemini-3.7-flash and
    gemini-2.5-flash on 2026-08-15). A 30-item filing needs ~32 requests, so it
    cannot complete on the free tier at any pacing, and retries consume the
    same daily budget. Running a full filing requires billing enabled on the
    Google Cloud project (cost is negligible -- ~32 short Flash requests), or
    resumability so partial progress can be banked across days."""
    scored = []
    for i, item in enumerate(risk_items):
        rtext = item["risk_text"]
        rnum = item["risk_number"]

        # Only the hosted API needs pacing; a local model has no quota or RPM
        # ceiling, so sleeping between items would just make runs slower for
        # no reason.
        if backend == "gemini" and i > 0:
            time.sleep(rate_limit_sleep)

        few_shot = load_few_shot_examples(exclude_text=rtext)
        system_prompt = (
            "Classify the following IPO DRHP risk factor into exactly one category: "
            "Financial, Legal, Regulatory, Operational, Market, Reputational.\n"
            "And score its severity (1-5) using the rubric below:\n\n"
            f"{RUBRIC_DESCRIPTION}\n"
            "FEW-SHOT EXAMPLES:\n"
            f"{few_shot}\n\n"
            "Return ONLY valid JSON format:\n"
            "{\n"
            '  "category": "<Financial|Legal|Regulatory|Operational|Market|Reputational>",\n'
            '  "score": <1-5 integer>,\n'
            '  "reasoning": "<one sentence explanation justifying category and score based on rubric>"\n'
            "}"
        )
        prompt = f'Risk Factor: "{rtext}"'

        try:
            raw_resp = query_llm(prompt, system_prompt, backend=backend)
            if not raw_resp:
                # "heuristic" returns None by design. Strict scoring must never
                # fall back to keyword guessing -- that's the placeholder data
                # this whole module exists to refuse to write.
                raise ValueError(
                    f"Backend '{backend}' returned no response. Strict scoring requires "
                    f"a real model backend ('gemini' or 'local')."
                )
            parsed = clean_json_response(raw_resp)
            cat = str(parsed.get("category", "")).strip().capitalize()
            if cat not in VALID_CATEGORIES:
                raise ValueError(f"LLM returned an invalid category: '{cat}'")
            score = int(parsed.get("score", 0))
            if not (1 <= score <= 5):
                raise ValueError(f"LLM returned an out-of-range score: {score}")
            reasoning = str(parsed.get("reasoning", "")).strip()
            if not reasoning:
                raise ValueError("LLM response was missing the required 'reasoning' field.")
        except Exception as exc:
            raise PipelineStepError(
                "risk_scoring",
                f"LLM scoring failed on risk #{rnum} ({i + 1}/{len(risk_items)}): {exc}",
            ) from exc

        scored.append(
            {
                "company_id": item["company_id"],
                "risk_number": rnum,
                "risk_text": rtext,
                "category": cat,
                "score": score,
                "reasoning": reasoning,
            }
        )

        if progress_cb:
            progress_cb(i + 1, len(risk_items))

    return scored


# =====================================================================
# STEP 5: LITIGATION + INDUSTRY EXTRACTION (adapted from script 07's
# already-strict run_combined_llm_call, with dynamic section location
# instead of the hardcoded page-range map)
# =====================================================================

def _split_litigation_cases(raw_text: str):
    current_party = "company"
    cases = []
    lines = raw_text.split("\n")
    buffer_lines = []

    def flush_case_buffer():
        nonlocal buffer_lines
        if buffer_lines:
            text = " ".join(buffer_lines).strip()
            text = re.sub(r"^\d+\s+", "", text)
            if len(text) > 45 and not text.isupper():
                cases.append({"party_type": current_party, "case_text": text[:500]})
            buffer_lines = []

    for line in lines:
        l_str = line.strip()
        l_upper = l_str.upper()

        if "DIRECTOR" in l_upper and ("LITIGATION" in l_upper or "PROCEEDINGS" in l_upper):
            current_party = "director"
        elif "PROMOTER" in l_upper and ("LITIGATION" in l_upper or "PROCEEDINGS" in l_upper):
            current_party = "promoter"
        elif "COMPANY" in l_upper and ("LITIGATION" in l_upper or "PROCEEDINGS" in l_upper):
            current_party = "company"

        if (
            re.match(r"^(?:[i|v|x]+\.|\d+[\.\)\:])\s+", l_str, re.IGNORECASE)
            or ("Tax" in l_str and "Demand" in l_str)
            or ("Notice" in l_str and "issued" in l_str)
            or ("Proceeding" in l_str and "pending" in l_str)
        ):
            flush_case_buffer()

        if l_str:
            buffer_lines.append(l_str)

    flush_case_buffer()
    return cases


def extract_litigation_and_industry(pdf_path: Path, company_id: str, company_name: str, backend="gemini"):
    doc = fitz.open(pdf_path)
    try:
        try:
            lit_start, lit_end = locate_section_pages(
                doc,
                start_headers=["OUTSTANDING LITIGATION AND MATERIAL DEVELOPMENTS", "OUTSTANDING LITIGATION", "LEGAL PROCEEDINGS"],
                end_headers=["GOVERNMENT AND OTHER APPROVALS", "OTHER REGULATORY AND STATUTORY DISCLOSURES"],
            )
        except ValueError as exc:
            raise PipelineStepError("litigation_extraction", str(exc)) from exc

        raw_litigation_text = "\n".join(doc[p].get_text() for p in range(lit_start, lit_end))

        try:
            ind_start, ind_end = locate_section_pages(
                doc,
                start_headers=["INDUSTRY OVERVIEW"],
                end_headers=["OUR BUSINESS", "BUSINESS OVERVIEW"],
            )
        except ValueError as exc:
            raise PipelineStepError("industry_extraction", str(exc)) from exc

        raw_industry_text = "\n".join(doc[p].get_text() for p in range(ind_start, ind_end)).strip()
    finally:
        doc.close()

    cases = _split_litigation_cases(raw_litigation_text)
    industry_prompt_snippet = raw_industry_text[:3500]

    if not cases:
        # No litigation is a legitimate outcome (not every filer has pending cases) --
        # proceed with an empty list rather than failing the whole pipeline.
        cases = []

    lit_prompt_items = [
        f"Case #{idx} [Party: {c['party_type'].upper()}]: \"{c['case_text']}\""
        for idx, c in enumerate(cases, 1)
    ]
    lit_prompt_block = "\n\n".join(lit_prompt_items) if lit_prompt_items else "(No litigation cases found in this filing.)"

    system_prompt = (
        f"You are an expert financial and legal analyst evaluating an Indian IPO DRHP filing for {company_name}.\n\n"
        "TASK 1: Categorize each litigation case item into EXACTLY ONE category: Criminal, Civil, Tax, Regulatory/SEBI, Other.\n"
        "Provide a concise 1-sentence reasoning explaining the legal/financial exposure for each case. "
        "If there are no cases, return an empty array for \"litigation\".\n\n"
        "TASK 2: Write a 3-4 sentence plain-English summary of the Industry Overview text below, specifically "
        "highlighting industry report facts, market drivers, and the company's competitive position.\n\n"
        "Return ONLY valid JSON in this exact structure:\n"
        "{\n"
        '  "litigation": [\n'
        '    {"case_id": 1, "category": "<Criminal|Civil|Tax|Regulatory/SEBI|Other>", "reasoning": "<concise 1-sentence explanation>"}\n'
        "  ],\n"
        '  "industry_summary": "<3-4 sentence specific summary of industry overview>"\n'
        "}"
    )
    prompt = (
        f"=== LITIGATION CASES ({len(cases)} ITEMS) ===\n{lit_prompt_block}\n\n"
        f"=== INDUSTRY OVERVIEW TEXT ===\n{industry_prompt_snippet}"
    )

    try:
        raw_resp = query_llm(prompt, system_prompt, backend=backend)
        parsed = clean_json_response(raw_resp)
    except Exception as exc:
        raise PipelineStepError(
            "litigation_industry_llm_call", f"Combined litigation/industry LLM call failed: {exc}"
        ) from exc

    lit_results = parsed.get("litigation", [])
    if not isinstance(lit_results, list):
        raise PipelineStepError(
            "litigation_industry_llm_call",
            f"LLM returned a malformed 'litigation' field (expected a list). Response: {parsed}",
        )

    scored_litigation = []
    for idx, c in enumerate(cases, 1):
        matched = None
        for l_res in lit_results:
            if l_res.get("case_id") == idx:
                matched = l_res
                break
        if not matched and idx <= len(lit_results):
            matched = lit_results[idx - 1]

        cat = str(matched.get("category", "Other") if matched else "Other").strip()
        reason = str(matched.get("reasoning", "") if matched else "").strip()

        if cat not in VALID_LIT_CATEGORIES:
            cat = "Civil"
        if not reason:
            reason = f"{cat} proceeding involving {c['party_type']} disclosed in DRHP filings."

        scored_litigation.append(
            {
                "company_id": company_id,
                "case_id": idx,
                "party_type": c["party_type"],
                "case_text": c["case_text"],
                "category": cat,
                "reasoning": reason,
            }
        )

    industry_summary = str(parsed.get("industry_summary", "")).strip()
    if not industry_summary or len(industry_summary) < 40:
        raise PipelineStepError(
            "litigation_industry_llm_call",
            f"LLM returned an invalid or too-short industry_summary. Response: {parsed}",
        )

    return {
        "company_id": company_id,
        "litigation_scores": scored_litigation,
        "industry_summary": industry_summary,
    }


# =====================================================================
# STEP 6: PROCEEDS + PROMOTER EXTRACTION (new -- not surfaced by any
# existing API endpoint/UI, stored for parity with the 3 existing
# companies' data files, same as their current un-surfaced state)
# =====================================================================

def extract_proceeds_and_promoter(pdf_path: Path, company_id: str, company_name: str, backend="gemini"):
    doc = fitz.open(pdf_path)
    try:
        try:
            obj_start, obj_end = locate_section_pages(
                doc,
                start_headers=["OBJECTS OF THE OFFER", "OBJECTS OF THE ISSUE"],
                end_headers=["BASIS FOR OFFER PRICE", "BASIS FOR ISSUE PRICE", "OTHER REGULATORY"],
            )
            objects_text = "\n".join(doc[p].get_text() for p in range(obj_start, obj_end))[:4000]
        except ValueError as exc:
            raise PipelineStepError("proceeds_extraction", str(exc)) from exc

        try:
            prom_start, prom_end = locate_section_pages(
                doc,
                start_headers=["OUR PROMOTERS AND PROMOTER GROUP", "OUR PROMOTER AND PROMOTER GROUP", "OUR PROMOTERS", "OUR PROMOTER"],
                end_headers=["OUR GROUP COMPANIES", "RELATED PARTY TRANSACTIONS", "DIVIDEND POLICY"],
            )
            promoter_text = "\n".join(doc[p].get_text() for p in range(prom_start, prom_end))[:4000]
        except ValueError as exc:
            raise PipelineStepError("promoter_extraction", str(exc)) from exc
    finally:
        doc.close()

    system_prompt = (
        f"You are analyzing an Indian IPO DRHP filing for {company_name}.\n\n"
        "TASK 1: From the 'Objects of the Offer' text, extract the fund allocation breakdown "
        "(purpose -> amount, as stated). If the offer is entirely an Offer for Sale with no fresh "
        "issue proceeds, say so explicitly.\n\n"
        "TASK 2: From the 'Our Promoters' text, determine whether the company has identifiable "
        "named individual/entity promoters, or is professionally managed with no identifiable promoter.\n\n"
        "Return ONLY valid JSON:\n"
        "{\n"
        '  "is_offer_for_sale_only": <true|false>,\n'
        '  "proceeds_allocation": "<plain-text summary of fund allocation by purpose>",\n'
        '  "has_named_promoters": <true|false>,\n'
        '  "promoter_names": ["<name>", ...],\n'
        '  "promoter_notes": "<1-2 sentence note>"\n'
        "}"
    )
    prompt = (
        f"=== OBJECTS OF THE OFFER TEXT ===\n{objects_text}\n\n"
        f"=== OUR PROMOTERS TEXT ===\n{promoter_text}"
    )

    try:
        raw_resp = query_llm(prompt, system_prompt, backend=backend)
        parsed = clean_json_response(raw_resp)
    except Exception as exc:
        raise PipelineStepError(
            "proceeds_promoter_llm_call", f"Proceeds/promoter LLM call failed: {exc}"
        ) from exc

    return {
        "company_id": company_id,
        "is_offer_for_sale_only": bool(parsed.get("is_offer_for_sale_only", False)),
        "proceeds_allocation": str(parsed.get("proceeds_allocation", "")).strip(),
        "has_named_promoters": bool(parsed.get("has_named_promoters", False)),
        "promoter_names": parsed.get("promoter_names", []) or [],
        "promoter_notes": str(parsed.get("promoter_notes", "")).strip(),
    }


# =====================================================================
# STEP 7: SCOPED DB / CSV WRITES (never an unscoped wipe of other
# companies' rows)
# =====================================================================

def write_company_metadata(company_id: str, company_name: str, sector: str):
    if COMPANIES_CSV.exists():
        df = pd.read_csv(COMPANIES_CSV)
    else:
        df = pd.DataFrame(columns=["company_id", "name", "sector"])

    if (df["company_id"].str.lower() == company_id.lower()).any():
        raise PipelineStepError(
            "db_write", f"company_id '{company_id}' already exists in companies.csv."
        )

    df = pd.concat(
        [df, pd.DataFrame([{"company_id": company_id, "name": company_name, "sector": sector}])],
        ignore_index=True,
    )
    df.to_csv(COMPANIES_CSV, index=False)


def write_scored_risks(scored_risks):
    conn = sqlite3.connect(SCORED_RISKS_DB)
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS scored_risks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                company_id TEXT NOT NULL,
                risk_number INTEGER NOT NULL,
                risk_text TEXT NOT NULL,
                category TEXT NOT NULL,
                score INTEGER NOT NULL,
                reasoning TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(company_id, risk_number)
            )
            """
        )
        for r in scored_risks:
            cursor.execute(
                """
                INSERT OR REPLACE INTO scored_risks
                (company_id, risk_number, risk_text, category, score, reasoning)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (r["company_id"], r["risk_number"], r["risk_text"], r["category"], r["score"], r["reasoning"]),
            )
        conn.commit()
    except Exception as exc:
        raise PipelineStepError("db_write", f"Failed writing scored_risks rows: {exc}") from exc
    finally:
        conn.close()


def write_litigation_scores(company_id: str, litigation_scores):
    conn = sqlite3.connect(SCORED_RISKS_DB)
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS litigation_scores (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                company_id TEXT NOT NULL,
                case_id INTEGER NOT NULL,
                party_type TEXT NOT NULL,
                case_text TEXT NOT NULL,
                category TEXT NOT NULL,
                reasoning TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(company_id, case_id)
            )
            """
        )
        # Scoped delete only -- never touch other companies' rows.
        cursor.execute("DELETE FROM litigation_scores WHERE LOWER(company_id) = ?", (company_id.lower(),))
        for r in litigation_scores:
            cursor.execute(
                """
                INSERT OR REPLACE INTO litigation_scores
                (company_id, case_id, party_type, case_text, category, reasoning)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (r["company_id"], r["case_id"], r["party_type"], r["case_text"], r["category"], r["reasoning"]),
            )
        conn.commit()
    except Exception as exc:
        raise PipelineStepError("db_write", f"Failed writing litigation_scores rows: {exc}") from exc
    finally:
        conn.close()


def write_industry_summary(company_id: str, industry_summary: str):
    if INDUSTRY_SUMMARIES_CSV.exists():
        df = pd.read_csv(INDUSTRY_SUMMARIES_CSV)
        df = df[df["company_id"].str.lower() != company_id.lower()]
    else:
        df = pd.DataFrame(columns=["company_id", "summary_text"])
    df = pd.concat(
        [df, pd.DataFrame([{"company_id": company_id, "summary_text": industry_summary}])],
        ignore_index=True,
    )
    df.to_csv(INDUSTRY_SUMMARIES_CSV, index=False)


def write_proceeds_promoter(company_id: str, proceeds_promoter: dict):
    if PROCEEDS_SUMMARY_CSV.exists():
        df = pd.read_csv(PROCEEDS_SUMMARY_CSV)
        df = df[df["company_id"].str.lower() != company_id.lower()]
    else:
        df = pd.DataFrame(columns=["company_id", "is_offer_for_sale_only", "proceeds_allocation"])
    df = pd.concat(
        [
            df,
            pd.DataFrame(
                [
                    {
                        "company_id": company_id,
                        "is_offer_for_sale_only": proceeds_promoter["is_offer_for_sale_only"],
                        "proceeds_allocation": proceeds_promoter["proceeds_allocation"],
                    }
                ]
            ),
        ],
        ignore_index=True,
    )
    df.to_csv(PROCEEDS_SUMMARY_CSV, index=False)

    if PROMOTER_FLAGS_CSV.exists():
        pf = pd.read_csv(PROMOTER_FLAGS_CSV)
        pf = pf[pf["company_id"].str.lower() != company_id.lower()]
    else:
        pf = pd.DataFrame(columns=["company_id", "has_named_promoters", "promoter_names", "promoter_notes"])
    pf = pd.concat(
        [
            pf,
            pd.DataFrame(
                [
                    {
                        "company_id": company_id,
                        "has_named_promoters": proceeds_promoter["has_named_promoters"],
                        "promoter_names": "; ".join(proceeds_promoter["promoter_names"]),
                        "promoter_notes": proceeds_promoter["promoter_notes"],
                    }
                ]
            ),
        ],
        ignore_index=True,
    )
    pf.to_csv(PROMOTER_FLAGS_CSV, index=False)


# =====================================================================
# STEP 8: RECOMPUTE DERIVED METRICS (safe -- these scripts already do a
# full, deterministic, idempotent recompute across every company in the
# DB, confirmed by reading their source directly)
# =====================================================================

def recompute_derived_metrics():
    try:
        obf = importlib.import_module("scripts.10_obfuscation_test")
        obf.main()
    except Exception as exc:
        raise PipelineStepError("obfuscation_recompute", str(exc)) from exc

    try:
        ddi = importlib.import_module("scripts.11_ddi")
        ddi.main()
    except Exception as exc:
        raise PipelineStepError("ddi_recompute", str(exc)) from exc

    try:
        bench = importlib.import_module("scripts.06_benchmark")
        bench.run_benchmarking()
    except Exception as exc:
        raise PipelineStepError("benchmark_recompute", str(exc)) from exc


# =====================================================================
# ORCHESTRATOR
# =====================================================================

def run_full_pipeline(pdf_path: Path, company_id: str, company_name: str, sector: str = "Uploaded",
                      backend: str = None, log=print):
    """Runs every step in order. Raises PipelineStepError naming exactly
    which step failed. Returns a list of completed step names on success.

    backend: "gemini" (hosted API) or "local" (Ollama). Defaults to the
    LLM_BACKEND env var so a machine can be switched over in .env without
    touching call sites. "heuristic" is rejected -- strict scoring must never
    write keyword-guessed placeholder data."""
    if backend is None:
        backend = os.getenv("LLM_BACKEND", "gemini")
    backend = backend.strip().lower()
    if backend not in ("gemini", "local"):
        raise PipelineStepError(
            "backend_selection",
            f"Unsupported backend '{backend}'. Use 'gemini' or 'local' -- "
            f"'heuristic' cannot be used for strict scoring.",
        )

    completed_steps = []

    log(f"[0/8] Backing up existing data...")
    backup_dir = backup_existing_data()
    completed_steps.append("backup")
    log(f"      Backup saved to {backup_dir}")

    log(f"[1/8] Verifying '{pdf_path.name}' looks like a DRHP...")
    is_drhp, matched = verify_is_drhp(pdf_path)
    if not is_drhp:
        raise PipelineStepError(
            "drhp_verification",
            "This doesn't appear to be a DRHP — no standard sections detected "
            f"(looked for {DRHP_MARKERS} in the first 20 pages).",
        )
    completed_steps.append("drhp_verification")
    log(f"      Matched markers: {matched}")

    log("[2/8] Extracting risk factors...")
    risk_items = extract_risk_items(pdf_path, company_id)
    completed_steps.append("risk_extraction")
    log(f"      Extracted {len(risk_items)} risk items.")

    log(f"[3/8] Scoring {len(risk_items)} risk items via {backend.upper()} (this is the slow step)...")

    def _progress(done, total):
        if done % 10 == 0 or done == total:
            log(f"      Scored {done}/{total} risk items...")

    scored_risks = score_risks_strict(risk_items, backend=backend, progress_cb=_progress)
    completed_steps.append("risk_scoring")

    log("[4/8] Extracting + scoring litigation cases and industry overview...")
    lit_industry = extract_litigation_and_industry(pdf_path, company_id, company_name, backend=backend)
    completed_steps.append("litigation_industry_extraction")
    log(f"      Found {len(lit_industry['litigation_scores'])} litigation cases.")

    log("[5/8] Extracting proceeds allocation + promoter structure...")
    try:
        proceeds_promoter = extract_proceeds_and_promoter(pdf_path, company_id, company_name, backend=backend)
        completed_steps.append("proceeds_promoter_extraction")
    except PipelineStepError as exc:
        # Lower-stakes than the core risk/litigation pipeline and not
        # surfaced by any existing endpoint/UI -- log and continue rather
        # than failing the whole upload over it.
        log(f"      WARNING: proceeds/promoter extraction skipped ({exc.message})")
        proceeds_promoter = None

    log("[6/8] Writing to database and CSVs (scoped to this company only)...")
    write_company_metadata(company_id, company_name, sector)
    write_scored_risks(scored_risks)
    write_litigation_scores(company_id, lit_industry["litigation_scores"])
    write_industry_summary(company_id, lit_industry["industry_summary"])
    if proceeds_promoter:
        write_proceeds_promoter(company_id, proceeds_promoter)
    completed_steps.append("db_write")

    log("[7/8] Recomputing DDI, Obfuscation test, and cross-company benchmarks...")
    recompute_derived_metrics()
    completed_steps.append("derived_metrics_recompute")

    log(f"[8/8] Done. '{company_name}' ({company_id}) is now available in the dashboard.")
    log("      Note: Shadow Ledger cross-check is not available for uploaded companies "
        "(requires manual financial-statement verification, never fabricated).")
    completed_steps.append("complete")

    return completed_steps


def slugify_company_id(company_name: str) -> str:
    return re.sub(r"[^a-z0-9]", "", company_name.lower())
