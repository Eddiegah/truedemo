"""
Turns the exploration agent's action log into narration - grounded in
repo_context.py's real technical summary, not generic "streamline your
workflow" marketing language. This is where TrueDemo's whole claim gets
either proven or exposed as empty: the output should visibly reference
real dependencies/files from the repo, not just describe what's on screen.

Model selection is intentionally dynamic (list models, pick a Flash
variant) rather than a hardcoded version string - Gemini's free-tier
model lineup has moved fast enough in 2026 that pinning one name risks
a 404 the day it's deprecated. A short hardcoded fallback list covers
the case where listing itself fails.
"""
import json
import os

from google import genai
from google.genai import types

from action_log import ActionLog

FALLBACK_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-flash-latest"]

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


def _pick_model(client: genai.Client) -> str:
    try:
        for model in client.models.list():
            name = getattr(model, "name", "") or ""
            actions = getattr(model, "supported_actions", None) or []
            if "generateContent" in actions and "flash" in name.lower() and "preview" not in name.lower():
                return name.removeprefix("models/")
    except Exception as err:
        print(f"[script_writer] Model listing failed, using fallback list: {err}")
    return FALLBACK_MODELS[0]


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

    models_to_try = [_pick_model(client), *FALLBACK_MODELS]
    last_error: Exception | None = None

    for model in dict.fromkeys(models_to_try):  # dedupe, preserve order
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
            print(f"[script_writer] Narration written using model {model}")
            return
        except Exception as err:
            print(f"[script_writer] Model {model} failed: {err}")
            last_error = err
            continue

    raise RuntimeError(f"All Gemini models failed to produce narration: {last_error}")
