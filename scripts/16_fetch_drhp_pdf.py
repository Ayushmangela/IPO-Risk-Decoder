"""
Script 16: Resolve + Download the Actual DRHP PDF for an Active IPO

Given one row from data/active_ipos.json (produced by script 14), finds the
direct DRHP/RHP PDF link on the filing's chittorgarh.com detail page and
downloads it to data/pdfs/.

Manually verified against 6 real filings from data/active_ipos.json before
writing this (2026-08-12):
  - Tablespace Technologies Ltd.        -> nsearchives.nseindia.com/.../DRHP.pdf  (direct PDF, works)
  - Adroit Industries (India) Ltd.      -> bseindia.com/.../DRHP.pdf             (direct PDF, works)
  - Expression 360 Services India Ltd.  -> sebi.gov.in/filings/.../drhp_*.html   (HTML stub page,
    NOT the actual document -- the real DRHP isn't linked from this page in a
    simple <a href> the way NSE/BSE host theirs; needs a different resolution
    path, deliberately NOT attempted here rather than silently downloading
    the wrong file)
  - Naini Papers Ltd. / Jakson Green Ltd. / SNVA Traveltech Ltd. (all
    confidential filings) -> no public DRHP link exists on the page at all,
    which is the CORRECT/expected outcome, not a failure.

Per project convention: fail loudly and name exactly what went wrong. Never
write a partial or wrong-content file. A company whose only public link is a
non-PDF stub (like the SEBI case above) is reported as NEEDS_MANUAL_RESOLUTION,
distinct from an actual error, so a caller can skip it without crashing a
batch run.
"""

import json
import re
import sys
from pathlib import Path

import requests

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
PDF_DIR = DATA_DIR / "pdfs"
ACTIVE_IPOS_JSON = DATA_DIR / "active_ipos.json"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
}

# Matches <a href="URL" ... title="... DRHP ..."> or "... RHP ..." (allows any
# attribute order/content between href and title, same as chittorgarh's markup).
DRHP_LINK_REGEX = re.compile(
    r'<a\s+[^>]*href="([^"]+)"[^>]*title="([^"]*(?:DRHP|RHP)[^"]*)"[^>]*>'
    r'|<a\s+[^>]*title="([^"]*(?:DRHP|RHP)[^"]*)"[^>]*href="([^"]+)"[^>]*>',
    re.IGNORECASE,
)


class DrhpNotFound(Exception):
    """No DRHP/RHP link on the page at all (unexpected for a non-confidential filing)."""


class DrhpConfidential(Exception):
    """Filing is marked confidential -- no public link is the correct, expected outcome."""


class DrhpNeedsManualResolution(Exception):
    """A DRHP/RHP-titled link exists but doesn't point at a directly-downloadable
    PDF (e.g. a SEBI stub HTML page) -- resolving the real file needs a
    different approach, not attempted here."""

    def __init__(self, matched_url: str, matched_title: str):
        self.matched_url = matched_url
        self.matched_title = matched_title
        super().__init__(
            f"Found a DRHP-titled link ({matched_title!r} -> {matched_url}) but it "
            f"doesn't look like a direct PDF -- needs manual resolution, not downloaded."
        )


# chittorgarh.com puts these two identical boilerplate nav links (pointing at
# a generic cross-company report page, not any specific filing) on EVERY IPO
# detail page. Confirmed by inspecting raw regex matches on a real page
# (2026-08-12) -- without this filter, every single company incorrectly
# resolves to the same generic /report/... URL instead of its own PDF.
GENERIC_NAV_TITLES = {"mainboard rhp & drhp", "sme rhp & drhp"}


def _is_generic_nav_link(title: str) -> bool:
    import html

    normalized = html.unescape(title).strip().lower()
    return normalized in GENERIC_NAV_TITLES


