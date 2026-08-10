# IPO Prospectus Risk Decoder

An offline extraction, categorization, severity scoring, and peer benchmarking platform for Indian IPO DRHP (Draft Red Herring Prospectus) filings.

## 🎯 Overview
Indian IPO DRHP filings contain dense 40-80 page "Risk Factors" sections. This tool:
1. Extracts individual risk items using PyMuPDF (`fitz`) and regular expressions.
2. Validates LLM severity scores against ~100 human-labeled examples using a standardized 1-5 severity rubric before full dataset processing.
3. Benchmarks companies against sector peers using pandas.
4. Serves pre-computed metrics via FastAPI to a React dashboard.

> **Note**: In accordance with system scope rules, LLM processing runs entirely offline. The live API serves strictly pre-computed SQLite and CSV datasets.

---

## 📂 Folder Structure

```
.
├── GEMINI.md                    # Core project context, scope & rules
├── IPO_Risk_Decoder_Project_Doc.md # Detailed project development document
├── README.md                    # Project documentation & setup instructions
├── requirements.txt             # Python dependencies
├── data/
│   ├── pdfs/                    # Input DRHP PDFs (15-20 target filings)
│   ├── risks_raw.csv            # Extracted unlabeled risk items
│   ├── human_labels.csv         # ~100 manually scored ground truth items
│   ├── peer_stats.csv           # Sector-aggregated peer benchmarking data
│   └── scored_risks.db          # Pre-computed SQLite database (LLM scored)
├── backend/
│   ├── main.py                  # FastAPI server & route declarations
│   └── config.py                # System paths & configuration settings
├── scripts/
│   ├── 01_extract_risks.py      # PDF parsing and regex risk item extraction
│   ├── 02_llm_pipeline.py      # LLM categorization, scoring & validation script
│   └── 03_peer_benchmarking.py # Pandas sector peer analysis script
└── frontend/                    # React (Vite) dashboard interface
    ├── package.json
    ├── vite.config.js
    └── src/                     # React components & UI layouts
```

---

## 🚀 Setup & Execution

### 1. Environment Setup
```bash
# Create Python virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Run Backend (FastAPI)
```bash
uvicorn backend.main:app --reload --port 8000
```
- Access API documentation: `http://127.0.0.1:8000/docs`
- Health check endpoint: `http://127.0.0.1:8000/api/health`

### 3. Run Frontend (React)
```bash
cd frontend
npm install
npm run dev
```
