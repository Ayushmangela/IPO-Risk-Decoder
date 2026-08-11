"""
Script 10: Obfuscation Hypothesis Test (Deterministic Readability & Spearman Correlation Analysis)

Per GEMINI.md & User Requirements:
- Pure algorithmic computation: ZERO LLM calls, 100% deterministic formulas.
- Step 1: Readability Scoring via Flesch Reading Ease formula on raw risk text using textstat library.
- Step 2: Spearman Rank Correlation test between severity score (ordinal 1-5) and readability score.
- Step 3: Outlier Identification — top 5 severe risks (score >= 4) with lowest readability score per company.
- Outputs: SQLite table risk_readability, /data/obfuscation_report.csv, and /data/obfuscation_outliers.csv.
"""

import os
import sqlite3
import sys
from pathlib import Path
import pandas as pd
from scipy.stats import spearmanr
import textstat

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
SCORED_RISKS_DB = DATA_DIR / "scored_risks.db"
OBFUSCATION_REPORT_CSV = DATA_DIR / "obfuscation_report.csv"
OBFUSCATION_OUTLIERS_CSV = DATA_DIR / "obfuscation_outliers.csv"


def init_readability_db(conn: sqlite3.Connection):
    """Creates risk_readability table and alters scored_risks table if needed."""
    cursor = conn.cursor()
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS risk_readability (
            company_id TEXT NOT NULL,
            risk_number INTEGER NOT NULL,
            readability_score REAL NOT NULL,
            PRIMARY KEY (company_id, risk_number)
        )
        """
    )
    # Also attempt adding column to scored_risks if missing
    try:
        cursor.execute("ALTER TABLE scored_risks ADD COLUMN readability_score REAL")
    except sqlite3.OperationalError:
        pass  # Column already exists
    conn.commit()


def calculate_readability_scores(conn: sqlite3.Connection) -> pd.DataFrame:
    """Calculates Flesch Reading Ease score for all 232 risk items."""
    cursor = conn.cursor()
    cursor.execute("SELECT company_id, risk_number, risk_text, category, score FROM scored_risks ORDER BY company_id, risk_number")
    rows = cursor.fetchall()

    scored_items = []
    cursor_insert = conn.cursor()

    for cid, rnum, rtext, cat, score in rows:
        # Calculate Flesch Reading Ease score (0-100 scale: lower = harder to read)
        fre_score = textstat.flesch_reading_ease(rtext)
        
        scored_items.append({
            "company_id": cid,
            "risk_number": rnum,
            "category": cat,
            "score": score,
            "readability_score": fre_score,
            "risk_text": rtext
        })

        cursor_insert.execute(
            """
            INSERT OR REPLACE INTO risk_readability (company_id, risk_number, readability_score)
            VALUES (?, ?, ?)
            """,
            (cid, rnum, fre_score),
        )
        cursor_insert.execute(
            """
            UPDATE scored_risks SET readability_score = ? WHERE LOWER(company_id) = ? AND risk_number = ?
            """,
            (fre_score, cid.lower(), rnum),
        )

    conn.commit()
    return pd.DataFrame(scored_items)


def run_correlation_analysis(df: pd.DataFrame) -> pd.DataFrame:
    """Computes Spearman Rank Correlation between severity score and readability score."""
    report_rows = []

    companies = sorted(df["company_id"].unique().tolist())
    all_groups = companies + ["combined_all"]

    for group in all_groups:
        if group == "combined_all":
            subset = df
            cname = "combined_all"
        else:
            subset = df[df["company_id"] == group]
            cname = group

        sample_size = len(subset)
        if sample_size < 3:
            continue

        corr, p_value = spearmanr(subset["score"], subset["readability_score"])
        corr = round(float(corr), 4)
        p_val = round(float(p_value), 4)

        if corr < 0 and p_val < 0.05:
            interp = "significant negative correlation — supports obfuscation hypothesis"
        elif corr < 0:
            interp = f"slight negative correlation (directionally supports hypothesis, but not statistically significant at p={p_val})"
        elif corr > 0 and p_val < 0.05:
            interp = "significant positive correlation — contradicts obfuscation hypothesis"
        else:
            interp = "no significant correlation"

        report_rows.append({
            "company_id": cname,
            "spearman_correlation": corr,
            "p_value": p_val,
            "sample_size": sample_size,
            "interpretation": interp
        })

    report_df = pd.DataFrame(report_rows)
    report_df.to_csv(OBFUSCATION_REPORT_CSV, index=False)
    return report_df


def identify_outliers(df: pd.DataFrame) -> pd.DataFrame:
    """Flags top 5 severe risks (score >= 4) with lowest readability scores per company."""
    outlier_rows = []

    for cid in sorted(df["company_id"].unique().tolist()):
        c_subset = df[(df["company_id"] == cid) & (df["score"] >= 4)]
        # Sort by readability score ascending (lowest/hardest to read first)
        c_sorted = c_subset.sort_values(by="readability_score", ascending=True).head(5)

        for _, row in c_sorted.iterrows():
            snippet = row["risk_text"][:220] + "..." if len(row["risk_text"]) > 220 else row["risk_text"]
            outlier_rows.append({
                "company_id": cid,
                "risk_number": int(row["risk_number"]),
                "category": row["category"],
                "score": int(row["score"]),
                "readability_score": round(float(row["readability_score"]), 2),
                "risk_snippet": snippet
            })

    outliers_df = pd.DataFrame(outlier_rows)
    outliers_df.to_csv(OBFUSCATION_OUTLIERS_CSV, index=False)
    return outliers_df


def main():
    print("=" * 90)
    print("🧪 OBFUSCATION HYPOTHESIS TEST PIPELINE (DETERMINISTIC READABILITY ANALYSIS)")
    print("Metric: Flesch Reading Ease Score (Lower score = harder to read / dense legal prose)")
    print("Correlation: Spearman Rank Correlation (Severity Score vs Readability Score)")
    print("=" * 90 + "\n")

    if not SCORED_RISKS_DB.exists():
        raise FileNotFoundError(f"Database {SCORED_RISKS_DB} not found. Run database population script first.")

    conn = sqlite3.connect(SCORED_RISKS_DB)
    init_readability_db(conn)

    # 1. Compute Readability Scores
    df = calculate_readability_scores(conn)
    conn.close()

    print(f"✅ Computed Flesch Reading Ease scores for all {len(df)} risk items across {df['company_id'].nunique()} companies.")
    print(f"   Stored scores into SQLite table `risk_readability` inside {SCORED_RISKS_DB.name}.\n")

    # 2. Run Correlation Analysis
    report_df = run_correlation_analysis(df)

    # 3. Identify Outliers
    outliers_df = identify_outliers(df)

    # PRINT SUMMARY OUTPUT REQUIRED BY USER
    print("=" * 90)
    print("📊 1. SPEARMAN CORRELATION TEST RESULTS (data/obfuscation_report.csv):")
    print("=" * 90)
    print(report_df.to_markdown(index=False))

    print("\n\n🚩 2. FLAGGED OUTLIER EXAMPLES (Top 5 Severe & Hardest-to-Read Risks per Company):")
    print("=" * 90)
    for cid in sorted(outliers_df["company_id"].unique().tolist()):
        c_outliers = outliers_df[outliers_df["company_id"] == cid]
        print(f"\n--- [{cid.upper()}] TOP {len(c_outliers)} OBFUSCATED RISK OUTLIERS ---")
        for _, r in c_outliers.iterrows():
            print(f"  • Risk #{r['risk_number']} | Cat: {r['category']} | Severity: {r['score']}/5 | Readability Score: {r['readability_score']}")
            print(f"    Snippet: \"{r['risk_snippet']}\"\n")


    print("=" * 90)
    print(f"Report CSV Saved   : {OBFUSCATION_REPORT_CSV.resolve()}")
    print(f"Outliers CSV Saved : {OBFUSCATION_OUTLIERS_CSV.resolve()}")
    print("=" * 90)


if __name__ == "__main__":
    main()
