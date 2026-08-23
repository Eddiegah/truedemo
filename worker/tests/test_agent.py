"""
Unit tests for agent.py's pure helper functions - no browser, no network.
The full explore() function is covered by manual testing against real
fixtures (documented in the README's Verification section) since it
needs a real Chromium instance; these tests cover the logic that's
cheap and fast to check automatically on every push.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from agent import _is_skippable, _same_origin, _sample_value_for  # noqa: E402


def test_same_origin_matches_identical_host():
    assert _same_origin("https://example.com/a", "https://example.com/b")


def test_same_origin_rejects_different_host():
    assert not _same_origin("https://example.com", "https://evil.com")


def test_same_origin_rejects_subdomain():
    # A subdomain is a different origin - the agent should not wander from
    # app.example.com onto docs.example.com mid-exploration.
    assert not _same_origin("https://app.example.com", "https://docs.example.com")


def test_is_skippable_catches_logout():
    assert _is_skippable("Sign Out", "")
    assert _is_skippable("logout", "/logout")


def test_is_skippable_catches_mailto():
    assert _is_skippable("Contact us", "mailto:hello@example.com")


def test_is_skippable_allows_normal_link():
    assert not _is_skippable("Pricing", "/pricing")


def test_sample_value_for_search_hint():
    assert _sample_value_for("Search topics") == "AI research trends"


def test_sample_value_for_email_hint():
    assert _sample_value_for("Your email address") == "demo@truedemo.dev"


def test_sample_value_for_unknown_hint_falls_back_to_default():
    assert _sample_value_for("Favorite color") == "TrueDemo demo"


def test_sample_value_for_is_case_insensitive():
    assert _sample_value_for("SEARCH") == _sample_value_for("search")
