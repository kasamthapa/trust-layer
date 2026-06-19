"""
fairness.py — TrustLayer fairness audit engine.

Measures whether merchants from different community groups receive equal
treatment when they have equal creditworthiness signals.

Design philosophy
-----------------
TrustLayer never uses caste, ethnicity, or community group as a scoring
input. The `group` field exists solely so this audit module can check that
the features we DO use (bills, QR, airtime, network) are not acting as
proxies for social identity.

Two key principles enforced here:

  1. Missing data lowers confidence, not eligibility.
     A merchant with 2 months of data gets a cautious score, not a
     rejection. The psychometric floor (0.35 minimum) ensures that even
     zero-history merchants are evaluated on potential, not absence.

  2. Community trust is capped at 25% of the final score.
     The social graph is powerful but could re-encode historical inequalities
     if given too much weight (e.g. groups with historically weaker networks
     scoring lower purely due to fewer connections). Capping the graph
     contribution at 25% means behaviour always dominates.

The audit compares group-average scores before and after graph fusion to
verify that the cap is working as intended and that the gap between groups
does not widen when social signals are introduced.
"""

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
