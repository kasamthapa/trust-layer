import os
from dotenv import load_dotenv

load_dotenv()

# Ollama local LLM
OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL: str = os.getenv("OLLAMA_MODEL", "gemma3:4b")
OLLAMA_TIMEOUT: int = int(os.getenv("OLLAMA_TIMEOUT", "30"))

# File paths (relative to engine/ working directory)
MODEL_PATH: str = os.getenv("MODEL_PATH", "models/trustlayer_xgb.pkl")
SEED_DATA_PATH: str = os.getenv("SEED_DATA_PATH", "data/seed_data.json")

# Scoring thresholds
FRAUD_LOAN_MULTIPLIER: float = float(os.getenv("FRAUD_LOAN_MULTIPLIER", "1.5"))
CONFIDENCE_CAP: float = float(os.getenv("CONFIDENCE_CAP", "0.85"))
LOAN_AFFORDABILITY_RATIO: float = float(os.getenv("LOAN_AFFORDABILITY_RATIO", "0.75"))

# Score band cutoffs (300–850 scale)
SCORE_BAND_PLATINUM: int = int(os.getenv("SCORE_BAND_PLATINUM", "750"))
SCORE_BAND_GOLD: int = int(os.getenv("SCORE_BAND_GOLD", "500"))
SCORE_BAND_SILVER: int = int(os.getenv("SCORE_BAND_SILVER", "350"))

APP_VERSION: str = os.getenv("APP_VERSION", "1.0.0")

# NeonDB / PostgreSQL connection string
DATABASE_URL: str = os.getenv("DATABASE_URL", "")
