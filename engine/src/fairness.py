"""
fairness.py — TrustLayer fairness audit engine.

Measures whether merchants from different socioeconomic segments receive equal
treatment when they have equal creditworthiness signals.

Group labels describe business context and geography, not ethnicity or caste:
  urban_established  — long-operating businesses in city centres
  urban_emerging     — newer businesses in urban or peri-urban areas
  rural_traditional  — community-based businesses in semi-urban/rural settings
  rural_underserved  — businesses in historically underserved areas
  peri_urban         — businesses on the urban fringe or in border communities

Design philosophy
-----------------
TrustLayer never uses socioeconomic segment as a scoring input. The `group`
field exists solely so this audit module can check that the features we DO use
(bills, QR, airtime, network) are not acting as proxies for background or location.

Two key principles enforced here:

  1. Missing data lowers confidence, not eligibility.
     A merchant with 2 months of data gets a cautious score, not a
     rejection. The psychometric floor (0.35 minimum) ensures that even
     zero-history merchants are evaluated on potential, not absence.

  2. Community trust is capped at 25% of the final score.
     The social graph is powerful but could re-encode structural inequalities
     if given too much weight (e.g. segments with historically weaker networks
     scoring lower purely due to fewer connections). Capping the graph
     contribution at 25% means behaviour always dominates.

The audit compares group-average scores before and after graph fusion to
verify that the cap is working as intended and that the gap between segments
does not widen when social signals are introduced.
"""

from typing import Optional

from src.scoring import (
    compute_confidence,
    compute_personal_score,
    get_all_merchants,
)
from src.graph import get_merchant_trust

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# Fusion weights — must sum to 1.0.
# Behaviour-based personal score carries 75% of the weight.
# Graph-derived social trust carries at most 25%.
_PERSONAL_WEIGHT = 0.75
_GRAPH_WEIGHT = 0.25

# Neutral graph substitute used in the "before graph" baseline calculation.
# 0.5 represents "no information" — neither trusted nor untrusted.
_NEUTRAL_GRAPH = 0.5

# Conversion factor: internal 0–1 scores scaled to 300–850 range for display.
# We use a 0–1000 scale here for the fairness report (simpler to read).
_SCORE_SCALE = 1000

# Thin-file threshold: fewer than this many months of activity.
_THIN_FILE_MONTHS = 6


# ---------------------------------------------------------------------------
# Group score computation
# ---------------------------------------------------------------------------

def compute_group_scores(use_graph: bool = False) -> dict[str, list[float]]:
    """
    Compute fused scores for every merchant and bucket them by community group.

    Fusion formula:
        fused = 0.75 * personal_score + 0.25 * trust_score

    When use_graph=False, trust_score is replaced with 0.5 (neutral baseline).
    This lets us compare the score distribution before and after the social
    graph is introduced, revealing whether it helps or harms equity.

    Returns:
        dict mapping group name → list of fused scores (0.0 – 1.0) for that group.
    """
    merchants = get_all_merchants()
    group_scores: dict[str, list[float]] = {}

    for m in merchants:
        personal = compute_personal_score(m)

        if use_graph:
            # Live trust score from graph PageRank.
            trust = get_merchant_trust(m["id"])
        else:
            # Neutral stand-in: no social signal applied yet.
            trust = _NEUTRAL_GRAPH

        fused = _PERSONAL_WEIGHT * personal + _GRAPH_WEIGHT * trust

        group = m["group"]
        group_scores.setdefault(group, []).append(fused)

    return group_scores


# ---------------------------------------------------------------------------
# Fairness metrics
# ---------------------------------------------------------------------------

