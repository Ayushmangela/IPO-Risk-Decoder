# LLM Pipeline Validation Report

- **Validation Date**: 2026-08-10
- **Evaluated Dataset**: Ground Truth [`data/human_labels.csv`](file:///Users/ayush/Project/IPO Prospectus Risk Decoder/data/human_labels.csv) (100 items)
- **Active Backend Engine**: `GEMINI`
- **Data Leakage Exclusion**: ✅ ENABLED (Target row excluded from few-shots)

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

## 🔍 Audit: Sample Raw Model JSON Responses

### Item #1
- **Risk Text**: "If we are unable to attract merchants to our ecosystem, grow our relationships with our existing merchants, and increase transaction volumes on our pl..."
- **Human Ground Truth**: Category=`Financial` | Score=`4`
- **LLM Prediction**: Category=`Financial` | Score=`4`
- **Raw LLM JSON Response**:
```json
{"score": 4, "reasoning": "High (Financial): Specific financial metrics and exposure figures provided."}
```
### Item #2
- **Risk Text**: "If we fail to retain our consumers, attract new consumers, expand the volume of transactions from consumers, or if our consumer acquisition costs incr..."
- **Human Ground Truth**: Category=`Financial` | Score=`3`
- **LLM Prediction**: Category=`Financial` | Score=`3`
- **Raw LLM JSON Response**:
```json
{"score": 3, "reasoning": "Moderate (Financial): Real business risk stated vaguely without specific numbers or metrics."}
```
### Item #3
- **Risk Text**: "We may not be able to maintain and strengthen the network effects of our platform, which could have a material adverse effect on our business, financi..."
- **Human Ground Truth**: Category=`Financial` | Score=`3`
- **LLM Prediction**: Category=`Financial` | Score=`3`
- **Raw LLM JSON Response**:
```json
{"score": 3, "reasoning": "Moderate (Financial): Real business risk stated vaguely without specific numbers or metrics."}
```
### Item #4
- **Risk Text**: "We derive a majority of our revenue from our payment services. Our efforts to expand our service offerings and market reach may not succeed and may im..."
- **Human Ground Truth**: Category=`Financial` | Score=`4`
- **LLM Prediction**: Category=`Financial` | Score=`4`
- **Raw LLM JSON Response**:
```json
{"score": 4, "reasoning": "High (Financial): Specific financial metrics and exposure figures provided."}
```
### Item #5
- **Risk Text**: "The ongoing COVID-19 pandemic and measures intended to prevent its spread have had, and may continue to have, a material and adverse effect on our bus..."
- **Human Ground Truth**: Category=`Financial` | Score=`5`
- **LLM Prediction**: Category=`Financial` | Score=`5`
- **Raw LLM JSON Response**:
```json
{"score": 5, "reasoning": "Severe (Financial): Quantified material impact with historical financial loss numbers stated."}
```


---

## 💡 Validation Conclusion

### ✅ Pipeline Trusted across Full Dataset
- Evaluated backend engine: `GEMINI`
- Category agreement achieved **96.00%** (Threshold: ≥80%).
- Severity scoring achieved **100.00%** within ±1 score point (Threshold: ≥80%).
