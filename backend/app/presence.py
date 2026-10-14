"""In-memory presence for collaborative competency editing."""

from __future__ import annotations

import re
import threading
import time
from dataclasses import dataclass
from typing import Optional

PRESENCE_TTL_SECONDS = 25
_FRAGMENT_RE = re.compile(r"^[a-zA-Z0-9:._-]{1,64}$")
_COLORS = (
    "#2563EB",
    "#DC2626",
    "#059669",
    "#D97706",
    "#7C3AED",
    "#DB2777",
    "#0891B2",
    "#4F46E5",
    "#65A30D",
    "#EA580C",
)

_lock = threading.Lock()
_entries: dict[tuple[int, int], "PresenceEntry"] = {}


@dataclass
class PresenceEntry:
    competence_id: int
    user_id: int
    step: int
    fragment: str
    seen_at: float


def presence_color(user_id: int) -> str:
    return _COLORS[int(user_id) % len(_COLORS)]


def sanitize_fragment(value: Optional[str], step: int) -> str:
    text = (value or "").strip()
    if text and _FRAGMENT_RE.match(text):
        return text
    return f"step:{max(1, min(int(step or 1), 10))}"


def sanitize_step(value: Optional[int]) -> int:
    try:
        step = int(value or 1)
    except (TypeError, ValueError):
        step = 1
    return max(1, min(step, 10))


def _prune_unlocked(now: float) -> None:
    expired = [key for key, entry in _entries.items() if now - entry.seen_at > PRESENCE_TTL_SECONDS]
    for key in expired:
        _entries.pop(key, None)


def upsert_presence(competence_id: int, user_id: int, step: int, fragment: str) -> None:
    now = time.time()
    with _lock:
        _prune_unlocked(now)
        _entries[(competence_id, user_id)] = PresenceEntry(
            competence_id=competence_id,
            user_id=user_id,
            step=sanitize_step(step),
            fragment=sanitize_fragment(fragment, step),
            seen_at=now,
        )


def drop_presence(competence_id: int, user_id: int) -> None:
    with _lock:
        _entries.pop((competence_id, user_id), None)


def list_presence(competence_id: int) -> list[PresenceEntry]:
    now = time.time()
    with _lock:
        _prune_unlocked(now)
        return [entry for entry in _entries.values() if entry.competence_id == competence_id]
