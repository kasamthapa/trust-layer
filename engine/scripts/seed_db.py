"""
seed_db.py — Initialise the NeonDB schema and populate it with seed data.

Usage (from the engine/ directory):
    python scripts/seed_db.py

What it does:
  1. Connects to the database defined by DATABASE_URL in engine/.env
  2. Creates the merchants and vouches tables if they do not exist
  3. Inserts the 25 seed merchants and 37 vouches from data/seed_data.json
     (skipped if the table is already populated — safe to re-run)
"""

import sys
import os

# Allow imports from the engine/ root when this script is run directly.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from src.database import init_db, seed_database
from config.settings import DATABASE_URL


def main() -> None:
    print("TrustLayer — Database seed script")
    print("=" * 40)

    if not DATABASE_URL:
        print(
            "ERROR: DATABASE_URL is not set.\n"
            "Add it to engine/.env and re-run this script.\n"
            "Example: DATABASE_URL=postgresql://user:pass@host/dbname"
        )
        sys.exit(1)

    print(f"Target database: {DATABASE_URL[:40]}...")

    # Step 1: create tables
    print("\n[1/2] Initialising schema...")
    ok = init_db()
    if not ok:
        print("  FAILED — could not connect or create tables. Check DATABASE_URL.")
        sys.exit(1)
    print("  OK — tables ready.")

    # Step 2: insert seed data
    print("\n[2/2] Seeding data...")
    ok = seed_database()
    if not ok:
        print("  FAILED — seed insertion error. Check logs above.")
        sys.exit(1)

    print("\nDone. NeonDB is ready for TrustLayer.")


if __name__ == "__main__":
    main()
