"""Item-name comparison and validation rules (no database needed)."""

from __future__ import annotations

import pytest
from django.core.exceptions import ValidationError

from apps.finance.naming import make_name_key, validate_item_name

# chr(0x....) instead of the letters themselves: several Arabic letters look like Latin ones.
ALEF = chr(0x0627)
ALEF_HAMZA_ABOVE = chr(0x0623)
ALEF_HAMZA_BELOW = chr(0x0625)
ALEF_MADDA = chr(0x0622)
TEH_MARBUTA = chr(0x0629)
HEH = chr(0x0647)
ALEF_MAKSURA = chr(0x0649)
YEH = chr(0x064A)
FATHA = chr(0x064E)  # a diacritic
TATWEEL = chr(0x0640)


class TestMakeNameKey:
    @pytest.mark.parametrize(
        ("name", "key"),
        [
            ("Rent", "rent"),
            ("RENT", "rent"),
            ("  Rent  ", "rent"),
            ("Phone Bill", "phone bill"),
            ("", ""),
        ],
    )
    def test_english_names_ignore_case_and_outer_spaces(self, name: str, key: str) -> None:
        assert make_name_key(name) == key

    @pytest.mark.parametrize("variant", [ALEF_HAMZA_ABOVE, ALEF_HAMZA_BELOW, ALEF_MADDA])
    def test_alef_forms_are_one_letter(self, variant: str) -> None:
        assert make_name_key(f"{variant}kl") == make_name_key(f"{ALEF}kl")

    def test_teh_marbuta_and_heh_are_one_letter(self) -> None:
        assert make_name_key(f"x{TEH_MARBUTA}") == make_name_key(f"x{HEH}")

    def test_alef_maksura_and_yeh_are_one_letter(self) -> None:
        assert make_name_key(f"x{ALEF_MAKSURA}") == make_name_key(f"x{YEH}")

    def test_diacritics_and_tatweel_are_ignored(self) -> None:
        assert make_name_key(f"x{FATHA}y") == "xy"
        assert make_name_key(f"x{TATWEEL}{TATWEEL}y") == "xy"

    def test_arabic_indic_and_persian_digits_equal_western_digits(self) -> None:
        assert make_name_key("Room ٣") == make_name_key("Room 3")
        assert make_name_key("Room ۳") == make_name_key("Room 3")

    def test_different_words_stay_different(self) -> None:
        assert make_name_key("Rent") != make_name_key("Rents")

    def test_is_stable_when_applied_twice(self) -> None:
        once = make_name_key(f"  {ALEF_HAMZA_ABOVE}x{TEH_MARBUTA}{FATHA} ")
        assert make_name_key(once) == once


class TestValidateItemName:
    @pytest.mark.parametrize("name", ["Rent", "a", "x" * 40, "Phone bill 2", "إيجار", "Gym"])
    def test_valid(self, name: str) -> None:
        validate_item_name(name)

    @pytest.mark.parametrize(
        "name",
        [
            "",
            "x" * 41,
            " Rent",
            "Rent ",
            "Phone  bill",  # two spaces
            "Rent!",
            "a-b",
            "a_b",
            "a/b",
            "\U0001f4b0 money",  # emoji
            "tab\tname",
            "line\nbreak",
        ],
    )
    def test_invalid(self, name: str) -> None:
        with pytest.raises(ValidationError):
            validate_item_name(name)
