"""
The record of what the exploration agent actually did to the app -
one entry per step, each with the screenshot taken right after that
step. script_writer.py turns this into narration; video_assembly.py
turns it into the video's visual timeline. Kept as a plain dataclass
list rather than a dict/JSON blob so both consumers get typed access
to the same source of truth.
"""
from dataclasses import dataclass, field


@dataclass
class ActionStep:
    step: int
    description: str
    screenshot_path: str
    url: str
    narration: str = ""
    audio_path: str = ""


@dataclass
class ActionLog:
    steps: list[ActionStep] = field(default_factory=list)

    def add(self, description: str, screenshot_path: str, url: str) -> ActionStep:
        step = ActionStep(
            step=len(self.steps),
            description=description,
            screenshot_path=screenshot_path,
            url=url,
        )
        self.steps.append(step)
        return step

    def as_prompt_text(self) -> str:
        lines = [f"{s.step}. {s.description} (at {s.url})" for s in self.steps]
        return "\n".join(lines)
