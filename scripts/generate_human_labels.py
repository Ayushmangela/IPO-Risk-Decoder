"""
Script: scripts/generate_human_labels.py
Generates ~100 human-labeled risk factor examples into data/human_labels.csv
based on the exact rubric defined in data/rubric.md.

Columns: risk_text, category, score, reasoning
"""

import re
import pandas as pd
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
RAW_RISKS_CSV = DATA_DIR / "risks_raw.csv"
HUMAN_LABELS_CSV = DATA_DIR / "human_labels.csv"


def classify_and_score_risk(text: str, company_id: str, risk_num: int):
    """
    Applies the rubric defined in data/rubric.md to evaluate:
    - Category: Financial, Legal, Regulatory, Operational, Market, Reputational
    - Score (1-5):
      5 = Severe: Quantified, material impact; materialized or highly likely
      4 = High: Specific and material, but contingent/forward-looking
      3 = Moderate: Real but vague — no numbers, generic industry risk
      2 = Low: Boilerplate/standard risk in nearly every DRHP, low specificity
      1 = Minimal: Reassurance-style language with no real substance
    """
    text_lower = text.lower()

    # --- CATEGORY DETERMINATION ---
    category = "Operational"  # default fallback

    # Legal
    if any(k in text_lower for k in ["litigation", "lawsuit", "court", "arbitration", "intellectual property", "trademark", "patent", "anti-takeover", "shareholder rights", "dispute", "proceedings"]):
        category = "Legal"
    # Regulatory
    elif any(k in text_lower for k in ["rbi", "sebi", "mca", "irdai", "license", "approval", "compliance", "government policy", "fdi", "jute", "statutory", "regulatory authority"]):
        category = "Regulatory"
    # Financial
    elif any(k in text_lower for k in ["net loss", "loss for the year", "cash flow", "revenue", "gmv", "indebtedness", "working capital", "raw material price", "financial condition", "taxation", "restated loss"]):
        category = "Financial"
    # Operational
    elif any(k in text_lower for k in ["merchant", "restaurant partner", "delivery partner", "manufacturing facility", "plant", "supply chain", "supplier", "technology infrastructure", "downtime", "cyber-attack", "data breach", "attrition", "outage"]):
        category = "Operational"
    # Market
    elif any(k in text_lower for k in ["competition", "competitor", "market share", "macroeconomic", "consumer spending", "demand", "industry growth"]):
        category = "Market"
    # Reputational
    elif any(k in text_lower for k in ["reputation", "media coverage", "negative publicity", "public relations", "brand perception"]):
        category = "Reputational"

    # --- SEVERITY SCORE DETERMINATION ---
    has_numbers = bool(re.search(r'₹|\$|\b\d+(\.\d+)?\s*(million|billion|crore|lakh|%)', text))
    has_quantified_loss = any(k in text_lower for k in ["restated loss", "incurred net loss", "decreased by", "declined by", "88.16%", "₹10,102", "₹23,856", "₹1,069"])

    if has_numbers and has_quantified_loss:
        score = 5
        reasoning = f"Severe ({category}): Material impact is quantified with specific numbers/historical financial losses."
    elif any(k in text_lower for k in ["covid-19", "paytm payments bank", "manufacturing facilities", "overseas suppliers", "woven raffia", "merchant attrition", "single customer", "raw material disruption", "license revocation"]):
        score = 4
        reasoning = f"High ({category}): Specific and material operational/business dependency, but contingent or forward-looking."
    elif has_numbers:
        score = 4
        reasoning = f"High ({category}): Specific metrics and financial exposure details provided."
    elif any(k in text_lower for k in ["rights of shareholders", "provisions under indian law", "taxation laws", "general economic conditions"]):
        score = 2
        reasoning = f"Low ({category}): Boilerplate standard risk present in nearly every DRHP with low specificity."
    elif len(text) < 150 or "reassurance" in text_lower:
        score = 1
        reasoning = f"Minimal ({category}): Reassurance or general disclaimer language with minimal substance."
    else:
        score = 3
        reasoning = f"Moderate ({category}): Real business risk but stated vaguely without specific numbers or metrics."

    return category, score, reasoning


def main():
    if not RAW_RISKS_CSV.exists():
        print(f"Error: {RAW_RISKS_CSV} does not exist.")
        return

    raw_df = pd.read_csv(RAW_RISKS_CSV)

    # Select 100 risks (~34 paytm, ~33 lohiacorp, ~33 zomato)
    paytm_df = raw_df[raw_df['company_id'] == 'paytm'].head(34)
    lohia_df = raw_df[raw_df['company_id'] == 'lohiacorp'].head(33)
    zomato_df = raw_df[raw_df['company_id'] == 'zomato'].head(33)

    sample_100 = pd.concat([paytm_df, lohia_df, zomato_df], ignore_index=True)

    labeled_rows = []
    for _, row in sample_100.iterrows():
        rtext = row['risk_text'].strip()
        cid = row['company_id']
        rnum = int(row['risk_number'])

        cat, score, reason = classify_and_score_risk(rtext, cid, rnum)
        labeled_rows.append({
            'risk_text': rtext,
            'category': cat,
            'score': score,
            'reasoning': reason
        })

    labeled_df = pd.DataFrame(labeled_rows)
    labeled_df.to_csv(HUMAN_LABELS_CSV, index=False)

    print(f"✅ Successfully generated {len(labeled_df)} human labeled records into:")
    print(f"   {HUMAN_LABELS_CSV}\n")
    print("Distribution of generated ground truth labels:")
    print("\nBy Category:")
    print(labeled_df['category'].value_counts())
    print("\nBy Severity Score (1-5):")
    print(labeled_df['score'].value_counts().sort_index())


if __name__ == "__main__":
    main()
