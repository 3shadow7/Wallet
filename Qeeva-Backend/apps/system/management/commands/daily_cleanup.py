"""``python manage.py daily_cleanup``: run once a day by the server's scheduler (D-214).

Example with cron on a Linux server (every day at 03:15):
    15 3 * * *  cd /srv/qeeva/Qeeva-Backend && python manage.py daily_cleanup

Plain Django, so it works on any host (D-211). What it erases is described in
``apps/system/cleanup.py``.
"""

from __future__ import annotations

from typing import Any

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.system.cleanup import run_cleanup


class Command(BaseCommand):
    help = "Erase old deleted rows and old seen notifications (run once a day)."

    def handle(self, *args: Any, **options: Any) -> None:
        erased = run_cleanup(timezone.now())
        # One short line per table, never any user data.
        for table, count in sorted(erased.items()):
            self.stdout.write(f"{table}: {count} erased")
        self.stdout.write(self.style.SUCCESS("Daily cleanup done."))
