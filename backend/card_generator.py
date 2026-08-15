"""
Shareable Risk Card Generator

Renders a single 1200x630 PNG (standard OG-image size, unfurls cleanly on
X/Twitter, Reddit, Slack, LinkedIn) summarizing one company's risk profile:
name, sector, an overall severity verdict, and its top risk categories.

Pure presentation over already-computed data (company_summary dict, same
shape returned by GET /companies/{id}/summary) -- makes zero DB queries and
zero LLM calls of its own, consistent with the project's "backend never
invokes an LLM live" rule (per GEMINI.md).

Uses Pillow's built-in scalable default font (ImageFont.load_default(size=N),
Pillow >=10.1) rather than bundling a font file -- keeps this dependency-free
and avoids downloading any external asset into the repo.
"""

from io import BytesIO

from PIL import Image, ImageDraw, ImageFont

CARD_WIDTH = 1200
CARD_HEIGHT = 630

BG_COLOR = (15, 18, 26)          # near-black navy
CARD_BORDER = (35, 40, 54)
TEXT_PRIMARY = (240, 242, 247)
TEXT_MUTED = (140, 148, 165)
BRAND_ACCENT = (99, 179, 237)    # light blue

# (label, color) buckets for the 1-5 severity rubric used throughout the
# pipeline (scripts/03_llm_pipeline.py RUBRIC_DESCRIPTION), applied to the
# company's AVERAGE severity across all extracted risk items.
SEVERITY_BUCKETS = [
    (4.5, "SEVERE", (235, 87, 87)),
    (3.5, "HIGH", (242, 153, 74)),
    (2.5, "MODERATE", (242, 201, 76)),
    (1.5, "LOW", (111, 207, 151)),
    (0.0, "MINIMAL", (98, 209, 137)),
]


def _severity_label(average_severity: float):
    for threshold, label, color in SEVERITY_BUCKETS:
        if average_severity >= threshold:
            return label, color
    return SEVERITY_BUCKETS[-1][1], SEVERITY_BUCKETS[-1][2]


def _font(size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.load_default(size=size)


def _top_categories(category_counts: dict, total_risks: int, limit: int = 3):
    ranked = sorted(category_counts.items(), key=lambda kv: kv[1], reverse=True)
    out = []
    for name, count in ranked[:limit]:
        pct = round((count / total_risks) * 100) if total_risks else 0
        out.append((name, count, pct))
    return out


def generate_risk_card(company_summary: dict) -> bytes:
    """Renders a PNG risk card from a company_summary dict (same shape as
    GET /companies/{id}/summary's response). Returns raw PNG bytes."""
    company = company_summary["company"]
    total_risks = company_summary["total_risks"]
    avg_severity = company_summary["average_severity"]
    category_counts = company_summary["category_counts"]

    label, color = _severity_label(avg_severity)
    top_cats = _top_categories(category_counts, total_risks)

    img = Image.new("RGB", (CARD_WIDTH, CARD_HEIGHT), BG_COLOR)
    draw = ImageDraw.Draw(img)

    # Outer border, slightly inset
    draw.rectangle([8, 8, CARD_WIDTH - 9, CARD_HEIGHT - 9], outline=CARD_BORDER, width=2)

    margin = 64

    # Eyebrow branding
    draw.text((margin, 56), "IPO RISK DECODER", font=_font(26), fill=BRAND_ACCENT)

    # Company name (wrap if long)
    name = company["name"]
    name_font = _font(56 if len(name) <= 28 else 42)
    draw.text((margin, 100), name, font=name_font, fill=TEXT_PRIMARY)

    # Sector
    draw.text((margin, 170), company["sector"].upper(), font=_font(24), fill=TEXT_MUTED)

    # Severity verdict block
    verdict_y = 250
    draw.text((margin, verdict_y), f"{avg_severity:.1f}", font=_font(120), fill=color)
    score_w = draw.textlength(f"{avg_severity:.1f}", font=_font(120))
    draw.text((margin + score_w + 20, verdict_y + 40), "/ 5", font=_font(40), fill=TEXT_MUTED)
    draw.text((margin, verdict_y + 130), f"{label} RISK PROFILE", font=_font(32), fill=color)
    draw.text(
        (margin, verdict_y + 175),
        f"Based on {total_risks} disclosed risk factors",
        font=_font(22),
        fill=TEXT_MUTED,
    )

    # Top categories, right-aligned column
    cat_x = 760
    cat_y = 250
    draw.text((cat_x, cat_y - 40), "TOP RISK CATEGORIES", font=_font(22), fill=TEXT_MUTED)
    row_h = 62
    for i, (cat_name, count, pct) in enumerate(top_cats):
        y = cat_y + i * row_h
        draw.text((cat_x, y), cat_name.upper(), font=_font(28), fill=TEXT_PRIMARY)
        draw.text((cat_x, y + 32), f"{count} risks ({pct}%)", font=_font(20), fill=TEXT_MUTED)

    # Footer
    draw.line([margin, CARD_HEIGHT - 90, CARD_WIDTH - margin, CARD_HEIGHT - 90], fill=CARD_BORDER, width=1)
    draw.text(
        (margin, CARD_HEIGHT - 68),
        "Offline-scored against a validated 1-5 severity rubric, benchmarked vs. sector peers.",
        font=_font(20),
        fill=TEXT_MUTED,
    )

    buf = BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()
