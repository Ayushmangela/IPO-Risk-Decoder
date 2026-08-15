"""
FastAPI Backend Application for IPO Prospectus Risk Decoder

Per GEMINI.md:
- Reads strictly from pre-computed offline data (scored_risks.db, companies.csv, peer_stats.csv, reports).
- NEVER invokes an LLM live during API requests.
- Exposes core endpoints for companies, risk factors, summary metrics, litigation load, disclosure distortion, and methodology.
"""

import importlib
import json
import sqlite3
import sys
from pathlib import Path
from typing import Dict, List, Optional
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, Response
import pandas as pd
from pydantic import BaseModel

from backend.card_generator import generate_risk_card

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
PDF_DIR = DATA_DIR / "pdfs"
SCORED_RISKS_DB = DATA_DIR / "scored_risks.db"
COMPANIES_CSV = DATA_DIR / "companies.csv"
PEER_STATS_CSV = DATA_DIR / "peer_stats.csv"
INDUSTRY_SUMMARIES_CSV = DATA_DIR / "industry_summaries.csv"
LITIGATION_SUMMARY_CSV = DATA_DIR / "litigation_summary.csv"
OBFUSCATION_REPORT_CSV = DATA_DIR / "obfuscation_report.csv"
DDI_REPORT_CSV = DATA_DIR / "ddi_report.csv"
OBFUSCATION_OUTLIERS_CSV = DATA_DIR / "obfuscation_outliers.csv"
DDI_OUTLIERS_CSV = DATA_DIR / "ddi_outliers.csv"
ACTIVE_IPOS_JSON = DATA_DIR / "active_ipos.json"

# Needed to dynamically import the numbered scripts/ modules (e.g. "scripts.14_fetch_active_ipos")
sys.path.insert(0, str(BASE_DIR))


app = FastAPI(
    title="IPO Prospectus Risk Decoder API",
    description="FastAPI service serving pre-computed IPO DRHP risk factor analysis, severity scores, litigation load, obfuscation metrics, and disclosure distortion analysis.",
    version="1.2.0",
)

# Enable CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =====================================================================
# PYDANTIC RESPONSE MODELS
# =====================================================================

class CompanyInfo(BaseModel):
    company_id: str
    name: str
    sector: str


class RiskItem(BaseModel):
    company_id: str
    risk_number: int
    risk_text: str
    category: str
    score: int
    reasoning: str
    ddi_score: Optional[float] = None
    materiality_score: Optional[float] = None
    emphasis_score: Optional[float] = None
    readability_score: Optional[float] = None


class LitigationCaseItem(BaseModel):
    company_id: str
    case_id: int
    party_type: str
    case_text: str
    category: str
    reasoning: str


class CategoryPeerStat(BaseModel):
    category: str
    count: int
    company_pct: float
    all_company_avg_pct: float
    difference: float


class LitigationSummary(BaseModel):
    total_cases: int
    criminal_count: int
    civil_count: int
    tax_count: int
    regulatory_count: int
    other_count: int
    category_counts: Dict[str, int]
    party_type_breakdown: Dict[str, int]
    has_director_or_promoter_litigation: bool


class ObfuscationSummary(BaseModel):
    spearman_correlation: float
    p_value: float
    sample_size: int
    interpretation: str


class DDISummary(BaseModel):
    avg_materiality: float
    avg_emphasis: float
    avg_ddi: float
    buried_risk_count: int


class CompanySummary(BaseModel):
    company: CompanyInfo
    total_risks: int
    average_severity: float
    category_counts: Dict[str, int]
    comparison_mode: str
    comparison_notice: str
    peer_comparison: List[CategoryPeerStat]
    industry_summary: Optional[str] = None
    litigation_summary: Optional[LitigationSummary] = None
    obfuscation: Optional[ObfuscationSummary] = None
    ddi: Optional[DDISummary] = None


class OutlierRiskItem(BaseModel):
    company_id: str
    risk_number: int
    category: str
    score: int
    risk_snippet: str
    ddi_score: Optional[float] = None
    materiality_score: Optional[float] = None
    emphasis_score: Optional[float] = None
    readability_score: Optional[float] = None


class CompanyOutliers(BaseModel):
    company_id: str
    ddi_outliers: List[OutlierRiskItem]
    obfuscation_outliers: List[OutlierRiskItem]


# =====================================================================
# HELPER FUNCTIONS
# =====================================================================

