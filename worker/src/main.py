"""
Phase 2: the real pipeline. Explores the live app with a real browser,
grounds understanding in the real source repo, writes narration with
Gemini, synthesizes it with local TTS, and assembles a captioned video -
then publishes it as a GitHub Release asset and reports the URL back.

Every stage posts progress via webhook as it completes. Any stage
failing marks the job failed with a real error message rather than
silently producing a broken or fake result - this pipeline's whole
premise is technical honesty, which has to hold for its own failure
modes too.

Usage: python src/main.py --job-id JOB_ID --url URL [--repo-url URL]
       --webhook-url URL --webhook-secret SECRET
Requires env vars: GEMINI_API_KEY, GH_TOKEN, GITHUB_REPO
"""
import argparse
import os
import sys
import tempfile
from pathlib import Path

import requests

from agent import explore
from repo_context import get_repo_context
from script_writer import write_narration
from narration import synthesize_narration
from video_assembly import assemble_video
from video_release import publish_video


def post_progress(job_id: str, webhook_url: str, webhook_secret: str, stage: str, **extra) -> None:
    try:
        res = requests.post(
            f"{webhook_url}/api/jobs/{job_id}/progress",
            headers={"x-webhook-secret": webhook_secret, "Content-Type": "application/json"},
            json={"stage": stage, **extra},
            timeout=15,
        )
        res.raise_for_status()
        print(f"[progress] {stage} -> {res.status_code}")
    except requests.RequestException as err:
        # A missed status update shouldn't crash the whole job - the run's
        # own GitHub Actions log is still the source of truth if this fails.
        print(f"[progress] FAILED to post '{stage}': {err}", file=sys.stderr)


def fetch_credentials(job_id: str, webhook_url: str, webhook_secret: str) -> tuple[str, str] | None:
    """Fetches the optional demo login over the same authenticated channel
    as progress updates - never via workflow_dispatch inputs, which are
    visible in this public repo's Actions logs. The frontend nulls the
    credentials out of the database the moment this call reads them.
    Never printed, never included in any progress message - a fetch
    failure just means exploration proceeds without logging in, not a
    job failure."""
    try:
        res = requests.get(
            f"{webhook_url}/api/jobs/{job_id}/credentials",
            headers={"x-webhook-secret": webhook_secret},
            timeout=15,
        )
        res.raise_for_status()
        data = res.json()
        username, password = data.get("demoUsername"), data.get("demoPassword")
        if username and password:
            return username, password
    except requests.RequestException as err:
        print(f"[main] Could not fetch demo credentials (continuing without login): {err}", file=sys.stderr)
    return None


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--job-id", required=True)
    parser.add_argument("--url", required=True)
    parser.add_argument("--repo-url", default="")
    parser.add_argument("--webhook-url", required=True)
    parser.add_argument("--webhook-secret", required=True)
    args = parser.parse_args()

    def progress(stage: str, **extra) -> None:
        post_progress(args.job_id, args.webhook_url, args.webhook_secret, stage, **extra)

    github_repo = os.environ.get("GITHUB_REPO")
    if not github_repo:
        progress("Worker misconfigured: GITHUB_REPO not set", status="failed", errorMessage="GITHUB_REPO env var missing")
        return 1

    work_root = Path(tempfile.mkdtemp(prefix=f"truedemo-{args.job_id}-"))

    try:
        credentials = fetch_credentials(args.job_id, args.webhook_url, args.webhook_secret)
        if credentials:
            progress("Demo login provided - will explore behind sign-in")

        progress(f"Exploring {args.url} with a real browser...")
        action_log = explore(args.url, work_root / "screenshots", credentials=credentials)
        progress(f"Explored {len(action_log.steps)} steps of the app")

        repo_context = ""
        if args.repo_url:
            progress(f"Reading repository {args.repo_url} for technical grounding...")
            repo_context = get_repo_context(args.repo_url)
            if repo_context:
                progress("Repository context extracted")
            else:
                progress("Could not read repository - narrating from UI exploration only")

        progress("Writing narration script grounded in real technical context...")
        write_narration(action_log, repo_context)

        progress("Synthesizing narration audio (Piper TTS)...")
        synthesize_narration(action_log, work_root / "audio", work_root / "voices")

        progress("Assembling video (ffmpeg)...")
        video_path = assemble_video(action_log, work_root / "assembly", work_root / "final.mp4")

        progress("Publishing video...")
        video_url = publish_video(args.job_id, str(video_path), github_repo)

        progress("Done - video ready", status="completed", videoUrl=video_url)
        print("Done.")
        return 0

    except Exception as err:
        print(f"[main] Job failed: {err}", file=sys.stderr)
        progress(f"Job failed: {err}", status="failed", errorMessage=str(err))
        return 1


if __name__ == "__main__":
    sys.exit(main())
