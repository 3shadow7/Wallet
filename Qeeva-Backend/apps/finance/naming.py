"""How two item names are compared (decisions D-055, D-056, D-057).

Two items are "the same item" when they have the same type and their *name keys* are equal
(D-055). The key is the name with the differences the user does not care about removed:

* letter case (``Rent`` = ``rent``) and surrounding spaces (D-056);
* Arabic spelling variants (D-057): every alef form (with hamza above or below, with madda,
  alef wasla) becomes the plain alef, teh marbuta becomes heh, alef maksura becomes yeh;
  diacritics (tashkeel) and the stretching letter tatweel are removed;
* Arabic-Indic digits and Persian digits become 0-9 (an assumption in D-057).

The key is only used to compare names. The name the user typed is stored unchanged.
"""

from __future__ import annotations

import unicodedata

from django.core.exceptions import ValidationError

NAME_MIN = 1
NAME_MAX = 40

# Letters that Arabic writers use interchangeably (D-057).
_ARABIC_LETTER_FOLDING = {
    "\u0623": "\u0627",  # alef with hamza above -> plain alef
    "\u0625": "\u0627",  # alef with hamza below -> plain alef
    "\u0622": "\u0627",  # alef with madda -> plain alef
    "\u0671": "\u0627",  # alef wasla -> plain alef
    "\u0629": "\u0647",  # teh marbuta -> heh
    "\u0649": "\u064a",  # alef maksura -> yeh
    "\u0640": "",  # tatweel (the stretching line) is dropped
}
# Arabic-Indic digits (U+0660-0669) and Persian digits (U+06F0-06F9) -> 0-9.
_DIGITS = {
    **{0x0660 + i: str(i) for i in range(10)},
    **{0x06F0 + i: str(i) for i in range(10)},
}
_TRANSLATION = str.maketrans({**{ord(k): v for k, v in _ARABIC_LETTER_FOLDING.items()}, **_DIGITS})


def make_name_key(name: str) -> str:
    """Return the comparison key of an item name (see the module docstring)."""
    # Normal form D splits letters from their marks, so every diacritic is a separate
    # "Mn" (mark) character that we can drop in one step.
    decomposed = unicodedata.normalize("NFD", name.strip())
    without_marks = "".join(ch for ch in decomposed if unicodedata.category(ch) != "Mn")
    # Compose again so that the same text always gives the same key, then fold and lowercase.
    composed = unicodedata.normalize("NFC", without_marks)
    return composed.translate(_TRANSLATION).lower()


def validate_item_name(value: str) -> None:
    """Python-level rules for an item name.

    The database also enforces the length and the space rules (CHECK constraints). The
    "no symbols" rule (D-056) is checked here only: PostgreSQL character classes depend on the
    server's locale, and a rule that behaves differently per machine does not belong in a CHECK.
    """
    if not NAME_MIN <= len(value) <= NAME_MAX:
        raise ValidationError(f"Name must be {NAME_MIN}-{NAME_MAX} characters.")
    if value != value.strip():
        raise ValidationError("Name must not start or end with a space.")
    if "  " in value:
        raise ValidationError("Name must not contain two spaces in a row.")
    for ch in value:
        category = unicodedata.category(ch)
        # L = letters (English and Arabic), N = digits, M = marks (Arabic diacritics).
        if ch != " " and category[0] not in {"L", "N", "M"}:
            raise ValidationError("Name may contain letters, numbers and single spaces only.")