def get_companies_list() -> List[Dict]:
    """Reads companies metadata from data/companies.csv."""
    if not COMPANIES_CSV.exists():
        raise HTTPException(status_code=500, detail=f"Metadata file {COMPANIES_CSV.name} not found.")
    df = pd.read_csv(COMPANIES_CSV)
    return df.to_dict(orient="records")


def find_company_by_id(company_id: str) -> Optional[Dict]:
    """Looks up company by company_id (case-insensitive)."""
    companies = get_companies_list()
    target = company_id.strip().lower()
    for c in companies:
        if str(c["company_id"]).strip().lower() == target:
            return c
    return None


def fetch_risks_for_company(company_id: str) -> List[Dict]:
    """Fetches scored risk items joined with DDI and Readability scores."""
    if not SCORED_RISKS_DB.exists():
        raise HTTPException(status_code=500, detail="Database scored_risks.db not found.")

    conn = sqlite3.connect(SCORED_RISKS_DB)
    cursor = conn.cursor()
    
    query = """
        SELECT s.company_id, s.risk_number, s.risk_text, s.category, s.score, s.reasoning,
               COALESCE(d.ddi_score, s.ddi_score, 0.0) as ddi_score,
               COALESCE(d.materiality_score, 0.0) as materiality_score,
               COALESCE(d.emphasis_score, 0.0) as emphasis_score,
               COALESCE(r.readability_score, s.readability_score, 0.0) as readability_score
        FROM scored_risks s
        LEFT JOIN risk_ddi d ON LOWER(s.company_id) = LOWER(d.company_id) AND s.risk_number = d.risk_number
        LEFT JOIN risk_readability r ON LOWER(s.company_id) = LOWER(r.company_id) AND s.risk_number = r.risk_number
        WHERE LOWER(s.company_id) = ? 
        ORDER BY s.risk_number ASC
    """
    
    try:
        cursor.execute(query, (company_id.strip().lower(),))
        rows = cursor.fetchall()
    except sqlite3.OperationalError:
        # Fallback to standard columns if tables missing
        cursor.execute("SELECT company_id, risk_number, risk_text, category, score, reasoning FROM scored_risks WHERE LOWER(company_id) = ? ORDER BY risk_number ASC", (company_id.strip().lower(),))
        raw_rows = cursor.fetchall()
        rows = [(r[0], r[1], r[2], r[3], r[4], r[5], 0.0, 0.0, 0.0, 0.0) for r in raw_rows]
    finally:
        conn.close()

    result = []
    for r in rows:
        result.append({
            "company_id": r[0],
            "risk_number": r[1],
            "risk_text": r[2],
            "category": r[3],
            "score": r[4],
            "reasoning": r[5],
            "ddi_score": round(float(r[6]), 2),
            "materiality_score": round(float(r[7]), 2),
            "emphasis_score": round(float(r[8]), 2),
            "readability_score": round(float(r[9]), 2),
        })
    return result


