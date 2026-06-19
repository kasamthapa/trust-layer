"""
scoring.py — TrustLayer formula-based scoring engine.

Converts raw merchant behavioural signals into a 300–850 credit-like score.
All logic is deterministic and explainable: every weight and threshold maps
directly to a named config constant so nothing is a magic number.

Pipeline per merchant:
  1. compute_confidence      — how much data do we have?
  2. compute_behaviour_score — what does the data say?
  3. compute_psychometric_floor — thin-file safety net
  4. compute_personal_score  — blend of the above three
  5. graph engine injects network_trust_score externally (see graph.py)
  6. final 300–850 score = personal * 400 + network * 150 + 300 baseline
"""

import json
import logging
import os
from functools import lru_cache
from typing import Optional

from config.settings import (
    CONFIDENCE_CAP,
    LOAN_AFFORDABILITY_RATIO,
    SCORE_BAND_GOLD,
    SCORE_BAND_PLATINUM,
    SCORE_BAND_SILVER,
    SEED_DATA_PATH,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Data loading
# ---------------------------------------------------------------------------

@lru_cache(maxsize=1)
def _load_raw() -> dict:
    """Load seed_data.json once and cache it for the process lifetime."""
    path = os.path.join(os.path.dirname(__file__), "..", SEED_DATA_PATH)
    with open(os.path.normpath(path), "r", encoding="utf-8") as f:
        return json.load(f)


def load_merchants() -> list[dict]:
    """Return all merchant records from seed_data.json."""
    return _load_raw()["merchants"]


def get_merchant(merchant_id: str) -> Optional[dict]:
    """Return a single merchant by id, or None if not found."""
    for m in load_merchants():
        if m["id"] == merchant_id:
            return m
    return None


def get_all_merchants() -> list[dict]:
    """Return all merchants (thin wrapper kept for API readability)."""
    return load_merchants()


# ---------------------------------------------------------------------------
# Database-backed data access (with JSON fallback)
# ---------------------------------------------------------------------------

def _row_to_merchant(row: tuple, columns: list[str]) -> dict:
    """Convert a psycopg2 row tuple + column list into a merchant dict.

    The DB stores the group field as `group_label` to avoid conflicting with
    the SQL reserved word GROUP. We remap it back to `group` here so the rest
    of the codebase never sees the difference.
    """
    m = dict(zip(columns, row))
    # Remap DB column name to the canonical field name used everywhere else.
    if "group_label" in m:
        m["group"] = m.pop("group_label")
    return m


def get_all_merchants_db() -> list[dict]:
    """Read all merchants from PostgreSQL.

    Returns an empty list (not an exception) if the DB is unreachable,
    so callers can fall through to the JSON fallback.
    """
    try:
        from src.database import get_connection  # lazy import avoids circular deps
        conn = get_connection()
        if conn is None:
            return []
        with conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT id, name, phone, location, occupation, group_label, "
                    "months_active, bill_payment_ratio, qr_transaction_consistency, "
                    "airtime_topup_frequency, psychometric_score, network_trust_score, "
                    "transaction_volatility, days_since_last_transaction, "
                    "community_fraud_flag, cashflow_monthly_npr, requested_loan_npr "
                    "FROM merchants ORDER BY id"
                )
                columns = [desc[0] for desc in cur.description]
                return [_row_to_merchant(row, columns) for row in cur.fetchall()]
    except Exception as exc:
        logger.warning("get_all_merchants_db failed: %s", exc)
        return []


def get_merchant_db(merchant_id: str) -> Optional[dict]:
    """Read a single merchant from PostgreSQL by id.

    Returns None (not an exception) if the DB is unreachable or the merchant
    does not exist, so callers can fall through to the JSON fallback.
    """
    try:
        from src.database import get_connection
        conn = get_connection()
        if conn is None:
            return None
        with conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT id, name, phone, location, occupation, group_label, "
                    "months_active, bill_payment_ratio, qr_transaction_consistency, "
                    "airtime_topup_frequency, psychometric_score, network_trust_score, "
                    "transaction_volatility, days_since_last_transaction, "
                    "community_fraud_flag, cashflow_monthly_npr, requested_loan_npr "
                    "FROM merchants WHERE id = %s",
                    (merchant_id,),
                )
                columns = [desc[0] for desc in cur.description]
                row = cur.fetchone()
                return _row_to_merchant(row, columns) if row else None
    except Exception as exc:
        logger.warning("get_merchant_db failed for %s: %s", merchant_id, exc)
        return None


