"""Does the user's newest consent cover the CURRENT terms and privacy policy? (D-202, D-208)

The app asks him to accept again when this returns False, for example after the owner changes
``app_config.terms_version`` from ``2026-11`` to ``2027-03`` in the admin page.
"""

from __future__ import annotations

from apps.accounts.models import ConsentAction, ConsentKind, UserConsent
from apps.system.config import get_text
from common.auth import SupabasePrincipal

# Which app_config key holds the current version of each versioned document.
VERSION_KEYS: dict[str, str] = {
    ConsentKind.TERMS: "terms_version",
    ConsentKind.PRIVACY: "privacy_version",
}


def latest_consent(principal: SupabasePrincipal, kind: str) -> UserConsent | None:
    """His newest row for this kind (the current state), or None if he never answered."""
    consent: UserConsent | None = (
        UserConsent.objects.for_user(principal).filter(kind=kind).order_by("-created_at").first()
    )
    return consent


def has_accepted_current(principal: SupabasePrincipal, kind: str) -> bool:
    """True when his newest action is "accepted" and, for terms and privacy, for today's version.

    Marketing has no document version to compare: only the newest action counts.
    """
    newest = latest_consent(principal, kind)
    if newest is None or newest.action != ConsentAction.ACCEPTED:
        return False
    version_key = VERSION_KEYS.get(kind)
    return version_key is None or newest.document_version == get_text(version_key)
