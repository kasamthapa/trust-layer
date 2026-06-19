"""
routes.py — TrustLayer API router.

Wires together scoring, graph, fairness, ML, and AI layers into REST endpoints.
All endpoints are best-effort: individual layer failures (ML unavailable,
Ollama down, DB offline) degrade gracefully rather than returning 500s.

Prefix: /api/v1
"""

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException

from api.schemas import (
    ExplanationItem,
    FairnessAudit,
    FairnessGroup,
    FairnessResponse,
    GraphEdge,
    GraphNode,
    GraphResponse,
    LayerBreakdown,
    MerchantSummary,
    ScoreRequest,
    ScoreResponse,
    SHAPItem,
)
from config.settings import SCORE_BAND_SILVER
from src.fairness import compute_fairness_metrics, compute_merchant_fairness, get_thin_file_analysis
from src.graph import get_graph_data, get_merchant_trust
from src.ml_model import get_shap_explanation, predict_band
from src.scoring import (
    build_explanation,
    compute_behaviour_score,
    compute_confidence,
    compute_loan_ceiling,
    compute_personal_score,
    compute_psychometric_floor,
    compute_score_band,
    get_merchant,
    load_merchants_from_db,
)
from src.ai_agent import generate_summary

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["trustlayer"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_merchant_or_404(merchant_id: str) -> dict:
    """Load a merchant by ID from DB (with JSON fallback), raise 404 if missing."""
    # Try the DB-aware loader first; fall back to the JSON-only path.
    merchants = load_merchants_from_db()
    for m in merchants:
        if m["id"] == merchant_id:
            return m
    raise HTTPException(status_code=404, detail=f"Merchant '{merchant_id}' not found.")


def _build_score_response(merchant: dict, requested_loan_override: Optional[float] = None) -> ScoreResponse:
    """
    Run the full scoring pipeline for one merchant and return a ScoreResponse.

    Extracted into a helper so both POST /score and GET /merchant/{id}/score
    share identical logic without duplication.
    """
    merchant_id = merchant["id"]

    # --- Layer 1: formula-based personal score ---
    personal = compute_personal_score(merchant)
    confidence = compute_confidence(merchant["months_active"])
    behaviour = compute_behaviour_score(merchant)
    floor = compute_psychometric_floor(merchant.get("psychometric_score"))

    # --- Layer 2: social graph trust ---
    trust_score = get_merchant_trust(merchant_id)

    # --- Layer 3: ML prediction ---
    try:
        ml_result = predict_band(merchant, trust_score)
    except Exception as exc:
        logger.warning("ML prediction failed for %s: %s", merchant_id, exc)
        ml_result = {"ml_band": "unavailable", "ml_score": 500, "ml_confidence": 0.0, "feature_importance": []}

    # --- Explanation layers ---
    try:
        raw_explanation = build_explanation(merchant, personal, confidence, behaviour, floor)
        explanation = [ExplanationItem(**e) for e in raw_explanation]
    except Exception as exc:
        logger.warning("Explanation build failed for %s: %s", merchant_id, exc)
        explanation = []

    try:
        raw_shap = get_shap_explanation(merchant, trust_score)
        shap_factors = [SHAPItem(**s) for s in raw_shap]
    except Exception as exc:
        logger.warning("SHAP explanation failed for %s: %s", merchant_id, exc)
        shap_factors = []

    # --- Fraud flag ---
    try:
        graph_data = get_graph_data()
        fraud_flagged = merchant_id in graph_data["fraud_ring_ids"]
    except Exception as exc:
        logger.warning("Fraud check failed for %s: %s", merchant_id, exc)
        fraud_flagged = bool(merchant.get("community_fraud_flag", 0))

    # --- Score fusion ---
    # formula_score and graph_score are normalised to 0–1 then scaled to 0–1000
    # so all three layers are on the same scale before blending.
    formula_score = int(personal * 1000)
    graph_score = int(trust_score * 1000)
    ml_score = ml_result["ml_score"]

    # Weights: formula carries the most weight (50%) because it is the most
    # explainable signal. Graph and ML each contribute 25% as corroborating layers.
    final_fused = int(0.50 * formula_score + 0.25 * graph_score + 0.25 * ml_score)
    final_fused = max(0, min(1000, final_fused))

    band = compute_score_band(final_fused)
    loan_ceiling = compute_loan_ceiling(merchant, confidence)

    layer_breakdown = LayerBreakdown(
        formula_score=formula_score,
        graph_score=graph_score,
        ml_score=ml_score,
        final_fused=final_fused,
    )

    # --- Loan amount (override or seed data) ---
    requested_loan = int(
        requested_loan_override
        if requested_loan_override is not None
        else merchant["requested_loan_npr"]
    )

    # --- Gate check ---
    # Fraud ring membership is the hardest gate — no amount is safe.
    # Loan-to-ceiling ratio uses 1.5× as the outer boundary: merchants can
    # ask for slightly more than their ceiling (lenders negotiate), but
    # anything beyond 1.5× signals unrealistic expectations.
    if fraud_flagged:
        gate_status = "FLAGGED"
        gate_reason = "Merchant is part of a detected fraud ring."
    elif requested_loan > loan_ceiling * 1.5:
        gate_status = "FLAGGED"
        gate_reason = (
            f"Requested loan (NPR {requested_loan:,}) exceeds safe lending "
            f"threshold (NPR {int(loan_ceiling * 1.5):,})."
        )
    else:
        gate_status = "CLEAR"
        gate_reason = None

    # --- Fairness audit and optional score correction ---
    fairness_raw = compute_merchant_fairness(merchant, final_fused, gate_status, fraud_flagged)
    # Use the corrected score (after_score) as the final score presented to the user.
    final_score = fairness_raw["after_score"]
    # Recompute band from the corrected score so band and score stay consistent.
    band = compute_score_band(final_score)
    fairness_audit = FairnessAudit(**fairness_raw)

    # --- AI narrative summary (non-blocking) ---
    ai_summary: Optional[str] = None
    try:
        ai_summary = generate_summary(
            merchant_name=merchant["name"],
            score=final_score,
            band=band,
            gate_status=gate_status,
            explanation=raw_explanation,
            confidence=confidence,
            loan_ceiling=loan_ceiling,
            fraud_flagged=fraud_flagged,
            ml_band=ml_result["ml_band"],
        )
    except Exception as exc:
        logger.error("AI summary failed for %s: %s", merchant_id, exc, exc_info=True)

    return ScoreResponse(
        merchant_id=merchant_id,
        name=merchant["name"],
        occupation=merchant["occupation"],
        location=merchant["location"],
        score=final_score,
        band=band,
        confidence=round(confidence, 4),
        loan_ceiling=loan_ceiling,
        requested_loan=requested_loan,
        gate_status=gate_status,
        gate_reason=gate_reason,
        explanation=explanation,
        shap_factors=shap_factors,
        layer_breakdown=layer_breakdown,
        ai_summary=ai_summary,
        ml_band=ml_result["ml_band"],
        ml_confidence=ml_result["ml_confidence"],
        fraud_flagged=fraud_flagged,
        fairness_audit=fairness_audit,
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/merchants", response_model=list[MerchantSummary])
def list_merchants() -> list[MerchantSummary]:
    """
    Return all merchants as lightweight summaries for the UI picker dropdown.

    Tries the database first; falls back to JSON seed data automatically.
    """
    try:
        merchants = load_merchants_from_db()
        return [
            MerchantSummary(
                id=m["id"],
                name=m["name"],
                occupation=m["occupation"],
                location=m["location"],
                months_active=m["months_active"],
            )
            for m in merchants
        ]
    except Exception as exc:
        logger.error("list_merchants failed: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to load merchant list.")


@router.get("/merchants/{merchant_id}")
def get_merchant_profile(merchant_id: str) -> dict:
    """
    Return the full raw profile for a single merchant including all signal fields.

    Used by the UI detail panel and by automated tests that need to inspect
    the raw data before scoring.
    """
    return _get_merchant_or_404(merchant_id)


@router.post("/score", response_model=ScoreResponse)
def score_merchant(request: ScoreRequest) -> ScoreResponse:
    """
    Run the full TrustLayer scoring pipeline for a merchant.

    Pipeline:
      1. Load merchant from DB / JSON
      2. Formula layer  — behavioural signals + psychometric floor
      3. Graph layer    — PageRank social trust from vouch network
      4. ML layer       — XGBoost pattern recognition (second opinion)
      5. Fuse scores    — 50% formula + 25% graph + 25% ML
      6. Gate check     — fraud ring + loan-to-ceiling ratio
      7. AI narrative   — Ollama LLM summary (non-blocking)

    If the ML model or Ollama are unavailable the response still returns
    with ml_band="unavailable" and ai_summary=null respectively.
    """
    merchant = _get_merchant_or_404(request.merchant_id)
    return _build_score_response(merchant, requested_loan_override=request.requested_loan_amount)


@router.get("/graph", response_model=GraphResponse)
def get_graph() -> GraphResponse:
    """
    Return the full merchant vouch network for the UI graph visualisation.

    Nodes carry trust scores and fraud flags. Edges carry normalised
    trust-budget weights. The fraud_ring_ids list lets the UI highlight
    the ring cluster distinctly.

    Response is cached after first build — subsequent calls are O(1).
    """
    try:
        data = get_graph_data()
        return GraphResponse(
            nodes=[GraphNode(**n) for n in data["nodes"]],
            edges=[GraphEdge(**e) for e in data["edges"]],
            fraud_ring_ids=data["fraud_ring_ids"],
            stats=data["stats"],
        )
    except Exception as exc:
        logger.error("get_graph failed: %s", exc)
        raise HTTPException(status_code=500, detail="Graph engine error.")


@router.get("/fairness", response_model=FairnessResponse)
def get_fairness() -> FairnessResponse:
    """
    Return the inter-group fairness audit comparing scores before and after
    graph fusion, broken down by community group (brahmin / chhetri /
    janajati / dalit / madhesi).

    Also incorporates thin-file analysis into the explanatory note so the
    UI fairness panel can surface both equity dimensions in one call.
    """
    try:
        metrics = compute_fairness_metrics()
        thin = get_thin_file_analysis()

        groups = []
        for g in metrics["groups"]:
            groups.append(
                FairnessGroup(
                    group=g,
                    avg_score_before=metrics["before"][g],
                    avg_score_after=metrics["after"][g],
                    merchant_count=metrics["merchant_counts"][g],
                )
            )

        # Enrich the standard note with thin-file numbers so the UI has
        # both equity stories in a single response.
        thin_note = (
            f" Thin-file merchants ({thin['thin_file_count']} of "
            f"{thin['thin_file_count'] + thin['established_count']} total) "
            f"average {thin['avg_score_thin']:.2f} vs "
            f"{thin['avg_score_established']:.2f} for established merchants — "
            "a proportional gap, not a hard cutoff."
        )

        return FairnessResponse(
            groups=groups,
            max_gap_before=metrics["max_gap_before"],
            max_gap_after=metrics["max_gap_after"],
            gap_reduction_pct=metrics["gap_reduction_pct"],
            note=metrics["note"] + thin_note,
        )
    except Exception as exc:
        logger.error("get_fairness failed: %s", exc)
        raise HTTPException(status_code=500, detail="Fairness engine error.")


@router.get("/merchant/{merchant_id}/score", response_model=ScoreResponse)
def get_merchant_score(merchant_id: str) -> ScoreResponse:
    """
    Convenience GET endpoint: score a specific merchant using their own
    requested_loan_npr from seed data, without needing a POST body.

    Identical output to POST /score — useful for quick demos, direct URL
    sharing, and the UI's one-click score buttons.
    """
    merchant = _get_merchant_or_404(merchant_id)
    return _build_score_response(merchant, requested_loan_override=None)
