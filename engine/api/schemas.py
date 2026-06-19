"""
schemas.py — Pydantic v2 request and response models for the TrustLayer API.

Every model here is the single source of truth for what the API accepts and
returns. The UI TypeScript types in ui/src/types.ts must mirror these exactly.
"""

from typing import Optional
from pydantic import BaseModel


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------

class ScoreRequest(BaseModel):
    merchant_id: str
    # If omitted, the engine uses the requested_loan_npr value from seed data.
    requested_loan_amount: Optional[float] = None


# ---------------------------------------------------------------------------
# Score response sub-models
# ---------------------------------------------------------------------------

class ExplanationItem(BaseModel):
    """One human-readable factor contributing to (or hurting) the score."""
    factor: str
    direction: str      # "+" helped the score, "-" hurt it
    detail: str


class SHAPItem(BaseModel):
    """One SHAP feature contribution for the ML layer explanation."""
    feature: str
    impact: float       # raw SHAP value (positive = pushed score up)
    direction: str      # "+" or "-"


class LayerBreakdown(BaseModel):
    """The three independent scoring layers before fusion."""
    formula_score: int  # 300–850 equivalent from scoring.py formula
    graph_score: int    # 300–850 equivalent from PageRank trust
    ml_score: int       # 300–850 equivalent from XGBoost band
    final_fused: int    # weighted blend of all three


# ---------------------------------------------------------------------------
# Main score response
# ---------------------------------------------------------------------------

class ScoreResponse(BaseModel):
    # Identity
    merchant_id: str
    name: str
    occupation: str
    location: str

    # Score
    score: int              # final fused 300–850 integer
    band: str               # Platinum / Gold / Silver / Refused

    # Confidence and loan
    confidence: float       # 0.0–1.0 data confidence from scoring.py
    loan_ceiling: int       # maximum loan approved (NPR)
    requested_loan: int     # what the merchant asked for (NPR)

    # Gate
    gate_status: str        # "CLEAR" or "FLAGGED"
    gate_reason: Optional[str] = None  # explanation if FLAGGED

    # Explanation layers
    explanation: list[ExplanationItem]
    shap_factors: list[SHAPItem]
    layer_breakdown: LayerBreakdown

    # AI narrative
    ai_summary: Optional[str] = None

    # ML layer
    ml_band: str
    ml_confidence: float

    # Fraud
    fraud_flagged: bool


# ---------------------------------------------------------------------------
# Graph response models
# ---------------------------------------------------------------------------

class GraphNode(BaseModel):
    id: str
    name: str
    occupation: str
    location: str
    trust: float    # normalised PageRank score 0.0–1.0
    fraud: bool     # True if flagged by ring detection
    score: int      # composite score (0 if not yet scored)


class GraphEdge(BaseModel):
    source: str
    target: str
    weight: float   # normalised trust-budget weight


class GraphResponse(BaseModel):
    nodes: list[GraphNode]
    edges: list[GraphEdge]
    fraud_ring_ids: list[str]
    stats: dict     # total_nodes, total_edges, fraud_count, avg_trust


# ---------------------------------------------------------------------------
# Fairness response models
# ---------------------------------------------------------------------------

class FairnessGroup(BaseModel):
    group: str
    avg_score_before: float     # before graph fusion (formula only)
    avg_score_after: float      # after graph fusion
    merchant_count: int


class FairnessResponse(BaseModel):
    groups: list[FairnessGroup]
    max_gap_before: float       # spread between highest and lowest group avg before
    max_gap_after: float        # spread after graph fusion
    gap_reduction_pct: float    # positive = graph narrowed inequality
    note: str                   # design philosophy note


# ---------------------------------------------------------------------------
# Merchant list model
# ---------------------------------------------------------------------------

class MerchantSummary(BaseModel):
    id: str
    name: str
    occupation: str
    location: str
    months_active: int


# ---------------------------------------------------------------------------
# Health check response
# ---------------------------------------------------------------------------

class HealthResponse(BaseModel):
    status: str         # "ok" or "degraded"
    version: str
    ml_layer: str       # "loaded" or "unavailable"
    graph_engine: str   # "ready" or "error"
    ai_layer: str       # "reachable" or "unreachable"
    database: str       # "connected" or "unavailable"
