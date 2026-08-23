"""
Unit test for music.py - checks the generated ambient bed is a real,
valid, non-silent WAV file of roughly the requested duration. Doesn't
judge how it sounds (that was verified by ear against real pipeline
output, per the README), just that it produces real audio data.
"""
import sys
import wave
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from music import generate_ambient_bed  # noqa: E402


def test_generate_ambient_bed_produces_valid_wav(tmp_path):
    out_path = tmp_path / "bed.wav"
    generate_ambient_bed(out_path, duration=2.0)

    assert out_path.exists()
    with wave.open(str(out_path), "rb") as wf:
        assert wf.getnchannels() == 1
        assert wf.getsampwidth() == 2
        assert wf.getnframes() > 0
        actual_duration = wf.getnframes() / wf.getframerate()
        assert 1.5 < actual_duration < 2.5


def test_generate_ambient_bed_is_not_silent(tmp_path):
    out_path = tmp_path / "bed.wav"
    generate_ambient_bed(out_path, duration=2.0)

    with wave.open(str(out_path), "rb") as wf:
        frames = wf.readframes(wf.getnframes())
    # At least some samples should be meaningfully non-zero - a silent
    # bug (e.g. all-zero output) would pass a "file exists" check but
    # fail this one.
    assert any(b != 0 for b in frames)


def test_generate_ambient_bed_clamps_very_short_duration(tmp_path):
    out_path = tmp_path / "bed.wav"
    generate_ambient_bed(out_path, duration=0.1)

    with wave.open(str(out_path), "rb") as wf:
        actual_duration = wf.getnframes() / wf.getframerate()
    assert actual_duration >= 1.0
