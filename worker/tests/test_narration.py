"""
Unit tests for narration.py, with PiperVoice mocked out entirely - no
real ~60MB voice download, no real ONNX inference, fast and deterministic
in CI. These specifically regression-test the exact bug class found
during real development (see README): piper-tts 1.7.0's synthesize()
returns a generator of audio-chunk objects with their own sample-rate/
width/channel metadata, not a direct wave-file writer like older docs
assumed. A fake chunk class matching that real shape is what these tests
synthesize with, so a regression back to the old (broken) API assumption
would fail here, not just in production.
"""
import subprocess
import sys
import wave
from dataclasses import dataclass
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from action_log import ActionLog  # noqa: E402
import narration  # noqa: E402


@dataclass
class FakeAudioChunk:
    """Mirrors the real piper.voice.AudioChunk shape closely enough for
    these tests - same attributes narration.py actually reads."""

    sample_rate: int
    sample_width: int
    sample_channels: int
    audio_int16_bytes: bytes


def fake_chunk(seconds: float, sample_rate: int = 22050) -> FakeAudioChunk:
    n_samples = int(sample_rate * seconds)
    return FakeAudioChunk(
        sample_rate=sample_rate,
        sample_width=2,
        sample_channels=1,
        audio_int16_bytes=b"\x00\x01" * n_samples,
    )


def make_action_log(*texts: str) -> ActionLog:
    log = ActionLog()
    for i, text in enumerate(texts):
        step = log.add(f"Step {i}", f"step_{i}.png", "https://example.com")
        step.narration = text
    return log


def test_synthesize_narration_writes_valid_wav_per_step(tmp_path):
    log = make_action_log("Hello there.", "A second line.")
    mock_voice = MagicMock()
    mock_voice.synthesize.side_effect = [
        [fake_chunk(1.0)],
        [fake_chunk(0.5)],
    ]

    with patch.object(narration, "_ensure_voice", return_value=(Path("v.onnx"), Path("v.json"))), \
         patch.object(narration.PiperVoice, "load", return_value=mock_voice):
        narration.synthesize_narration(log, tmp_path / "audio", tmp_path / "voices")

    assert log.steps[0].audio_path == str(tmp_path / "audio" / "step_0.wav")
    assert log.steps[1].audio_path == str(tmp_path / "audio" / "step_1.wav")
    for path in (log.steps[0].audio_path, log.steps[1].audio_path):
        assert Path(path).exists()
        with wave.open(path, "rb") as wf:
            assert wf.getnframes() > 0


def test_synthesize_narration_uses_narration_text_not_description(tmp_path):
    log = ActionLog()
    step = log.add("Clicked the button", "s.png", "https://example.com")
    step.narration = "The actual narration line."
    mock_voice = MagicMock()
    mock_voice.synthesize.return_value = [fake_chunk(0.5)]

    with patch.object(narration, "_ensure_voice", return_value=(Path("v.onnx"), Path("v.json"))), \
         patch.object(narration.PiperVoice, "load", return_value=mock_voice):
        narration.synthesize_narration(log, tmp_path / "audio", tmp_path / "voices")

    mock_voice.synthesize.assert_called_once_with("The actual narration line.")


def test_synthesize_narration_falls_back_to_description_when_no_narration(tmp_path):
    log = ActionLog()
    log.add("Clicked the button", "s.png", "https://example.com")  # narration left blank
    mock_voice = MagicMock()
    mock_voice.synthesize.return_value = [fake_chunk(0.5)]

    with patch.object(narration, "_ensure_voice", return_value=(Path("v.onnx"), Path("v.json"))), \
         patch.object(narration.PiperVoice, "load", return_value=mock_voice):
        narration.synthesize_narration(log, tmp_path / "audio", tmp_path / "voices")

    mock_voice.synthesize.assert_called_once_with("Clicked the button")


def test_wav_header_matches_chunk_metadata_not_hardcoded(tmp_path):
    # Regression guard for the real bug: the WAV header must come from
    # whatever the chunk actually reports, not an assumption baked into
    # the calling code.
    log = make_action_log("Hi.")
    mock_voice = MagicMock()
    mock_voice.synthesize.return_value = [
        FakeAudioChunk(sample_rate=16000, sample_width=2, sample_channels=1, audio_int16_bytes=b"\x00\x01" * 8000)
    ]

    with patch.object(narration, "_ensure_voice", return_value=(Path("v.onnx"), Path("v.json"))), \
         patch.object(narration.PiperVoice, "load", return_value=mock_voice):
        narration.synthesize_narration(log, tmp_path / "audio", tmp_path / "voices")

    with wave.open(log.steps[0].audio_path, "rb") as wf:
        assert wf.getframerate() == 16000
        assert wf.getsampwidth() == 2
        assert wf.getnchannels() == 1


def test_multiple_chunks_concatenate_into_one_continuous_wav(tmp_path):
    log = make_action_log("A longer line split into sentences.")
    mock_voice = MagicMock()
    mock_voice.synthesize.return_value = [fake_chunk(1.0), fake_chunk(1.0), fake_chunk(1.0)]

    with patch.object(narration, "_ensure_voice", return_value=(Path("v.onnx"), Path("v.json"))), \
         patch.object(narration.PiperVoice, "load", return_value=mock_voice):
        narration.synthesize_narration(log, tmp_path / "audio", tmp_path / "voices")

    with wave.open(log.steps[0].audio_path, "rb") as wf:
        duration = wf.getnframes() / wf.getframerate()
    assert 2.9 < duration < 3.1  # three 1-second chunks, concatenated


def test_empty_synthesis_still_produces_a_valid_openable_wav(tmp_path):
    # No audio produced at all (e.g. an empty narration line) - the
    # fallback branch must still write a valid WAV, not a corrupt file
    # that fails to open later in the pipeline.
    log = make_action_log("")
    mock_voice = MagicMock()
    mock_voice.synthesize.return_value = []

    with patch.object(narration, "_ensure_voice", return_value=(Path("v.onnx"), Path("v.json"))), \
         patch.object(narration.PiperVoice, "load", return_value=mock_voice):
        narration.synthesize_narration(log, tmp_path / "audio", tmp_path / "voices")

    with wave.open(log.steps[0].audio_path, "rb") as wf:
        assert wf.getnframes() == 0
        assert wf.getnchannels() == 1
        assert wf.getsampwidth() == 2


def test_ensure_voice_skips_download_when_files_already_exist(tmp_path):
    onnx = tmp_path / f"{narration.VOICE_NAME}.onnx"
    config = tmp_path / f"{narration.VOICE_NAME}.onnx.json"
    onnx.write_bytes(b"fake model")
    config.write_text("{}")

    with patch.object(subprocess, "run") as mock_run:
        result_onnx, result_config = narration._ensure_voice(tmp_path)

    mock_run.assert_not_called()
    assert result_onnx == onnx
    assert result_config == config


def test_ensure_voice_downloads_when_files_missing(tmp_path):
    with patch.object(subprocess, "run") as mock_run:
        narration._ensure_voice(tmp_path / "voices")

    mock_run.assert_called_once()
    args = mock_run.call_args.args[0]
    assert narration.VOICE_NAME in args


def test_ensure_voice_downloads_when_only_config_missing(tmp_path):
    # Both files are required - a partial download (e.g. from an earlier
    # interrupted run) should not be trusted as complete.
    (tmp_path / f"{narration.VOICE_NAME}.onnx").write_bytes(b"partial")

    with patch.object(subprocess, "run") as mock_run:
        narration._ensure_voice(tmp_path)

    mock_run.assert_called_once()
