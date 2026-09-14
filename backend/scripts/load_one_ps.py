"""Загрузка одного ПС с classinform.ru по коду и рег. номеру."""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.classinform_parser import load_ps_from_classinform


def main() -> int:
    if len(sys.argv) < 2:
        print("Использование: load_one_ps.py <код_ПС> [рег_номер]")
        print("Пример: load_one_ps.py 23.020 367")
        return 1

    ps_code = sys.argv[1].strip()
    reg_number = sys.argv[2].strip() if len(sys.argv) > 2 else None

    print(f"Загрузка {ps_code}" + (f" (reg={reg_number})" if reg_number else ""))
    ok = load_ps_from_classinform(ps_code, reg_number=reg_number)
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
