"""
Clones the target GitHub repo (shallow) and extracts a concise technical
summary - README, manifest/dependency files, and a bounded directory
listing - so script_writer.py can ground narration in what the app
*actually* is, not just what it looks like from clicking around it.

This is the core of TrueDemo's differentiator: every other autonomous
demo tool only sees the UI. This module is what lets the narration
mention the real stack, real dependencies, real file structure.
"""
import shutil
import subprocess
import tempfile
from pathlib import Path

IGNORED_DIRS = {
    ".git", "node_modules", "venv", ".venv", "__pycache__", "dist",
    "build", ".next", "out", "target", ".vercel",
}
MANIFEST_FILES = [
    "package.json", "requirements.txt", "pyproject.toml", "Cargo.toml",
    "go.mod", "Gemfile", "composer.json",
]
README_CANDIDATES = ["README.md", "readme.md", "Readme.md", "README"]

CLONE_TIMEOUT_SECONDS = 60
MAX_README_CHARS = 3000
MAX_TREE_ENTRIES = 60


def _clone(repo_url: str, dest: Path) -> None:
    subprocess.run(
        ["git", "clone", "--depth", "1", "--single-branch", repo_url, str(dest)],
        check=True,
        capture_output=True,
        timeout=CLONE_TIMEOUT_SECONDS,
    )


def _read_readme(root: Path) -> str:
    for name in README_CANDIDATES:
        path = root / name
        if path.exists():
            text = path.read_text(encoding="utf-8", errors="ignore")
            return text[:MAX_README_CHARS]
    return ""


def _read_manifests(root: Path) -> dict[str, str]:
    """Checks the repo root plus one level of subdirectories, so a
    monorepo layout (e.g. frontend/package.json, worker/requirements.txt)
    isn't invisible just because nothing sits at the top level."""
    found = {}
    search_dirs = [root] + [d for d in root.iterdir() if d.is_dir() and d.name not in IGNORED_DIRS]
    for directory in search_dirs:
        for name in MANIFEST_FILES:
            path = directory / name
            if path.exists():
                key = str(path.relative_to(root))
                found[key] = path.read_text(encoding="utf-8", errors="ignore")[:2000]
    return found


def _walk_tree(root: Path) -> list[str]:
    entries = []
    for path in sorted(root.rglob("*")):
        if any(part in IGNORED_DIRS for part in path.parts):
            continue
        if len(entries) >= MAX_TREE_ENTRIES:
            break
        entries.append(str(path.relative_to(root)))
    return entries


def get_repo_context(repo_url: str) -> str:
    """Returns a plain-text technical summary of the repo, or an empty
    string (never raises) if the repo can't be cloned - a missing/private
    repo shouldn't fail the whole job, just narrow the narration to what
    the exploration agent can observe from the UI alone."""
    tmp_dir = Path(tempfile.mkdtemp(prefix="truedemo-repo-"))
    try:
        _clone(repo_url, tmp_dir)

        readme = _read_readme(tmp_dir)
        manifests = _read_manifests(tmp_dir)
        tree = _walk_tree(tmp_dir)

        parts = [f"Repository: {repo_url}"]

        if manifests:
            parts.append("\nDependency/manifest files found:")
            for name, content in manifests.items():
                parts.append(f"--- {name} ---\n{content}")

        if readme:
            parts.append(f"\nREADME excerpt:\n{readme}")

        if tree:
            parts.append(f"\nFile tree ({len(tree)} entries shown):\n" + "\n".join(tree))

        return "\n".join(parts)
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired, OSError) as err:
        print(f"[repo_context] Could not read repo {repo_url}: {err}")
        return ""
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)
