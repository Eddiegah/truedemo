"""
Turns the exploration agent's action log into narration - grounded in
repo_context.py's real technical summary, not generic "streamline your
workflow" marketing language. This is where TrueDemo's whole claim gets
either proven or exposed as empty: the output should visibly reference
real dependencies/files from the repo, not just describe what's on screen.

Model selection tries `gemini-flash-latest` first - Google's own alias
for "whatever flash model is currently recommended," immune to version
drift by design - then a couple of hardcoded, verified-working pins as
backup. Earlier this used `client.models.list()` to auto-pick a model,
but that list includes deprecated-for-new-users models with no signal
distinguishing them from live ones (confirmed directly: it returned
`gemini-2.5-flash` first, which 404s with "no longer available to new
users, use gemini-3.6-flash instead" - the API's own error message
names the fix). A transient 503 ("high demand") is retried a couple of
times before moving to the next model, since on the free tier that's
usually just momentary capacity, not a dead model.
"""
import json
import os
import time

from google import genai
from google.genai import types

from action_log import ActionLog

FALLBACK_MODELS = ["gemini-flash-latest", "gemini-3.6-flash", "gemini-2.5-flash"]
MAX_RETRIES_PER_MODEL = 2
RETRY_DELAY_SECONDS = 3

SYSTEM_INSTRUCTION = """You write narration scripts for short autonomous product demo videos.

You are given (1) real technical context pulled from the product's actual source
repository - dependencies, README, file structure - and (2) a step-by-step log of
what an automated browser just did while exploring the live app.

Your narration must be TECHNICALLY GROUNDED: where relevant, reference the real
stack, real dependencies, or real files from the repo context rather than generic
marketing language like "streamline your workflow" or "powerful and intuitive."
If the repo context is empty, narrate only what's visibly true from the action log
- never invent technical details that aren't given to you.

Write exactly one narration line per action log step, in order, each 1-2 sentences,
conversational and confident, suitable for a text-to-speech voiceover.

Respond with ONLY a JSON array of strings, one per step, in order. No other text."""


def write_narration(action_log: ActionLog, repo_context: str) -> None:
    """Mutates action_log in place, setting `.narration` on each step."""
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not configured - can't write narration.")

    client = genai.Client(api_key=api_key)

    prompt = (
        f"REPO CONTEXT:\n{repo_context or '(no repository provided - narrate only what is visible)'}\n\n"
        f"ACTION LOG ({len(action_log.steps)} steps):\n{action_log.as_prompt_text()}"
    )

    last_error: Exception | None = None

    for model in FALLBACK_MODELS:
        for attempt in range(1, MAX_RETRIES_PER_MODEL + 1):
            try:
                response = client.models.generate_content(
                    model=model,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        system_instruction=SYSTEM_INSTRUCTION,
                        response_mime_type="application/json",
                        temperature=0.6,
                    ),
                )
                lines = json.loads(response.text)
                if not isinstance(lines, list) or len(lines) != len(action_log.steps):
                    raise ValueError(f"Expected {len(action_log.steps)} narration lines, got {lines!r}")

                for step, line in zip(action_log.steps, lines):
                    step.narration = str(line)
                print(f"[script_writer] Narration written using model {model} (attempt {attempt})")
                return
            except Exception as err:
                last_error = err
                is_overloaded = "503" in str(err) or "UNAVAILABLE" in str(err)
                if is_overloaded and attempt < MAX_RETRIES_PER_MODEL:
                    print(f"[script_writer] Model {model} overloaded, retrying in {RETRY_DELAY_SECONDS}s: {err}")
                    time.sleep(RETRY_DELAY_SECONDS)
                    continue
                print(f"[script_writer] Model {model} failed: {err}")
                break

    raise RuntimeError(f"All Gemini models failed to produce narration: {last_error}")
