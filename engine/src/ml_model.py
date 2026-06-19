"""
ml_model.py — TrustLayer XGBoost ML scoring layer.

ML layer provides a second-opinion score using pattern recognition.
Trained on 2000 synthetic merchant profiles to demonstrate architecture.
Production deployment requires retraining on real repayment data.

IMPORTANT: The ML score complements the formula-based score from scoring.py —
it does NOT override it. The final decision presented to the user is a blend
of three signals: formula score, graph trust score, and this ML band.
Keeping them separate means each can be audited, explained, and updated
independently without destabilising the others.
"""

import logging
import os
import warnings
from functools import lru_cache
from typing import Optional

import joblib
import numpy as np
import pandas as pd

from config.settings import MODEL_PATH

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Feature contract
# ---------------------------------------------------------------------------

# The model was trained on exactly these 9 features in this exact order.
# Any change to order or names breaks inference — treat this list as a
# versioned contract between training (scripts/train.py) and serving.
FEATURE_NAMES: list[str] = [
    "months_active",
    "bill_payment_ratio",
    "qr_transaction_consistency",
    "airtime_topup_frequency",
    "psychometric_score",
    "network_trust_score",
    "transaction_volatility",
    "days_since_last_transaction",
    "community_fraud_flag",
]

# Map the XGBoost integer class label to a human-readable band name.
_BAND_LABELS: dict[int, str] = {
    0: "Refused",
    1: "Silver",
    2: "Gold",
    3: "Platinum",
}

# Representative mid-point score for each band.
# Used when the consumer needs a numeric value but only the ML band is available.
_BAND_SCORES: dict[str, int] = {
    "Refused":  200,
    "Silver":   425,
    "Gold":     625,
    "Platinum": 825,
}

_FALLBACK_RESPONSE: dict = {
    "ml_band": "unavailable",
    "ml_score": 500,
    "ml_confidence": 0.0,
    "feature_importance": [],
}


# ---------------------------------------------------------------------------
# Model loading
# ---------------------------------------------------------------------------

@lru_cache(maxsize=1)
def load_model():
    """
    Load the trained XGBoost model from MODEL_PATH.

    Cached after first call so the ~MB pickle is read from disk only once
    per process lifetime.

    Returns the model object, or None if the file is missing or corrupt.
    The rest of this module handles None gracefully so the API stays live
    even when the model file has not yet been generated (e.g. fresh clone
    before running scripts/train.py).
    """
    path = os.path.join(os.path.dirname(__file__), "..", MODEL_PATH)
    path = os.path.normpath(path)

    if not os.path.exists(path):
        logger.warning(
            "ML model file not found at '%s'. "
            "Run scripts/train.py to generate it. "
            "Falling back to formula-only scoring.",
            path,
        )
        return None

    try:
        model = joblib.load(path)
        logger.info("ML model loaded from '%s'.", path)
        return model
    except Exception as exc:
        logger.warning("Failed to load ML model: %s. Falling back to formula-only scoring.", exc)
        return None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _build_feature_vector(merchant: dict, network_trust_score: float) -> pd.DataFrame:
    """
    Assemble a single-row DataFrame matching the training feature contract.

    psychometric_score substitution:
        None means the merchant has not taken the psychometric quiz (cold start).
        We substitute 0.5 (the neutral midpoint) rather than 0 or NaN so the
        model does not over-penalise thin-file merchants at inference time —
        the same logic used in scoring.py for consistency.
    """
    psychometric = merchant.get("psychometric_score")
    if psychometric is None:
        psychometric = 0.5

    values = [
        merchant["months_active"],
        merchant["bill_payment_ratio"],
        merchant["qr_transaction_consistency"],
        merchant["airtime_topup_frequency"],
        psychometric,
        network_trust_score,
        merchant["transaction_volatility"],
        merchant["days_since_last_transaction"],
        merchant["community_fraud_flag"],
    ]

    return pd.DataFrame([values], columns=FEATURE_NAMES)


# ---------------------------------------------------------------------------
# Inference
# ---------------------------------------------------------------------------

def predict_band(merchant: dict, network_trust_score: float) -> dict:
    """
    Run the XGBoost classifier and return a band prediction with confidence.

    Steps:
      1. Build feature vector (single row, exact column order).
      2. model.predict()       → integer class label 0-3.
      3. model.predict_proba() → probability for each class.
      4. Map label → band name, pick max probability as confidence.
      5. Extract per-feature importance from the model's feature_importances_
         attribute (gain-based, averaged over all trees).

    If the model is unavailable (None), returns _FALLBACK_RESPONSE so the
    API can still serve a result driven purely by the formula layer.
    """
    model = load_model()
    if model is None:
        return _FALLBACK_RESPONSE.copy()

    X = _build_feature_vector(merchant, network_trust_score)

    # Suppress XGBoost version warnings during inference.
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        label: int = int(model.predict(X)[0])
        proba: np.ndarray = model.predict_proba(X)[0]

    band = _BAND_LABELS.get(label, "Refused")
    ml_confidence = float(np.max(proba))
    ml_score = _BAND_SCORES[band]

    # feature_importances_ is a 1-D array aligned with FEATURE_NAMES.
    importances = model.feature_importances_
    feature_importance = [
        {"feature": name, "importance": round(float(imp), 4)}
        for name, imp in zip(FEATURE_NAMES, importances)
    ]
    # Sort descending so the caller can truncate to top-N easily.
    feature_importance.sort(key=lambda x: x["importance"], reverse=True)

    return {
        "ml_band": band,
        "ml_score": ml_score,
        "ml_confidence": round(ml_confidence, 4),
        "feature_importance": feature_importance,
    }


# ---------------------------------------------------------------------------
# SHAP explanation
# ---------------------------------------------------------------------------

def get_shap_explanation(merchant: dict, network_trust_score: float) -> list[dict]:
    """
    Return the top-5 SHAP contributors for a single merchant's prediction.

    SHAP (SHapley Additive exPlanations) attributes each feature's contribution
    to the gap between the base rate and this merchant's predicted probability.
    Positive SHAP = pushed score up; negative SHAP = pushed score down.

    shap is imported inside this function to avoid adding ~200 ms to API
    startup time on cold boot — it is only needed on the explain endpoint.

    Returns an empty list (never raises) if shap is unavailable or the model
    is missing, so the UI can render without the SHAP panel gracefully.
    """
    try:
        import shap  # noqa: PLC0415  (intentional lazy import)

        model = load_model()
        if model is None:
            return []

        X = _build_feature_vector(merchant, network_trust_score)

        explainer = shap.TreeExplainer(model)

        # shap_values shape: (n_classes, n_samples, n_features) for multi-class XGBoost.
        shap_values = explainer.shap_values(X)

        # Use the SHAP values for the predicted class so the explanation is
        # aligned with the actual decision rather than a background class.
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            predicted_class = int(model.predict(X)[0])

        # shap_values is a list indexed by class; each element is (n_samples, n_features).
        class_shap = shap_values[predicted_class][0]  # shape: (n_features,)

        items = [
            {
                "feature": FEATURE_NAMES[i],
                "impact": round(float(class_shap[i]), 4),
                "direction": "+" if class_shap[i] >= 0 else "-",
            }
            for i in range(len(FEATURE_NAMES))
        ]

        # Sort by absolute impact, return top 5.
        items.sort(key=lambda x: abs(x["impact"]), reverse=True)
        return items[:5]

    except Exception as exc:
        logger.warning("SHAP explanation failed: %s. Returning empty explanation.", exc)
        return []
