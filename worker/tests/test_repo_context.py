"""
Unit tests for repo_context.py's file-reading helpers, using a real tmp
directory instead of a real git clone - _clone() itself needs network
access and is covered by the manual production runs in the README's
Verification section instead.

_read_manifests specifically regression-tests the monorepo bug found
earlier in this project's own build: manifests in subdirectories
(frontend/package.json, worker/requirements.txt) were invisible when
only the repo root was checked.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from repo_context import _read_manifests, _read_readme, _walk_tree  # noqa: E402


def test_read_readme_finds_root_readme(tmp_path):
    (tmp_path / "README.md").write_text("# Hello\nThis is a test repo.")
    assert _read_readme(tmp_path) == "# Hello\nThis is a test repo."


def test_read_readme_returns_empty_string_when_missing(tmp_path):
    assert _read_readme(tmp_path) == ""


def test_read_manifests_finds_root_manifest(tmp_path):
    (tmp_path / "package.json").write_text('{"name": "root-app"}')
    manifests = _read_manifests(tmp_path)
    assert "package.json" in manifests
    assert "root-app" in manifests["package.json"]


def test_read_manifests_finds_monorepo_subdirectory_manifests(tmp_path):
    # This is the exact layout that broke before the fix: nothing at the
    # root, real manifests one level down in frontend/ and worker/.
    frontend = tmp_path / "frontend"
    frontend.mkdir()
    (frontend / "package.json").write_text('{"name": "frontend-app"}')

    worker = tmp_path / "worker"
    worker.mkdir()
    (worker / "requirements.txt").write_text("requests==2.32.3")

    # Keys come from Path.relative_to(), which is backslash-separated on
    # Windows and forward-slash on Linux (where this actually runs in
    # production) - normalize before comparing so the test means the same
    # thing on both.
    manifests = {k.replace("\\", "/"): v for k, v in _read_manifests(tmp_path).items()}
    assert "frontend/package.json" in manifests
    assert "worker/requirements.txt" in manifests
    assert "frontend-app" in manifests["frontend/package.json"]


def test_read_manifests_ignores_node_modules(tmp_path):
    node_modules = tmp_path / "node_modules" / "some-package"
    node_modules.mkdir(parents=True)
    (node_modules / "package.json").write_text('{"name": "should-not-appear"}')

    manifests = _read_manifests(tmp_path)
    assert not any("node_modules" in key for key in manifests)


def test_walk_tree_ignores_git_directory(tmp_path):
    (tmp_path / ".git").mkdir()
    (tmp_path / ".git" / "config").write_text("")
    (tmp_path / "main.py").write_text("print('hi')")

    entries = _walk_tree(tmp_path)
    assert "main.py" in entries
    assert not any(".git" in e for e in entries)
