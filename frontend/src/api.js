/**
 * API Service for IPO Prospectus Risk Decoder
 */

export const API_BASE_URL =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://127.0.0.1:8000'
    : '';

export const STATIC_METHODOLOGY_DATA = {
  rubric: {
    scale: [
      { score: 5, label: "Severe", description: "Quantified, material impact stated; risk has already materialized or is highly likely" },
      { score: 4, label: "High", description: "Specific and material, but contingent/forward-looking" },
      { score: 3, label: "Moderate", description: "Real but vague — no numbers, generic industry risk" },
      { score: 2, label: "Low", description: "Boilerplate/standard risk present in nearly every DRHP in this industry, low specificity" },
      { score: 1, label: "Minimal", description: "Reassurance-style language with no real substance" }
    ],
    categories: ["Financial", "Legal", "Regulatory", "Operational", "Market", "Reputational"]
  },
  validation_benchmark: {
    ground_truth_samples: 100,
    threshold_required: "≥80.0%",
    models_evaluated: [
      {
        backend: "local",
        model_name: "llama3.2:3b (Ollama)",
        category_match_pct: 23.0,
        severity_within_pm1_pct: 59.0,
        status: "FAILED",
        reason: "Failed both category (23% vs 80%) and score accuracy thresholds (59% vs 80%). Over-indexed on score 5."
      },
      {
        backend: "gemini",
        model_name: "gemini-flash-latest (Google)",
        category_match_pct: 89.0,
        severity_within_pm1_pct: 100.0,
        status: "PASSED",
        reason: "Exceeded all validation thresholds (89% category match, 100% score within ±1, MAE 0.030)."
      }
    ]
  },
  ddi_methodology: {
    title: "Disclosure Distortion Index (DDI)",
    formula: "DDI = Materiality Score - Emphasis Score",
    materiality_score: "M_i = min(100, 15*N_rupee + 12*N_pct + 10*N_metric + Bonus_large)",
    emphasis_score: "E_i = 0.50*PositionScore + 0.30*HeaderScore + 0.20*LengthScore",
    threshold: "DDI > +30.0 flags a 'Buried Important Risk' (high financial materiality, low placement emphasis).",
    range: "[-100.0 to +100.0]"
  },
  obfuscation_methodology: {
    title: "Obfuscation Test (Flesch Readability vs Severity Correlation)",
    formula: "Spearman Rank Correlation (rho) between FRE Readability Score and Severity (1-5)",
    hypothesis: "Higher severity risks correlate with LOWER readability (harder to read).",
    per_company_results: [
      { company: "Zomato", spearman_rho: 0.2485, p_value: 0.0477, significance: "Statistically Significant (p < 0.05)", finding: "Contradicts obfuscation hypothesis — severe risks written in clearer prose." },
      { company: "Paytm", spearman_rho: 0.2016, p_value: 0.0711, significance: "Borderline / Not Significant (p = 0.0711)", finding: "No statistically significant correlation." },
      { company: "Lohia Corp", spearman_rho: 0.0984, p_value: 0.3643, significance: "Not Significant (p = 0.3643)", finding: "No correlation between severity and readability." },
      { company: "Combined Dataset (232 risks)", spearman_rho: 0.1826, p_value: 0.0053, significance: "Statistically Significant (p = 0.0053)", finding: "Contradicts obfuscation hypothesis across full dataset." }
    ]
  },
  shadow_ledger_methodology: {
    title: "Shadow Ledger Engine (Financial Statements Cross-Check)",
    cross_checked_figures: ["Total Revenue", "Profit After Tax (PAT)", "Total Debt / Borrowings"],
    equivalence_rules: [
      "Only compare figures for the exact same fiscal year.",
      "Only compare figures with identical accounting scope (Standalone vs Consolidated).",
      "Only compare figures measuring the exact same defined financial metric.",
      "Non-equivalent metrics (e.g. Sanctioned Credit Limits vs Balance Sheet Debt) are labeled 'Not Directly Comparable' with both values preserved."
    ],
    confirmed_match_example: "Lohia Corp corporate guarantee of ₹413.00 Million on Page 323 Note 36 matched Risk #9 claim (₹413.00 Million, 0.0% difference)."
  },
  proceeds_promoter_methodology: {
    title: "Use of Proceeds & Promoter Structure Analysis",
    execution: "100% Deterministic Extraction (Zero LLM Calls)",
    proceeds_extraction: "Parsed directly from 'Objects of the Offer' fund allocation tables in Section III/IV of the DRHP.",
    promoter_extraction: "Extracted from explicit cover page and 'Capital Structure / Our Promoters' disclosures."
  },
  limitations_notice: {
    title: "Single-Company-Per-Sector Limitation Notice",
    description: "Since each of the 3 sample companies (Paytm: Fintech, Lohia Corp: Capital Goods, Zomato: Consumer Internet) belongs to a different sector, the peer benchmarking engine calculates a cross-company comparison baseline rather than a true same-sector peer benchmark."
  }
};

export async function fetchCompanies() {
  const res = await fetch(`${API_BASE_URL}/api/companies`);
  if (!res.ok) throw new Error('Failed to fetch companies');
  return res.json();
}

export async function fetchCompanySummary(companyId) {
  const res = await fetch(`${API_BASE_URL}/api/companies/${companyId}/summary`);
  if (!res.ok) throw new Error('Failed to fetch summary');
  return res.json();
}

export async function fetchCompanyOutliers(companyId) {
  const res = await fetch(`${API_BASE_URL}/api/companies/${companyId}/outliers`);
  if (!res.ok) throw new Error('Failed to fetch outliers');
  return res.json();
}

export async function fetchCompanyRisks(companyId) {
  const res = await fetch(`${API_BASE_URL}/api/companies/${companyId}/risks`);
  if (!res.ok) throw new Error('Failed to fetch risks');
  return res.json();
}

export async function fetchCompanyLitigation(companyId) {
  const res = await fetch(`${API_BASE_URL}/api/companies/${companyId}/litigation`);
  if (!res.ok) throw new Error('Failed to fetch litigation');
  return res.json();
}

export async function fetchActiveIpos() {
  const res = await fetch(`${API_BASE_URL}/api/active-ipos`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || 'Failed to fetch active IPO list');
  }
  return res.json();
}

export async function refreshActiveIpos() {
  const res = await fetch(`${API_BASE_URL}/api/active-ipos/refresh`, { method: 'POST' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || 'Failed to refresh active IPO list');
  }
  return res.json();
}

/** Uploads a DRHP PDF and runs the full pipeline synchronously. Throws an
 * Error whose `.detail` carries the structured {failed_step, message, log}
 * payload when the backend reports a specific pipeline-step failure. */
export async function uploadDrhp(file, companyName, sector) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('company_name', companyName);
  if (sector) formData.append('sector', sector);

  const res = await fetch(`${API_BASE_URL}/api/upload-drhp`, {
    method: 'POST',
    body: formData,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(
      typeof body.detail === 'string' ? body.detail : body.detail?.message || 'Upload failed'
    );
    err.detail = body.detail;
    throw err;
  }
  return body;
}

export async function fetchMethodology() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/methodology`);
    if (!res.ok) return STATIC_METHODOLOGY_DATA;
    const data = await res.json();
    return data || STATIC_METHODOLOGY_DATA;
  } catch (err) {
    return STATIC_METHODOLOGY_DATA;
  }
}
