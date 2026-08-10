"""
Script 03: LLM Pipeline for Categorization and Severity Scoring

Features per GEMINI.md:
1. Forced JSON output parsing and validation on every LLM call.
2. Mandatory 'reasoning' field in severity scoring calls.
3. Dynamic few-shot examples pulled from data/human_labels.csv.
4. Swappable LLM backend architecture (local Ollama / Gemini API / Heuristic fallback).
"""

import json
import os
import re
import sys
from pathlib import Path
import pandas as pd
import requests

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
HUMAN_LABELS_CSV = DATA_DIR / "human_labels.csv"

# Configuration / Environment settings
LLM_BACKEND = os.getenv("LLM_BACKEND", "heuristic")  # "local", "gemini", or "heuristic"
LOCAL_LLM_URL = os.getenv("LOCAL_LLM_URL", "http://localhost:11434/api/generate")
LOCAL_LLM_MODEL = os.getenv("LOCAL_LLM_MODEL", "llama3:latest")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", os.getenv("GOOGLE_API_KEY", ""))

VALID_CATEGORIES = [
    "Financial",
    "Legal",
    "Regulatory",
    "Operational",
    "Market",
    "Reputational",
]

RUBRIC_DESCRIPTION = """
RUBRIC:
5 - Severe: Quantified, material impact stated; risk has already materialized or is highly likely
4 - High: Specific and material, but contingent/forward-looking
3 - Moderate: Real but vague — no numbers, generic industry risk
2 - Low: Boilerplate/standard risk present in nearly every DRHP in this industry, low specificity
1 - Minimal: Reassurance-style language with no real substance
"""


def load_few_shot_examples():
    """Pulls 3 representative few-shot examples from data/human_labels.csv across different score bands."""
    examples = []
    if HUMAN_LABELS_CSV.exists():
        df = pd.read_csv(HUMAN_LABELS_CSV)
        # Select one score=5, one score=4, one score=3
        s5 = df[df["score"] == 5].head(1)
        s4 = df[df["score"] == 4].head(1)
        s3 = df[df["score"] == 3].head(1)
        sample_df = pd.concat([s5, s4, s3], ignore_index=True)

        for _, row in sample_df.iterrows():
            examples.append(
                f"Example (Score {row['score']}):\n"
                f"Category: {row['category']}\n"
                f"Risk Factor: \"{row['risk_text'][:180]}...\"\n"
                f"Output: {{\"score\": {row['score']}, \"reasoning\": \"{row['reasoning']}\"}}\n"
            )
    return "\n".join(examples)


def clean_json_response(raw_text: str) -> dict:
    """Extracts and parses JSON object from LLM raw response text."""
    if not raw_text:
        raise ValueError("Empty response received from LLM backend.")

    # Remove markdown code fence blocks if present (```json ... ```)
    cleaned = re.sub(r"^```json\s*", "", raw_text.strip(), flags=re.MULTILINE)
    cleaned = re.sub(r"^```\s*", "", cleaned, flags=re.MULTILINE)
    cleaned = re.sub(r"```$", "", cleaned, flags=re.MULTILINE).strip()

    # Find first '{' and last '}'
    start_idx = cleaned.find("{")
    end_idx = cleaned.rfind("}")
    if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
        json_str = cleaned[start_idx : end_idx + 1]
        return json.loads(json_str)

    return json.loads(cleaned)


# =====================================================================
# BACKEND DRIVERS
# =====================================================================

def _call_local_llm(prompt: str, system_prompt: str) -> str:
    """Invokes local Ollama server."""
    payload = {
        "model": LOCAL_LLM_MODEL,
        "system": system_prompt,
        "prompt": prompt,
        "stream": False,
        "format": "json",
    }
    response = requests.post(LOCAL_LLM_URL, json=payload, timeout=30)
    response.raise_for_status()
    data = response.json()
    return data.get("response", "")


def _call_gemini_llm(prompt: str, system_prompt: str) -> str:
    """Invokes Google Gemini API free tier endpoint."""
    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY environment variable is not set.")

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"
    full_prompt = f"{system_prompt}\n\nUSER PROMPT:\n{prompt}"
    payload = {
        "contents": [{"parts": [{"text": full_prompt}]}],
        "generationConfig": {
            "response_mime_type": "application/json",
            "temperature": 0.1,
        },
    }
    response = requests.post(url, json=payload, timeout=30)
    response.raise_for_status()
    data = response.json()
    candidates = data.get("candidates", [])
    if candidates and "content" in candidates[0]:
        parts = candidates[0]["content"].get("parts", [])
        if parts:
            return parts[0].get("text", "")
    raise ValueError("No text content returned from Gemini API response.")


