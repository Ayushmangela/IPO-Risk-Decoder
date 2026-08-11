"""
Script 11: Disclosure Distortion Index (DDI) Pipeline

Per GEMINI.md & User Requirements:
- Pure algorithmic computation: ZERO LLM calls, 100% deterministic mathematical formulas.
- Step 1: Materiality Score (0-100) based on regex extraction of financial numbers (₹ amounts, %, ratios, magnitude bonuses).
- Step 2: Emphasis Score (0-100) based on position in prospectus, bolded header presence, and word count brevity.
- Step 3: Disclosure Distortion Index (DDI) = MaterialityScore - EmphasisScore.
- Step 4: Outlier Identification — top 5 risks with highest DDI score (most buried important risks) per company.
- Outputs: SQLite table risk_ddi, /data/ddi_report.csv, and /data/ddi_outliers.csv.
"""

import os
import re
import sqlite3
import sys
from pathlib import Path
import pandas as pd

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
SCORED_RISKS_DB = DATA_DIR / "scored_risks.db"
DDI_REPORT_CSV = DATA_DIR / "ddi_report.csv"
DDI_OUTLIERS_CSV = DATA_DIR / "ddi_outliers.csv"

# Regex patterns for financial metric extraction
RUPEE_REGEX = re.compile(
    r"(?:₹|rs\.?|rupees?)\s*[\d\.\,]+\s*(?:crore|million|billion)?|(?:[\d\.\,]+\s*(?:crore|million|billion)\s*(?:rupees|inr)?)",
    re.IGNORECASE,
)
PCT_REGEX = re.compile(r"\b\d+(?:\.\d+)?\s*(?:\%|percent)\b", re.IGNORECASE)
METRIC_NUM_REGEX = re.compile(r"\b\d+(?:\.\d+)?\s*(?:x|times|months|years|days|users|merchants|orders)\b", re.IGNORECASE)


def calculate_materiality_score(text: str) -> float:
    """
    Computes Materiality Score (0-100) based on presence and magnitude of quantitative claims.
    
    Formula:
    Materiality = min(100, 15*N_rupee + 12*N_pct + 10*N_metric + Bonus_large_pct + Bonus_large_amt)
    """
    rupees = RUPEE_REGEX.findall(text)
    pcts = PCT_REGEX.findall(text)
    metrics = METRIC_NUM_REGEX.findall(text)

    n_rupee = len(rupees)
    n_pct = len(pcts)
    n_metric = len(metrics)

    # Magnitude Bonuses
    bonus_large_pct = 0
    for p in pcts:
        val_str = re.sub(r"[^\d\.]", "", p)
        try:
            val = float(val_str)
            if val >= 25.0:
                bonus_large_pct = 20
                break
        except ValueError:
            pass

    bonus_large_amt = 0
    for r in rupees:
        r_lower = r.lower()
        if "crore" in r_lower or "billion" in r_lower or "million" in r_lower:
            bonus_large_amt = 20
            break

    raw_score = (15 * n_rupee) + (12 * n_pct) + (10 * n_metric) + bonus_large_pct + bonus_large_amt
    return round(min(100.0, float(raw_score)), 2)


def calculate_emphasis_score(risk_number: int, total_risks: int, text: str) -> float:
    """
    Computes Emphasis Score (0-100) based on issuer placement, header formatting, and brevity.
    
    Formula:
    Emphasis = 0.50 * PositionScore + 0.30 * HeaderScore + 0.20 * BrevityScore
    
    Where:
    - PositionScore = 100 * (1 - (risk_number - 1) / total_risks)  [Risk #1 = 100, Last risk = ~1]
    - HeaderScore = 100 if starts with capital title heading, else 0
    - BrevityScore = max(0, 100 - (word_count - 50) / 3)
    """
    # 1. Position Score (SEBI placement ordering: earlier = higher emphasis)
    pos_score = 100.0 * (1.0 - (float(risk_number - 1) / float(max(1, total_risks))))

    # 2. Header Score (Visual heading formatting)
    first_line = text.strip().split("\n")[0]
    has_header = 100.0 if (
        re.match(r"^[A-Z0-9\s\,\-\:\(\)]{4,40}$", first_line)
        or re.match(r"^(?:[A-Z\s]{4,30}|[0-9]+\.\s+[A-Z])", text.strip())
        or text.startswith("We ")
        or text.startswith("Our ")
        or text.startswith("If ")
    ) else 0.0

    # 3. Brevity Score (Concise visual presentation)
    words = text.split()
    word_count = len(words)
    brevity_score = max(0.0, 100.0 - (float(word_count - 50) / 3.0))

    emphasis = (0.50 * pos_score) + (0.30 * has_header) + (0.20 * brevity_score)
    return round(min(100.0, max(0.0, emphasis)), 2)


