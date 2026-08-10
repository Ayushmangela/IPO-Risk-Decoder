"""
Script 01: Extract Risk Factors section from DRHP PDFs using PyMuPDF (fitz)
and regex split into individual risk items.

Per GEMINI.md pipeline specifications:
1. Locate Risk Factors section via ToC / page-by-page header scanning.
2. Extract page range using PyMuPDF (fitz).
3. Regex-split into individual numbered risk items.
4. Output to data/risks_raw.csv (company_id, risk_number, risk_text).
"""

import os
import re
import sys
from pathlib import Path
import pandas as pd
import pymupdf as fitz

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
PDF_DIR = DATA_DIR / "pdfs"
OUTPUT_CSV = DATA_DIR / "risks_raw.csv"

# Sub-header titles that may appear at the end of a risk item paragraph right before section resets
SUB_HEADER_TRAILING_REGEX = r"\s*(?:External Risk Factors|External Risks|Risks Related to the Offer|Risks Relating to the Offer|Risks Relating to the Equity Shares and this Offer|Risks Relating to the Equity Shares|Internal Risk Factors|Internal Risks)[\s\:\–\—\-]*$"


def locate_risk_factors_pages(doc: fitz.Document, filename: str):
    """
    Step 1: Locate the Risk Factors section start and end page indices.
    - Tries Table of Contents (ToC) on pages 1-15 first to find reported printed page range.
    - Scans page-by-page headers for 'SECTION II' / 'RISK FACTORS' and 'SECTION III' / 'INTRODUCTION'.
    - Returns (start_pdf_index, end_pdf_index, toc_start_page, toc_end_page).
    """
    toc_start_page = None
    toc_end_page = None

    # 1. Search ToC on pages 0..15
    for p in range(min(15, len(doc))):
        text = doc[p].get_text()
        if "TABLE OF CONTENTS" in text.upper() or "INDEX" in text.upper():
            m_start = re.search(r'SECTION\s+II[^\n\d]*RISK\s+FACTORS[^\d]*(\d{1,4})', text, re.IGNORECASE)
            if not m_start:
                m_start = re.search(r'RISK\s+FACTORS[^\d]*(\d{1,4})', text, re.IGNORECASE)
            if m_start:
                toc_start_page = int(m_start.group(1))

            m_end = re.search(r'SECTION\s+III[^\n\d]*INTRODUCTION[^\d]*(\d{1,4})', text, re.IGNORECASE)
            if not m_end:
                m_end = re.search(r'INTRODUCTION[^\d]*(\d{1,4})', text, re.IGNORECASE)
            if m_end:
                toc_end_page = int(m_end.group(1))
            break

    # 2. Page-by-page header scanning for exact PDF page bounds
    start_idx = None
    end_idx = None

    for p in range(len(doc)):
        text = doc[p].get_text()
        # Skip ToC page itself to avoid false match on ToC entries
        if "TABLE OF CONTENTS" in text.upper():
            continue

        lines = [l.strip() for l in text.split("\n") if l.strip()]
        for l in lines[:10]:  # check top 10 lines of page
            clean_l = re.sub(r'[\:\–\—\-\s]+', ' ', l).strip().upper()
            if clean_l in ["SECTION II RISK FACTORS", "RISK FACTORS"]:
                if start_idx is None:
                    start_idx = p
                    break
            elif start_idx is not None and clean_l in ["SECTION III INTRODUCTION", "INTRODUCTION", "SECTION III"]:
                end_idx = p
                break

        if end_idx is not None:
            break

    # Fallback search if exact headers were slightly variant
    if start_idx is None and toc_start_page:
        search_start = max(0, toc_start_page - 10)
        search_end = min(len(doc), toc_start_page + 30)
        for p in range(search_start, search_end):
            text = doc[p].get_text()
            if "RISK FACTORS" in text.upper() and "TABLE OF CONTENTS" not in text.upper():
                lines = [l.strip() for l in text.split("\n") if l.strip()]
                for l in lines[:8]:
                    if "RISK" in l.upper():
                        start_idx = p
                        break
            if start_idx is not None:
                break

    if end_idx is None and start_idx is not None:
        search_end_start = start_idx + 10
        search_end_max = min(len(doc), start_idx + 100)
        for p in range(search_end_start, search_end_max):
            text = doc[p].get_text()
            lines = [l.strip() for l in text.split("\n") if l.strip()]
            for l in lines[:8]:
                if "SECTION III" in l.upper() or "INTRODUCTION" in l.upper():
                    end_idx = p
                    break
            if end_idx is not None:
                break

    return start_idx, end_idx, toc_start_page, toc_end_page


