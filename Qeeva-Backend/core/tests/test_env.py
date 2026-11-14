import os
from pathlib import Path

import pytest
from django.core.exceptions import ImproperlyConfigured

from core.env import (
    env_bool,
    env_int,
    env_list,
    env_required,
    load_env_file,
    parse_database_url,
)


class TestEnvHelpers:
    def test_required_returns_value_and_strips_spaces(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("X_VAR", "  hello  ")
        assert env_required("X_VAR") == "hello"

    @pytest.mark.parametrize("value", [None, "", "   "])
    def test_required_fails_when_missing_or_blank(
        self, monkeypatch: pytest.MonkeyPatch, value: str | None
    ) -> None:
        if value is None:
            monkeypatch.delenv("X_VAR", raising=False)
        else:
            monkeypatch.setenv("X_VAR", value)
        with pytest.raises(ImproperlyConfigured, match="X_VAR"):
            env_required("X_VAR")

    @pytest.mark.parametrize("raw", ["1", "true", "TRUE", "Yes", "on"])
    def test_bool_true_words(self, monkeypatch: pytest.MonkeyPatch, raw: str) -> None:
        monkeypatch.setenv("X_FLAG", raw)
        assert env_bool("X_FLAG") is True

    @pytest.mark.parametrize("raw", ["0", "false", "No", "off", ""])
    def test_bool_false_words(self, monkeypatch: pytest.MonkeyPatch, raw: str) -> None:
        monkeypatch.setenv("X_FLAG", raw)
        assert env_bool("X_FLAG", default=True) is False

    def test_bool_default_when_unset(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.delenv("X_FLAG", raising=False)
        assert env_bool("X_FLAG") is False
        assert env_bool("X_FLAG", default=True) is True

    def test_bool_rejects_unknown_word_instead_of_guessing(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("X_FLAG", "maybe")
        with pytest.raises(ImproperlyConfigured):
            env_bool("X_FLAG")

    def test_int(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("X_NUM", " 42 ")
        assert env_int("X_NUM", default=0) == 42
        monkeypatch.delenv("X_NUM")
        assert env_int("X_NUM", default=7) == 7

    def test_int_rejects_text(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("X_NUM", "abc")
        with pytest.raises(ImproperlyConfigured):
            env_int("X_NUM", default=0)

    def test_list_trims_and_drops_empty_entries(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("X_LIST", " a , ,b,, c ")
        assert env_list("X_LIST") == ["a", "b", "c"]

    def test_list_empty_when_unset(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.delenv("X_LIST", raising=False)
        assert env_list("X_LIST") == []


class TestParseDatabaseUrl:
    def test_supabase_session_pooler_url(self) -> None:
        url = (
            "postgresql://postgres.abcdef:p%40ss%2Fword@aws-0-eu.pooler.supabase.com:5432"
            "/postgres?sslmode=require"
        )
        assert parse_database_url(url) == {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": "postgres",
            "USER": "postgres.abcdef",
            "PASSWORD": "p@ss/word",  # percent-encoding is decoded
            "HOST": "aws-0-eu.pooler.supabase.com",
            "PORT": "5432",
            "OPTIONS": {"sslmode": "require"},
        }

    def test_postgres_scheme_and_no_port_or_options(self) -> None:
        config = parse_database_url("postgres://u:p@db.example.com/mydb")
        assert config["HOST"] == "db.example.com"
        assert config["PORT"] == ""
        assert "OPTIONS" not in config

    @pytest.mark.parametrize(
        "url",
        [
            "postgresql://u:p@localhost:5433/db",
            "postgresql://u:p@LOCALHOST:5433/db",  # host names are case-insensitive
            "postgres://u:p@LocalHost/db",
        ],
    )
    def test_the_name_localhost_is_read_as_127_0_0_1(self, url: str) -> None:
        # Decision D-102: on Windows, connecting through the name "localhost" took ~15 s per
        # connection, through the address 127.0.0.1 ~19 ms.
        assert parse_database_url(url)["HOST"] == "127.0.0.1"

    def test_the_rest_of_the_url_is_untouched_when_localhost_is_replaced(self) -> None:
        assert parse_database_url("postgresql://u:p%40w@localhost:5433/db?sslmode=disable") == {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": "db",
            "USER": "u",
            "PASSWORD": "p@w",
            "HOST": "127.0.0.1",
            "PORT": "5433",
            "OPTIONS": {"sslmode": "disable"},
        }

    @pytest.mark.parametrize(
        ("url", "expected_host"),
        [
            ("postgresql://u:p@127.0.0.1:5433/db", "127.0.0.1"),
            ("postgresql://u:p@[::1]:5433/db", "::1"),  # IPv6 written on purpose stays IPv6
            ("postgresql://u:p@localhost.example.com/db", "localhost.example.com"),
            ("postgresql://u:p@mylocalhost/db", "mylocalhost"),
            ("postgresql://u:p@db.localhost/db", "db.localhost"),
        ],
    )
    def test_every_other_host_is_kept_as_written(self, url: str, expected_host: str) -> None:
        assert parse_database_url(url)["HOST"] == expected_host

    @pytest.mark.parametrize(
        "url",
        [
            "mysql://u:p@localhost/db",
            "sqlite:///db.sqlite3",
            "postgresql://u:p@/db",
            "postgresql://u:p@localhost",
            "postgresql://u:p@localhost:notaport/db",
            "not a url",
        ],
    )
    def test_rejects_bad_urls(self, url: str) -> None:
        with pytest.raises(ImproperlyConfigured):
            parse_database_url(url)

    def test_error_messages_never_contain_the_password(self) -> None:
        with pytest.raises(ImproperlyConfigured) as caught:
            parse_database_url("mysql://user:SuperSecret123@localhost/db")
        assert "SuperSecret123" not in str(caught.value)


class TestLoadEnvFile:
    def test_loads_values_and_ignores_comments_blank_lines_and_quotes(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        for name in ("A_ONE", "A_TWO", "A_THREE"):
            monkeypatch.delenv(name, raising=False)
        env_file = tmp_path / ".env"
        env_file.write_text(
            "# a comment\n\nA_ONE=1\nA_TWO = \"two words\"\nA_THREE='x=y'\nnot a pair\n",
            encoding="utf-8",
        )
        load_env_file(env_file)
        assert os.environ["A_ONE"] == "1"
        assert os.environ["A_TWO"] == "two words"
        assert os.environ["A_THREE"] == "x=y"

    def test_real_environment_wins_over_the_file(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("A_KEEP", "from-environment")
        env_file = tmp_path / ".env"
        env_file.write_text("A_KEEP=from-file\n", encoding="utf-8")
        load_env_file(env_file)
        assert os.environ["A_KEEP"] == "from-environment"

    def test_missing_file_is_fine(self, tmp_path: Path) -> None:
        load_env_file(tmp_path / "does-not-exist.env")  # must not raise
