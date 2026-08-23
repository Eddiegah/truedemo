"""
Unit tests for script_writer.py, with genai.Client mocked out - these
never make a real network call, so they're fast, free, and deterministic
in CI without a real GEMINI_API_KEY. The real API integration (including
the actual retry-on-503 and fallback-model behavior this is modeled on)
was verified against the live API during development - see the README's
Verification section for that trail. These tests protect the *logic*
around that integration from regressing silently.
"""
import json
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from action_log import ActionLog  # noqa: E402
import script_writer  # noqa: E402


def make_action_log(n: int) -> ActionLog:
    log = ActionLog()
    for i in range(n):
        log.add(f"Did step {i}", f"step_{i}.png", "https://example.com")
    return log


def mock_response(lines: list[str]) -> MagicMock:
    return MagicMock(text=json.dumps(lines))


@pytest.fixture(autouse=True)
def no_real_sleep(monkeypatch):
    # The retry path sleeps for real seconds - patched everywhere so the
    # suite runs in a fraction of a second, not tens of seconds.
    monkeypatch.setattr(script_writer.time, "sleep", lambda _seconds: None)


@pytest.fixture(autouse=True)
def has_api_key(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "test-key-not-real")


def test_raises_without_api_key(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    log = make_action_log(2)
    with pytest.raises(RuntimeError, match="GEMINI_API_KEY is not configured"):
        script_writer.write_narration(log, "some repo context")


def test_does_not_call_gemini_without_api_key(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    log = make_action_log(1)
    with patch.object(script_writer.genai, "Client") as mock_client_cls:
        with pytest.raises(RuntimeError):
            script_writer.write_narration(log, "")
        mock_client_cls.assert_not_called()


def test_first_model_success_sets_narration_on_every_step():
    log = make_action_log(3)
    mock_client = MagicMock()
    mock_client.models.generate_content.return_value = mock_response(
        ["Line one.", "Line two.", "Line three."]
    )

    with patch.object(script_writer.genai, "Client", return_value=mock_client):
        script_writer.write_narration(log, "some repo context")

    assert [s.narration for s in log.steps] == ["Line one.", "Line two.", "Line three."]
    # Only the first (preferred) model should have been tried.
    assert mock_client.models.generate_content.call_count == 1
    called_model = mock_client.models.generate_content.call_args.kwargs["model"]
    assert called_model == script_writer.FALLBACK_MODELS[0]


def test_falls_through_to_next_model_on_wrong_line_count():
    log = make_action_log(2)
    mock_client = MagicMock()
    mock_client.models.generate_content.side_effect = [
        mock_response(["only one line"]),  # wrong count for 2 steps
        mock_response(["Line one.", "Line two."]),  # second model, correct
    ]

    with patch.object(script_writer.genai, "Client", return_value=mock_client):
        script_writer.write_narration(log, "")

    assert [s.narration for s in log.steps] == ["Line one.", "Line two."]
    assert mock_client.models.generate_content.call_count == 2


def test_falls_through_to_next_model_on_malformed_json():
    log = make_action_log(1)
    mock_client = MagicMock()
    mock_client.models.generate_content.side_effect = [
        MagicMock(text="not valid json"),
        mock_response(["Recovered line."]),
    ]

    with patch.object(script_writer.genai, "Client", return_value=mock_client):
        script_writer.write_narration(log, "")

    assert log.steps[0].narration == "Recovered line."


def test_retries_same_model_on_503_before_moving_on():
    log = make_action_log(1)
    mock_client = MagicMock()
    mock_client.models.generate_content.side_effect = [
        Exception("503 UNAVAILABLE - model overloaded"),
        mock_response(["Succeeded on retry."]),
    ]

    with patch.object(script_writer.genai, "Client", return_value=mock_client):
        script_writer.write_narration(log, "")

    assert log.steps[0].narration == "Succeeded on retry."
    assert mock_client.models.generate_content.call_count == 2
    # Both calls should have used the SAME (first, preferred) model - a 503
    # retries in place, it doesn't immediately burn the next model in line.
    models_used = [c.kwargs["model"] for c in mock_client.models.generate_content.call_args_list]
    assert models_used[0] == models_used[1] == script_writer.FALLBACK_MODELS[0]


def test_non_503_error_does_not_retry_moves_to_next_model_immediately():
    log = make_action_log(1)
    mock_client = MagicMock()
    mock_client.models.generate_content.side_effect = [
        Exception("404 NOT_FOUND - model deprecated"),
        mock_response(["From the second model."]),
    ]

    with patch.object(script_writer.genai, "Client", return_value=mock_client):
        script_writer.write_narration(log, "")

    assert log.steps[0].narration == "From the second model."
    models_used = [c.kwargs["model"] for c in mock_client.models.generate_content.call_args_list]
    # A non-503 failure should burn exactly one attempt on the first model,
    # then move straight to the second - not retry a dead model twice.
    assert models_used == [script_writer.FALLBACK_MODELS[0], script_writer.FALLBACK_MODELS[1]]


def test_raises_when_every_model_fails():
    log = make_action_log(1)
    mock_client = MagicMock()
    mock_client.models.generate_content.side_effect = Exception("500 internal error")

    with patch.object(script_writer.genai, "Client", return_value=mock_client):
        with pytest.raises(RuntimeError, match="All Gemini models failed"):
            script_writer.write_narration(log, "")

    # Every fallback model should have been tried before giving up.
    models_used = [c.kwargs["model"] for c in mock_client.models.generate_content.call_args_list]
    assert models_used == list(script_writer.FALLBACK_MODELS)
    assert log.steps[0].narration == ""


def test_prompt_includes_repo_context_when_provided():
    log = make_action_log(1)
    mock_client = MagicMock()
    mock_client.models.generate_content.return_value = mock_response(["Line."])

    with patch.object(script_writer.genai, "Client", return_value=mock_client):
        script_writer.write_narration(log, "Next.js 16, Prisma, Neon Postgres")

    prompt = mock_client.models.generate_content.call_args.kwargs["contents"]
    assert "Next.js 16, Prisma, Neon Postgres" in prompt


def test_prompt_notes_missing_repo_when_context_is_empty():
    log = make_action_log(1)
    mock_client = MagicMock()
    mock_client.models.generate_content.return_value = mock_response(["Line."])

    with patch.object(script_writer.genai, "Client", return_value=mock_client):
        script_writer.write_narration(log, "")

    prompt = mock_client.models.generate_content.call_args.kwargs["contents"]
    assert "no repository provided" in prompt
