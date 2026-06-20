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
    MerchantCreateRequest,
    MerchantCreateResponse,
    MerchantSummary,
    ScoreRequest,
    ScoreResponse,
    SHAPItem,
    VouchLimit,
    VouchLookupMerchant,
    VouchLookupResponse,
    VouchRequest,
    VouchRespondRequest,
    VouchStats,
)
from config.settings import (
    SCORE_BAND_SILVER,
    MAX_VOUCHES_GIVEN,
    MAX_VOUCHES_RECEIVED,
    VOUCH_DEFAULT_IMPACT,
)
from src.fairness import compute_fairness_metrics, compute_merchant_fairness, get_thin_file_analysis
from src.graph import build_graph, compute_vouch_stats, get_graph_data, get_merchant_trust
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



def _normalise_identifier(value: str) -> str:
    return value.strip().lower()


def _find_merchant_by_identifier(identifier: str) -> Optional[dict]:
    """Find a merchant by merchant ID, business PAN, or phone number."""
    needle = _normalise_identifier(identifier)
    if not needle:
        return None
    for m in load_merchants_from_db():
        candidates = [
            m.get("id"),
            m.get("business_pan"),
            m.get("phone"),
        ]
        if any(_normalise_identifier(str(c)) == needle for c in candidates if c):
            return m
    return None


