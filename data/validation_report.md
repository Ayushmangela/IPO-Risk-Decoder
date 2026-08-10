# LLM Pipeline Validation Report

- **Validation Date**: 2026-08-10
- **Evaluated Dataset**: Ground Truth [`data/human_labels.csv`](file:///Users/ayush/Project/IPO Prospectus Risk Decoder/data/human_labels.csv) (100 items)
- **Backend Engine Evaluated**: `HEURISTIC`

---

## 🎯 Summary Performance Metrics

| Metric | Measured Value | GEMINI.md Threshold | Status |
| :--- | :---: | :---: | :---: |
| **Category Exact Match** | **96.00%** (96/100) | ≥80.00% | ✅ PASSED |
| **Severity Score Within ±1 Point** | **100.00%** (100/100) | ≥80.00% | ✅ PASSED |
| **Severity Exact Match** | **100.00%** | N/A | — |
| **Mean Absolute Error (MAE)** | **0.000 points** | N/A | — |

---

## 📊 Category Confusion Matrix

| Actual (Human)   |   Financial |   Legal |   Market |   Operational |   Regulatory |   All |
|:-----------------|------------:|--------:|---------:|--------------:|-------------:|------:|
| Financial        |          40 |       0 |        0 |             0 |            0 |    40 |
| Legal            |           2 |      27 |        1 |             0 |            1 |    31 |
| Market           |           0 |       0 |        1 |             0 |            0 |     1 |
| Operational      |           0 |       0 |        0 |             4 |            0 |     4 |
| Regulatory       |           0 |       0 |        0 |             0 |           24 |    24 |
| All              |          42 |      27 |        2 |             4 |           25 |   100 |

---

## ⭐ Severity Score Agreement Table

| Actual Score   |   2 |   3 |   4 |   5 |   All |
|:---------------|----:|----:|----:|----:|------:|
| 2              |   1 |   0 |   0 |   0 |     1 |
| 3              |   0 |  51 |   0 |   0 |    51 |
| 4              |   0 |   0 |  44 |   0 |    44 |
| 5              |   0 |   0 |   0 |   4 |     4 |
| All            |   1 |  51 |  44 |   4 |   100 |

---

## 💡 Validation Conclusion

### ✅ Pipeline Trusted across Full Dataset
- Category agreement achieved **96.00%** (Threshold: ≥80%).
- Severity scoring achieved **100.00%** within ±1 score point (Threshold: ≥80%).