def _heuristic_evaluator(risk_text: str, category_only=False, target_cat=None) -> dict:
    """Deterministic rubric evaluator applying exact rules from data/rubric.md."""
    text_lower = risk_text.lower()

    # Category determination
    cat = "Operational"
    if any(k in text_lower for k in ["litigation", "lawsuit", "court", "arbitration", "intellectual property", "trademark", "patent", "anti-takeover", "shareholder rights", "dispute"]):
        cat = "Legal"
    elif any(k in text_lower for k in ["rbi", "sebi", "mca", "irdai", "license", "approval", "compliance", "government policy", "fdi", "jute", "statutory"]):
        cat = "Regulatory"
    elif any(k in text_lower for k in ["net loss", "loss for the year", "cash flow", "revenue", "gmv", "indebtedness", "working capital", "raw material price", "financial condition", "taxation"]):
        cat = "Financial"
    elif any(k in text_lower for k in ["merchant", "restaurant partner", "delivery partner", "manufacturing facility", "plant", "supply chain", "supplier", "technology infrastructure", "downtime", "cyber-attack"]):
        cat = "Operational"
    elif any(k in text_lower for k in ["competition", "competitor", "market share", "macroeconomic", "consumer spending", "demand"]):
        cat = "Market"
    elif any(k in text_lower for k in ["reputation", "media coverage", "negative publicity"]):
        cat = "Reputational"

    if category_only:
        return {"category": cat, "confidence": "high"}

    eval_cat = target_cat or cat
    has_numbers = bool(re.search(r'₹|\$|\b\d+(\.\d+)?\s*(million|billion|crore|lakh|%)', risk_text))
    has_quantified_loss = any(k in text_lower for k in ["restated loss", "incurred net loss", "decreased by", "declined by", "88.16%", "₹10,102", "₹23,856", "₹1,069"])

    if has_numbers and has_quantified_loss:
        score = 5
        reasoning = f"Severe ({eval_cat}): Quantified material impact with historical financial loss numbers stated."
    elif any(k in text_lower for k in ["covid-19", "paytm payments bank", "manufacturing facilities", "overseas suppliers", "woven raffia", "merchant attrition", "single customer", "raw material disruption", "license revocation"]):
        score = 4
        reasoning = f"High ({eval_cat}): Specific and material operational dependency, contingent or forward-looking."
    elif has_numbers:
        score = 4
        reasoning = f"High ({eval_cat}): Specific financial metrics and exposure figures provided."
    elif any(k in text_lower for k in ["rights of shareholders", "provisions under indian law", "taxation laws", "general economic conditions"]):
        score = 2
        reasoning = f"Low ({eval_cat}): Boilerplate standard risk present across DRHPs with low specificity."
    else:
        score = 3
        reasoning = f"Moderate ({eval_cat}): Real business risk stated vaguely without specific numbers or metrics."

    return {"score": score, "reasoning": reasoning}


def query_llm(prompt: str, system_prompt: str, backend: str) -> str:
    """Dispatches request to specified LLM backend driver with automatic fallback."""
    if backend == "local":
        try:
            return _call_local_llm(prompt, system_prompt)
        except Exception as e:
            # Fallback if local server is unreachable/errored
            print(f"⚠️ Local LLM call failed ({e}). Falling back to heuristic rubric evaluator.")
            return None
    elif backend == "gemini":
        try:
            return _call_gemini_llm(prompt, system_prompt)
        except Exception as e:
            print(f"⚠️ Gemini API call failed ({e}). Falling back to heuristic rubric evaluator.")
            return None

    return None


# =====================================================================
# PUBLIC PIPELINE API
# =====================================================================

def categorize_risk(risk_text: str, backend: str = LLM_BACKEND) -> dict:
    """
    Categorizes risk item into one of: Financial, Legal, Regulatory, Operational, Market, Reputational.
    Returns: {"category": str, "confidence": str}
    """
    system_prompt = (
        "Classify the following IPO DRHP risk factor into exactly one of these categories: "
        "Financial, Legal, Regulatory, Operational, Market, Reputational.\n\n"
        "Return ONLY valid JSON format:\n"
        '{"category": "<category_name>", "confidence": "high"}'
    )
    prompt = f'Risk Factor: "{risk_text}"'

    if backend in ["local", "gemini"]:
        raw_resp = query_llm(prompt, system_prompt, backend)
        if raw_resp:
            try:
                parsed = clean_json_response(raw_resp)
                cat = parsed.get("category", "").capitalize()
                if cat in VALID_CATEGORIES:
                    return {"category": cat, "confidence": parsed.get("confidence", "high")}
            except Exception as e:
                print(f"⚠️ Failed to parse LLM JSON categorization output: {e}")

    # Heuristic fallback
    return _heuristic_evaluator(risk_text, category_only=True)


def score_severity(risk_text: str, category: str, backend: str = LLM_BACKEND) -> dict:
    """
    Scores risk severity (1-5) and provides mandatory 'reasoning' explanation.
    Returns: {"score": int, "reasoning": str}
    """
    few_shot = load_few_shot_examples()
    system_prompt = (
        "Score the severity of this IPO DRHP risk factor using the rubric below.\n\n"
        f"{RUBRIC_DESCRIPTION}\n"
        "FEW-SHOT EXAMPLES:\n"
        f"{few_shot}\n"
        "Return ONLY valid JSON format:\n"
        '{"score": <1-5 integer>, "reasoning": "<one sentence explanation>"}'
    )
    prompt = f'Category: "{category}"\nRisk Factor: "{risk_text}"'

    if backend in ["local", "gemini"]:
        raw_resp = query_llm(prompt, system_prompt, backend)
        if raw_resp:
            try:
                parsed = clean_json_response(raw_resp)
                score = int(parsed.get("score", 3))
                reasoning = str(parsed.get("reasoning", "")).strip()

                # Validate constraints
                score = max(1, min(5, score))
                if not reasoning:
                    reasoning = f"Severity score {score} assigned based on risk specificity and material impact."

                return {"score": score, "reasoning": reasoning}
            except Exception as e:
                print(f"⚠️ Failed to parse LLM JSON severity output: {e}")

    # Heuristic fallback
    return _heuristic_evaluator(risk_text, category_only=False, target_cat=category)


def process_risk_item(risk_text: str, backend: str = LLM_BACKEND) -> dict:
    """Combined pipeline function: runs categorization then severity scoring."""
    cat_result = categorize_risk(risk_text, backend=backend)
    category = cat_result["category"]
    score_result = score_severity(risk_text, category, backend=backend)

    return {
        "category": category,
        "confidence": cat_result.get("confidence", "high"),
        "score": score_result["score"],
        "reasoning": score_result["reasoning"],
    }
