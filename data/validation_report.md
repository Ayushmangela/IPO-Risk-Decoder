# LLM Pipeline Validation Report

- **Validation Date**: 2026-08-10
- **Evaluated Dataset**: Ground Truth [`data/human_labels.csv`](file:///Users/ayush/Project/IPO Prospectus Risk Decoder/data/human_labels.csv) (100 items)
- **Active Backend Engine**: `LOCAL`
- **Data Leakage Exclusion**: ✅ ENABLED (Target row excluded from few-shots)

---

## 🎯 Summary Performance Metrics

| Metric | Measured Value | GEMINI.md Threshold | Status |
| :--- | :---: | :---: | :---: |
| **Category Exact Match** | **23.00%** (23/100) | ≥80.00% | ❌ FAILED |
| **Severity Score Within ±1 Point** | **59.00%** (59/100) | ≥80.00% | ❌ FAILED |
| **Severity Exact Match** | **18.00%** | N/A | — |
| **Mean Absolute Error (MAE)** | **1.240 points** | N/A | — |

---

## 📊 Category Confusion Matrix

| Actual (Human)   |   Financial |   Market |   Operational |   Regulatory |   Reputational |   All |
|:-----------------|------------:|---------:|--------------:|-------------:|---------------:|------:|
| Financial        |          19 |        7 |            10 |            2 |              2 |    40 |
| Legal            |           5 |        1 |            12 |            5 |              8 |    31 |
| Market           |           0 |        0 |             1 |            0 |              0 |     1 |
| Operational      |           2 |        0 |             0 |            0 |              2 |     4 |
| Regulatory       |           6 |        2 |             6 |            4 |              6 |    24 |
| All              |          32 |       10 |            29 |           11 |             18 |   100 |

---

## ⭐ Severity Score Agreement Table

| Actual Score   |   2 |   3 |   4 |   5 |   All |
|:---------------|----:|----:|----:|----:|------:|
| 2              |   0 |   0 |   0 |   1 |     1 |
| 3              |   1 |   3 |   7 |  40 |    51 |
| 4              |   0 |   7 |  11 |  26 |    44 |
| 5              |   0 |   0 |   0 |   4 |     4 |
| All            |   1 |  10 |  18 |  71 |   100 |

---

## 🔍 Audit: Sample Raw Model JSON Responses

### Item #1
- **Risk Text**: "If we are unable to attract merchants to our ecosystem, grow our relationships with our existing merchants, and increase transaction volumes on our pl..."
- **Human Ground Truth**: Category=`Financial` | Score=`4`
- **LLM Prediction**: Category=`Operational` | Score=`5`
- **Raw LLM JSON Response**:
```json
{"score": 5, "reasoning": "Severe (Operational): Material impact is quantified with specific numbers/historical growth rates and potential consequences, including material adverse effects on business, financial condition, cash flows, and results of operations."}
```
### Item #2
- **Risk Text**: "If we fail to retain our consumers, attract new consumers, expand the volume of transactions from consumers, or if our consumer acquisition costs incr..."
- **Human Ground Truth**: Category=`Financial` | Score=`3`
- **LLM Prediction**: Category=`Market` | Score=`4`
- **Raw LLM JSON Response**:
```json
{"score": 4, "reasoning": "High (Market): Specific metrics and financial exposure details provided, highlighting the material impact of consumer retention and growth on the company's success."}
```
### Item #3
- **Risk Text**: "We may not be able to maintain and strengthen the network effects of our platform, which could have a material adverse effect on our business, financi..."
- **Human Ground Truth**: Category=`Financial` | Score=`3`
- **LLM Prediction**: Category=`Operational` | Score=`5`
- **Raw LLM JSON Response**:
```json
{"score": 5, "reasoning": "Severe (Operational): Material impact is quantified with specific details about network effects, consumer behavior, and potential consequences on business outcomes."}
```
### Item #4
- **Risk Text**: "We derive a majority of our revenue from our payment services. Our efforts to expand our service offerings and market reach may not succeed and may im..."
- **Human Ground Truth**: Category=`Financial` | Score=`4`
- **LLM Prediction**: Category=`Financial` | Score=`4`
- **Raw LLM JSON Response**:
```json
{"score": 4, "reasoning": "High (Financial): Specific metrics and financial exposure details provided, highlighting the potential impact of service mix and competitor vulnerability on revenue and growth."}
```
### Item #5
- **Risk Text**: "The ongoing COVID-19 pandemic and measures intended to prevent its spread have had, and may continue to have, a material and adverse effect on our bus..."
- **Human Ground Truth**: Category=`Financial` | Score=`5`
- **LLM Prediction**: Category=`Market` | Score=`5`
- **Raw LLM JSON Response**:
```json
{"score": 5, "reasoning": "Severe (Market): Quantified, material impact stated; risk has already materialized or is highly likely due to COVID-19 pandemic's ongoing effects on business operations and results."}
```


---

## 💡 Validation Conclusion

### ⚠️ Model Performance under threshold - Gemini 2.5 Flash Fallback Triggered
- Evaluated backend engine: `LOCAL`
- Category agreement achieved **23.00%** (Threshold: ≥80%).
- Severity scoring achieved **59.00%** within ±1 score point (Threshold: ≥80%).
