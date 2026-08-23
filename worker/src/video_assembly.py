"""
Combines each step's screenshot + narration audio into a captioned video
clip, crossfades all clips together into one continuous video (rather
than hard-cutting between them), and mixes in a soft ambient music bed
underneath - audible on its own during the brief pauses each clip carries
after its narration ends, not just as a backing track. All via ffmpeg
(preinstalled on GitHub Actions' ubuntu-latest runners, no extra install
needed). Captions are burned in from a text file (drawtext's textfile=
option) rather than an inline string, specifically to avoid having to
escape LLM-generated narration text against ffmpeg's filtergraph syntax.
"""
import json
import shutil
import subprocess
from pathlib import Path

from action_log import ActionLog
from music import generate_ambient_bed

WIDTH, HEIGHT = 1280, 800
RESOLUTION = f"{WIDTH}x{HEIGHT}"
CLIP_TIMEOUT_SECONDS = 60
ASSEMBLY_TIMEOUT_SECONDS = 180

# How long each clip holds its frame in silence after narration ends -
# gives crossfades room to breathe and gives the background music a
# moment to actually be heard on its own, not just as a bed under speech.
TRAILING_PAD_SECONDS = 0.6

# Crossfade length between consecutive clips. Clamped per-video against the
# shortest clip's duration (see _safe_xfade_duration) - a clip shorter than
# this would make ffmpeg's xfade/acrossfade filters misbehave or error.
XFADE_DURATION = 0.6

MUSIC_VOLUME_DB = -22  # subtle bed, narration stays clearly in front

# Ken Burns pan/zoom on each still screenshot, instead of a flat static
# frame - real screenshots, motion-graphics-grade polish. Subtle and
# professional (a 6-8% drift), not a dramatic swoop: the point is to make
# a still image feel alive without drawing attention to the effect itself.
FPS = 25
ZOOM_END = 1.08
ZOOM_STEP = 0.0006
# zoompan's `d=` is a hard frame count - once exhausted it stops producing
# output entirely, which would cut the video track short if underestimated
# relative to the real (audio-driven) clip length. Overshooting is free:
# -shortest trims it back to the real duration, and extra zoompan frames
# just mean the zoom clamps at ZOOM_END sooner and holds - still a clean
# Ken Burns look, not a bug.
ZOOMPAN_SAFETY_MARGIN_SECONDS = 1.5

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


def _probe_duration(path: Path) -> float:
    result = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", str(path)],
        check=True,
        capture_output=True,
        text=True,
        timeout=15,
    )
    return float(json.loads(result.stdout)["format"]["duration"])


def _build_clip(
    screenshot: str,
    audio: str,
    caption_file: Path,
    font: str | None,
    out_path: Path,
    audio_duration: float,
    pan_upper: bool,
) -> None:
    # Upscale well past target resolution before zoompan, so the zoomed-in
    # window is still sampled from a large source image instead of
    # stretching an already-1280x800 screenshot - avoids soft/blurry zoom.
    upscale_w, upscale_h = WIDTH * 3, HEIGHT * 3
    frames = max(1, round((audio_duration + TRAILING_PAD_SECONDS + ZOOMPAN_SAFETY_MARGIN_SECONDS) * FPS))
    # Two alternating targets for the zoom drift - plain center, and a
    # slight bias toward the upper third, where the most demo-relevant UI
    # (headers, primary actions) typically sits. Enough variety across a
    # multi-step video that clips don't all look identical.
    y_expr = "(ih*0.35)-(ih/zoom/2)" if pan_upper else "ih/2-(ih/zoom/2)"

    vf_parts = [
        f"scale={upscale_w}:{upscale_h}:force_original_aspect_ratio=increase,crop={upscale_w}:{upscale_h}",
        f"zoompan=z='min(zoom+{ZOOM_STEP},{ZOOM_END})':d={frames}:"
        f"x='iw/2-(iw/zoom/2)':y='{y_expr}':s={WIDTH}x{HEIGHT}:fps={FPS}",
    ]
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
        "-af", f"apad=pad_dur={TRAILING_PAD_SECONDS}",
        "-c:v", "libx264", "-tune", "stillimage", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k",
        "-shortest",
        str(out_path),
    ]
    _run_ffmpeg(cmd, CLIP_TIMEOUT_SECONDS)


