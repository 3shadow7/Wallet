"""Measures why database tests may be slow: connection time and time per query.

Run from Qeeva-Backend with the venv active and QEEVA_TEST_DATABASE_URL set:
    python db_latency_check.py
It only runs "SELECT 1" and changes nothing.
"""

import os
import re
import sys
import time

import psycopg

url = os.environ.get("QEEVA_TEST_DATABASE_URL")
if not url:
    sys.exit("Set QEEVA_TEST_DATABASE_URL first (see README, 'Database tests').")

# The same server addressed by name and by IPv4, so the two can be compared.
variants = {"as written": url}
for host in ("localhost", "127.0.0.1"):
    variants[f"host={host}"] = re.sub(r"@[^:/]+", f"@{host}", url, count=1)

for label, address in variants.items():
    try:
        started = time.perf_counter()
        connection = psycopg.connect(address, connect_timeout=15)
        connect_time = time.perf_counter() - started
        started = time.perf_counter()
        for _ in range(30):
            connection.execute("SELECT 1").fetchone()
        per_query_ms = (time.perf_counter() - started) / 30 * 1000
        connection.close()
        print(f"{label:<18} connect {connect_time * 1000:8.1f} ms   per query {per_query_ms:7.2f} ms")
    except Exception as error:  # noqa: BLE001 - a diagnostic script reports everything
        print(f"{label:<18} FAILED: {type(error).__name__}")
