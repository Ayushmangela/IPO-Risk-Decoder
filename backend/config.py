import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
PDF_DIR = DATA_DIR / "pdfs"
RAW_RISKS_CSV = DATA_DIR / "risks_raw.csv"
HUMAN_LABELS_CSV = DATA_DIR / "human_labels.csv"
PEER_STATS_CSV = DATA_DIR / "peer_stats.csv"
DB_PATH = DATA_DIR / "scored_risks.db"

# Validation Thresholds (from GEMINI.md)
CATEGORY_MATCH_THRESHOLD = 0.80  # 80% category agreement
SCORE_DIFF_THRESHOLD = 1        # Off by at most 1 point
SCORE_ACCURACY_THRESHOLD = 0.80 # Score within ±1 on 80% cases
