"""One shared rule for "a user only ever sees their own rows".

Django connects to the database with a powerful role, so PostgreSQL
Row Level Security cannot protect one user's rows from another user's request: our own
code has to. To make that rule hard to forget, every model in ``apps/`` declares an
``OWNER_FIELD`` and reads user data only through ``Model.objects.for_user(principal)``.
``common/tests/test_ownership.py`` fails the build when a model forgets to declare it.
"""

from __future__ import annotations

from typing import TypeVar, cast

from django.core.exceptions import ImproperlyConfigured
from django.db import models

from common.auth import SupabasePrincipal

_M = TypeVar("_M", bound=models.Model)


class OwnedManager(models.Manager[_M]):
    """Manager whose ``for_user`` returns only the rows that belong to the verified caller."""

    def for_user(self, principal: SupabasePrincipal) -> models.QuerySet[_M]:
        # The argument must be the verified principal (built from the signed token), never a
        # raw id taken from a URL or request body, so a client cannot pick someone else's rows.
        owner_field = getattr(self.model, "OWNER_FIELD", None)
        if not isinstance(owner_field, str):
            raise ImproperlyConfigured(
                f"{self.model.__name__} has no OWNER_FIELD, so it is not scoped to a user. "
                "Internal tables must never be read on behalf of a user."
            )
        queryset = self.get_queryset().filter(models.Q(**{owner_field: principal.id}))
        return cast("models.QuerySet[_M]", queryset)
