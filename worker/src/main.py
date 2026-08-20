"""
Phase 1 stub pipeline: proves the architecture end to end (GitHub Actions
runner -> webhook progress updates -> Postgres -> frontend polling) with
fake stages, not the real exploration/narration/video work yet.

Real thing this replaces, coming in Phase 2:
    Playwright exploration -> repo context grounding -> script writing ->
    Piper TTS narration -> ffmpeg video assembly

Usage: python src/main.py --job-id JOB_ID --url URL [--repo-url URL]
"""
import argparse
import sys
import time

import requests


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

    print(f"Processing job {args.job_id} for {args.url} (repo: {args.repo_url or 'none'})")

    progress("Worker started - stub pipeline (Phase 1 architecture proof)")
    time.sleep(2)

    if args.repo_url:
        progress(f"Reading repository {args.repo_url}...")
        time.sleep(2)

    progress(f"Exploring {args.url}...")
    time.sleep(2)

    progress("Writing narration script...")
    time.sleep(2)

    progress(
        "Stub pipeline complete - this is where the real video would be",
        status="completed",
        videoUrl="https://example.com/stub-video-not-real",
    )
    print("Done.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