def find_drhp_pdf_url(source_url: str, is_confidential_filing: bool) -> str:
    """Returns the direct PDF URL for a filing's chittorgarh.com detail page.

    Raises DrhpConfidential / DrhpNotFound / DrhpNeedsManualResolution --
    never returns a guessed or partial URL.
    """
    try:
        resp = requests.get(source_url, headers=HEADERS, timeout=15)
    except requests.exceptions.RequestException as exc:
        raise RuntimeError(f"Could not reach {source_url}: {exc}") from exc

    if resp.status_code != 200:
        raise RuntimeError(f"{source_url} returned HTTP {resp.status_code} (expected 200).")

    matches = []
    for m in DRHP_LINK_REGEX.finditer(resp.text):
        url, title = (m.group(1), m.group(2)) if m.group(1) else (m.group(4), m.group(3))
        if not _is_generic_nav_link(title):
            matches.append((url, title))

    if not matches:
        if is_confidential_filing:
            raise DrhpConfidential(
                f"{source_url} is a confidential filing with no public DRHP link -- expected."
            )
        raise DrhpNotFound(
            f"No DRHP/RHP-titled link found on {source_url} -- page structure may have "
            f"changed, or this filing genuinely has none yet."
        )

    # Prefer an explicit "DRHP" title over a bare "RHP" one if both appear.
    matches.sort(key=lambda pair: 0 if "drhp" in pair[1].lower() else 1)
    url, title = matches[0]

    if not url.lower().split("?")[0].endswith(".pdf"):
        raise DrhpNeedsManualResolution(url, title)

    return url


def download_pdf(pdf_url: str, company_id: str) -> Path:
    """Downloads pdf_url to data/pdfs/{company_id}.pdf. Verifies actual PDF
    content (not just a .pdf-looking URL) before committing the file --
    writes to a temp path first so a failed/partial download never leaves a
    corrupt file at the final path."""
    PDF_DIR.mkdir(parents=True, exist_ok=True)
    final_path = PDF_DIR / f"{company_id}.pdf"
    tmp_path = PDF_DIR / f"{company_id}.pdf.part"

    try:
        with requests.get(pdf_url, headers=HEADERS, timeout=60, stream=True) as resp:
            if resp.status_code != 200:
                raise RuntimeError(f"{pdf_url} returned HTTP {resp.status_code} (expected 200).")

            content_type = resp.headers.get("Content-Type", "")
            if "pdf" not in content_type.lower():
                raise RuntimeError(
                    f"{pdf_url} responded with Content-Type '{content_type}', not a PDF."
                )

            with open(tmp_path, "wb") as f:
                first_chunk = True
                for chunk in resp.iter_content(chunk_size=65536):
                    if first_chunk:
                        if not chunk.startswith(b"%PDF"):
                            raise RuntimeError(
                                f"{pdf_url} content does not start with the %PDF magic bytes."
                            )
                        first_chunk = False
                    f.write(chunk)
    except Exception:
        tmp_path.unlink(missing_ok=True)
        raise

    tmp_path.replace(final_path)
    return final_path


def slugify_company_id(company_name: str) -> str:
    return re.sub(r"[^a-z0-9]", "", company_name.lower())


def fetch_drhp_for_ipo(ipo: dict) -> Path:
    """End-to-end: resolve + download the DRHP PDF for one active_ipos.json row."""
    url = find_drhp_pdf_url(ipo["source_url"], ipo.get("is_confidential_filing", False))
    company_id = slugify_company_id(ipo["company_name"])
    return download_pdf(url, company_id)


def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/16_fetch_drhp_pdf.py <sample-count>", file=sys.stderr)
        print("  Runs against the first N companies in data/active_ipos.json "
              "and reports the outcome for each, without failing the whole run "
              "on an individual company's error.", file=sys.stderr)
        sys.exit(1)

    sample_count = int(sys.argv[1])

    with open(ACTIVE_IPOS_JSON, encoding="utf-8") as f:
        data = json.load(f)

    results = {"downloaded": [], "confidential": [], "needs_manual_resolution": [], "errors": []}

    for ipo in data["ipos"][:sample_count]:
        name = ipo["company_name"]
        try:
            path = fetch_drhp_for_ipo(ipo)
            print(f"[OK]                     {name} -> {path}")
            results["downloaded"].append(name)
        except DrhpConfidential as exc:
            print(f"[CONFIDENTIAL]           {name}: {exc}")
            results["confidential"].append(name)
        except DrhpNeedsManualResolution as exc:
            print(f"[NEEDS_MANUAL_RESOLUTION] {name}: {exc}")
            results["needs_manual_resolution"].append(name)
        except Exception as exc:
            print(f"[ERROR]                  {name}: {exc}")
            results["errors"].append((name, str(exc)))

    print("\n" + "=" * 70)
    print(f"Downloaded: {len(results['downloaded'])} | "
          f"Confidential (expected skip): {len(results['confidential'])} | "
          f"Needs manual resolution: {len(results['needs_manual_resolution'])} | "
          f"Errors: {len(results['errors'])}")


if __name__ == "__main__":
    main()
