"""
app.py — TrustLayer FastAPI application factory.

Startup sequence:
  1. init_db() + seed_database()  — ensure schema and seed rows exist in NeonDB
  2. load_model()                  — warm the XGBoost pickle into the LRU cache
  3. get_graph_data()              — build the trust graph and cache it

All three are best-effort: if they fail the app still starts and serves
requests, falling back to JSON data and formula-only scoring where needed.
"""

import logging
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from api.routes import router
from api.schemas import HealthResponse
from config.settings import APP_VERSION, OLLAMA_BASE_URL, OLLAMA_TIMEOUT
from src.database import get_connection, init_db, seed_database
from src.graph import get_graph_data
from src.ml_model import load_model

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Lifespan (startup / shutdown)
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Run startup tasks before the server begins accepting requests."""

    # 1 — Database: create schema and seed if empty
    logger.info("Startup [1/3]: initialising database...")
    try:
        db_ok = init_db()
        if db_ok:
            seed_database()
            logger.info("Database ready.")
        else:
            logger.warning("Database unavailable at startup — JSON fallback active.")
    except Exception as exc:
        logger.warning("Database startup error: %s", exc)

    # 2 — ML model: warm the LRU cache so the first /score request is fast
    logger.info("Startup [2/3]: loading ML model...")
    try:
        model = load_model()
        if model is not None:
            logger.info("ML model loaded successfully.")
        else:
            logger.warning("ML model not found — formula-only scoring active.")
    except Exception as exc:
        logger.warning("ML model startup error: %s", exc)

    # 3 — Graph: build and cache the trust graph
    logger.info("Startup [3/3]: building trust graph...")
    try:
        data = get_graph_data()
        logger.info(
            "Graph ready: %d nodes, %d edges, %d fraud ring members.",
            data["stats"]["total_nodes"],
            data["stats"]["total_edges"],
            data["stats"]["fraud_count"],
        )
    except Exception as exc:
        logger.warning("Graph startup error: %s", exc)

    logger.info("TrustLayer API v%s started.", APP_VERSION)
    yield
    # Nothing to clean up on shutdown for this demo.


# ---------------------------------------------------------------------------
# Application factory
# ---------------------------------------------------------------------------

app = FastAPI(
    title="TrustLayer API",
    description=(
        "Alternative credit trust layer for unbanked merchants in Nepal. "
        "Built for KMC HackVerse 2026."
    ),
    version=APP_VERSION,
    lifespan=lifespan,
)

# Allow all origins during the hackathon so the Vite dev server and any
# judge's local machine can hit the API without CORS issues.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


# ---------------------------------------------------------------------------
# Global exception handler
# ---------------------------------------------------------------------------

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """
    Catch any unhandled exception and return a clean JSON error response.

    Never leaks raw tracebacks to the client — those are logged server-side
    only. This keeps the API surface predictable for the UI error handlers.
    """
    logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "detail": str(exc),
            "path": str(request.url.path),
        },
    )


# ---------------------------------------------------------------------------
# Health endpoint
# ---------------------------------------------------------------------------

@app.get("/health", response_model=HealthResponse, tags=["meta"])
async def health_check() -> HealthResponse:
    """
    Lightweight readiness probe that checks all four external dependencies.

    - database : runs SELECT 1 against NeonDB
    - ml_layer : checks whether the XGBoost pickle was loaded
    - graph_engine: checks whether graph data is cached and non-empty
    - ai_layer : GET OLLAMA_BASE_URL/api/tags with a 2-second timeout

    Returns status "ok" only when all four are healthy; "degraded" otherwise.
    The UI dashboard uses this to show a live system-status indicator.
    """
    results: dict[str, str] = {}

    # --- Database ---
    try:
        conn = get_connection()
        if conn is None:
            raise ConnectionError("get_connection returned None")
        with conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
        results["database"] = "connected"
    except Exception as exc:
        logger.warning("Health: database check failed: %s", exc)
        results["database"] = "unavailable"

    # --- ML model ---
    try:
        model = load_model()
        results["ml_layer"] = "loaded" if model is not None else "unavailable"
    except Exception:
        results["ml_layer"] = "unavailable"

    # --- Graph engine ---
    try:
        data = get_graph_data()
        results["graph_engine"] = "ready" if data["stats"]["total_nodes"] > 0 else "error"
    except Exception as exc:
        logger.warning("Health: graph check failed: %s", exc)
        results["graph_engine"] = "error"

    # --- Ollama / AI layer ---
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            resp = await client.get(f"{OLLAMA_BASE_URL}/api/tags")
        results["ai_layer"] = "reachable" if resp.status_code == 200 else "unreachable"
    except Exception:
        # Ollama not running locally is expected in cloud / CI environments.
        results["ai_layer"] = "unreachable"

    overall = (
        "ok"
        if all(v in ("connected", "loaded", "ready", "reachable") for v in results.values())
        else "degraded"
    )

    return HealthResponse(
        status=overall,
        version=APP_VERSION,
        ml_layer=results["ml_layer"],
        graph_engine=results["graph_engine"],
        ai_layer=results["ai_layer"],
        database=results["database"],
    )
