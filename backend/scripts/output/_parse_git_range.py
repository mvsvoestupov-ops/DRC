"""One-off: list objects and sizes in origin/main..HEAD (no network)."""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(r"C:\IT\DRC")


def main() -> int:
    rng = "origin/main..HEAD"
    out = subprocess.check_output(
        ["git", "-C", str(ROOT), "rev-list", "--objects", rng],
        text=True,
        errors="replace",
    )
    lines = [ln.strip() for ln in out.splitlines() if ln.strip()]
    big: list[tuple[int, str, str]] = []
    paths: list[str] = []
    for ln in lines:
        parts = ln.split(maxsplit=1)
        oid = parts[0]
        path = parts[1] if len(parts) > 1 else ""
        if path:
            paths.append(path)
        try:
            sz = int(
                subprocess.check_output(
                    ["git", "-C", str(ROOT), "cat-file", "-s", oid],
                    text=True,
                ).strip()
            )
        except subprocess.CalledProcessError:
            continue
        if sz >= 1_048_576:
            big.append((sz, path or f"(blob {oid[:8]})", oid))
    big.sort(reverse=True)
    log = subprocess.check_output(
        ["git", "-C", str(ROOT), "log", "--oneline", rng],
        text=True,
        errors="replace",
    )
    status = subprocess.check_output(
        ["git", "-C", str(ROOT), "status", "-sb"],
        text=True,
        errors="replace",
    )
    env_hits = [
        p
        for p in paths
        if p.endswith(".env") or p.endswith(".env.example") or "PassFor" in p or "парол" in p
    ]
    esco = [p for p in paths if "ESCO" in p or p.endswith(".rdf") or p.endswith(".db")]
    dest = ROOT / "backend" / "scripts" / "output" / "_push_reject_diag_raw.txt"
    with dest.open("w", encoding="utf-8") as f:
        f.write("== git status -sb ==\n")
        f.write(status)
        f.write("\n== commits ==\n")
        f.write(log)
        f.write("\n== paths in range ==\n")
        for p in sorted(set(paths)):
            f.write(p + "\n")
        f.write("\n== blobs >= 1MB ==\n")
        for sz, path, oid in big:
            f.write(f"{sz}\t{path}\t{oid}\n")
        f.write("\n== env/secret-like paths ==\n")
        for p in sorted(set(env_hits)):
            f.write(p + "\n")
        f.write("\n== esco/db/rdf paths ==\n")
        for p in sorted(set(esco)):
            f.write(p + "\n")
    print(dest.read_text(encoding="utf-8"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