def fetch_litigation_for_company(company_id: str) -> List[Dict]:
    """Fetches litigation cases from SQLite litigation_scores table."""
    if not SCORED_RISKS_DB.exists():
        return []

    conn = sqlite3.connect(SCORED_RISKS_DB)
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            SELECT company_id, case_id, party_type, case_text, category, reasoning 
            FROM litigation_scores 
            WHERE LOWER(company_id) = ? 
            ORDER BY case_id ASC
            """,
            (company_id.strip().lower(),),
        )
        rows = cursor.fetchall()
    except sqlite3.OperationalError:
        rows = []
    finally:
        conn.close()

    result = []
    for r in rows:
        result.append({
            "company_id": r[0],
            "case_id": r[1],
            "party_type": r[2],
            "case_text": r[3],
            "category": r[4],
            "reasoning": r[5],
        })
    return result


def fetch_peer_stats_for_company(company_id: str) -> List[Dict]:
    """Fetches pre-computed peer stats from data/peer_stats.csv."""
    if not PEER_STATS_CSV.exists():
        return []
    df = pd.read_csv(PEER_STATS_CSV)
    c_df = df[df["company_id"].str.strip().str.lower() == company_id.strip().lower()]
    return c_df.to_dict(orient="records")


def fetch_industry_summary_for_company(company_id: str) -> str:
    """Fetches industry overview summary from data/industry_summaries.csv."""
    if not INDUSTRY_SUMMARIES_CSV.exists():
        return ""
    df = pd.read_csv(INDUSTRY_SUMMARIES_CSV)
    c_df = df[df["company_id"].str.strip().str.lower() == company_id.strip().lower()]
    if not c_df.empty and "summary_text" in c_df.columns:
        return str(c_df.iloc[0]["summary_text"])
    return ""


def fetch_litigation_summary_for_company(company_id: str) -> Dict:
    """Computes litigation load summary stats and party type breakdown."""
    cases = fetch_litigation_for_company(company_id)
    total_cases = len(cases)

    cat_counts = {"Criminal": 0, "Civil": 0, "Tax": 0, "Regulatory/SEBI": 0, "Other": 0}
    party_counts = {"company": 0, "director": 0, "promoter": 0}
    has_dir_promoter = False

    for c in cases:
        cat = c.get("category", "Other")
        if cat not in cat_counts:
            cat = "Other"
        cat_counts[cat] += 1

        ptype = str(c.get("party_type", "company")).strip().lower()
        if ptype in party_counts:
            party_counts[ptype] += 1
        else:
            party_counts["company"] += 1

        if ptype in ["director", "promoter"]:
            has_dir_promoter = True

    return {
        "total_cases": total_cases,
        "criminal_count": cat_counts["Criminal"],
        "civil_count": cat_counts["Civil"],
        "tax_count": cat_counts["Tax"],
        "regulatory_count": cat_counts["Regulatory/SEBI"],
        "other_count": cat_counts["Other"],
        "category_counts": cat_counts,
        "party_type_breakdown": party_counts,
        "has_director_or_promoter_litigation": has_dir_promoter,
    }


def fetch_obfuscation_summary_for_company(company_id: str) -> Optional[Dict]:
    """Fetches Spearman correlation metrics from data/obfuscation_report.csv."""
    if not OBFUSCATION_REPORT_CSV.exists():
        return None
    df = pd.read_csv(OBFUSCATION_REPORT_CSV)
    c_df = df[df["company_id"].str.strip().str.lower() == company_id.strip().lower()]
    if c_df.empty:
        return None
    row = c_df.iloc[0]
    return {
        "spearman_correlation": round(float(row["spearman_correlation"]), 4),
        "p_value": round(float(row["p_value"]), 4),
        "sample_size": int(row["sample_size"]),
        "interpretation": str(row["interpretation"]),
    }


def fetch_ddi_summary_for_company(company_id: str, risks: List[Dict]) -> Optional[Dict]:
    """Computes DDI summary metrics from company risks list."""
    if not risks:
        return None
    mats = [r["materiality_score"] for r in risks if r.get("materiality_score") is not None]
    emps = [r["emphasis_score"] for r in risks if r.get("emphasis_score") is not None]
    ddis = [r["ddi_score"] for r in risks if r.get("ddi_score") is not None]

    if not ddis:
        return None

    avg_mat = round(sum(mats) / len(mats), 2)
    avg_emp = round(sum(emps) / len(emps), 2)
    avg_ddi = round(sum(ddis) / len(ddis), 2)
    buried_count = len([d for d in ddis if d > 30.0])

    return {
        "avg_materiality": avg_mat,
        "avg_emphasis": avg_emp,
        "avg_ddi": avg_ddi,
        "buried_risk_count": buried_count,
    }


def fetch_outliers_for_company(company_id: str) -> Dict:
    """Fetches top DDI and Obfuscation outliers for a company from CSV files."""
    cid_target = company_id.strip().lower()
    ddi_outliers = []
    obf_outliers = []

    if DDI_OUTLIERS_CSV.exists():
        df_ddi = pd.read_csv(DDI_OUTLIERS_CSV)
        c_ddi = df_ddi[df_ddi["company_id"].str.strip().str.lower() == cid_target]
        for _, r in c_ddi.iterrows():
            ddi_outliers.append({
                "company_id": str(r["company_id"]),
                "risk_number": int(r["risk_number"]),
                "category": str(r["category"]),
                "score": int(r["score"]),
                "risk_snippet": str(r["risk_snippet"]),
                "materiality_score": round(float(r["materiality_score"]), 2),
                "emphasis_score": round(float(r["emphasis_score"]), 2),
                "ddi_score": round(float(r["ddi_score"]), 2),
            })

    if OBFUSCATION_OUTLIERS_CSV.exists():
        df_obf = pd.read_csv(OBFUSCATION_OUTLIERS_CSV)
        c_obf = df_obf[df_obf["company_id"].str.strip().str.lower() == cid_target]
        for _, r in c_obf.iterrows():
            obf_outliers.append({
                "company_id": str(r["company_id"]),
                "risk_number": int(r["risk_number"]),
                "category": str(r["category"]),
                "score": int(r["score"]),
                "risk_snippet": str(r["risk_snippet"]),
                "readability_score": round(float(r["readability_score"]), 2),
            })

    return {
        "company_id": company_id,
        "ddi_outliers": ddi_outliers,
        "obfuscation_outliers": obf_outliers,
    }


# =====================================================================
# API ENDPOINTS
# =====================================================================

@app.get("/api")
def read_root():
    return {
        "status": "online",
        "service": "IPO Prospectus Risk Decoder API",
        "version": "1.2.0",
        "documentation": "/docs",
    }


@app.get("/api/health")
def health_check():
    return {"status": "healthy", "database": SCORED_RISKS_DB.exists()}


# Endpoint 1: GET /companies
@app.get("/companies", response_model=List[CompanyInfo])
@app.get("/api/companies", response_model=List[CompanyInfo])
def get_companies():
    """Returns list of all processed companies (id, name, sector)."""
    return get_companies_list()


# Endpoint 2: GET /companies/{id}/risks
@app.get("/companies/{company_id}/risks", response_model=List[RiskItem])
@app.get("/api/companies/{company_id}/risks", response_model=List[RiskItem])
def get_company_risks(company_id: str):
    """Returns full risk factor list for a company with severity scores, reasoning, DDI, and readability metrics."""
    company = find_company_by_id(company_id)
    if not company:
        raise HTTPException(
            status_code=404,
            detail=f"Company with ID '{company_id}' not found. Available companies: {', '.join([c['company_id'] for c in get_companies_list()])}",
        )
    risks = fetch_risks_for_company(company_id)
    return risks


# Endpoint 3: GET /companies/{id}/summary
@app.get("/companies/{company_id}/summary", response_model=CompanySummary)
@app.get("/api/companies/{company_id}/summary", response_model=CompanySummary)
def get_company_summary(company_id: str):
    """Returns category breakdown counts, average severity, litigation load, obfuscation test, and DDI summary metrics."""
    company = find_company_by_id(company_id)
    if not company:
        raise HTTPException(
            status_code=404,
            detail=f"Company with ID '{company_id}' not found. Available companies: {', '.join([c['company_id'] for c in get_companies_list()])}",
        )

    risks = fetch_risks_for_company(company_id)
    if not risks:
        raise HTTPException(status_code=404, detail=f"No risk factors found in database for company '{company_id}'.")

    # Compute category breakdown and average severity
    total_risks = len(risks)
    scores = [r["score"] for r in risks]
    avg_severity = round(sum(scores) / total_risks, 2) if total_risks > 0 else 0.0

    category_counts = {}
    for r in risks:
        cat = r["category"]
        category_counts[cat] = category_counts.get(cat, 0) + 1

    peer_stats = fetch_peer_stats_for_company(company_id)
    industry_summary = fetch_industry_summary_for_company(company_id)
    litigation_summary = fetch_litigation_summary_for_company(company_id)
    obfuscation = fetch_obfuscation_summary_for_company(company_id)
    ddi = fetch_ddi_summary_for_company(company_id, risks)

    return {
        "company": company,
        "total_risks": total_risks,
        "average_severity": avg_severity,
        "category_counts": category_counts,
        "comparison_mode": "cross-company comparison",
        "comparison_notice": (
            "Notice: Each company in the v1 dataset belongs to a distinct sector. "
            "Metrics represent a cross-company dataset comparison baseline rather than same-sector peer comparison."
        ),
        "peer_comparison": peer_stats,
        "industry_summary": industry_summary,
        "litigation_summary": litigation_summary,
        "obfuscation": obfuscation,
        "ddi": ddi,
    }


# Endpoint 4: GET /companies/{id}/litigation
@app.get("/companies/{company_id}/litigation", response_model=List[LitigationCaseItem])
@app.get("/api/companies/{company_id}/litigation", response_model=List[LitigationCaseItem])
def get_company_litigation(company_id: str):
    """Returns full list of litigation cases for a company (case_text, party_type, category, reasoning)."""
    company = find_company_by_id(company_id)
    if not company:
        raise HTTPException(
            status_code=404,
            detail=f"Company with ID '{company_id}' not found. Available companies: {', '.join([c['company_id'] for c in get_companies_list()])}",
        )
    litigation_cases = fetch_litigation_for_company(company_id)
    return litigation_cases


# Endpoint 5: GET /companies/{id}/outliers
@app.get("/companies/{company_id}/outliers", response_model=CompanyOutliers)
@app.get("/api/companies/{company_id}/outliers", response_model=CompanyOutliers)
def get_company_outliers(company_id: str):
    """Returns top DDI outliers and top obfuscation outliers for a company."""
    company = find_company_by_id(company_id)
    if not company:
        raise HTTPException(
            status_code=404,
            detail=f"Company with ID '{company_id}' not found. Available companies: {', '.join([c['company_id'] for c in get_companies_list()])}",
        )
    return fetch_outliers_for_company(company_id)


# =====================================================================
# SHAREABLE RISK CARD (v3)
#
# Pure presentation over the same data get_company_summary() already
# computes -- no new DB queries, no LLM calls. GET .../card returns the raw
# PNG; GET .../share returns a tiny HTML page whose og:image points at that
# PNG so pasting the /share link into X/Reddit/Slack unfurls the card (a
# bare image URL doesn't reliably unfurl on its own).
# =====================================================================

@app.get("/companies/{company_id}/card")
@app.get("/api/companies/{company_id}/card")
def get_company_risk_card(company_id: str):
    """Renders a 1200x630 PNG risk card (name, severity verdict, top risk
    categories) for sharing on social platforms."""
    company = find_company_by_id(company_id)
    if not company:
        raise HTTPException(
            status_code=404,
            detail=f"Company with ID '{company_id}' not found. Available companies: {', '.join([c['company_id'] for c in get_companies_list()])}",
        )
    summary = get_company_summary(company_id)
    png_bytes = generate_risk_card(summary)
    return Response(content=png_bytes, media_type="image/png")


@app.get("/companies/{company_id}/share", response_class=HTMLResponse)
@app.get("/api/companies/{company_id}/share", response_class=HTMLResponse)
def get_company_share_page(company_id: str, request: Request):
    """Minimal HTML page carrying og:image/twitter:image meta tags pointing
    at the PNG card, so a pasted link unfurls with the card image. Redirects
    a human visitor to the real dashboard after a moment.

    og:image/twitter:image MUST be absolute URLs per the Open Graph spec --
    X, Slack, and LinkedIn will not resolve a relative path when unfurling a
    link, so they're built from the actual incoming request host rather than
    hardcoded, keeping this correct in both local dev and on Vercel."""
    company = find_company_by_id(company_id)
    if not company:
        raise HTTPException(
            status_code=404,
            detail=f"Company with ID '{company_id}' not found. Available companies: {', '.join([c['company_id'] for c in get_companies_list()])}",
        )
    summary = get_company_summary(company_id)
    base = str(request.base_url).rstrip("/")
    card_url = f"{base}/api/companies/{company_id}/card"
    dashboard_url = f"{base}/?company={company_id}"
    title = f"{company['name']} — {summary['average_severity']:.1f}/5 Risk Profile"
    description = f"{summary['total_risks']} disclosed risk factors, scored against a validated 1-5 severity rubric and benchmarked vs. sector peers."
    html = f"""<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>{title}</title>