def init_ddi_db(conn: sqlite3.Connection):
    """Creates risk_ddi table and alters scored_risks table."""
    cursor = conn.cursor()
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS risk_ddi (
            company_id TEXT NOT NULL,
            risk_number INTEGER NOT NULL,
            materiality_score REAL NOT NULL,
            emphasis_score REAL NOT NULL,
            ddi_score REAL NOT NULL,
            PRIMARY KEY (company_id, risk_number)
        )
        """
    )
    try:
        cursor.execute("ALTER TABLE scored_risks ADD COLUMN ddi_score REAL")
    except sqlite3.OperationalError:
        pass
    conn.commit()


def process_ddi(conn: sqlite3.Connection) -> pd.DataFrame:
    """Calculates DDI scores across all risk items per company."""
    cursor = conn.cursor()
    cursor.execute("SELECT company_id, risk_number, risk_text, category, score FROM scored_risks ORDER BY company_id, risk_number")
    rows = cursor.fetchall()

    # Pre-calculate total risks per company for position scoring
    company_totals = {}
    for cid, rnum, rtext, cat, score in rows:
        company_totals[cid] = max(company_totals.get(cid, 0), rnum)

    results = []
    cursor_insert = conn.cursor()

    for cid, rnum, rtext, cat, score in rows:
        tot = company_totals[cid]
        mat_score = calculate_materiality_score(rtext)
        emp_score = calculate_emphasis_score(rnum, tot, rtext)
        
        # Disclosure Distortion Index (DDI) = Materiality - Emphasis
        ddi = round(mat_score - emp_score, 2)

        results.append({
            "company_id": cid,
            "risk_number": rnum,
            "category": cat,
            "score": score,
            "materiality_score": mat_score,
            "emphasis_score": emp_score,
            "ddi_score": ddi,
            "risk_text": rtext
        })

        cursor_insert.execute(
            """
            INSERT OR REPLACE INTO risk_ddi (company_id, risk_number, materiality_score, emphasis_score, ddi_score)
            VALUES (?, ?, ?, ?, ?)
            """,
            (cid, rnum, mat_score, emp_score, ddi),
        )
        cursor_insert.execute(
            """
            UPDATE scored_risks SET ddi_score = ? WHERE LOWER(company_id) = ? AND risk_number = ?
            """,
            (ddi, cid.lower(), rnum),
        )

    conn.commit()
    df = pd.DataFrame(results)

    # Save /data/ddi_report.csv
    report_df = df[["company_id", "risk_number", "materiality_score", "emphasis_score", "ddi_score"]]
    report_df.to_csv(DDI_REPORT_CSV, index=False)

    return df


def identify_ddi_outliers(df: pd.DataFrame) -> pd.DataFrame:
    """Identifies top 5 risks with highest DDI score (most buried important risks) per company."""
    outlier_rows = []

    for cid in sorted(df["company_id"].unique().tolist()):
        c_subset = df[df["company_id"] == cid]
        c_sorted = c_subset.sort_values(by="ddi_score", ascending=False).head(5)

        for _, row in c_sorted.iterrows():
            snippet = row["risk_text"][:220] + "..." if len(row["risk_text"]) > 220 else row["risk_text"]
            outlier_rows.append({
                "company_id": cid,
                "risk_number": int(row["risk_number"]),
                "category": row["category"],
                "score": int(row["score"]),
                "materiality_score": float(row["materiality_score"]),
                "emphasis_score": float(row["emphasis_score"]),
                "ddi_score": float(row["ddi_score"]),
                "risk_snippet": snippet
            })

    outliers_df = pd.DataFrame(outlier_rows)
    outliers_df.to_csv(DDI_OUTLIERS_CSV, index=False)
    return outliers_df


def main():
    print("=" * 90)
    print("📐 DISCLOSURE DISTORTION INDEX (DDI) PIPELINE")
    print("Zero LLM Calls | 100% Deterministic Algorithmic Computation")
    print("=" * 90 + "\n")

    print("📜 EXPLICIT SCORING FORMULAS:")
    print("-" * 90)
    print("1. MATERIALITY SCORE (M_i ∈ [0, 100]):")
    print("   M_i = min(100, 15*N_rupee + 12*N_pct + 10*N_metric + Bonus_large_pct + Bonus_large_amt)")
    print("   • N_rupee: Count of Rupee/monetary claims matched via regex (₹, crore, million, billion)")
    print("   • N_pct: Count of percentage claims matched via regex (%, percent)")
    print("   • Bonus_large_pct: +20 bonus points if any percentage claim >= 25%")
    print("   • Bonus_large_amt: +20 bonus points if monetary claim exceeds ₹100 crore / ₹1,000 million")
    print("\n2. EMPHASIS SCORE (E_i ∈ [0, 100]):")
    print("   E_i = 0.50 * PositionScore + 0.30 * HeaderScore + 0.20 * BrevityScore")
    print("   • PositionScore = 100 * (1 - (risk_number - 1) / total_company_risks)  [Earlier placement = higher emphasis]")
    print("   • HeaderScore = 100 if distinct bold title heading exists, else 0")
    print("   • BrevityScore = max(0, 100 - (word_count - 50) / 3)")
    print("\n3. DISCLOSURE DISTORTION INDEX (DDI_i ∈ [-100, +100]):")
    print("   DDI_i = MaterialityScore_i - EmphasisScore_i")
    print("   • High Positive DDI (> +30): 'BURIED IMPORTANT RISK' (High materiality, but low placement emphasis)")
    print("   • Negative DDI (< -30): 'PROMINENT BOILERPLATE' (High emphasis, but low quantitative substance)")
    print("-" * 90 + "\n")

    if not SCORED_RISKS_DB.exists():
        raise FileNotFoundError(f"Database {SCORED_RISKS_DB} not found.")

    conn = sqlite3.connect(SCORED_RISKS_DB)
    init_ddi_db(conn)

    df = process_ddi(conn)
    conn.close()

    outliers_df = identify_ddi_outliers(df)

    print("=" * 90)
    print("📊 1. DDI COMPUTATION SUMMARY PER COMPANY (data/ddi_report.csv):")
    print("=" * 90)
    summary_rows = []
    for cid in sorted(df["company_id"].unique().tolist()):
        c_sub = df[df["company_id"] == cid]
        buried_count = len(c_sub[c_sub["ddi_score"] > 30])
        summary_rows.append({
            "company_id": cid,
            "total_risks": len(c_sub),
            "avg_materiality": round(c_sub["materiality_score"].mean(), 2),
            "avg_emphasis": round(c_sub["emphasis_score"].mean(), 2),
            "avg_ddi": round(c_sub["ddi_score"].mean(), 2),
            "buried_important_risks_count (DDI > 30)": buried_count
        })
    print(pd.DataFrame(summary_rows).to_markdown(index=False))

    print("\n\n🚩 2. TOP BURIED IMPORTANT RISKS PER COMPANY (Highest DDI Outliers in data/ddi_outliers.csv):")
    print("=" * 90)
    for cid in sorted(outliers_df["company_id"].unique().tolist()):
        c_outliers = outliers_df[outliers_df["company_id"] == cid]
        print(f"\n--- [{cid.upper()}] TOP {len(c_outliers)} BURIED IMPORTANT RISKS (HIGHEST DDI SCORES) ---")
        for _, r in c_outliers.iterrows():
            print(f"  • Risk #{r['risk_number']} | Cat: {r['category']} | Severity: {r['score']}/5 | DDI Score: +{r['ddi_score']} (Mat: {r['materiality_score']}, Emp: {r['emphasis_score']})")
            print(f"    Snippet: \"{r['risk_snippet']}\"\n")

    print("=" * 90)
    print(f"DDI Report CSV Saved   : {DDI_REPORT_CSV.resolve()}")
    print(f"DDI Outliers CSV Saved : {DDI_OUTLIERS_CSV.resolve()}")
    print("=" * 90)


if __name__ == "__main__":
    main()
