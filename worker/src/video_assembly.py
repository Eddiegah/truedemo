"""
Combines each step's screenshot + narration audio into a captioned video
clip, then concatenates all clips into the final demo video - via ffmpeg
(preinstalled on GitHub Actions' ubuntu-latest runners, no extra install
needed). Captions are burned in from a text file (drawtext's textfile=
option) rather than an inline string, specifically to avoid having to
escape LLM-generated narration text against ffmpeg's filtergraph syntax.
"""
import shutil
import subprocess
from pathlib import Path

from action_log import ActionLog

WIDTH, HEIGHT = 1280, 800
RESOLUTION = f"{WIDTH}x{HEIGHT}"
CLIP_TIMEOUT_SECONDS = 60
CONCAT_TIMEOUT_SECONDS = 60

# Common on GitHub's ubuntu-latest images (fonts-dejavu-core is preinstalled).
# If it's missing, captions are skipped rather than failing the whole video -
# a cosmetic degradation, not a pipeline failure.
FONT_CANDIDATES = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
]


def _find_font() -> str | None:
    for candidate in FONT_CANDIDATES:
        if Path(candidate).exists():
            return candidate
    return None


def _run_ffmpeg(cmd: list[str], timeout: int) -> None:
    """subprocess.run's CalledProcessError.__str__ only includes the exit
    code, not stdout/stderr - even with capture_output=True, the actual
    ffmpeg diagnostic gets silently swallowed unless it's pulled out and
    included explicitly here."""
    try:
        subprocess.run(cmd, check=True, capture_output=True, timeout=timeout, text=True)
    except subprocess.CalledProcessError as err:
        raise RuntimeError(
            f"ffmpeg failed (exit {err.returncode}): {(err.stderr or '').strip()[-2000:]}"
        ) from err


def _build_clip(screenshot: str, audio: str, caption_file: Path, font: str | None, out_path: Path) -> None:
    vf_parts = [f"scale={RESOLUTION}:force_original_aspect_ratio=decrease,pad={WIDTH}:{HEIGHT}:(ow-iw)/2:(oh-ih)/2"]
    if font:
        vf_parts.append(
            f"drawtext=fontfile={font}:textfile={caption_file}:fontsize=28:fontcolor=white:"
            f"box=1:boxcolor=black@0.6:boxborderw=12:x=(w-text_w)/2:y=h-th-40"
        )

    cmd = [
        "ffmpeg", "-y",
        "-loop", "1", "-i", screenshot,
        "-i", audio,
        "-vf", ",".join(vf_parts),
        "-c:v", "libx264", "-tune", "stillimage", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k",
        "-shortest",
        str(out_path),
    ]
    _run_ffmpeg(cmd, CLIP_TIMEOUT_SECONDS)


def assemble_video(action_log: ActionLog, work_dir: Path, output_path: Path) -> Path:
    work_dir.mkdir(parents=True, exist_ok=True)
    font = _find_font()
    clip_paths = []

    for step in action_log.steps:
        if not step.audio_path:
            continue
        caption_file = work_dir / f"caption_{step.step}.txt"
        caption_file.write_text(step.narration or step.description, encoding="utf-8")

        clip_path = work_dir / f"clip_{step.step}.mp4"
        _build_clip(step.screenshot_path, step.audio_path, caption_file, font, clip_path)
        clip_paths.append(clip_path)

    if not clip_paths:
        raise RuntimeError("No narrated steps to assemble into a video.")

    concat_list = work_dir / "concat_list.txt"
    concat_list.write_text(
        "\n".join(f"file '{p.resolve().as_posix()}'" for p in clip_paths), encoding="utf-8"
    )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    _run_ffmpeg(
        ["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(concat_list), "-c", "copy", str(output_path)],
        CONCAT_TIMEOUT_SECONDS,
    )

    shutil.rmtree(work_dir, ignore_errors=True)
    return output_path