def load_merchants_from_db() -> list[dict]:
    """Try the database first; fall back to JSON seed data silently.

    This is the preferred entry point for the graph engine and API routes
    so they automatically benefit from live DB data when available.
    """
    merchants = get_all_merchants_db()
    if merchants:
        return merchants
    logger.info("Database unavailable or empty — loading merchants from JSON seed data.")
    return load_merchants()


# ---------------------------------------------------------------------------
# Confidence
# ---------------------------------------------------------------------------

def compute_confidence(months_active: int) -> float:
    """
    Confidence reflects how much behavioural history we have.

    c = min(months_active / 12, CONFIDENCE_CAP)

    Capped at CONFIDENCE_CAP (0.85) because alternative data should never
    create the false certainty that a full credit bureau file would justify.
    A merchant with 12+ months is well-understood but still carries 15 %
    epistemic humility.
    """
    return min(months_active / 12.0, CONFIDENCE_CAP)


# ---------------------------------------------------------------------------
# Behaviour score
# ---------------------------------------------------------------------------

def compute_behaviour_score(merchant: dict) -> float:
    """
    Weighted average of four observable signals (0.0–1.0 each).

    Weights reflect the signal's reliability and local relevance:
      - bill_payment_ratio        0.35  Strongest predictor: paying utility/phone
                                        bills consistently shows financial discipline
                                        even without a bank account.
      - qr_transaction_consistency 0.30 QR penetration in Nepal is high post-2022;
                                        consistent QR use signals active trade and
                                        a verifiable income stream.
      - airtime_topup_frequency   0.20  Airtime top-ups are a widely-used informal
                                        savings proxy in emerging markets — regular
                                        small purchases indicate stable cash flow.
      - cashflow_seasonality      0.15  Inverted transaction_volatility: low
                                        volatility means predictable income, which
                                        reduces repayment risk.
    """
    bill      = merchant["bill_payment_ratio"]          * 0.35
    qr        = merchant["qr_transaction_consistency"]  * 0.30
    airtime   = merchant["airtime_topup_frequency"]     * 0.20
    stability = (1.0 - merchant["transaction_volatility"]) * 0.15

    return bill + qr + airtime + stability


# ---------------------------------------------------------------------------
# Psychometric floor
# ---------------------------------------------------------------------------

def compute_psychometric_floor(psychometric_score: Optional[float]) -> float:
    """
    Thin-file safety net for merchants with little behavioural history.

    If psychometric_score is None (cold-start / quiz not taken):
        floor = 0.35  — a neutral starting point, not a penalty.

    If psychometric_score is available (0.0–1.0):
        floor = 0.35 + 0.15 * psychometric_score  → range 0.35 – 0.50

    The quiz can lift a cold-start merchant slightly above the floor but
    is deliberately constrained so it cannot dominate the final score.
    Trust must be earned through behaviour over time, not self-reported.
    """
    if psychometric_score is None:
        return 0.35
    return 0.35 + 0.15 * psychometric_score


# ---------------------------------------------------------------------------
# Personal score
# ---------------------------------------------------------------------------

def compute_personal_score(merchant: dict) -> float:
    """
    Blend behavioural evidence with the psychometric floor, weighted by
    how much data we have (confidence).

    personal = c * B + (1 - c) * floor

    When c is low (new merchant), the floor dominates — we are cautious.
    As months_active grows, the observed behaviour B takes over.
    Returns a value in [0.0, 1.0].
    """
    c     = compute_confidence(merchant["months_active"])
    B     = compute_behaviour_score(merchant)
    floor = compute_psychometric_floor(merchant.get("psychometric_score"))

    return c * B + (1 - c) * floor


# ---------------------------------------------------------------------------
# Loan ceiling
# ---------------------------------------------------------------------------

