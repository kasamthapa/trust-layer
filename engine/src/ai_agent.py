"""
AI layer for TrustLayer. Ollama runs locally — no merchant data is sent to external APIs.
Rules and graph decide the credit score. AI explains the decision in plain language.
All functions are fallback-safe — the scoring pipeline works without Ollama.
"""

import json
import logging

import httpx

from config.settings import OLLAMA_BASE_URL, OLLAMA_MODEL, OLLAMA_TIMEOUT

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Availability check
# ---------------------------------------------------------------------------

def check_ollama_available() -> bool:
    """
    Probe whether the local Ollama server is reachable.

    Uses a 2-second timeout so this check never meaningfully delays a
    request — if Ollama is slow to respond it is effectively unavailable.
    Returns True only on HTTP 200; all other outcomes return False silently.
    """
    try:
        resp = httpx.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=2.0)
        return resp.status_code == 200
    except Exception:
        return False


# ---------------------------------------------------------------------------
# Internal Ollama call
# ---------------------------------------------------------------------------

def _call_ollama(prompt: str) -> str | None:
    """
    POST a generation request to Ollama and return the response text.

    Uses stream=false so we get a single JSON response rather than a stream,
    which is simpler to parse and fine for the short summaries we generate.
    Temperature 0.3 keeps output factual and consistent across calls.
    num_predict 120 caps output length to roughly 2–3 sentences.

    Returns None on any failure so callers can fall back gracefully.
    """
    payload = {
        "model": OLLAMA_MODEL,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": 0.3,
            "num_predict": 120,
        },
    }
    try:
        resp = httpx.post(
            f"{OLLAMA_BASE_URL}/api/generate",
            json=payload,
            timeout=60.0,
        )
        resp.raise_for_status()
        data = resp.json()
        text = data.get("response", "").strip()
        return text if text else None
    except Exception as exc:
        logger.warning("Ollama call failed: %s", exc)
        return None


# ---------------------------------------------------------------------------
# Fallback summaries (deterministic, no LLM required)
# ---------------------------------------------------------------------------

def _build_fallback_summary(
    band: str,
    score: int,
    gate_status: str,
    fraud_flagged: bool,
) -> str:
    """
    Return a rule-based summary string when Ollama is unavailable.

    Each case maps to a distinct message so the UI always has something
    meaningful to display rather than an empty or generic placeholder.
    """
    if fraud_flagged:
        return (
            "This application has been flagged due to irregular patterns in the "
            "community trust network. Manual review is recommended before proceeding."
        )
    if gate_status == "FLAGGED":
        return (
            "The requested loan amount exceeds the recommended ceiling based on "
            "verified cashflow. A reduced loan amount may be approved."
        )
    if band == "Platinum":
        return (
            f"Strong behavioral signals and community trust support this application. "
            f"Score of {score}/1000 indicates low credit risk."
        )
    if band == "Gold":
        return (
            f"Solid repayment indicators with moderate confidence. "
            f"Score of {score}/1000 supports cautious approval within the recommended ceiling."
        )
    if band == "Silver":
        return (
            f"Partial behavioral data available. "
            f"Score of {score}/1000 suggests limited exposure with close monitoring."
        )
    return (
        f"Insufficient trust signals at this time. Score of {score}/1000 does not meet "
        "minimum threshold. Recommend re-application after 6 months of consistent "
        "digital activity."
    )


# ---------------------------------------------------------------------------
# Credit officer summary (for loan officer UI)
# ---------------------------------------------------------------------------

def generate_summary(
    merchant_name: str,
    score: int,
    band: str,
    confidence: float,
    loan_ceiling: int,
    gate_status: str,
    explanation: list[dict],
    fraud_flagged: bool,
    ml_band: str,
    fraud_association: bool = False,
) -> str:
    """
    Generate a 2–3 sentence lending decision summary for a loan officer.

    Audience: credit officer reviewing the application internally.
    Tone: professional, specific, mentions both strengths and concerns.

    If Ollama is unreachable, returns a deterministic fallback based on
    band, gate status, and fraud flag so the UI always has content.
    """
    if not check_ollama_available():
        return _build_fallback_summary(band, score, gate_status, fraud_flagged)

    # Summarise top 3 explanation factors as a readable sentence fragment.
    top_factors = explanation[:3]
    factors_text = "; ".join(
        f"{e['factor']} ({e['direction']})" for e in top_factors
    ) if top_factors else "no detailed factors available"

    association_note = (
        "\nNote: This merchant has vouched for at least one fraud-flagged merchant. "
        "Mention this association risk."
        if fraud_association else ""
    )

    prompt = (
        "You are a credit officer at a microfinance institution in Nepal. "
        "Explain this lending decision to a colleague in 2-3 sentences. "
        "Be professional, specific, and mention both strengths and concerns if any. "
        "Do not use bullet points.\n\n"
        f"Merchant: {merchant_name}\n"
        f"Score: {score}/1000 ({band} band)\n"
        f"Confidence: {confidence:.0%}\n"
        f"Loan ceiling: NPR {loan_ceiling:,}\n"
        f"Gate status: {gate_status}\n"
        f"Fraud flag: {fraud_flagged}\n"
        f"ML prediction: {ml_band}\n"
        f"Key factors: {factors_text}"
        f"{association_note}"
    )

    result = _call_ollama(prompt)
    if result:
        return result

    # _call_ollama returned None despite Ollama appearing reachable (e.g. model
    # not pulled yet, timeout mid-stream). Fall back to the deterministic string.
    return _build_fallback_summary(band, score, gate_status, fraud_flagged)


# ---------------------------------------------------------------------------
# Merchant-facing advice (for merchant self-service UI)
# ---------------------------------------------------------------------------

def generate_merchant_advice(
    merchant_name: str,
    score: int,
    band: str,
    explanation: list[dict],
) -> str:
    """
    Generate a short, plain-language explanation and improvement tip for the
    merchant themselves — not for the loan officer.

    Audience: small business owner in Nepal, may have limited financial literacy.
    Tone: friendly, encouraging, actionable.
    Length: exactly 2 sentences — one for the result, one practical tip.

    Returns a fallback string if Ollama is unavailable or times out.
    """
    if not check_ollama_available():
        # Merchant-facing fallback is deliberately warmer in tone.
        if band in ("Platinum", "Gold"):
            return (
                f"Great news, {merchant_name}! Your consistent bill payments and "
                "digital transactions have built strong trust — keep it up."
            )
        if band == "Silver":
            return (
                f"{merchant_name}, your trust score is growing. "
                "Try to pay all utility bills on time each month to improve your score faster."
            )
        return (
            f"{merchant_name}, your score needs more time to build. "
            "Start by making small, regular QR payments every week to establish a visible track record."
        )

    # Identify the weakest factor to give a targeted improvement tip.
    negative_factors = [e["factor"] for e in explanation if e.get("direction") == "-"]
    weakest = negative_factors[0] if negative_factors else "transaction consistency"

    prompt = (
        "You are a friendly financial advisor helping a small business owner in Nepal. "
        "In 2 sentences, explain their credit score result and give one practical tip "
        "to improve it. Use simple language.\n\n"
        f"Merchant name: {merchant_name}\n"
        f"Score: {score}/1000 ({band} band)\n"
        f"Main area to improve: {weakest}"
    )

    result = _call_ollama(prompt)
    if result:
        return result

    # Fallback if the LLM call silently failed after the availability check.
    return (
        f"{merchant_name}, your score is {score}/1000 ({band}). "
        f"Focus on improving your {weakest.lower()} to increase your trust level."
    )
