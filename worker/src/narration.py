"""
Local, zero-cost text-to-speech via Piper (ONNX-based, runs entirely on
the GitHub Actions runner - no API key, no per-request cost). The honest
tradeoff, stated plainly in the README rather than glossed over: Piper's
voice quality is noticeably more robotic than a paid API like ElevenLabs.
That's the deliberate cost of a genuinely free pipeline.
"""
import subprocess
import sys
import wave
from pathlib import Path

from piper.voice import PiperVoice

from action_log import ActionLog

VOICE_NAME = "en_US-lessac-medium"
DOWNLOAD_TIMEOUT_SECONDS = 90


def _ensure_voice(voices_dir: Path) -> tuple[Path, Path]:
    onnx_path = voices_dir / f"{VOICE_NAME}.onnx"
    config_path = voices_dir / f"{VOICE_NAME}.onnx.json"

    if not onnx_path.exists() or not config_path.exists():
        voices_dir.mkdir(parents=True, exist_ok=True)
        subprocess.run(
            [sys.executable, "-m", "piper.download_voices", "--data-dir", str(voices_dir), VOICE_NAME],
            check=True,
            capture_output=True,
            timeout=DOWNLOAD_TIMEOUT_SECONDS,
        )

    return onnx_path, config_path


def synthesize_narration(action_log: ActionLog, output_dir: Path, voices_dir: Path) -> None:
    """Mutates action_log in place, setting `.audio_path` on each step."""
    output_dir.mkdir(parents=True, exist_ok=True)
    onnx_path, config_path = _ensure_voice(voices_dir)
    voice = PiperVoice.load(str(onnx_path), config_path=str(config_path))

    for step in action_log.steps:
        text = step.narration or step.description
        wav_path = output_dir / f"step_{step.step}.wav"

        with wave.open(str(wav_path), "wb") as wav_file:
            header_set = False
            for chunk in voice.synthesize(text):
                if not header_set:
                    wav_file.setnchannels(chunk.sample_channels)
                    wav_file.setsampwidth(chunk.sample_width)
                    wav_file.setframerate(chunk.sample_rate)
                    header_set = True
                wav_file.writeframes(chunk.audio_int16_bytes)
            if not header_set:
                # No audio produced (e.g. empty narration) - write a valid,
                # silent, zero-length WAV rather than leave a broken file.
                wav_file.setnchannels(1)
                wav_file.setsampwidth(2)
                wav_file.setframerate(22050)

        step.audio_path = str(wav_path)
