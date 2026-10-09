"""Normalize OTF/TF codes and qualification levels from messy HTML/XML fields."""
from __future__ import annotations

import re
from typing import NamedTuple

_CYR_TO_LAT = str.maketrans(
    "АВСЕНКМОРТХавсенкмортх",
    "ABCEHKMOPTXABCEHKMOPTX",
)

TF_CODE_RE = re.compile(
    r"([A-Za-zА-Яа-яЁё])\s*[/\\|．]\s*(\d{1,3})\s*[.．]\s*(\d)(?:\s*[.．]\s*(\d))?",
)
OTF_LETTER_RE = re.compile(r"^[A-Za-zА-Яа-яЁё]$")
LEVEL_PHRASE_RE = re.compile(
    r"(?:уровен[ьяе]\s*(?:\(подуровень\))?\s*квалификации|квалификации)\s*[:\s]*([1-9])",
    re.I,
)
CLEAN_LEVEL_RE = re.compile(r"^\s*([1-9])(?:\s*[.]\s*([1-9]))?\b")


class TfCodeParts(NamedTuple):
    letter: str
    seq: str
    level: str
    compact: str


def latin_otf_letter(value: str | None) -> str:
    text = (value or "").strip()
    if not text:
        return ""
    ch = text[0].translate(_CYR_TO_LAT).upper()
    return ch if "A" <= ch <= "Z" else ""


def parse_tf_code(value: str | None) -> TfCodeParts | None:
    match = TF_CODE_RE.search(value or "")
    if not match:
        return None
    letter = latin_otf_letter(match.group(1))
    if not letter:
        return None
    seq = match.group(2)
    level = match.group(3)
    compact = f"{letter}/{seq}.{level}"
    if match.group(4):
        compact = f"{compact}.{match.group(4)}"
    return TfCodeParts(letter, seq, level, compact)


def compact_tf_code(value: str | None) -> str:
    parts = parse_tf_code(value)
    if parts:
        return parts.compact
    return (value or "").strip()


def compact_otf_code(gf_code: str | None, tf_code: str | None = None) -> str:
    for candidate in (gf_code, tf_code):
        text = (candidate or "").strip()
        if OTF_LETTER_RE.fullmatch(text):
            letter = latin_otf_letter(text)
            if letter:
                return letter
    text = (gf_code or "").strip()
    first = text.split()[0] if text else ""
    if OTF_LETTER_RE.fullmatch(first):
        letter = latin_otf_letter(first)
        if letter:
            return letter
    parts = parse_tf_code(tf_code) or parse_tf_code(gf_code)
    return parts.letter if parts else ""


def qualification_digit(value: str | None) -> str:
    text = (value or "").strip()
    if not text:
        return ""
    if len(text) <= 12:
        match = CLEAN_LEVEL_RE.match(text)
        if match:
            return match.group(1)
    phrase = LEVEL_PHRASE_RE.search(text)
    if phrase:
        return phrase.group(1)
    parts = parse_tf_code(text)
    if parts and parts.level.isdigit() and 1 <= int(parts.level) <= 9:
        return parts.level
    if len(text) <= 12:
        match = re.search(r"[1-9]", text)
        if match:
            return match.group(0)
    return ""


def tf_qualification_level(
    gf_level: str | None = None,
    sub_ql: str | None = None,
    tf_code: str | None = None,
) -> str:
    for candidate in (gf_level, sub_ql, tf_code):
        digit = qualification_digit(candidate)
        if digit:
            return digit
    parts = parse_tf_code(tf_code)
    return parts.level if parts else ""
