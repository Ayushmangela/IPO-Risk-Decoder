"""
Script 14: Fetch Active/Upcoming Mainboard IPOs (DRHP Filing Tracker)

Discovery-only. Does NOT trigger any LLM/processing — just refreshes the
cached snapshot at data/active_ipos.json so the frontend can browse it.

The chittorgarh.com report page is a client-side-rendered Next.js app (the
initial HTML literally contains "Total Records: 0" and an empty loading
skeleton). The real data comes from the JSON API the page's own JS calls:

    https://webnodejs.chittorgarh.com/cloud/report/data-read/158/1/8/2026/2026-27/0/mainboard/0

This script calls that endpoint directly with a normal browser User-Agent.
Per project convention: if the response shape can't be parsed cleanly, this
fails loudly (raises / non-zero exit) rather than writing an empty or
partial file.
"""

import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import requests

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
OUTPUT_JSON = DATA_DIR / "active_ipos.json"

REPORT_PAGE_URL = "https://www.chittorgarh.com/report/upcoming-ipos-drhp-filed/158/mainboard/"
DATA_API_URL = (
    "https://webnodejs.chittorgarh.com/cloud/report/data-read/158/1/8/2026/2026-27/0/mainboard/0"
)
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Referer": REPORT_PAGE_URL,
    "Accept": "application/json",
}
REQUIRED_ROW_FIELDS = ["Company", "DRHP Filing Date"]


def _strip_html(raw: str) -> str:
    """Removes embedded HTML (icons, links) and collapses whitespace."""
    if not raw:
        return ""
    text = re.sub(r"<[^>]+>", "", raw)
    return re.sub(r"\s+", " ", text).strip()


def _extract_link_text(raw: str) -> str:
    """Pulls the visible text out of an <a>...</a> wrapper, else strips tags."""
    if not raw:
        return ""
    m = re.search(r">([^<]+)<", raw)
    if m:
        return m.group(1).strip()
    return _strip_html(raw)


def fetch_active_ipos() -> dict:
    """Fetches, validates, and normalizes the active/upcoming mainboard IPO list.

    Raises RuntimeError/ValueError with a clear message if the response can't
    be parsed as expected -- never returns a silently empty/partial result.
    """
    try:
        resp = requests.get(DATA_API_URL, headers=HEADERS, timeout=15)
    except requests.exceptions.RequestException as exc:
        raise RuntimeError(
            f"Could not reach chittorgarh.com's IPO data API ({DATA_API_URL}): {exc}"
        ) from exc

    if resp.status_code != 200:
        raise RuntimeError(
            f"chittorgarh.com IPO data API returned HTTP {resp.status_code} "
            f"(expected 200). The site may be blocking automated requests or the "
            f"endpoint has changed. Body preview: {resp.text[:300]!r}"
        )

    try:
        payload = resp.json()
    except ValueError as exc:
        raise RuntimeError(
            f"chittorgarh.com IPO data API did not return valid JSON: {exc}. "
            f"Body preview: {resp.text[:300]!r}"
        ) from exc

    if "reportTableData" not in payload:
        raise RuntimeError(
            "chittorgarh.com IPO data API response is missing the expected "
            "'reportTableData' key -- the API shape has likely changed. "
            f"Top-level keys received: {list(payload.keys())}"
        )

    raw_rows = payload["reportTableData"]
    if not isinstance(raw_rows, list) or len(raw_rows) == 0:
        raise RuntimeError(
            "chittorgarh.com IPO data API returned zero rows -- refusing to write "
            "an empty active_ipos.json. Either the site has no listings right now "
            "(unlikely) or the response shape has changed."
        )

    ipos = []
    for i, row in enumerate(raw_rows):
        missing = [f for f in REQUIRED_ROW_FIELDS if not row.get(f)]
        if missing:
            raise RuntimeError(
                f"Row {i} of chittorgarh.com's IPO data is missing required "
                f"field(s) {missing} -- the table structure may have changed. "
                f"Row preview: {row}"
            )

        company_raw = row.get("Company", "")
        is_confidential = "fa-lock" in company_raw or "Confidential Filing" in company_raw
        company_name = _strip_html(company_raw)

        sebi_approval_date = (row.get("SEBI Approval Date") or "").strip()
        filing_status = "SEBI Approved" if sebi_approval_date else "DRHP Filed"

        slug = row.get("~URLRewrite_Folder_Name") or ""
        listing_id = row.get("~id")
        source_url = (
            f"https://www.chittorgarh.com/ipo/{slug}/{listing_id}/"
            if slug and listing_id
            else None
        )

        ipos.append(
            {
                "id": listing_id,
                "company_name": company_name,
                "is_confidential_filing": is_confidential,
                "filing_status": filing_status,
                "drhp_filing_date": (row.get("DRHP Filing Date") or "").strip(),
                "sebi_approval_date": sebi_approval_date,
                "offer_type": (row.get("Offer Type") or "").strip(),
                "sale_type": (row.get("Sale Type") or "").strip(),
                "estimated_issue_size": _strip_html(row.get("Estimated Issue Size") or ""),
                "exchange": (row.get("Exchange") or "").strip(),
                "lead_manager": _extract_link_text(row.get("Primary Lead Manager") or ""),
                "industry": (row.get("Industry") or "").strip(),
                "source_url": source_url,
            }
        )

    return {
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "source": DATA_API_URL,
        "count": len(ipos),
        "ipos": ipos,
    }


def main():
    print("=" * 70)
    print("IPO Prospectus Risk Decoder - Active IPO Fetcher")
    print(f"Source: {DATA_API_URL}")
    print("=" * 70)

    result = fetch_active_ipos()

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_JSON, "w") as f:
        json.dump(result, f, indent=2)

    print(f"\n✅ Fetched {result['count']} active/upcoming mainboard IPOs.")
    print(f"   Saved to: {OUTPUT_JSON}\n")

    print("Sample rows:")
    for ipo in result["ipos"][:5]:
        print(
            f"  - {ipo['company_name']} | {ipo['filing_status']} | "
            f"Filed {ipo['drhp_filing_date']} | {ipo['industry']}"
        )
    print("=" * 70)
    return result


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"\n❌ Failed to fetch active IPO list: {exc}", file=sys.stderr)
        sys.exit(1)
