"""
Publishes the finished video as a GitHub Release asset - free, no card,
and simple enough not to need a dedicated blob-storage service for a
demo-scale mp4. Uses the `gh` CLI (preinstalled on GitHub Actions
runners, authenticated via the GH_TOKEN env var the workflow already
sets) rather than hand-rolling the multi-step Releases REST API.
"""
import json
import subprocess

RELEASE_TIMEOUT_SECONDS = 120


def publish_video(job_id: str, video_path: str, repo: str) -> str:
    """Creates a release tagged `demo-<job_id>` with the video attached,
    and returns its public download URL."""
    tag = f"demo-{job_id}"

    subprocess.run(
        [
            "gh", "release", "create", tag, video_path,
            "--repo", repo,
            "--title", f"TrueDemo: {job_id}",
            "--notes", "Autonomously generated demo video.",
        ],
        check=True,
        capture_output=True,
        timeout=RELEASE_TIMEOUT_SECONDS,
    )

    result = subprocess.run(
        ["gh", "release", "view", tag, "--repo", repo, "--json", "assets"],
        check=True,
        capture_output=True,
        timeout=30,
        text=True,
    )
    assets = json.loads(result.stdout)["assets"]
    if not assets:
        raise RuntimeError(f"Release {tag} was created but has no assets.")
    return assets[0]["url"]