def extract_risk_items_from_pdf(pdf_path: Path, company_id: str):
    """
    Step 2: Extract text from located page range and regex-split into risk items.
    Returns list of dicts: [{'company_id': company_id, 'risk_number': N, 'risk_text': text}, ...]
    """
    doc = fitz.open(pdf_path)
    start_idx, end_idx, toc_start, toc_end = locate_risk_factors_pages(doc, pdf_path.name)

    if start_idx is None or end_idx is None:
        print(f"❌ Could not locate Risk Factors page bounds for {pdf_path.name}")
        return []

    # Print page range for sanity check
    print(f"📄 [{company_id.upper()}] Risk Factors Page Range Detected:")
    print(f"   - PDF Page Range (1-indexed): Page {start_idx + 1} to Page {end_idx} (Total {end_idx - start_idx} pages)")
    if toc_start:
        print(f"   - ToC Listed Printed Pages : Page {toc_start} to Page {toc_end if toc_end else 'N/A'}")
    else:
        print(f"   - ToC Listed Printed Pages : Not found (Page-by-page header scan fallback used)")

    # Extract text lines only from the located page range
    cleaned_lines = []
    for p in range(start_idx, end_idx):
        text = doc[p].get_text("text")
        for l in text.split("\n"):
            s = l.strip()
            # Omit standalone header/footer page numbers (1-3 digits alone on line)
            if s.isdigit() and len(s) <= 3:
                continue
            cleaned_lines.append(s)

    # Regex line-parser for numbered risk factors (1., 2., 3...) with sub-section reset support
    risks = []
    current_num = 0
    current_text_lines = []
    global_risk_no = 0

    i = 0
    while i < len(cleaned_lines):
        line = cleaned_lines[i]
        m = re.match(r'^(\d{1,3})\.\s*(.*)', line)
        if m:
            num = int(m.group(1))
            rest = m.group(2).strip()

            is_new_risk = False
            # Check if this starts a valid new risk factor item (either resets to 1 for sub-sections or increments)
            if num == 1 or num == current_num + 1 or (1 < num < current_num + 3):
                if rest == "" or re.match(r'^[A-Z\"“\'‘\[]', rest):
                    is_new_risk = True

            if is_new_risk:
                if current_text_lines:
                    global_risk_no += 1
                    risk_text = " ".join(" ".join(current_text_lines).split())
                    # Clean trailing sub-header titles if present
                    risk_text = re.sub(SUB_HEADER_TRAILING_REGEX, "", risk_text, flags=re.IGNORECASE).strip()
                    if len(risk_text) > 30:
                        risks.append({
                            "company_id": company_id,
                            "risk_number": global_risk_no,
                            "risk_text": risk_text
                        })
                current_num = num
                current_text_lines = [rest] if rest else []
                i += 1
                continue

        if current_num > 0:
            current_text_lines.append(line)
        i += 1

    if current_text_lines and current_num > 0:
        global_risk_no += 1
        risk_text = " ".join(" ".join(current_text_lines).split())
        risk_text = re.sub(SUB_HEADER_TRAILING_REGEX, "", risk_text, flags=re.IGNORECASE).strip()
        if len(risk_text) > 30:
            risks.append({
                "company_id": company_id,
                "risk_number": global_risk_no,
                "risk_text": risk_text
            })

    print(f"   - Total Extracted Risk Items: {len(risks)}")
    print("-" * 70)
    return risks


def main():
    if not PDF_DIR.exists():
        print(f"Error: Directory {PDF_DIR} does not exist.")
        sys.exit(1)

    pdf_files = sorted([f for f in PDF_DIR.glob("*.pdf")])
    if not pdf_files:
        print(f"No PDF files found in {PDF_DIR}.")
        sys.exit(1)

    print("=" * 70)
    print(f"🚀 IPO Prospectus Risk Factors Extractor")
    print(f"Processing {len(pdf_files)} DRHP PDF files in {PDF_DIR}...")
    print("=" * 70 + "\n")

    all_risks = []
    for pdf_path in pdf_files:
        company_id = pdf_path.stem.lower()
        company_risks = extract_risk_items_from_pdf(pdf_path, company_id)
        all_risks.extend(company_risks)

    if not all_risks:
        print("No risk items extracted.")
        sys.exit(1)

    # Save to /data/risks_raw.csv
    df = pd.DataFrame(all_risks)
    df.to_csv(OUTPUT_CSV, index=False)
    print(f"\n✅ Saved {len(df)} extracted risk items across {df['company_id'].nunique()} companies to:")
    print(f"   {OUTPUT_CSV}\n")

    # Display 5 sample extracted rows per company for user sanity check
    print("=" * 70)
    print("🔍 SAMPLE EXTRACTED ROWS (5 per company)")
    print("=" * 70)

    for company_id in df['company_id'].unique():
        print(f"\n--- Company: [{company_id.upper()}] ---")
        sample_df = df[df['company_id'] == company_id].head(5)
        for _, row in sample_df.iterrows():
            preview = row['risk_text'][:110] + ("..." if len(row['risk_text']) > 110 else "")
            print(f"  Row {row['risk_number']}: {preview}")


if __name__ == "__main__":
    main()
