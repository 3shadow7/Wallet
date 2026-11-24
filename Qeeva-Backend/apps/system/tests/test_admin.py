"""The admin page for ``app_config`` (D-209), driven like a browser with Django's test client."""

from __future__ import annotations

import pytest
from django.contrib.auth.models import User
from django.test import Client

from apps.system.models import AppConfigEntry

pytestmark = pytest.mark.django_db

LIST_URL = "/admin/system/appconfigentry/"


def change_url(key: str) -> str:
    return f"{LIST_URL}{key}/change/"


@pytest.fixture
def owner() -> User:
    user: User = User.objects.create_superuser("owner", password="a-long-test-password")
    return user


@pytest.fixture
def browser(owner: User) -> Client:
    client = Client()
    client.force_login(owner)
    return client


def test_the_list_shows_every_key_with_its_meaning(browser: Client) -> None:
    page = browser.get(LIST_URL)
    assert page.status_code == 200
    text = page.content.decode()
    assert "device_limit_free" in text
    assert "Devices allowed on the free plan" in text


def test_the_page_needs_an_admin_login() -> None:
    page = Client().get(LIST_URL)
    assert page.status_code == 302  # sent to the login page
    assert "/admin/login/" in page["Location"]


def test_changing_a_value_saves_it_with_its_type_and_the_admin(
    browser: Client, owner: User
) -> None:
    page = browser.post(change_url("device_limit_free"), {"value": "2"})
    assert page.status_code == 302  # saved, back to the list
    entry = AppConfigEntry.objects.get(key="device_limit_free")
    assert (entry.value, entry.updated_by_id) == (2, owner.pk)


def test_a_switch_is_typed_as_true_or_false(browser: Client) -> None:
    browser.post(change_url("signup_open"), {"value": "true"})
    assert AppConfigEntry.objects.get(key="signup_open").value is True


def test_a_wrong_value_shows_the_reason_and_saves_nothing(browser: Client) -> None:
    page = browser.post(change_url("device_limit_free"), {"value": "two"})
    assert page.status_code == 200  # the form again, with the error
    assert "must be a whole number" in page.content.decode()
    assert AppConfigEntry.objects.get(key="device_limit_free").value == 1


def test_keys_cannot_be_added_or_deleted(browser: Client) -> None:
    assert browser.get(f"{LIST_URL}add/").status_code == 403
    assert browser.get(f"{LIST_URL}signup_open/delete/").status_code == 403
    assert AppConfigEntry.objects.filter(key="signup_open").exists()


def test_the_change_form_shows_plain_values(browser: Client) -> None:
    text = browser.get(change_url("signup_open")).content.decode()
    # Django writes a new line after <textarea>; the value is "false", not Python's False.
    assert ">\nfalse</textarea>" in text
