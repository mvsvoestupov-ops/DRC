"""One-shot: pull competence 32 from server and import locally. Safe to leave; no-ops after done."""
from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

DONE = Path(__file__).resolve().parents[1] / "scripts" / "output" / "_pull_32_oneshot_done.flag"
LOG = Path(__file__).resolve().parents[1] / "scripts" / "output" / "_pull_32_log.txt"
RESULT = Path(__file__).resolve().parents[1] / "scripts" / "output" / "_pull_32_result.txt"
OUT_JSON = Path(__file__).resolve().parents[1] / "scripts" / "output" / "competence_32_server.json"
DUMP_PY = Path(__file__).resolve().parents[1] / "scripts" / "output" / "dump_comp_32.py"
BACKEND = Path(__file__).resolve().parents[1]


def _log(msg: str) -> None:
    LOG.parent.mkdir(parents=True, exist_ok=True)
    with LOG.open("a", encoding="utf-8") as f:
        f.write(msg + "\n")


def _ssh_key() -> str | None:
    home = Path(os.environ.get("USERPROFILE") or os.environ.get("HOME") or "")
    for name in ("id_ed25519_drc", "id_ed25519", "id_rsa"):
        p = home / ".ssh" / name
        if p.exists():
            return str(p)
    return None


def _common_opts() -> list[str]:
    opts = ["-o", "StrictHostKeyChecking=accept-new", "-o", "BatchMode=yes"]
    key = _ssh_key()
    if key:
        opts = ["-i", key, *opts]
    return opts


def _openssh(name: str) -> str:
    candidates = [
        Path(os.environ.get("SystemRoot", r"C:\Windows")) / "System32" / "OpenSSH" / name,
        Path(r"C:\Windows\System32\OpenSSH") / name,
        Path(name),
    ]
    for p in candidates:
        if p.name == name and not p.is_absolute():
            return name
        if p.exists():
            return str(p)
    return name


def _write_result(**fields) -> None:
    lines = [f"{k}={v}" for k, v in fields.items()]
    RESULT.write_text("\n".join(lines) + "\n", encoding="utf-8")


def run() -> None:
    if DONE.exists() and DONE.read_text(encoding="utf-8").strip() not in {"", "retry"}:
        # allow explicit retry marker
        if DONE.read_text(encoding="utf-8").strip() != "retry":
            return
    # Claim immediately so uvicorn double-reload cannot start two pulls
    DONE.write_text("running\n", encoding="utf-8")
    LOG.write_text("=== oneshot pull_32 start\n", encoding="utf-8")
    try:
        host = "root@201.34.149.65"
        remote_py = "/tmp/dump_comp_32.py"
        common = _common_opts()
        scp_bin = _openssh("scp.exe")
        ssh_bin = _openssh("ssh.exe")
        _log(f"scp_bin={scp_bin}")
        _log(f"ssh_bin={ssh_bin}")
        _log(f"key={_ssh_key()}")
        _log(f"dump_py_exists={DUMP_PY.exists()} path={DUMP_PY}")

        _log("== Upload dump script")
        # port 22 is default; do not pass -p (scp: preserve times) with a value
        scp = subprocess.run(
            [scp_bin, *common, str(DUMP_PY), f"{host}:{remote_py}"],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            shell=False,
        )
        _log(scp.stdout or "")
        _log(scp.stderr or "")
        if scp.returncode != 0:
            _write_result(
                success="false",
                error=f"scp failed rc={scp.returncode}: {(scp.stderr or scp.stdout or '')[:500]}",
            )
            DONE.write_text("fail-scp\n", encoding="utf-8")
            return

        _log("== Dump competence 32 from server")
        dump = subprocess.run(
            [ssh_bin, *common, "-p", "22", host, f"python3 {remote_py}"],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            shell=False,
        )
        _log(f"dump rc={dump.returncode}")
        if dump.returncode != 0:
            _log(dump.stderr or dump.stdout or "")
            _write_result(
                success="false",
                error=f"ssh dump failed rc={dump.returncode}: {(dump.stderr or dump.stdout or '')[:500]}",
            )
            DONE.write_text("fail-dump\n", encoding="utf-8")
            return

        OUT_JSON.write_text(dump.stdout, encoding="utf-8")
        _log(f"Saved {OUT_JSON}")

        _log("== Import into local DB")
        py = BACKEND / "venv" / "Scripts" / "python.exe"
        if not py.exists():
            py = Path(sys.executable)
        imp = subprocess.run(
            [str(py), "scripts/_import_competence_json.py", str(OUT_JSON)],
            cwd=str(BACKEND),
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
        _log(imp.stdout or "")
        _log(imp.stderr or "")
        _log(f"import rc={imp.returncode}")

        ok = imp.returncode == 0
        competence_id = ""
        name = ""
        public_code = ""
        owner_email = ""
        err = (imp.stderr or "").strip()
        try:
            # import prints a JSON object
            text = (imp.stdout or "").strip()
            # find last JSON object in output
            start = text.rfind("{")
            if start >= 0:
                payload = json.loads(text[start:])
                competence_id = str(payload.get("id", ""))
                name = str(payload.get("name", ""))
                public_code = str(payload.get("public_code", ""))
                owner_email = str(payload.get("owner_email", ""))
                ok = bool(payload.get("ok", ok))
        except Exception as parse_exc:
            err = (err + f" parse_import_output: {parse_exc}").strip()

        _write_result(
            success="true" if ok else "false",
            competence_id=competence_id,
            name=name,
            public_code=public_code,
            owner_email=owner_email,
            error=err or "",
            import_stdout=(imp.stdout or "").strip()[:2000],
        )
        DONE.write_text("ok\n" if ok else "fail-import\n", encoding="utf-8")
    except Exception as exc:
        _log(f"EXCEPTION: {exc}")
        _write_result(success="false", error=str(exc))
        DONE.write_text("fail-exc\n", encoding="utf-8")
