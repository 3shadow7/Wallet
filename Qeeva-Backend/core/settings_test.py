"""Settings used ONLY by the automated tests and the type checker.

The tests must give the same result on every machine, so these values are assigned
unconditionally (not "if missing"). They win over a developer's local ``.env`` file,
because real environment variables always take priority over that file.
"""

import os

os.environ["DJANGO_SECRET_KEY"] = "test-only-secret-key-never-used-outside-tests-0123456789"
os.environ["DJANGO_DEBUG"] = "false"
os.environ["DJANGO_ALLOWED_HOSTS"] = "testserver,localhost"
# Database tests need a real PostgreSQL (see README). They run only when this variable is set in
# the real environment; otherwise a placeholder is used and those tests are skipped.
os.environ["DATABASE_URL"] = os.environ.get(
    "QEEVA_TEST_DATABASE_URL", "postgresql://test:test@localhost:5432/test"
)
os.environ["SUPABASE_URL"] = "https://testproject.supabase.co"
os.environ["DB_CONN_MAX_AGE"] = "0"
os.environ["DB_DISABLE_SERVER_SIDE_CURSORS"] = "false"

from core.settings import *
