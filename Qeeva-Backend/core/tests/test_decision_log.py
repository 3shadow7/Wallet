"""Guard tests for the decision log, ``plans/decisions/decision-log.md``.

The log is the single source of truth for D-numbers (decision D-098). Its first version silently
lost two numbers (D-018 and D-030), so these tests make that kind of mistake fail loudly:

* a number written twice,
* a number that vanished (neither a row nor listed as reserved),
* a status the readers do not know,
* a "superseded" row that does not point at a real replacement,
* a reference to a number that does not exist,
* a wrong "Next free number" line.

They only read a Markdown file, so they need no database. If the repository is checked out
without the ``plans`` folder (for example only ``Qeeva-Backend`` was copied), they are skipped
with a reason instead of failing.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

import pytest

# This file is Qeeva-Backend/core/tests/test_decision_log.py, so the repository root is three
# folders above the ``tests`` folder.
REPO_ROOT = Path(__file__).resolve().parents[3]
LOG_PATH = REPO_ROOT / "plans" / "decisions" / "decision-log.md"

# A table row: | D-123 | status | decision text |   (the text may contain anything, even "|").
ROW = re.compile(r"^\|\s*D-(\d{3})\s*\|\s*([^|]+?)\s*\|\s*(.+?)\s*\|\s*$")
# Any mention of a decision number, in a row or in the prose.
MENTION = re.compile(r"\bD-(\d{3})\b")
# The line  **Reserved IDs with no text: D-007, D-008.**  lists numbers whose text was lost.
RESERVED = re.compile(r"\*\*Reserved IDs with no text:([^*]*)\*\*")
NEXT_FREE = re.compile(r"\*\*Next free number: D-(\d{3})\.\*\*")
USED_UP_TO = re.compile(r"D-001 to D-(\d{3}) are used")

# The first words of a status. "superseded by D-NNN" must also name the replacement.
STATUS_PREFIXES = ("approved", "proposal", "superseded by D-", "deferred", "AI choice")


@dataclass(frozen=True)
class Row:
    number: int
    status: str
    text: str


@dataclass(frozen=True)
class Log:
    raw: str
    rows: list[Row]
    reserved: set[int]

    @property
    def row_numbers(self) -> list[int]:
        return [row.number for row in self.rows]

    @property
    def highest(self) -> int:
        return max([*self.row_numbers, *self.reserved])


def _read_log() -> Log:
    if not LOG_PATH.is_file():
        pytest.skip(f"decision log not found at {LOG_PATH} (is the plans folder checked out?)")
    raw = LOG_PATH.read_text(encoding="utf-8")
    rows = []
    for line in raw.splitlines():
        match = ROW.match(line)
        if match:
            rows.append(Row(int(match.group(1)), match.group(2), match.group(3)))
    reserved_match = RESERVED.search(raw)
    reserved = (
        {int(number) for number in MENTION.findall(reserved_match.group(1))}
        if reserved_match
        else set()
    )
    return Log(raw=raw, rows=rows, reserved=reserved)


@pytest.fixture(scope="module")
def log() -> Log:
    return _read_log()


class TestDecisionLog:
    def test_the_log_has_rows(self, log: Log) -> None:
        # A parsing slip (for example a changed table layout) must not make every test below
        # pass on an empty list.
        assert len(log.rows) > 50

    def test_no_number_is_written_twice(self, log: Log) -> None:
        duplicates = sorted({n for n in log.row_numbers if log.row_numbers.count(n) > 1})
        assert duplicates == [], f"numbers with more than one row: {duplicates}"

    def test_no_number_is_lost(self, log: Log) -> None:
        # Every number from 1 to the highest is either a row or listed as reserved.
        present = set(log.row_numbers) | log.reserved
        missing = [f"D-{n:03d}" for n in range(1, log.highest + 1) if n not in present]
        assert missing == [], f"numbers with neither a row nor a reserved entry: {missing}"

    def test_a_number_is_not_both_a_row_and_reserved(self, log: Log) -> None:
        both = sorted(set(log.row_numbers) & log.reserved)
        assert both == [], f"numbers that are rows and also reserved: {both}"

    def test_next_free_number_is_the_highest_plus_one(self, log: Log) -> None:
        match = NEXT_FREE.search(log.raw)
        assert match, 'the line "**Next free number: D-NNN.**" is missing'
        assert int(match.group(1)) == log.highest + 1

    def test_used_up_to_line_matches_the_highest_number(self, log: Log) -> None:
        match = USED_UP_TO.search(log.raw)
        assert match, 'the line "D-001 to D-NNN are used" is missing'
        assert int(match.group(1)) == log.highest

    def test_every_status_starts_with_a_known_word(self, log: Log) -> None:
        unknown = [
            f"D-{row.number:03d}: {row.status!r}"
            for row in log.rows
            if not row.status.startswith(STATUS_PREFIXES)
        ]
        assert unknown == [], f"unknown status: {unknown}"

    def test_every_row_has_a_real_decision_text(self, log: Log) -> None:
        empty = [f"D-{row.number:03d}" for row in log.rows if len(row.text) < 15]
        assert empty == [], f"rows with no decision text: {empty}"

    def test_superseded_rows_point_at_existing_other_rows(self, log: Log) -> None:
        existing = set(log.row_numbers)
        for row in log.rows:
            if not row.status.startswith("superseded by D-"):
                continue
            targets = {int(n) for n in MENTION.findall(row.status)}
            assert targets, f"D-{row.number:03d} names no replacement"
            assert row.number not in targets, f"D-{row.number:03d} supersedes itself"
            assert targets <= existing, f"D-{row.number:03d} points at a missing row: {targets}"

    def test_every_mentioned_number_exists(self, log: Log) -> None:
        known = set(log.row_numbers) | log.reserved
        # "Next free number: D-NNN" names a number that is not used yet, on purpose.
        scanned = NEXT_FREE.sub("", log.raw)
        mentioned = {int(n) for n in MENTION.findall(scanned)}
        unknown = sorted(f"D-{n:03d}" for n in mentioned - known)
        assert unknown == [], f"mentioned but neither a row nor reserved: {unknown}"