<meta name="description" content="{description}">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{description}">
<meta property="og:image" content="{card_url}">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{title}">
<meta name="twitter:description" content="{description}">
<meta name="twitter:image" content="{card_url}">
<meta http-equiv="refresh" content="0; url={dashboard_url}">
</head>
<body>
<p>Redirecting to <a href="{dashboard_url}">{company['name']}'s risk dashboard</a>...</p>
<img src="{card_url}" alt="{title}" style="max-width:100%">
</body>
</html>"""
    return HTMLResponse(content=html)


# =====================================================================
# ACTIVE IPO BROWSER + PDF UPLOAD PIPELINE (v2 — see GEMINI.md)
#
# Discovery-only browsing (GET /active-ipos) never triggers processing.
# POST /upload-drhp is the only path that invokes the LLM live, and only
# on an explicit, single user-initiated request. Local `uvicorn` only —
# not supported on the Vercel deployment (read-only filesystem, no
# configured timeout override for a 1-2 minute request).
# =====================================================================

@app.get("/active-ipos")
@app.get("/api/active-ipos")
def get_active_ipos():
    """Returns the cached active/upcoming mainboard IPO list. Refreshed only
    via POST /active-ipos/refresh — never automatically."""
    if not ACTIVE_IPOS_JSON.exists():
        raise HTTPException(
            status_code=404,
            detail="No cached active IPO list yet. Call POST /active-ipos/refresh first.",
        )
    with open(ACTIVE_IPOS_JSON) as f:
        return json.load(f)


@app.post("/active-ipos/refresh")
@app.post("/api/active-ipos/refresh")
def refresh_active_ipos():
    """Re-runs the chittorgarh.com scraper on demand and returns the refreshed list."""
    try:
        fetch_module = importlib.import_module("scripts.14_fetch_active_ipos")
        result = fetch_module.fetch_active_ipos()
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to refresh active IPO list: {exc}")

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with open(ACTIVE_IPOS_JSON, "w") as f:
        json.dump(result, f, indent=2)
    return result


class UploadDrhpResponse(BaseModel):
    company_id: str
    company_name: str
    status: str
    steps_completed: List[str]


@app.post("/upload-drhp", response_model=UploadDrhpResponse)
@app.post("/api/upload-drhp", response_model=UploadDrhpResponse)
async def upload_drhp(
    file: UploadFile = File(...),
    company_name: str = Form(...),
    sector: str = Form("Uploaded"),
):
    """Uploads a DRHP PDF and runs the full analysis pipeline synchronously
    (single-user showcase app — a blocking request with a frontend loading
    state is the intended UX, per the feature spec). Runs locally via
    uvicorn only.
    """
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")
    if not company_name or not company_name.strip():
        raise HTTPException(status_code=400, detail="company_name is required.")

    pipeline = importlib.import_module("scripts.15_process_uploaded_drhp")

    company_id = pipeline.slugify_company_id(company_name)
    if not company_id:
        raise HTTPException(status_code=400, detail="Could not derive a valid company_id from that company name.")

    existing = find_company_by_id(company_id)
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"A company with ID '{company_id}' already exists ('{existing['name']}'). Choose a different name.",
        )

    PDF_DIR.mkdir(parents=True, exist_ok=True)
    pdf_path = PDF_DIR / f"{company_id}.pdf"
    contents = await file.read()
    with open(pdf_path, "wb") as f:
        f.write(contents)

    # DRHP verification happens as pipeline step 1 -- but check it here first
    # too so we can return a clean 400 (and remove the temp file) before
    # committing to the full run, per the spec's "verify before processing" step.
    is_drhp, matched = pipeline.verify_is_drhp(pdf_path)
    if not is_drhp:
        pdf_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=400,
            detail="This doesn't appear to be a DRHP — no standard sections detected.",
        )

    log_lines = []

    try:
        steps_completed = pipeline.run_full_pipeline(
            pdf_path, company_id, company_name.strip(), sector.strip() or "Uploaded", log=log_lines.append
        )
    except pipeline.PipelineStepError as exc:
        raise HTTPException(
            status_code=500,
            detail={"failed_step": exc.step, "message": exc.message, "log": log_lines},
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={"failed_step": "unknown", "message": str(exc), "log": log_lines},
        )

    return {
        "company_id": company_id,
        "company_name": company_name.strip(),
        "status": "complete",
        "steps_completed": steps_completed,
    }


# Endpoint 6: GET /methodology
@app.get("/methodology")
@app.get("/api/methodology")
def get_methodology():
    """Returns methodology details: severity rubric, LLM model validation benchmark, dataset limitations, and algorithmic formulas."""
    return {
        "rubric": {
            "scale": [
                {"score": 5, "label": "Severe", "description": "Quantified, material impact stated; risk has already materialized or is highly likely"},
                {"score": 4, "label": "High", "description": "Specific and material, but contingent/forward-looking"},
                {"score": 3, "label": "Moderate", "description": "Real but vague — no numbers, generic industry risk"},
                {"score": 2, "label": "Low", "description": "Boilerplate/standard risk present in nearly every DRHP in this industry, low specificity"},
                {"score": 1, "label": "Minimal", "description": "Reassurance-style language with no real substance"}
            ],
            "categories": ["Financial", "Legal", "Regulatory", "Operational", "Market", "Reputational"]
        },
        "validation_benchmark": {
            "ground_truth_samples": 100,
            "threshold_required": "≥80.0%",
            "models_evaluated": [
                {
                    "backend": "local",
                    "model_name": "llama3.2:3b (Ollama)",
                    "category_match_pct": 23.0,
                    "severity_within_pm1_pct": 59.0,
                    "status": "FAILED",
                    "reason": "Failed both category (23% vs 80%) and score accuracy thresholds (59% vs 80%). Over-indexed on score 5."
                },
                {
                    "backend": "gemini",
                    "model_name": "gemini-flash-latest (Google)",
                    "category_match_pct": 89.0,
                    "severity_within_pm1_pct": 100.0,
                    "status": "PASSED",
                    "reason": "Exceeded all validation thresholds (89% category match, 100% score within ±1, MAE 0.030)."
                }
            ]
        },
        "ddi_methodology": {
            "title": "Disclosure Distortion Index (DDI)",
            "formula": "DDI = Materiality Score - Emphasis Score",
            "materiality_score": "M_i = min(100, 15*N_rupee + 12*N_pct + 10*N_metric + Bonus_large)",
            "emphasis_score": "E_i = 0.50*PositionScore + 0.30*HeaderScore + 0.20*LengthScore",
            "threshold": "DDI > +30.0 flags a 'Buried Important Risk' (high financial materiality, low placement emphasis).",
            "range": "[-100.0 to +100.0]"
        },
        "obfuscation_methodology": {
            "title": "Obfuscation Test (Flesch Readability vs Severity Correlation)",
            "formula": "Spearman Rank Correlation (rho) between FRE Readability Score and Severity (1-5)",
            "hypothesis": "Higher severity risks correlate with LOWER readability (harder to read).",
            "per_company_results": [
                {"company": "Zomato", "spearman_rho": 0.2485, "p_value": 0.0477, "significance": "Statistically Significant (p < 0.05)", "finding": "Contradicts obfuscation hypothesis — severe risks written in clearer prose."},
                {"company": "Paytm", "spearman_rho": 0.2016, "p_value": 0.0711, "significance": "Borderline / Not Significant (p = 0.0711)", "finding": "No statistically significant correlation."},
                {"company": "Lohia Corp", "spearman_rho": 0.0984, "p_value": 0.3643, "significance": "Not Significant (p = 0.3643)", "finding": "No correlation between severity and readability."},
                {"company": "Combined Dataset (232 risks)", "spearman_rho": 0.1826, "p_value": 0.0053, "significance": "Statistically Significant (p = 0.0053)", "finding": "Contradicts obfuscation hypothesis across full dataset."}
            ]
        },
        "shadow_ledger_methodology": {
            "title": "Shadow Ledger Engine (Financial Statements Cross-Check)",
            "cross_checked_figures": ["Total Revenue", "Profit After Tax (PAT)", "Total Debt / Borrowings"],
            "equivalence_rules": [
                "Only compare figures for the exact same fiscal year.",
                "Only compare figures with identical accounting scope (Standalone vs Consolidated).",
                "Only compare figures measuring the exact same defined financial metric.",
                "Non-equivalent metrics (e.g. Sanctioned Credit Limits vs Balance Sheet Debt) are labeled 'Not Directly Comparable' with both values preserved."
            ],
            "confirmed_match_example": "Lohia Corp corporate guarantee of ₹413.00 Million on Page 323 Note 36 matched Risk #9 claim (₹413.00 Million, 0.0% difference)."
        },
        "proceeds_promoter_methodology": {
            "title": "Use of Proceeds & Promoter Structure Analysis",
            "execution": "100% Deterministic Extraction (Zero LLM Calls)",
            "proceeds_extraction": "Parsed directly from 'Objects of the Offer' fund allocation tables in Section III/IV of the DRHP.",
            "promoter_extraction": "Extracted from explicit cover page and 'Capital Structure / Our Promoters' disclosures."
        },
        "limitations_notice": {
            "title": "Single-Company-Per-Sector Limitation Notice",
            "description": (
                "Since each of the 3 sample companies (Paytm: Fintech, Lohia Corp: Capital Goods, Zomato: Consumer Internet) "
                "belongs to a different sector, the peer benchmarking engine calculates a cross-company comparison baseline "
                "rather than a true same-sector peer benchmark. In production with multiple companies per sector, comparison "
                "must be grouped strictly by sector."
            )
        }
    }