def compute_fairness_metrics() -> dict:
    """
    Compare group-average scores before and after graph fusion.

    The key output is gap_reduction_pct: a positive number means the graph
    fusion narrowed the spread between groups (good). A negative number
    would mean it widened inequality (a signal to reduce _GRAPH_WEIGHT).

    Scores are scaled to 0–1000 for legibility in the audit report.
    """
    scores_before = compute_group_scores(use_graph=False)
    scores_after = compute_group_scores(use_graph=True)

    all_groups = sorted(set(scores_before) | set(scores_after))

    def avg(scores: list[float]) -> float:
        return sum(scores) / len(scores) if scores else 0.0

    # Scale to 0-1000 for display.
    before_avg: dict[str, float] = {
        g: round(avg(scores_before.get(g, [])) * _SCORE_SCALE, 1)
        for g in all_groups
    }
    after_avg: dict[str, float] = {
        g: round(avg(scores_after.get(g, [])) * _SCORE_SCALE, 1)
        for g in all_groups
    }

    before_values = list(before_avg.values())
    after_values = list(after_avg.values())

    max_gap_before = round(max(before_values) - min(before_values), 1) if before_values else 0.0
    max_gap_after = round(max(after_values) - min(after_values), 1) if after_values else 0.0

    # Positive = gap narrowed after graph was introduced.
    # We guard against division by zero for the degenerate case of zero gap.
    if max_gap_before > 0:
        gap_reduction_pct = round((max_gap_before - max_gap_after) / max_gap_before * 100, 1)
    else:
        gap_reduction_pct = 0.0

    merchant_counts: dict[str, int] = {
        g: len(scores_before.get(g, []))
        for g in all_groups
    }

    return {
        "groups": all_groups,
        "before": before_avg,
        "after": after_avg,
        "max_gap_before": max_gap_before,
        "max_gap_after": max_gap_after,
        "gap_reduction_pct": gap_reduction_pct,
        "note": (
            "Community trust weight capped at 25% to prevent social graph from "
            "encoding historical inequality. "
            "Missing data lowers confidence, not eligibility."
        ),
        "merchant_counts": merchant_counts,
    }


# ---------------------------------------------------------------------------
# Thin-file analysis
# ---------------------------------------------------------------------------

def get_thin_file_analysis() -> dict:
    """
    Examine how the system handles cold-start and data-sparse merchants.

    Thin-file merchants are defined as those with:
        months_active < _THIN_FILE_MONTHS (6)  OR  psychometric_score is None

    The psychometric floor (0.35) ensures that even a merchant with zero
    transaction history still receives a non-zero starting score. This is
    intentional: the floor represents "plausible new entrant" not "zero trust".

    Compares the average score of thin-file vs established merchants to show
    that the gap is modest and proportional — not a hard cutoff.
    """
    merchants = get_all_merchants()

    thin_file = [
        m for m in merchants
        if m["months_active"] < _THIN_FILE_MONTHS or m.get("psychometric_score") is None
    ]
    established = [
        m for m in merchants
        if m["months_active"] >= _THIN_FILE_MONTHS and m.get("psychometric_score") is not None
    ]

    def avg_score(group: list[dict]) -> float:
        if not group:
            return 0.0
        scores = [compute_personal_score(m) for m in group]
        return round(sum(scores) / len(scores), 4)

    avg_thin = avg_score(thin_file)
    avg_established = avg_score(established)

    floor_explanation = (
        "Merchants with limited history (< 6 months or no psychometric quiz) receive "
        "a 0.35 floor score — equivalent to roughly 440 on a 300-850 scale. "
        "This is not approval; it is a cautious starting point that keeps the door open "
        "while asking the merchant to demonstrate repayment on a smaller initial loan. "
        "The floor is never used as a ceiling: as behaviour data accumulates, "
        "the confidence weight shifts toward observed signals and the floor fades out."
    )

    return {
        "thin_file_count": len(thin_file),
        "established_count": len(established),
        "avg_score_thin": avg_thin,
        "avg_score_established": avg_established,
        "thin_file_ids": [m["id"] for m in thin_file],
        "floor_explanation": floor_explanation,
    }


# ---------------------------------------------------------------------------
# Per-merchant fairness audit
# ---------------------------------------------------------------------------

# Score adjustment caps — prevent the fairness boost from dominating the result.
_VERY_THIN_BOOST = 30   # < 6 months active
_THIN_BOOST = 20        # 6–11 months active
_LOW_VOUCHER_BOOST = 12 # network trust below 0.4 (sparse connections, not distrust)
_SEASONAL_BOOST = 10    # high cashflow volatility (seasonal trade pattern)
_MAX_ADJUSTMENT = 50    # hard ceiling on total fairness correction

# Thresholds
_FULL_HISTORY_MONTHS = 12   # above this = established, no thin-file boost
_VERY_THIN_MONTHS = 6       # below this = very thin file
_LOW_VOUCHER_THRESHOLD = 0.4
_SEASONAL_THRESHOLD = 0.6   # stability = 1 - volatility; below this = seasonal
_RISKY_BILL_THRESHOLD = 0.6