def _safe_xfade_duration(durations: list[float]) -> float:
    """Clamped below the shortest clip's length - acrossfade/xfade need
    both sides of a transition to actually be at least that long."""
    return min(XFADE_DURATION, min(durations) * 0.4)


def _crossfade_chain(clip_paths: list[Path], durations: list[float], out_path: Path) -> None:
    """Dissolves all clips into one continuous track instead of hard-cutting
    between them - xfade for video, acrossfade for audio, chained across
    however many clips there are."""
    if len(clip_paths) == 1:
        shutil.copy(clip_paths[0], out_path)
        return

    xfade_dur = _safe_xfade_duration(durations)
    inputs: list[str] = []
    for p in clip_paths:
        inputs += ["-i", str(p)]

    v_filters = []
    a_filters = []
    v_label, a_label = "0:v", "0:a"
    merged_duration = durations[0]

    for i in range(1, len(clip_paths)):
        offset = merged_duration - xfade_dur
        next_v, next_a = f"v{i}", f"a{i}"
        v_filters.append(
            f"[{v_label}][{i}:v]xfade=transition=fade:duration={xfade_dur:.3f}:offset={offset:.3f}[{next_v}]"
        )
        a_filters.append(f"[{a_label}][{i}:a]acrossfade=d={xfade_dur:.3f}[{next_a}]")
        v_label, a_label = next_v, next_a
        merged_duration = merged_duration + durations[i] - xfade_dur

    cmd = [
        "ffmpeg", "-y",
        *inputs,
        "-filter_complex", ";".join(v_filters + a_filters),
        "-map", f"[{v_label}]", "-map", f"[{a_label}]",
        "-c:v", "libx264", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k",
        str(out_path),
    ]
    _run_ffmpeg(cmd, ASSEMBLY_TIMEOUT_SECONDS)


def _mix_background_music(narrated_path: Path, work_dir: Path, output_path: Path) -> None:
    duration = _probe_duration(narrated_path)
    music_path = generate_ambient_bed(work_dir / "music.wav", duration)

    cmd = [
        "ffmpeg", "-y",
        "-i", str(narrated_path),
        "-i", str(music_path),
        "-filter_complex",
        f"[1:a]volume={MUSIC_VOLUME_DB}dB[music];"
        f"[0:a][music]amix=inputs=2:duration=first:dropout_transition=2[aout]",
        "-map", "0:v", "-map", "[aout]",
        "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
        str(output_path),
    ]
    _run_ffmpeg(cmd, ASSEMBLY_TIMEOUT_SECONDS)


def assemble_video(action_log: ActionLog, work_dir: Path, output_path: Path) -> Path:
    work_dir.mkdir(parents=True, exist_ok=True)
    font = _find_font()
    clip_paths: list[Path] = []

    for step in action_log.steps:
        if not step.audio_path:
            continue
        caption_file = work_dir / f"caption_{step.step}.txt"
        caption_file.write_text(step.narration or step.description, encoding="utf-8")

        audio_duration = _probe_duration(Path(step.audio_path))
        clip_path = work_dir / f"clip_{step.step}.mp4"
        _build_clip(
            step.screenshot_path,
            step.audio_path,
            caption_file,
            font,
            clip_path,
            audio_duration,
            pan_upper=step.step % 2 == 0,
        )
        clip_paths.append(clip_path)

    if not clip_paths:
        raise RuntimeError("No narrated steps to assemble into a video.")

    durations = [_probe_duration(p) for p in clip_paths]

    output_path.parent.mkdir(parents=True, exist_ok=True)
    narrated_path = work_dir / "narrated.mp4"
    _crossfade_chain(clip_paths, durations, narrated_path)
    _mix_background_music(narrated_path, work_dir, output_path)

    shutil.rmtree(work_dir, ignore_errors=True)
    return output_path
