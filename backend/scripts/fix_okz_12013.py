"""Совместимость: заполнить ОКЗ только для ПС 12.013. См. fix_okz_all.py."""
from __future__ import annotations

import os
import runpy
import sys

BACKEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND)
os.chdir(BACKEND)

sys.argv = [os.path.join(BACKEND, "scripts", "fix_okz_all.py"), "--ps-code", "12.013", *sys.argv[1:]]
runpy.run_path(os.path.join(BACKEND, "scripts", "fix_okz_all.py"), run_name="__main__")
