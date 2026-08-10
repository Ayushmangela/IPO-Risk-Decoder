"""
Script 02: Human Labeling Helper CLI for IPO Prospectus Risk Factors.

Data Entry Helper for Phase 2:
- Reads data/risks_raw.csv.
- Displays one risk item at a time with category shortcuts & severity rubric options.
- Appends typed inputs to data/human_labels.csv (risk_text, category, score, reasoning).
- Skips already-labeled risks so you can pause/resume anytime.
- Type 'q' at any prompt to save and quit.

Note: No automated LLM classification is performed in this script.
"""

import csv
import sys
import textwrap
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
RAW_RISKS_CSV = DATA_DIR / "risks_raw.csv"
HUMAN_LABELS_CSV = DATA_DIR / "human_labels.csv"

CATEGORIES = [
    "Financial",
    "Legal",
    "Regulatory",
    "Operational",
    "Market",
    "Reputational",
]

RUBRIC_SCORES = {
    1: "Minimal: Reassurance-style language with no real substance",
    2: "Low: Boilerplate/standard risk present in nearly every DRHP",
    3: "Moderate: Real but vague — no numbers, generic industry risk",
    4: "High: Specific and material, but contingent/forward-looking",
    5: "Severe: Quantified, material impact; materialized or highly likely",
}


def load_labeled_texts():
    """Load set of risk_text entries already present in human_labels.csv."""
    labeled_set = set()
    if HUMAN_LABELS_CSV.exists():
        with open(HUMAN_LABELS_CSV, mode="r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                if row.get("risk_text"):
                    labeled_set.add(row["risk_text"].strip())
    return labeled_set


def ensure_csv_headers():
    """Ensure human_labels.csv exists with correct column headers."""
    if not HUMAN_LABELS_CSV.exists() or HUMAN_LABELS_CSV.stat().st_size == 0:
        with open(HUMAN_LABELS_CSV, mode="w", encoding="utf-8", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(["risk_text", "category", "score", "reasoning"])


def append_label(risk_text, category, score, reasoning):
    """Append a single labeled row to human_labels.csv."""
    ensure_csv_headers()
    with open(HUMAN_LABELS_CSV, mode="a", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow([risk_text, category, score, reasoning])


def main():
    if not RAW_RISKS_CSV.exists():
        print(f"Error: Raw risks CSV not found at {RAW_RISKS_CSV}")
        sys.exit(1)

    ensure_csv_headers()
    already_labeled = load_labeled_texts()

    # Load raw risks
    raw_risks = []
    with open(RAW_RISKS_CSV, mode="r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            raw_risks.append(row)

    unlabeled_risks = [r for r in raw_risks if r["risk_text"].strip() not in already_labeled]

    print("=" * 80)
    print("🏷️  IPO Prospectus Risk Factors — Human Labeling CLI Helper")
    print("=" * 80)
    print(f"Total raw risks in dataset : {len(raw_risks)}")
    print(f"Already labeled risks      : {len(already_labeled)}")
    print(f"Remaining to label        : {len(unlabeled_risks)}")
    print("=" * 80)
    print("Commands at any prompt:")
    print("  [q] Save and quit")
    print("  [s] Skip current risk")
    print("=" * 80 + "\n")

    if not unlabeled_risks:
        print("🎉 All risks in data/risks_raw.csv have already been labeled!")
        return

    labeled_count = len(already_labeled)

    for i, item in enumerate(unlabeled_risks, start=1):
        company_id = item.get("company_id", "unknown").upper()
        risk_num = item.get("risk_number", "?")
        risk_text = item.get("risk_text", "").strip()

        print("\n" + "#" * 80)
        print(f"📌 Item {i}/{len(unlabeled_risks)} | Company: [{company_id}] | Risk #{risk_num} | Total Labeled: {labeled_count}")
        print("#" * 80)
        print("\nTEXT:")
        wrapped_lines = textwrap.wrap(risk_text, width=78)
        for wline in wrapped_lines:
            print(f"  {wline}")
        print("\n" + "-" * 80)

        # 1. Select Category
        category = None
        while not category:
            print("Categories:")
            print("  [1] Financial   [2] Legal       [3] Regulatory")
            print("  [4] Operational [5] Market      [6] Reputational")
            cat_input = input("Select Category [1-6 or Name] (q=quit, s=skip): ").strip()

            if cat_input.lower() == "q":
                print(f"\n👋 Quitting helper. Progress saved ({labeled_count} total labels in data/human_labels.csv).")
                sys.exit(0)
            elif cat_input.lower() == "s":
                print("Skipped item.")
                break

            if cat_input in ["1", "2", "3", "4", "5", "6"]:
                category = CATEGORIES[int(cat_input) - 1]
            else:
                # Match name ignoring case
                matched = [c for c in CATEGORIES if c.lower() == cat_input.lower()]
                if matched:
                    category = matched[0]
                else:
                    print("⚠️ Invalid category choice. Please enter 1-6 or a valid category name.\n")

        if not category:
            continue

        # 2. Select Score
        score = None
        while score is None:
            print("\nSeverity Score Rubric:")
            for val, desc in RUBRIC_SCORES.items():
                print(f"  [{val}] {desc}")
            score_input = input("Select Score [1-5] (q=quit, s=skip): ").strip()

            if score_input.lower() == "q":
                print(f"\n👋 Quitting helper. Progress saved ({labeled_count} total labels in data/human_labels.csv).")
                sys.exit(0)
            elif score_input.lower() == "s":
                print("Skipped item.")
                break

            if score_input in ["1", "2", "3", "4", "5"]:
                score = int(score_input)
            else:
                print("⚠️ Invalid score. Please enter an integer from 1 to 5.\n")

        if score is None:
            continue

        # 3. Enter Reasoning
        reasoning = None
        while not reasoning:
            reason_input = input("\nEnter one-line reasoning (q=quit, s=skip): ").strip()
            if reason_input.lower() == "q":
                print(f"\n👋 Quitting helper. Progress saved ({labeled_count} total labels in data/human_labels.csv).")
                sys.exit(0)
            elif reason_input.lower() == "s":
                print("Skipped item.")
                break
            elif reason_input:
                reasoning = " ".join(reason_input.split())

        if not reasoning:
            continue

        # Save record immediately
        append_label(risk_text, category, score, reasoning)
        labeled_count += 1
        print(f"\n✅ Saved record! (Category: {category} | Score: {score} | Reasoning: {reasoning})")

    print("\n" + "=" * 80)
    print(f"🎉 Labeling session completed! Total labeled items: {labeled_count}")
    print("=" * 80)


if __name__ == "__main__":
    main()
