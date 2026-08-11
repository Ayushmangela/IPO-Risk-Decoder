"""
FastAPI Backend Application for IPO Prospectus Risk Decoder

Per GEMINI.md:
- Reads strictly from pre-computed offline data (scored_risks.db, companies.csv, peer_stats.csv).
- NEVER invokes an LLM live during API requests.
- Exposes 3 core endpoints:
  1. GET /companies - List of processed companies
  2. GET /companies/{id}/risks - Full risk factor list with severity scores & reasoning
  3. GET /companies/{id}/summary - Category breakdown, average severity, & cross-company peer comparison stats
"""

import sqlite3
from pathlib import Path
from typing import Dict, List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
from pydantic import BaseModel

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
SCORED_RISKS_DB = DATA_DIR / "scored_risks.db"
COMPANIES_CSV = DATA_DIR / "companies.csv"
PEER_STATS_CSV = DATA_DIR / "peer_stats.csv"
INDUSTRY_SUMMARIES_CSV = DATA_DIR / "industry_summaries.csv"
LITIGATION_SUMMARY_CSV = DATA_DIR / "litigation_summary.csv"


app = FastAPI(
    title="IPO Prospectus Risk Decoder API",
    description="FastAPI service serving pre-computed IPO DRHP risk factor analysis, severity scores, litigation load, and peer benchmarking.",
    version="1.1.0",
)

# Enable CORS for React frontend (Vite default port 5173 and localhost)
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
    """Fetches scored risk items from SQLite data/scored_risks.db."""
    if not SCORED_RISKS_DB.exists():
        raise HTTPException(status_code=500, detail="Database scored_risks.db not found.")

    conn = sqlite3.connect(SCORED_RISKS_DB)
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT company_id, risk_number, risk_text, category, score, reasoning 
        FROM scored_risks 
        WHERE LOWER(company_id) = ? 
        ORDER BY risk_number ASC
        """,
        (company_id.strip().lower(),),
    )
    rows = cursor.fetchall()
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



# =====================================================================
# API ENDPOINTS
# =====================================================================

@app.get("/")
def read_root():
    return {
        "status": "online",
        "service": "IPO Prospectus Risk Decoder API",
        "version": "1.0.0",
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
    """Returns full risk factor list for a company with severity scores and reasoning."""
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
    """Returns category breakdown counts, average severity, and cross-company peer benchmark stats."""
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



# Endpoint 4: GET /methodology
@app.get("/methodology")
@app.get("/api/methodology")
def get_methodology():
    """Returns methodology details: severity rubric, LLM model validation benchmark, and dataset limitations."""
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

