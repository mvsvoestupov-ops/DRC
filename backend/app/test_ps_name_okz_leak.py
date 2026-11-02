# -*- coding: utf-8 -*-
"""Lightweight checks for PS name vs OKZ title leak (run: py -3 -m app.test_ps_name_okz_leak)."""
from __future__ import annotations

from .classinform_parser import (
    looks_like_okz_occupation_name,
    pick_professional_standard_name,
)


def test_okz_detector() -> None:
    assert looks_like_okz_occupation_name(
        "Квалифицированные рабочие промышленности и рабочие родственных занятий, не входящие в другие группы"
    )
    assert not looks_like_okz_occupation_name("Работник авиатопливообеспечения")


def test_pick_skips_okz() -> None:
    name = pick_professional_standard_name(
        "Квалифицированные рабочие промышленности и рабочие родственных занятий, не входящие в другие группы",
        "Работник авиатопливообеспечения",
        okz_names=[
            "Квалифицированные рабочие промышленности и рабочие родственных занятий, не входящие в другие группы"
        ],
    )
    assert name == "Работник авиатопливообеспечения"


if __name__ == "__main__":
    test_okz_detector()
    test_pick_skips_okz()
    print("OK")
