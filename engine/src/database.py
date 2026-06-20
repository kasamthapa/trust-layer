"""
database.py — TrustLayer NeonDB (PostgreSQL) connection and schema layer.

Responsibilities:
  - Provide a get_connection() helper that returns a live psycopg2 connection.
  - init_db()      — create tables if they do not exist (idempotent DDL).
  - seed_database() — populate tables from seed_data.json if they are empty.

Every public function here is safe to call even when DATABASE_URL is missing
or the database is temporarily unreachable — it logs a warning and returns a
safe sentinel (None / False) rather than raising, so the rest of the app can
fall back to JSON data without crashing.
"""

import json
import logging
import os
from typing import Optional

import psycopg2
import psycopg2.extras

from config.settings import DATABASE_URL, SEED_DATA_PATH

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Connection
# ---------------------------------------------------------------------------

def get_connection() -> Optional[psycopg2.extensions.connection]:
    """Return a new psycopg2 connection to NeonDB.

    Returns None (never raises) if DATABASE_URL is unset or the DB is
    unreachable, so callers can handle the absence gracefully.

    Each call opens a fresh connection — connection pooling is intentionally
    left to a future production upgrade (e.g. psycopg2 + PgBouncer or
    asyncpg) so this demo stays dependency-light.
    """
    if not DATABASE_URL:
        logger.warning(
            "DATABASE_URL is not set. "
            "Add it to engine/.env to enable PostgreSQL storage."
        )
        return None

    try:
        conn = psycopg2.connect(DATABASE_URL, connect_timeout=5)
        return conn
    except Exception as exc:
        logger.warning("Could not connect to database: %s", exc)
        return None


# ---------------------------------------------------------------------------
# Schema creation (DDL)
# ---------------------------------------------------------------------------

_CREATE_MERCHANTS = """
CREATE TABLE IF NOT EXISTS merchants (
    id                          VARCHAR(10)  PRIMARY KEY,
    name                        VARCHAR(100) NOT NULL,
    phone                       VARCHAR(20),
    citizenship_no              VARCHAR(100),
    business_name               VARCHAR(150),
    business_pan                VARCHAR(100),
    location                    VARCHAR(100),
    business_type               VARCHAR(100),
    group_label                 VARCHAR(50),
    months_active               INTEGER,
    bill_payment_ratio          FLOAT,
    qr_transaction_consistency  FLOAT,
    airtime_topup_frequency     FLOAT,
    psychometric_score          FLOAT,          -- nullable: cold-start merchants
    network_trust_score         FLOAT,
    transaction_volatility      FLOAT,
    days_since_last_transaction INTEGER,
    community_fraud_flag        INTEGER        DEFAULT 0,
    cashflow_monthly_npr        INTEGER,
    requested_loan_npr          INTEGER,
    loan_purpose                VARCHAR(200),
    connected_sources           TEXT,
    created_at                  TIMESTAMP      DEFAULT NOW()
);
"""

_CREATE_VOUCHES = """
CREATE TABLE IF NOT EXISTS vouches (
    id          SERIAL       PRIMARY KEY,
    from_id     VARCHAR(10)  REFERENCES merchants(id),
    to_id       VARCHAR(10)  REFERENCES merchants(id),
    weight      FLOAT,
    note        VARCHAR(200),
    created_at  TIMESTAMP    DEFAULT NOW()
);
"""

_CREATE_VOUCH_REQUESTS = """
CREATE TABLE IF NOT EXISTS vouch_requests (
    id              SERIAL       PRIMARY KEY,
    requester_id    VARCHAR(10)  REFERENCES merchants(id),
    voucher_pan     VARCHAR(100) NOT NULL,
    status          VARCHAR(20)  DEFAULT 'pending',
    created_at      TIMESTAMP    DEFAULT NOW()
);
"""


