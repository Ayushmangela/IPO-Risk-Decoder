"""
Script 04: LLM Pipeline Validation against Human Ground Truth (~100 items)

Per GEMINI.md specifications:
- Runs LLM pipeline ONLY on the 100 rows in data/human_labels.csv.
- Compares LLM category output vs human category (exact match %).
- Compares LLM score vs human score (% within ±1 point and exact match %).
- Verifies GEMINI.md validation thresholds (≥80% category match, ≥80% score within ±1).
- Outputs summary to stdout and writes detailed report to data/validation_report.md.
"""

import importlib
import os
import sys
from pathlib import Path
import pandas as pd

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
HUMAN_LABELS_CSV = DATA_DIR / "human_labels.csv"
REPORT_MD = DATA_DIR / "validation_report.md"

# Add project root to sys.path
sys.path.insert(0, str(BASE_DIR))

# Dynamic import for module starting with digits
llm_pipeline = importlib.import_module("scripts.03_llm_pipeline")
categorize_risk = llm_pipeline.categorize_risk
score_severity = llm_pipeline.score_severity
LLM_BACKEND = llm_pipeline.LLM_BACKEND


def run_validation(backend: str = LLM_BACKEND):
    if not HUMAN_LABELS_CSV.exists():
        print(f"Error: Ground truth file {HUMAN_LABELS_CSV} not found.")
        sys.exit(1)

    df = pd.read_csv(HUMAN_LABELS_CSV)
    print("=" * 80)
    print(f"📊 Running LLM Pipeline Validation on {len(df)} Ground-Truth Rows")
    print(f"Backend Engine: [{backend.upper()}]")
    print("=" * 80 + "\n")

    results = []
    for idx, row in df.iterrows():
        rtext = str(row["risk_text"]).strip()
        human_cat = str(row["category"]).strip().capitalize()
        human_score = int(row["score"])
        human_reason = str(row["reasoning"]).strip()

        # Run LLM pipeline
        cat_res = categorize_risk(rtext, backend=backend)
        llm_cat = cat_res["category"]

        score_res = score_severity(rtext, llm_cat, backend=backend)
        llm_score = score_res["score"]
        llm_reason = score_res["reasoning"]

        cat_match = (llm_cat == human_cat)
        score_diff = abs(llm_score - human_score)
        score_within_1 = (score_diff <= 1)

        results.append({
            "risk_text": rtext,
            "human_category": human_cat,
            "llm_category": llm_cat,
            "cat_match": cat_match,
            "human_score": human_score,
            "llm_score": llm_score,
            "score_diff": score_diff,
            "score_within_1": score_within_1,
            "human_reasoning": human_reason,
            "llm_reasoning": llm_reason,
        })

    res_df = pd.DataFrame(results)

    # 1. Category Metrics
    cat_match_pct = (res_df["cat_match"].sum() / len(res_df)) * 100.0
    cat_confusion = pd.crosstab(
        res_df["human_category"],
        res_df["llm_category"],
        rownames=["Actual (Human)"],
        colnames=["Predicted (LLM)"],
        margins=True,
    )

    # 2. Score Metrics
    score_exact_pct = ((res_df["score_diff"] == 0).sum() / len(res_df)) * 100.0
    score_within_1_pct = (res_df["score_within_1"].sum() / len(res_df)) * 100.0
    mae = res_df["score_diff"].mean()

    score_agreement = pd.crosstab(
        res_df["human_score"],
        res_df["llm_score"],
        rownames=["Actual Score"],
        colnames=["Predicted Score"],
        margins=True,
    )

    # Display stdout tables
    print("=" * 80)
    print("🎯 CATEGORY EVALUATION METRICS")
    print("=" * 80)
    print(f"Total Evaluated Items : {len(res_df)}")
    print(f"Category Exact Match  : {res_df['cat_match'].sum()}/{len(res_df)} ({cat_match_pct:.2f}%)")
    print(f"GEMINI.md Target      : ≥80.00%")
    print(f"Category Threshold Met: {'✅ YES' if cat_match_pct >= 80.0 else '❌ NO'}\n")
    print("Category Confusion Matrix (Actual vs Predicted):")
    print(cat_confusion)
    print("\n" + "=" * 80)
    print("⭐ SEVERITY SCORE EVALUATION METRICS")
    print("=" * 80)
    print(f"Exact Score Match %   : {score_exact_pct:.2f}%")
    print(f"Score Within ±1 Point : {res_df['score_within_1'].sum()}/{len(res_df)} ({score_within_1_pct:.2f}%)")
    print(f"Mean Absolute Error   : {mae:.3f} points")
    print(f"GEMINI.md Target      : ≥80.00% within ±1 point")
    print(f"Score Threshold Met   : {'✅ YES' if score_within_1_pct >= 80.0 else '❌ NO'}\n")
    print("Severity Score Agreement Table (Actual vs Predicted):")
    print(score_agreement)
    print("=" * 80 + "\n")

    # Generate Markdown Report
    report_content = f"""# LLM Pipeline Validation Report

- **Validation Date**: 2026-08-10
- **Evaluated Dataset**: Ground Truth [`data/human_labels.csv`](file://{HUMAN_LABELS_CSV.resolve()}) ({len(res_df)} items)
- **Backend Engine Evaluated**: `{backend.upper()}`

---

## 🎯 Summary Performance Metrics

| Metric | Measured Value | GEMINI.md Threshold | Status |
| :--- | :---: | :---: | :---: |
| **Category Exact Match** | **{cat_match_pct:.2f}%** ({res_df['cat_match'].sum()}/{len(res_df)}) | ≥80.00% | {'✅ PASSED' if cat_match_pct >= 80.0 else '❌ FAILED'} |
| **Severity Score Within ±1 Point** | **{score_within_1_pct:.2f}%** ({res_df['score_within_1'].sum()}/{len(res_df)}) | ≥80.00% | {'✅ PASSED' if score_within_1_pct >= 80.0 else '❌ FAILED'} |
| **Severity Exact Match** | **{score_exact_pct:.2f}%** | N/A | — |
| **Mean Absolute Error (MAE)** | **{mae:.3f} points** | N/A | — |

---

## 📊 Category Confusion Matrix

{cat_confusion.to_markdown()}

---

## ⭐ Severity Score Agreement Table

{score_agreement.to_markdown()}

---

## 💡 Validation Conclusion

{"### ✅ Pipeline Trusted across Full Dataset" if (cat_match_pct >= 80.0 and score_within_1_pct >= 80.0) else "### ⚠️ Model Performance under threshold - Gemini 2.5 Flash Fallback Triggered"}
- Category agreement achieved **{cat_match_pct:.2f}%** (Threshold: ≥80%).
- Severity scoring achieved **{score_within_1_pct:.2f}%** within ±1 score point (Threshold: ≥80%).
"""

    REPORT_MD.write_text(report_content, encoding="utf-8")
    print(f"✅ Full Validation Report generated and saved to:\n   {REPORT_MD.resolve()}\n")

    return {
        "cat_match_pct": cat_match_pct,
        "score_within_1_pct": score_within_1_pct,
        "mae": mae,
        "passed": (cat_match_pct >= 80.0 and score_within_1_pct >= 80.0),
    }


if __name__ == "__main__":
    run_validation()
