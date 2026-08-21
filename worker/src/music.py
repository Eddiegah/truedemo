"""
Procedurally generates a short ambient background music bed - a few
softly-detuned sine pads with slow, independent volume swells, faded in
and out, mixed low under the narration. Generated in code rather than
sourced from a "royalty free" library: this project's whole positioning
is not taking unverified shortcuts, and a third-party site's "royalty
free" claim is exactly the kind of thing that would need verifying.
Code-generated audio has no such question mark - it's simply not anyone
else's work.
"""
import math
import wave
from pathlib import Path

import numpy as np

SAMPLE_RATE = 22050
# An open root/fifth/octave voicing - avoids the harsher major/minor-third
# dissonance a more "chord-like" pick risks when it's just droning underneath
# spoken narration for a whole video.
CHORD_HZ = [110.0, 164.81, 220.0, 277.18]
FADE_SECONDS = 2.0
BODY_LEVEL = 0.35  # headroom before the mix step's own volume filter


def _pad_wave(duration: float) -> np.ndarray:
    t = np.linspace(0, duration, int(SAMPLE_RATE * duration), endpoint=False)
    signal = np.zeros_like(t)
    for i, freq in enumerate(CHORD_HZ):
        detune = 1 + (i - 1.5) * 0.0015
        lfo = 0.75 + 0.25 * np.sin(2 * math.pi * (0.05 + i * 0.01) * t)
        signal += lfo * np.sin(2 * math.pi * freq * detune * t)
    signal /= len(CHORD_HZ)

    fade_samples = int(SAMPLE_RATE * FADE_SECONDS)
    if fade_samples * 2 < len(signal):
        signal[:fade_samples] *= np.linspace(0, 1, fade_samples)
        signal[-fade_samples:] *= np.linspace(1, 0, fade_samples)

    return signal * BODY_LEVEL


def generate_ambient_bed(out_path: Path, duration: float) -> Path:
    """Writes a mono WAV ambient pad of exactly `duration` seconds (floored
    at 1s) to out_path and returns it."""
    signal = _pad_wave(max(duration, 1.0))
    int16 = np.clip(signal * 32767, -32768, 32767).astype(np.int16)

    with wave.open(str(out_path), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SAMPLE_RATE)
        wf.writeframes(int16.tobytes())

    return out_path
