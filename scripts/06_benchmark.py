"""
Script 06: Offline Peer Benchmarking Analytics (Pandas Only)

Per GEMINI.md & User Requirements:
- NO LLM calls in this step.
- Reads scored risks from data/scored_risks.db joined with data/companies.csv.
- Computes per company, per category risk counts and percentages.
- Computes overall cross-company benchmark average and net differences.
- Explicitly flags the single-company-per-sector limitation for methodology auditability.
- Saves results to data/peer_stats.csv.
"""

import sqlite3
import sys
from pathlib import Path
import pandas as pd

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
SCORED_RISKS_DB = DATA_DIR / "scored_risks.db"
COMPANIES_CSV = DATA_DIR / "companies.csv"
PEER_STATS_CSV = DATA_DIR / "peer_stats.csv"

ALL_CATEGORIES = [
    "Financial",
    "Legal",
    "Regulatory",
    "Operational",
    "Market",
    "Reputational",
]


def run_benchmarking():
    if not SCORED_RISKS_DB.exists():
        print(f"Error: {SCORED_RISKS_DB} not found.")
        sys.exit(1)
    if not COMPANIES_CSV.exists():
        print(f"Error: {COMPANIES_CSV} not found.")
        sys.exit(1)

    # 1. Ingest Data from SQLite and CSV
    conn = sqlite3.connect(SCORED_RISKS_DB)
    risks_df = pd.read_sql_query("SELECT * FROM scored_risks", conn)
    conn.close()

    companies_df = pd.read_csv(COMPANIES_CSV)
    df = risks_df.merge(companies_df, on="company_id", how="left")

    print("=" * 90)
    print("📈 IPO RISK FACTORS — OFFLINE PEER BENCHMARKING ENGINE")
    print("=" * 90)
    print(f"Total Risks Loaded : {len(df)}")
    print(f"Total Companies    : {df['company_id'].nunique()} ({', '.join(df['company_id'].unique())})")
    print("=" * 90 + "\n")

    # 2. Compute Overall Cross-Company Category Averages
    overall_total = len(df)
    overall_category_counts = df["category"].value_counts().to_dict()
    all_company_avg_pct = {
        cat: round((overall_category_counts.get(cat, 0) / overall_total) * 100.0, 2)
        for cat in ALL_CATEGORIES
    }

    # 3. Compute Per-Company Per-Category Metrics
    benchmark_rows = []
    company_ids = df["company_id"].unique()

    for cid in company_ids:
        c_df = df[df["company_id"] == cid]
        c_total = len(c_df)
        c_counts = c_df["category"].value_counts().to_dict()

        for cat in ALL_CATEGORIES:
            cnt = c_counts.get(cat, 0)
            c_pct = round((cnt / c_total) * 100.0, 2)
            avg_pct = all_company_avg_pct[cat]
            diff = round(c_pct - avg_pct, 2)

            benchmark_rows.append({
                "company_id": cid,
                "category": cat,
                "count": cnt,
                "company_pct": c_pct,
                "all_company_avg_pct": avg_pct,
                "difference": diff,
            })

    stats_df = pd.DataFrame(benchmark_rows)
    stats_df.to_csv(PEER_STATS_CSV, index=False)

    # 4. Display Results
    print("=" * 90)
    print("📊 BENCHMARK METRICS SUMMARY (data/peer_stats.csv)")
    print("=" * 90)
    pivot_pct = stats_df.pivot(index="company_id", columns="category", values="company_pct")
    pivot_diff = stats_df.pivot(index="company_id", columns="category", values="difference")

    print("\n1. Company Category Exposure (% of Company Total Risks):")
    print(pivot_pct.to_markdown())

    print("\n2. Net Difference vs Dataset Average (% Points):")
    print(pivot_diff.to_markdown())

    print("\n" + "=" * 90)
    print("⚠️ METHODOLOGY & SECTOR COMPARISON LIMITATION NOTICE")
    print("=" * 90)
    print("• Note: GEMINI.md dictates that peer comparisons should occur within the same sector group.")
    print("• Current Dataset Limitation: Each company represents a distinct sector:")
    for _, crow in companies_df.iterrows():
        print(f"   - {crow['company_id'].upper()}: {crow['name']} ({crow['sector']})")
    print("• Benchmark Mode: Currently treating all 3 companies as a 'Cross-Sector Baseline'.")
    print("• Production Requirement: When dataset expands to multiple companies per sector,")
    print("  peer averages MUST be grouped strictly by sector (e.g., Fintech vs Fintech peers).")
    print("=" * 90 + "\n")

    print(f"✅ Benchmark data successfully computed and saved to:\n   {PEER_STATS_CSV.resolve()}\n")
    return stats_df


if __name__ == "__main__":
    run_benchmarking()