def init_db() -> bool:
    """Create the merchants and vouches tables if they do not already exist.

    Safe to call on every app startup — CREATE TABLE IF NOT EXISTS is a no-op
    when the schema is already in place.

    Returns True on success, False if the database is unreachable.
    """
    conn = get_connection()
    if conn is None:
        return False

    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(_CREATE_MERCHANTS)
                cur.execute(_CREATE_VOUCHES)
                cur.execute(_CREATE_VOUCH_REQUESTS)
                # Migrate: rename occupation → business_type if old column still exists
                cur.execute("""
                    DO $$
                    BEGIN
                        IF EXISTS (
                            SELECT 1 FROM information_schema.columns
                            WHERE table_name='merchants' AND column_name='occupation'
                        ) THEN
                            ALTER TABLE merchants RENAME COLUMN occupation TO business_type;
                        END IF;
                    END $$;
                """)
                cur.execute("ALTER TABLE merchants ADD COLUMN IF NOT EXISTS citizenship_no VARCHAR(100);")
                cur.execute("ALTER TABLE merchants ADD COLUMN IF NOT EXISTS business_name VARCHAR(150);")
                cur.execute("ALTER TABLE merchants ADD COLUMN IF NOT EXISTS business_pan VARCHAR(100);")
                cur.execute("ALTER TABLE merchants ADD COLUMN IF NOT EXISTS loan_purpose VARCHAR(200);")
                cur.execute("ALTER TABLE merchants ADD COLUMN IF NOT EXISTS connected_sources TEXT;")
        logger.info("Database schema initialised (merchants + vouches tables ready).")
        return True
    except Exception as exc:
        logger.error("init_db failed: %s", exc)
        return False
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Seed data insertion
# ---------------------------------------------------------------------------

def _load_seed_json() -> dict:
    """Load seed_data.json from the data/ directory."""
    path = os.path.join(os.path.dirname(__file__), "..", SEED_DATA_PATH)
    with open(os.path.normpath(path), "r", encoding="utf-8") as f:
        return json.load(f)


def seed_database() -> bool:
    """Populate merchants and vouches tables from seed_data.json.

    Idempotent: checks whether the merchants table already has rows before
    inserting. If it is non-empty, this function exits immediately without
    touching any data — so it is safe to call on every cold start.

    Returns True if rows were inserted (or already present), False on error.
    """
    conn = get_connection()
    if conn is None:
        return False

    try:
        with conn:
            with conn.cursor() as cur:
                # --- Guard: skip if already seeded ---
                cur.execute("SELECT COUNT(*) FROM merchants;")
                count = cur.fetchone()[0]
                if count > 0:
                    logger.info(
                        "Database already contains %d merchants — skipping seed.", count
                    )
                    return True

                # --- Load from JSON ---
                data = _load_seed_json()
                merchants = data["merchants"]
                vouches = data["vouches"]

                # --- Insert merchants ---
                merchant_sql = """
                    INSERT INTO merchants (
                        id, name, phone, location, business_type, group_label,
                        months_active, bill_payment_ratio, qr_transaction_consistency,
                        airtime_topup_frequency, psychometric_score, network_trust_score,
                        transaction_volatility, days_since_last_transaction,
                        community_fraud_flag, cashflow_monthly_npr, requested_loan_npr
                    ) VALUES (
                        %(id)s, %(name)s, %(phone)s, %(location)s, %(business_type)s,
                        %(group)s, %(months_active)s, %(bill_payment_ratio)s,
                        %(qr_transaction_consistency)s, %(airtime_topup_frequency)s,
                        %(psychometric_score)s, %(network_trust_score)s,
                        %(transaction_volatility)s, %(days_since_last_transaction)s,
                        %(community_fraud_flag)s, %(cashflow_monthly_npr)s,
                        %(requested_loan_npr)s
                    )
                """
                # The JSON uses the key "group"; psycopg2 named params pull it
                # directly from the dict. The DB column is named group_label to
                # avoid clashing with the SQL reserved word GROUP — the INSERT
                # above maps %(group)s → group_label column explicitly.
                psycopg2.extras.execute_batch(cur, merchant_sql, merchants)

                # --- Insert vouches ---
                vouch_sql = """
                    INSERT INTO vouches (from_id, to_id, weight, note)
                    VALUES (%(from_id)s, %(to_id)s, %(weight)s, %(note)s)
                """
                psycopg2.extras.execute_batch(cur, vouch_sql, vouches)

        print(f"  Inserted {len(merchants)} merchants.")
        print(f"  Inserted {len(vouches)} vouches.")
        logger.info("Seed complete: %d merchants, %d vouches.", len(merchants), len(vouches))
        return True

    except Exception as exc:
        logger.error("seed_database failed: %s", exc)
        print(f"  ERROR during seeding: {exc}")
        return False
    finally:
        conn.close()
