"""Import competence JSON dump from server into local profstandart.db."""
from __future__ import annotations

import json
import sys
from datetime import datetime
from pathlib import Path

# backend/ as cwd expected
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.db.session import SessionLocal  # noqa: E402
from app.db.competence_models import Competence, CompetenceStatus  # noqa: E402
from app.db.user_models import User  # noqa: E402


def _parse_json_field(value):
    if value is None or value == "":
        return None
    if isinstance(value, (dict, list)):
        return value
    if isinstance(value, str):
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return value
    return value


def _parse_dt(value):
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    text = str(value).replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(text)
    except ValueError:
        return None


def _status(value) -> CompetenceStatus:
    raw = str(value or "проект")
    for item in CompetenceStatus:
        if item.value == raw or item.name == raw:
            return item
    mapping = {
        "DRAFT": CompetenceStatus.DRAFT,
        "REVIEW": CompetenceStatus.REVIEW,
        "APPROVED": CompetenceStatus.APPROVED,
        "проект": CompetenceStatus.DRAFT,
        "на экспертизе": CompetenceStatus.REVIEW,
        "утверждена": CompetenceStatus.APPROVED,
    }
    return mapping.get(raw, CompetenceStatus.DRAFT)


def main() -> int:
    path = Path(sys.argv[1] if len(sys.argv) > 1 else "scripts/output/competence_32_server.json")
    payload = json.loads(path.read_text(encoding="utf-8"))
    row = payload.get("row") or payload
    target_id = int(row["id"])

    session = SessionLocal()
    try:
        local_user = (
            session.query(User).filter(User.role.in_(["admin", "moderator", "expert"])).order_by(User.id).first()
            or session.query(User).order_by(User.id).first()
        )
        owner_id = local_user.id if local_user else None

        existing = session.query(Competence).filter(Competence.id == target_id).first()
        created = False
        if existing:
            comp = existing
            print(f"Updating local competence id={target_id}")
        else:
            comp = Competence(id=target_id)
            created = True
            print(f"Inserting local competence id={target_id}")

        comp.public_code = row.get("public_code") or f"RUS-PK-{target_id:04d}"
        comp.name = row.get("name") or comp.public_code
        comp.qualification_name = row.get("qualification_name")
        comp.qualification_level = row.get("qualification_level")
        comp.prof_standard_id = row.get("prof_standard_id")
        comp.qualification_id = row.get("qualification_id")
        comp.labor_functions = _parse_json_field(row.get("labor_functions")) or []
        comp.structure = _parse_json_field(row.get("structure")) or {}
        comp.descriptors = _parse_json_field(row.get("descriptors")) or {}
        comp.discipline_mapping = _parse_json_field(row.get("discipline_mapping")) or []
        comp.ed_technologies = _parse_json_field(row.get("ed_technologies")) or []
        comp.assessment_tools = _parse_json_field(row.get("assessment_tools")) or []
        comp.resources = _parse_json_field(row.get("resources")) or []
        comp.status = _status(row.get("status"))
        comp.developer = row.get("developer")
        comp.validator = row.get("validator")
        comp.validation_notes = row.get("validation_notes")
        comp.is_active = int(row.get("is_active") if row.get("is_active") is not None else 1)
        comp.raw_data = _parse_json_field(row.get("raw_data")) or {}
        comp.user_id = owner_id
        created_at = _parse_dt(row.get("created_at"))
        updated_at = _parse_dt(row.get("updated_at"))
        if created_at:
            comp.created_at = created_at
        if updated_at:
            comp.updated_at = updated_at

        if created:
            session.add(comp)
        session.commit()
        session.refresh(comp)
        print(
            json.dumps(
                {
                    "ok": True,
                    "id": comp.id,
                    "public_code": comp.public_code,
                    "name": comp.name,
                    "status": comp.status.value if comp.status else None,
                    "owner_user_id": comp.user_id,
                    "owner_email": getattr(local_user, "email", None),
                    "source_db": payload.get("db"),
                    "has_structure": bool(comp.structure),
                    "assessment_tools": len(comp.assessment_tools or []),
                    "assessment_tools_v2": bool((comp.raw_data or {}).get("assessment_tools_v2")),
                    "wizard_step": (comp.raw_data or {}).get("wizard_step"),
                },
                ensure_ascii=False,
                indent=2,
            )
        )
        return 0
    except Exception as exc:
        session.rollback()
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    finally:
        session.close()


if __name__ == "__main__":
    raise SystemExit(main())