def _empty_vouch_stats() -> VouchStats:
    return VouchStats(
        vouches_given=0,
        vouches_received=0,
        vouches_given_remaining=MAX_VOUCHES_GIVEN,
        vouches_received_remaining=MAX_VOUCHES_RECEIVED,
        fraud_association=False,
    )

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

    # Weights: formula (70%) + graph (30%). ML is shadow mode — advisory only.
    # ML model was trained on synthetic data; it will be retrained on real
    # repayment outcomes after 12–18 months of production data collection.
    final_fused = int(0.70 * formula_score + 0.30 * graph_score)
    final_fused = max(0, min(1000, final_fused))

    band = compute_score_band(final_fused)
    loan_ceiling = compute_loan_ceiling(merchant, confidence)

    layer_breakdown = LayerBreakdown(
        formula_score=formula_score,
        graph_score=graph_score,
        ml_score=ml_score,
        final_fused=final_fused,
        ml_note=(
            "Formula carries 70% weight reflecting behavioral data reliability. "
            "Graph carries 30% reflecting network size — weight increases as merchant "
            "network grows. ML runs in shadow mode."
        ),
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

    # --- Vouch stats ---
    try:
        G = build_graph()
        all_vouch_stats = compute_vouch_stats(G)
        vs_raw = all_vouch_stats.get(merchant_id, {
            "vouches_given": 0,
            "vouches_received": 0,
            "vouches_given_remaining": MAX_VOUCHES_GIVEN,
            "vouches_received_remaining": MAX_VOUCHES_RECEIVED,
            "fraud_association": False,
        })
        vouch_stats = VouchStats(**vs_raw)
    except Exception as exc:
        logger.warning("Vouch stats failed for %s: %s", merchant_id, exc)
        vouch_stats = VouchStats(
            vouches_given=0,
            vouches_received=0,
            vouches_given_remaining=MAX_VOUCHES_GIVEN,
            vouches_received_remaining=MAX_VOUCHES_RECEIVED,
            fraud_association=False,
        )

    # If this merchant has vouched for a fraud-ring member, add a warning factor
    if vouch_stats.fraud_association:
        explanation.append(ExplanationItem(
            factor="Fraud Association",
            direction="-",
            detail="This merchant has vouched for at least one member of a detected fraud ring. Association review triggered.",
        ))

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
            fraud_association=vouch_stats.fraud_association,
        )
    except Exception as exc:
        logger.error("AI summary failed for %s: %s", merchant_id, exc, exc_info=True)

    return ScoreResponse(
        merchant_id=merchant_id,
        name=merchant["name"],
        business_type=merchant["business_type"],
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
        vouch_stats=vouch_stats,
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/merchants", response_model=MerchantCreateResponse)
def create_merchant(req: MerchantCreateRequest) -> MerchantCreateResponse:
    """
    Onboard a new merchant submitted via the merchant flow UI.

    Inserts into PostgreSQL, clears caches so the new merchant is immediately
    visible in subsequent list/score/graph calls, then returns the assigned ID.
    Falls back to a deterministic generated ID if the database is unavailable
    (demo-safe: does not raise a 500 in the hackathon sandbox).
    """
    from src.database import get_connection
    from src.graph import get_graph_data

    try:
        conn = get_connection()
        if conn is None:
            raise RuntimeError("Database unavailable")

        with conn:
            with conn.cursor() as cur:
                cur.execute("SELECT COUNT(*) FROM merchants;")
                count = cur.fetchone()[0]
                new_id = f"M{count + 1:03d}"

                cur.execute(
                    """
                    INSERT INTO merchants (
                        id, name, phone, citizenship_no, business_name, business_pan,
                        location, business_type, group_label,
                        months_active, bill_payment_ratio, qr_transaction_consistency,
                        airtime_topup_frequency, psychometric_score, network_trust_score,
                        transaction_volatility, days_since_last_transaction,
                        community_fraud_flag, cashflow_monthly_npr, requested_loan_npr,
                        loan_purpose, connected_sources
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s,
                        %s, %s, %s,
                        %s, %s, %s,
                        %s, %s, %s,
                        %s, %s,
                        %s, %s, %s,
                        %s, %s
                    )
                    """,
                    (
                        new_id, req.name, req.phone, req.citizenship_no,
                        req.business_name, req.business_pan, req.location, req.business_type,
                        "urban_emerging",
                        req.months_active, req.bill_payment_ratio,
                        req.qr_transaction_consistency, req.airtime_topup_frequency,
                        req.psychometric_score, 0.5,
                        req.transaction_volatility, req.days_since_last_transaction,
                        0, req.cashflow_monthly_npr, req.requested_loan_npr,
                        req.loan_purpose, ",".join(req.connected_sources),
                    ),
                )
        # Create pending vouch requests for each voucher PAN provided
        if req.voucher_pans:
            with conn:
                with conn.cursor() as cur:
                    for pan in req.voucher_pans:
                        pan = pan.strip()
                        if pan:
                            cur.execute(
                                "INSERT INTO vouch_requests (requester_id, voucher_pan, status) VALUES (%s, %s, 'pending')",
                                (new_id, pan),
                            )
        conn.close()

        # Clear graph cache so the new merchant is included in subsequent graph calls.
        get_graph_data.cache_clear()

        logger.info("New merchant created: %s (%s)", new_id, req.name)
        return MerchantCreateResponse(
            merchant_id=new_id,
            message=f"Merchant {req.name} successfully onboarded to TrustLayer. Reference ID: {new_id}",
        )

    except Exception as exc:
        logger.error("create_merchant failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Merchant creation failed: {exc}")


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
                business_type=m["business_type"],
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
      4. ML layer       — XGBoost pattern recognition (advisory / shadow mode)
      5. Fuse scores    — 70% formula + 30% graph (ML excluded until real data)
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


@router.get("/vouch-policy", response_model=VouchLimit)
def get_vouch_policy() -> VouchLimit:
    """
    Return the system-wide vouch policy constants.

    Used by the merchant onboarding UI to show limits and consequences
    before the merchant submits their application.
    """
    return VouchLimit(
        max_given=MAX_VOUCHES_GIVEN,
        max_received=MAX_VOUCHES_RECEIVED,
        default_impact_rate=VOUCH_DEFAULT_IMPACT,
        policy=(
            f"Each merchant may vouch for up to {MAX_VOUCHES_GIVEN} others. "
            f"Others may vouch for you up to {MAX_VOUCHES_RECEIVED} times. "
            f"Vouching for a merchant who defaults on their loan reduces your trust score "
            f"by {int(VOUCH_DEFAULT_IMPACT * 100)}% of the vouch weight. "
            "Vouching for a fraud ring member triggers an association review of your profile."
        ),
    )


def _fetch_pending_vouch_requests(identifier: str) -> list[VouchRequest]:
    """Return pending requests for a voucher identifier (PAN, merchant ID, or phone)."""
    from src.database import get_connection
    conn = get_connection()
    if conn is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
    merchant = _find_merchant_by_identifier(identifier)
    identifiers = {identifier.strip()}
    if merchant:
        for key in ("business_pan", "id", "phone"):
            value = merchant.get(key)
            if value:
                identifiers.add(str(value))
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT vr.id, vr.requester_id, vr.status,
                       to_char(vr.created_at, 'YYYY-MM-DD HH24:MI:SS'),
                       m.name, m.business_type, m.location,
                       m.months_active, m.cashflow_monthly_npr, m.requested_loan_npr,
                       m.loan_purpose
                FROM vouch_requests vr
                JOIN merchants m ON m.id = vr.requester_id
                WHERE vr.voucher_pan = ANY(%s) AND vr.status = 'pending'
                ORDER BY vr.created_at DESC
                """,
                (list(identifiers),),
            )
            rows = cur.fetchall()
        return [
            VouchRequest(
                id=r[0],
                requester_id=r[1],
                status=r[2],
                created_at=r[3],
                requester_name=r[4],
                business_type=r[5],
                location=r[6],
                months_active=r[7],
                cashflow_monthly_npr=r[8],
                requested_loan_npr=r[9],
                loan_purpose=r[10],
            )
            for r in rows
        ]
    except Exception as exc:
        logger.error("_fetch_pending_vouch_requests failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))
    finally:
        conn.close()


@router.get("/vouch-requests", response_model=list[VouchRequest])
def get_vouch_requests(pan: str) -> list[VouchRequest]:
    """Return pending vouch requests for a voucher PAN, merchant ID, or phone."""
    return _fetch_pending_vouch_requests(pan)


@router.get("/vouch-lookup", response_model=VouchLookupResponse)
def get_vouch_lookup(query: str) -> VouchLookupResponse:
    """Lookup voucher requests and received-vouch quota by merchant ID or PAN."""
    clean = query.strip()
    if not clean:
        raise HTTPException(status_code=400, detail="query is required")

    merchant = _find_merchant_by_identifier(clean)
    try:
        G = build_graph()
        stats_map = compute_vouch_stats(G)
        stats = VouchStats(**stats_map.get(merchant["id"], _empty_vouch_stats().model_dump())) if merchant else _empty_vouch_stats()
    except Exception as exc:
        logger.warning("vouch lookup stats failed for %s: %s", clean, exc)
        stats = _empty_vouch_stats()

    requests = _fetch_pending_vouch_requests(clean)
    return VouchLookupResponse(
        merchant=VouchLookupMerchant(
            id=merchant["id"],
            name=merchant["name"],
            business_type=merchant.get("business_type", ""),
            location=merchant.get("location", ""),
            business_pan=merchant.get("business_pan"),
            phone=merchant.get("phone"),
        ) if merchant else None,
        vouch_stats=stats,
        max_received=MAX_VOUCHES_RECEIVED,
        requests_remaining=max(0, MAX_VOUCHES_RECEIVED - stats.vouches_received),
        requests=requests,
    )


@router.post("/vouch-requests/{request_id}/respond")
def respond_vouch_request(request_id: int, body: VouchRespondRequest):
    """Accept or decline a vouch request. Accepting creates a vouch record."""
    from src.database import get_connection
    if body.action not in ("accept", "decline"):
        raise HTTPException(status_code=400, detail="action must be 'accept' or 'decline'")
    conn = get_connection()
    if conn is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT requester_id, status FROM vouch_requests WHERE id = %s",
                    (request_id,),
                )
                row = cur.fetchone()
                if not row:
                    raise HTTPException(status_code=404, detail="Vouch request not found")
                requester_id, status = row
                if status != "pending":
                    raise HTTPException(status_code=409, detail=f"Request already {status}")

                # Look up the voucher's merchant id by PAN
                cur.execute(
                    "SELECT id FROM merchants WHERE phone = %s OR id = %s OR business_pan = %s LIMIT 1",
                    (body.voucher_pan, body.voucher_pan, body.voucher_pan),
                )
                voucher_row = cur.fetchone()

                cur.execute(
                    "UPDATE vouch_requests SET status = %s WHERE id = %s",
                    (body.action + "d", request_id),
                )
                if body.action == "accept" and voucher_row:
                    cur.execute("SELECT COUNT(*) FROM vouches WHERE to_id = %s", (requester_id,))
                    received_count = cur.fetchone()[0]
                    if received_count >= MAX_VOUCHES_RECEIVED:
                        raise HTTPException(status_code=409, detail="Requester has reached the maximum received voucher limit")
                    voucher_id = voucher_row[0]
                    cur.execute(
                        "INSERT INTO vouches (from_id, to_id, weight, note) VALUES (%s, %s, %s, %s)",
                        (voucher_id, requester_id, 1.0, "Peer vouch via TrustLayer"),
                    )

        conn.close()
        from src.graph import get_graph_data
        get_graph_data.cache_clear()
        return {"status": "ok", "action": body.action}
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("respond_vouch_request failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


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
