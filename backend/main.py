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

app = FastAPI(
    title="IPO Prospectus Risk Decoder API",
    description="FastAPI service serving pre-computed IPO DRHP risk factor analysis, severity scores, and peer benchmarking.",
    version="1.0.0",
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


class CategoryPeerStat(BaseModel):
    category: str
    count: int
    company_pct: float
    all_company_avg_pct: float
    difference: float


class CompanySummary(BaseModel):
    company: CompanyInfo
    total_risks: int
    average_severity: float
    category_counts: Dict[str, int]
    comparison_mode: str
    comparison_notice: str
    peer_comparison: List[CategoryPeerStat]


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


def fetch_peer_stats_for_company(company_id: str) -> List[Dict]:
    """Fetches pre-computed peer stats from data/peer_stats.csv."""
    if not PEER_STATS_CSV.exists():
        return []
    df = pd.read_csv(PEER_STATS_CSV)
    c_df = df[df["company_id"].str.strip().str.lower() == company_id.strip().lower()]
    return c_df.to_dict(orient="records")


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
    }