def compute_loan_ceiling(merchant: dict, confidence: float) -> int:
    """
    Maximum loan we are willing to offer based on cashflow affordability.

    Base ceiling = monthly cashflow × LOAN_AFFORDABILITY_RATIO (0.75)
    If confidence < 0.4 (fewer than ~5 months of data), halve the ceiling —
    we want new merchants to demonstrate repayment on a smaller amount first.

    Returns an integer NPR value.
    """
    monthly = merchant["cashflow_monthly_npr"]
    ceiling = monthly * LOAN_AFFORDABILITY_RATIO

    if confidence < 0.4:
        ceiling = ceiling * 0.5

    return int(ceiling)


# ---------------------------------------------------------------------------
# Explanation builder
# ---------------------------------------------------------------------------

def build_explanation(
    merchant: dict,
    personal: float,
    confidence: float,
    behaviour: float,
    floor: float,
) -> list[dict]:
    """
    Return a list of human-readable explanation items for the score.
    Each item: {"factor": str, "direction": "+" | "-", "detail": str}

    Direction "+" means the factor contributed positively to the score;
    "-" means it dragged the score down.
    Thresholds are mid-points of the 0–1 scale unless otherwise noted.
    """
    items = []

    bill = merchant["bill_payment_ratio"]
    items.append({
        "factor": "Bill payment",
        "direction": "+" if bill >= 0.75 else "-",
        "detail": f"{bill:.0%} of bills paid on time — "
                  + ("strong repayment discipline." if bill >= 0.75
                     else "missed payments reduce confidence."),
    })

    qr = merchant["qr_transaction_consistency"]
    items.append({
        "factor": "QR transaction consistency",
        "direction": "+" if qr >= 0.70 else "-",
        "detail": f"{qr:.0%} QR consistency — "
                  + ("regular digital trade activity." if qr >= 0.70
                     else "irregular digital transactions noted."),
    })

    airtime = merchant["airtime_topup_frequency"]
    items.append({
        "factor": "Airtime top-up frequency",
        "direction": "+" if airtime >= 0.60 else "-",
        "detail": f"{airtime:.0%} top-up regularity — "
                  + ("consistent small cash-flow signal." if airtime >= 0.60
                     else "infrequent top-ups suggest irregular income."),
    })

    volatility = merchant["transaction_volatility"]
    items.append({
        "factor": "Cashflow stability",
        "direction": "+" if volatility <= 0.30 else "-",
        "detail": f"Volatility index {volatility:.2f} — "
                  + ("predictable income pattern." if volatility <= 0.30
                     else "high income variability increases risk."),
    })

    psych = merchant.get("psychometric_score")
    if psych is None:
        items.append({
            "factor": "Psychometric assessment",
            "direction": "-",
            "detail": "Assessment not completed — thin-file floor applied (not a penalty).",
        })
    else:
        items.append({
            "factor": "Psychometric assessment",
            "direction": "+" if psych >= 0.60 else "-",
            "detail": f"Score {psych:.2f} — "
                      + ("positive attitude and financial intent signals." if psych >= 0.60
                         else "assessment flagged some risk indicators."),
        })

    months = merchant["months_active"]
    items.append({
        "factor": "Data confidence",
        "direction": "+" if confidence >= 0.50 else "-",
        "detail": f"{months} months of activity (confidence {confidence:.2f}) — "
                  + ("sufficient history to rely on behaviour." if confidence >= 0.50
                     else "limited history; floor-based caution applied."),
    })

    return items


# ---------------------------------------------------------------------------
# Score band
# ---------------------------------------------------------------------------

def compute_score_band(score: int) -> str:
    """
    Map a 300–850 integer score to a named band.

    Platinum : {SCORE_BAND_PLATINUM}+  — highest trust, full loan ceiling available
    Gold     : {SCORE_BAND_GOLD}+      — approved with standard terms
    Silver   : {SCORE_BAND_SILVER}+    — approved with reduced ceiling or conditions
    Refused  : below {SCORE_BAND_SILVER} — insufficient trust signal
    """.format(
        SCORE_BAND_PLATINUM=SCORE_BAND_PLATINUM,
        SCORE_BAND_GOLD=SCORE_BAND_GOLD,
        SCORE_BAND_SILVER=SCORE_BAND_SILVER,
    )
    if score >= SCORE_BAND_PLATINUM:
        return "Platinum"
    if score >= SCORE_BAND_GOLD:
        return "Gold"
    if score >= SCORE_BAND_SILVER:
        return "Silver"
    return "Refused"
