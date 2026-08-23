"""
Unit tests for video_release.py, with subprocess.run mocked out - no real
`gh` CLI call, no real GitHub Release created. Covers the actual command
construction and response parsing, which is the part of this module that
can silently drift (a typo'd flag, a JSON shape assumption) without ever
raising an error until a real release attempt fails in production.
"""
import json
import subprocess
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

import video_release  # noqa: E402


def test_publish_video_returns_the_first_asset_url():
    create_result = MagicMock()
    view_result = MagicMock(stdout=json.dumps({"assets": [{"url": "https://github.com/x/y/releases/download/demo-abc/final.mp4"}]}))

    with patch.object(subprocess, "run", side_effect=[create_result, view_result]):
        url = video_release.publish_video("abc123", "/tmp/final.mp4", "owner/repo")

    assert url == "https://github.com/x/y/releases/download/demo-abc/final.mp4"


def test_publish_video_tags_release_with_job_id():
    create_result = MagicMock()
    view_result = MagicMock(stdout=json.dumps({"assets": [{"url": "https://example.com/video.mp4"}]}))

    with patch.object(subprocess, "run", side_effect=[create_result, view_result]) as mock_run:
        video_release.publish_video("job-xyz", "/tmp/final.mp4", "owner/repo")

    create_call_args = mock_run.call_args_list[0].args[0]
    assert "demo-job-xyz" in create_call_args
    assert "/tmp/final.mp4" in create_call_args
    assert "owner/repo" in create_call_args

    view_call_args = mock_run.call_args_list[1].args[0]
    assert "demo-job-xyz" in view_call_args
    assert "owner/repo" in view_call_args


def test_publish_video_raises_when_release_has_no_assets():
    create_result = MagicMock()
    view_result = MagicMock(stdout=json.dumps({"assets": []}))

    with patch.object(subprocess, "run", side_effect=[create_result, view_result]):
        with pytest.raises(RuntimeError, match="has no assets"):
            video_release.publish_video("job-xyz", "/tmp/final.mp4", "owner/repo")


def test_publish_video_propagates_gh_cli_failure():
    # A real failure (bad token, repo not found, network error) should
    # surface as a real exception, not be silently swallowed.
    with patch.object(
        subprocess, "run", side_effect=subprocess.CalledProcessError(1, ["gh", "release", "create"])
    ):
        with pytest.raises(subprocess.CalledProcessError):
            video_release.publish_video("job-xyz", "/tmp/final.mp4", "owner/repo")


def test_publish_video_uses_check_true_so_failures_are_not_silent():
    # Guards against a future edit accidentally dropping check=True, which
    # would make a failed `gh` call look like success.
    create_result = MagicMock()
    view_result = MagicMock(stdout=json.dumps({"assets": [{"url": "https://example.com/v.mp4"}]}))

    with patch.object(subprocess, "run", side_effect=[create_result, view_result]) as mock_run:
        video_release.publish_video("job-xyz", "/tmp/final.mp4", "owner/repo")

    for call in mock_run.call_args_list:
        assert call.kwargs.get("check") is True
