"""
Script 01: Extract Risk Factors section from DRHP PDFs using PyMuPDF (fitz)
and regex split into individual risk items.

Output: data/risks_raw.csv (company_id, risk_number, risk_text)
"""

from scripts.extract_risks import main

if __name__ == "__main__":
    main()
