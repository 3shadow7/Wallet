"""Settings used ONLY by the automated tests and the type checker.

Sets fake, throwaway values before the real settings are imported, so tests never read a
real ``.env`` file and never touch a real database or Supabase project.
"""

import os

os.environ.setdefault(
    "DJANGO_SECRET_KEY", "test-only-secret-key-never-used-outside-tests-0123456789"
)
os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost:5432/test")
os.environ.setdefault("SUPABASE_URL", "https://testproject.supabase.co")

from core.settings import *
