"""
Script 05: Populate SQLite Database with LLM Scored Risks

Per GEMINI.md & User Specs:
- Reads 232 raw risk items from data/risks_raw.csv across Paytm, Lohia Corp, and Zomato.
- Executes LLM pipeline using LLM_BACKEND=gemini.
- Stores output in SQLite database at data/scored_risks.db (schema: company_id, risk_number, risk_text, category, score, reasoning).
- Logs and reports any API failures, rate limit retries, or invalid JSON events.
"""

import importlib
import json
import os
import sqlite3
import sys
import time
from pathlib import Path
from dotenv import load_dotenv
import pandas as pd

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
RISKS_RAW_CSV = DATA_DIR / "risks_raw.csv"
SCORED_RISKS_DB = DATA_DIR / "scored_risks.db"
COMPANIES_CSV = DATA_DIR / "companies.csv"

load_dotenv(BASE_DIR / ".env")
load_dotenv(BASE_DIR / "backend" / ".env")

sys.path.insert(0, str(BASE_DIR))

# Dynamic import for pipeline module starting with digits
llm_pipeline = importlib.import_module("scripts.03_llm_pipeline")
process_risk_item = llm_pipeline.process_risk_item_single_pass


def init_database(db_path: Path):
    """Initializes SQLite database and creates scored_risks table."""
    conn = sqlite3.connect(db_path)
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
    conn.commit()
    return conn


def run_batch_scoring(backend: str = "gemini"):
    if not RISKS_RAW_CSV.exists():
        print(f"Error: {RISKS_RAW_CSV} not found.")
        sys.exit(1)

    raw_df = pd.read_csv(RISKS_RAW_CSV)
    print("=" * 80)
    print(f"🚀 Starting Batch LLM Risk Factor Scoring ({len(raw_df)} Total Risks)")
    print(f"Target Database: {SCORED_RISKS_DB.resolve()}")
    print(f"Active Backend : [{backend.upper()}]")
    print("=" * 80 + "\n")

    conn = init_database(SCORED_RISKS_DB)
    cursor = conn.cursor()

    success_count = 0
    issues_log = []
    start_time = time.time()

    for idx, row in raw_df.iterrows():
        cid = str(row["company_id"]).strip()
        rnum = int(row["risk_number"])
        rtext = str(row["risk_text"]).strip()

        # Respect Gemini rate limit window (15 RPM)
        if backend == "gemini":
            time.sleep(1.5)

        if (idx + 1) % 10 == 0 or idx == 0 or (idx + 1) == len(raw_df):
            elapsed = time.time() - start_time
            print(f"⌛ [{idx+1}/{len(raw_df)}] Scoring {cid.upper()} Risk #{rnum} (Elapsed: {elapsed:.1f}s)...")

        try:
            res = process_risk_item(rtext, backend=backend)
            cat = res["category"]
            score = res["score"]
            reason = res["reasoning"]

            # Store in SQLite database
            cursor.execute(
                """
                INSERT OR REPLACE INTO scored_risks 
                (company_id, risk_number, risk_text, category, score, reasoning)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (cid, rnum, rtext, cat, score, reason),
            )
            conn.commit()
            success_count += 1

        except Exception as e:
            err_msg = f"Row #{idx+1} ({cid} #{rnum}) Exception: {str(e)}"
            print(f"❌ {err_msg}")
            issues_log.append({
                "company_id": cid,
                "risk_number": rnum,
                "error": str(e),
                "risk_snippet": rtext[:100],
            })

    conn.close()
    total_time = time.time() - start_time

    # Verification and Analytics Report
    conn_verify = sqlite3.connect(SCORED_RISKS_DB)
    scored_df = pd.read_sql_query("SELECT * FROM scored_risks", conn_verify)
    conn_verify.close()

    print("\n" + "=" * 80)
    print("✅ BATCH SCORING COMPLETE")
    print("=" * 80)
    print(f"Total Risks Processed  : {success_count}/{len(raw_df)}")
    print(f"Total Database Rows    : {len(scored_df)}")
    print(f"Total Execution Time   : {total_time/60:.2f} minutes")
    print(f"Logged Issues/Failures : {len(issues_log)}\n")

    print("📊 Breakdown by Company:")
    print(scored_df["company_id"].value_counts().to_string())
    print("\n🏷️ Breakdown by Category:")
    print(scored_df["category"].value_counts().to_string())
    print("\n⭐ Breakdown by Severity Score (1-5):")
    print(scored_df["score"].value_counts().to_string())
    print("=" * 80 + "\n")

    if issues_log:
        print("⚠️ LOGGED ISSUES SUMMARY:")
        for issue in issues_log:
            print(f"  - Company: {issue['company_id']} | Risk #{issue['risk_number']} | Error: {issue['error']}")
    else:
        print("🎉 ZERO API failures or rate-limit dropouts! All 232 rows successfully scored and saved.")


if __name__ == "__main__":
    backend_choice = os.getenv("LLM_BACKEND", "gemini")
    run_batch_scoring(backend=backend_choice)
