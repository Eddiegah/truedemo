"""
The exploration agent: drives a real headless Chromium browser around
the target app and records what it finds. This is Playwright automation,
not a scripted click sequence - the agent discovers same-origin links,
buttons, and fillable inputs and picks unvisited ones, bounded by
MAX_STEPS and a visited-URL set so it can never loop forever on a page
that keeps offering the same link back to itself.

Filling real inputs (not just clicking links) matters for the product's
own claim: a demo that only ever navigates between pages never actually
shows what the app *does* - a search box that's never searched, a form
that's never submitted. Typing a plausible value in and submitting it
is what makes the resulting video show a real feature working.
"""
from pathlib import Path
from urllib.parse import urljoin, urlparse

from playwright.sync_api import Error as PlaywrightError, Locator, Page, sync_playwright

from action_log import ActionLog

MAX_STEPS = 7
NAV_TIMEOUT_MS = 15_000
ACTION_TIMEOUT_MS = 8_000
VIEWPORT = {"width": 1280, "height": 800}

# Elements whose text/href strongly suggest they leave the app or destroy
# state (external links, auth/logout, mailto/tel) - skipped so the agent
# stays inside the product being demoed.
SKIP_PATTERNS = ("logout", "sign out", "delete", "mailto:", "tel:")

INPUT_SELECTOR = (
    "input[type='text'], input[type='search'], input[type='email'], "
    "input:not([type]), textarea"
)

# Heuristic sample values keyed by keywords found in an input's placeholder/
# aria-label/name - picks something plausible for the field rather than
# leaving it empty or typing something obviously fake like "asdf".
SAMPLE_VALUES: list[tuple[tuple[str, ...], str]] = [
    (("search", "topic", "query", "keyword", "research"), "AI research trends"),
    (("email",), "demo@truedemo.dev"),
    (("url", "link", "website", "repo"), "https://example.com"),
    (("name",), "Alex Chen"),
]
DEFAULT_SAMPLE_VALUE = "TrueDemo demo"


def _same_origin(base_url: str, candidate_url: str) -> bool:
    return urlparse(base_url).netloc == urlparse(candidate_url).netloc


def _is_skippable(text: str, href: str) -> bool:
    haystack = f"{text} {href}".lower()
    return any(pattern in haystack for pattern in SKIP_PATTERNS)


def _sample_value_for(hint: str) -> str:
    hint = hint.lower()
    for keywords, value in SAMPLE_VALUES:
        if any(k in hint for k in keywords):
            return value
    return DEFAULT_SAMPLE_VALUE


def _screenshot(page: Page, output_dir: Path, step: int) -> str:
    path = output_dir / f"step_{step}.png"
    page.screenshot(path=str(path))
    return str(path)


def _find_fillable_input(page: Page, visited_labels: set[str]) -> tuple[str, Locator, str] | None:
    """Returns (description, locator, value) for the first visible, empty,
    enabled text-like input not yet interacted with - filling a real field
    beats only ever clicking links, since it's what actually shows a
    feature (e.g. a search box) working rather than just existing."""
    elements = page.locator(INPUT_SELECTOR).all()
    for el in elements:
        try:
            if not el.is_visible() or not el.is_enabled():
                continue
            if (el.input_value() or "").strip():
                continue

            hint = " ".join(
                filter(
                    None,
                    [
                        el.get_attribute("placeholder"),
                        el.get_attribute("aria-label"),
                        el.get_attribute("name"),
                    ],
                )
            )
            if not hint:
                continue

            label = hint[:60]
            if label in visited_labels:
                continue

            value = _sample_value_for(hint)
            return f'Typed "{value}" into "{label}"', el, value
        except PlaywrightError:
            continue
    return None


def _find_next_candidate(
    page: Page, base_url: str, visited_urls: set[str], visited_labels: set[str]
) -> tuple[str, str | Locator] | None:
    """Returns (description, target) for the first unvisited, in-app,
    non-skippable clickable element found on the page, or None. `target`
    is a URL string for links (navigated via page.goto) or the element's
    own Locator for buttons (clicked directly - never re-queried by text,
    which could otherwise match the wrong element or none at all)."""
    elements = page.locator("a[href], button").all()
    for el in elements:
        try:
            if not el.is_visible():
                continue
            text = (el.inner_text(timeout=1000) or "").strip()
            tag = el.evaluate("e => e.tagName.toLowerCase()")
            href = el.get_attribute("href") if tag == "a" else None
            resolved = urljoin(page.url, href) if href else page.url

            if not text or text[:60] in visited_labels:
                continue
            if _is_skippable(text, href or ""):
                continue
            if tag == "a" and href:
                if not _same_origin(base_url, resolved):
                    continue
                if resolved in visited_urls:
                    continue

            label = text[:60]
            description = f"Clicked \"{label}\"" if tag == "button" else f"Navigated to \"{label}\""
            return description, (resolved if tag == "a" else el)
        except PlaywrightError:
            continue
    return None


def explore(url: str, output_dir: Path) -> ActionLog:
    output_dir.mkdir(parents=True, exist_ok=True)
    log = ActionLog()
    visited_urls: set[str] = {url}
    visited_labels: set[str] = set()

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport=VIEWPORT)
        page.set_default_timeout(ACTION_TIMEOUT_MS)
        page.set_default_navigation_timeout(NAV_TIMEOUT_MS)

        page.goto(url, wait_until="domcontentloaded")
        page.wait_for_timeout(1000)
        shot = _screenshot(page, output_dir, len(log.steps))
        log.add("Landed on the app", shot, page.url)
        last_good_url = page.url

        for _ in range(MAX_STEPS):
            # A fillable input takes priority over a plain navigation/click
            # candidate - actually using a feature is more demo-worthy than
            # just visiting another page.
            fill_candidate = _find_fillable_input(page, visited_labels)

            try:
                if fill_candidate:
                    description, locator, value = fill_candidate
                    visited_labels.add(description.split('"')[3])
                    locator.fill(value, timeout=ACTION_TIMEOUT_MS)
                    page.wait_for_timeout(300)
                    try:
                        locator.press("Enter", timeout=ACTION_TIMEOUT_MS)
                    except PlaywrightError:
                        pass  # Not every field submits on Enter - fine, the fill itself is the demo-worthy part.
                    page.wait_for_timeout(1000)
                else:
                    candidate = _find_next_candidate(page, url, visited_urls, visited_labels)
                    if candidate is None:
                        break
                    description, target = candidate
                    visited_labels.add(description.split('"')[1])

                    if isinstance(target, str):
                        page.goto(target, wait_until="domcontentloaded")
                        visited_urls.add(target)
                    else:
                        target.click(timeout=ACTION_TIMEOUT_MS)
                    page.wait_for_timeout(800)
            except PlaywrightError as err:
                print(f"[agent] Step skipped, action failed: {err}")
                # A failed navigation (broken link, 404, redirect to nowhere)
                # can leave the page's DOM empty even though page.url looks
                # unchanged - confirmed by testing: 2 real, visible elements
                # before a failed goto, 0 found after, with page.url
                # identical both times. Without recovering here, one bad
                # link silently truncates the rest of the exploration, since
                # every later candidate search finds nothing on an empty
                # page. Reloading the last known-good URL restores a real
                # DOM before the next attempt.
                try:
                    page.goto(last_good_url, wait_until="domcontentloaded")
                except PlaywrightError:
                    pass
                continue

            last_good_url = page.url

            visited_urls.add(page.url)
            shot = _screenshot(page, output_dir, len(log.steps))
            log.add(description, shot, page.url)

        browser.close()

    return log