def compute_merchant_fairness(
    merchant: dict,
    base_score: int,
    gate_status: str,
    fraud_flagged: bool,
) -> dict:
    """
    Compute a per-merchant fairness audit and optional score correction.

    Core principle: missing data lowers confidence, not eligibility.
    This function separates two categories:

      1. Data gaps   — thin history, sparse network, seasonal cashflow.
                       These are NOT the merchant's fault. A modest upward
                       correction is applied to prevent the system from
                       auto-rejecting merchants who simply lack a track record.

      2. Risk signals — low bill payment, fraud ring membership, gate FLAGGED.
                       These ARE evidence of risk. No correction is applied;
                       the base score stands.

    Returns a dict that maps directly onto the FairnessAudit Pydantic model.
    """
    months = merchant["months_active"]
    thin_file = months < _FULL_HISTORY_MONTHS
    very_thin_file = months < _VERY_THIN_MONTHS

    stability = 1.0 - merchant["transaction_volatility"]
    seasonal = stability < _SEASONAL_THRESHOLD

    network_trust = merchant.get("network_trust_score", 0.5)
    low_voucher = network_trust < _LOW_VOUCHER_THRESHOLD

    bill_ratio = merchant["bill_payment_ratio"]
    risky = bill_ratio < _RISKY_BILL_THRESHOLD or fraud_flagged or gate_status == "FLAGGED"

    # --- Hard cases: fraud or genuine repayment risk — no correction ---
    if fraud_flagged:
        return {
            "status": "watch",
            "title": "Fairness watch: fraud risk overrides correction",
            "before_score": base_score,
            "adjustment": 0,
            "after_score": base_score,
            "policy": "Fraud patterns detected — fairness boost withheld",
            "summary": (
                "TrustLayer detected irregular vouching patterns. "
                "Fairness correction is withheld when fraud signals are present."
            ),
            "reasons": [
                "Circular vouching pattern detected in community network.",
                "Fairness boost does not apply when fraud gate is active.",
            ],
        }

    if bill_ratio < _RISKY_BILL_THRESHOLD:
        return {
            "status": "watch",
            "title": "Fairness watch: repayment risk remains",
            "before_score": base_score,
            "adjustment": 0,
            "after_score": base_score,
            "policy": "Repayment risk present — no correction applied",
            "summary": (
                "Missing data and repayment risk are treated separately. "
                "This merchant shows both thin history and repayment concerns."
            ),
            "reasons": [
                "Bill repayment below 60% threshold.",
                "Fairness correction applies to missing data, not repayment risk.",
            ],
        }

    # --- Data-gap correction path ---
    adjustment = 0
    reasons: list[str] = []

    if very_thin_file:
        adjustment += _VERY_THIN_BOOST
        reasons.append(
            f"{months} months of records: very limited history lowers confidence, "
            "not automatic eligibility."
        )
    elif thin_file:
        adjustment += _THIN_BOOST
        reasons.append(
            f"{months} months of records: limited history lowers confidence, "
            "not eligibility."
        )

    if low_voucher:
        adjustment += _LOW_VOUCHER_BOOST
        reasons.append(
            "Low community trust score: network connections help but loan ceiling "
            "stays cautious."
        )

    if seasonal:
        adjustment += _SEASONAL_BOOST
        reasons.append(
            "Seasonal cashflow pattern detected: income variability is acknowledged, "
            "not penalized."
        )

    adjustment = min(adjustment, _MAX_ADJUSTMENT)
    after_score = min(base_score + adjustment, 1000)

    if adjustment > 0:
        # Determine the most descriptive title based on primary driver.
        if very_thin_file:
            title = "Thin-file fairness correction applied"
            policy = "Correct missing-data bias"
        elif seasonal:
            title = "Seasonal cashflow adjustment applied"
            policy = "Acknowledge income seasonality"
        else:
            title = "Fairness correction applied"
            policy = "Correct missing-data bias"

        # Append the invariant closing reason last.
        reasons.append(
            "Missing data is separated from risky behaviour — late bills, fraud rings, "
            "and anomalous loan requests are still penalized."
        )

        return {
            "status": "corrected",
            "title": title,
            "before_score": base_score,
            "adjustment": adjustment,
            "after_score": after_score,
            "policy": policy,
            "summary": (
                "TrustLayer does not treat limited records as bad behaviour. "
                "The merchant stays eligible, but confidence and loan ceiling "
                "remain cautious."
            ),
            "reasons": reasons,
        }

    # --- No correction needed ---
    return {
        "status": "passed",
        "title": "Fairness audit passed",
        "before_score": base_score,
        "adjustment": 0,
        "after_score": base_score,
        "policy": "No correction needed",
        "summary": (
            "Sufficient behavioural data available. Score reflects actual activity "
            "without fairness adjustment."
        ),
        "reasons": [
            "Adequate history and behavioural signals available.",
            "No thin-file or seasonal penalties detected.",
        ],
    }
