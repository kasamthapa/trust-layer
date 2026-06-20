# TrustLayer
> Alternative credit trust middleware for collateral-free MSME lending in Nepal

![NRB Sandbox Ready](https://img.shields.io/badge/NRB%20Sandbox-Ready-green?style=flat-square)
![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688?style=flat-square&logo=fastapi)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react)
![XGBoost](https://img.shields.io/badge/XGBoost-ML-orange?style=flat-square)
![NetworkX](https://img.shields.io/badge/NetworkX-Graph-blue?style=flat-square)
![Gemma3 4B](https://img.shields.io/badge/Gemma3-4B%20Local-8B5CF6?style=flat-square)

---

## The Problem

Nepal's MSME financing gap is **USD 3.6 billion**. Over 90% of small merchants are rejected for loans because they lack collateral — not because they are risky. The Credit Information Bureau Nepal has records for only 2.8 million people in a country of 30 million. Creditworthy merchants are financially invisible.

---

## The Solution

TrustLayer is an open-source credit trust middleware that sits between merchants and banks. It converts alternative behavioral signals, community trust networks, and psychometric assessment into an explainable lending decision — without requiring collateral or formal credit history.

```
Merchant → [Nabil Bank App] → TrustLayer API → [Formula + Graph + ML + AI] → Bank Dashboard
```

---

## How It Works

TrustLayer uses a four-layer trust architecture:

| Layer | What it measures | Weight |
|---|---|---|
| **Rule-Based Formula** | Bill payments, QR transactions, airtime topup, cashflow stability — weighted by data confidence | 70% |
| **Community Trust Graph** | PageRank trust propagation across voucher network with Louvain fraud ring detection | 30% |
| **ML Pattern Recognition** | XGBoost trained on 2,000 synthetic profiles — runs in shadow mode, advisory only | Not fused |
| **Local AI Explanation** | Gemma3 4B via Ollama generates plain-language assessment entirely on-device | Narrative only |

### Scoring Formula

```
Confidence:  c = min(months_active / 12, 0.85)
Behaviour:   B = 0.35×bills + 0.30×QR + 0.20×airtime + 0.15×stability
Personal:    P = c×B + (1−c)×psychometric_floor
Final Score: S = 0.70×Formula + 0.30×Graph   (ML advisory, not fused)
```

Score range: **300 – 1000**

| Band | Score | Recommendation |
|---|---|---|
| Platinum | 750 – 1000 | Approve |
| Gold | 500 – 749 | Approve |
| Silver | 350 – 499 | Cautious approve |
| Refused | < 350 | Decline |

---

## Key Features

- **Merchant onboarding** via a Nabil Bank-style mobile interface built in React
- **Data source verification** — eSewa / Khalti, NEA electricity bills, ISP, NTC / Ncell, bank statement
- **5-question psychometric assessment** scored by local AI to establish character baseline
- **Community vouch system** — up to 5 vouches given and 5 received per merchant
- **Fraud ring detection** via Louvain community detection on the trust graph
- **Fairness audit** that separates missing data from genuinely risky behavior
- **Bank officer dashboard** with plain-language explainable decision panel
- **D3 force-directed trust graph** with real-time fraud ring highlighting
- **All AI inference runs locally** — no cloud dependency, no data leaves the device

---

## Regulatory Context

| Regulation | Status |
|---|---|
| NRB Digital Lending Guidelines — collateral-free MSME loans up to NPR 1M | Amended June 9, 2026 |
| NRB Fintech Regulatory Sandbox — credit scoring listed as focus area | Effective May 14, 2026 |
| TrustLayer architecture | Designed for NRB Sandbox deployment |

---

## Tech Stack

**Backend**
- Python · FastAPI · PostgreSQL (NeonDB via psycopg2)
- NetworkX (PageRank graph trust) · python-louvain (fraud detection)
- XGBoost · SHAP (ML advisory layer)
- Ollama — Gemma3 4B (local AI summaries)

**Frontend**
- React 18 · TypeScript · Vite
- Tailwind CSS v4 · D3.js v7 · Recharts
- React Router v7

---

## Setup

### Prerequisites

- Python 3.11+
- Node.js 20+
- PostgreSQL database (NeonDB free tier works)
- Ollama (for local AI — optional, degrades gracefully if absent)

### Backend

```bash
cd engine
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

cp .env.example .env
# Edit .env and add your DATABASE_URL

python3 scripts/seed_db.py
uvicorn api.app:app --reload --port 8000
```

### Frontend

```bash
cd ui
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

### Local AI (optional)

```bash
brew install ollama
ollama pull gemma3:4b
brew services start ollama
```

If Ollama is not running, the API degrades gracefully — scores and decisions work without the AI narrative.

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/score` | Full merchant credit assessment |
| `GET` | `/api/v1/graph` | Trust network with fraud detection |
| `GET` | `/api/v1/fairness` | Group equity audit across socioeconomic segments |
| `GET` | `/api/v1/merchants` | List all enrolled merchants |
| `POST` | `/api/v1/merchants` | Onboard a new merchant |
| `GET` | `/api/v1/vouch-policy` | Vouch system limits and policy |
| `GET` | `/api/v1/vouch-requests` | Pending vouch requests for a business PAN |
| `POST` | `/api/v1/vouch-requests/{id}/respond` | Accept or decline a vouch request |
| `GET` | `/api/v1/merchant/{id}/score` | Score a specific merchant by ID |
| `GET` | `/health` | System health check |

---

## Demo Flow

```
1. Merchant Flow     →  Nabil Bank home screen
2. Merchant Loan     →  4-step onboarding (identity, data sources, quiz, loan)
3. Bank Dashboard    →  Explainable credit decision with AI summary
4. Trust Graph       →  Fraud ring detection visualised in real time
5. Vouch Requests    →  Peer vouching — search, send, approve, decline
```

---

## Fairness Design

Missing data lowers **confidence** — not eligibility. Thin-file merchants (short history, seasonal cashflow) receive a fairness correction that separates data gaps from risky behavior. Equally reliable merchants score equally regardless of socioeconomic background.

The fairness audit is attached to every score response and visible in the bank dashboard technical panel.

---

## Fraud Detection

Louvain community detection identifies isolated vouching clusters. A legitimate merchant network has diverse external connections. A fraud ring vouches only internally — caught automatically regardless of individual score.

Fraud-flagged merchants are highlighted in red on the trust graph and trigger automatic review flags in the bank dashboard.

---

## Limitations & Future Work

- ML model trained on synthetic data — requires retraining on real repayment outcomes once live data is available
- Data source integrations (NEA, NTC, eSewa) simulate OAuth; production requires formal partnership agreements
- Vouch SMS notifications are simulated; production deployment requires telecom integration
- Production launch requires NRB Fintech Regulatory Sandbox approval and audit

---

## Built For

**KMC HackVerse 2026** — Kathmandu Model College  
Challenge: *Alternative Trust Layer for Financial Inclusion*

---

## License

MIT
