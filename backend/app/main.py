from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, status, BackgroundTasks, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.responses import HTMLResponse, Response
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import os
import datetime
import re
from sqlalchemy import or_, func, false as sa_false, String

from .parser import (
    parse_xml,
    fetch_all_standards_bulk,
    normalize_okso_code,
    extract_okso_values,
    extract_okso_codes_from_text,
    okso_matches_fgos,
    normalize_okpdtr_code,
    extract_okpdtr_codes_from_text,
    okpdtr_matches,
)
from .db import SessionLocal, Base, engine
from .db.raw_models import StandardRaw, GeneralizedFunctionRaw, ParticularFunctionRaw
from .db.qualifications_models import Qualification
from .db.assessment_tools_models import AssessmentTool
from .db.competence_models import Competence, CompetenceStatus
from .db.feedback_models import Feedback
from .db.user_models import User
from .db.registration_models import Registration
from .db.fgos_models import FgosSpo
from .fgos_registry import FGOS_CATEGORIES, FGOS_CATEGORY_BY_ID, FGOS_CATEGORY_IDS
from .db_operations import save_raw_standard
from .enrichment import (
    enrich_standard,
    enrich_standards_batch,
    get_enrichment_stats,
    cleanup_orphaned_enriched,
)
from .qualifications_parser import (
    fetch_all_qualifications,
    fetch_missing_qualifications,
    get_qualification_stats,
)
from .os_parser import (
    fetch_all_assessment_tools,
    get_assessment_tool_stats,
    link_assessment_tools_to_qualifications,
    sync_assessment_tool_revision_status,
)
from .spk_registry import (
    list_spk_names,
    reconcile_spk_names_in_db,
    sync_spk_from_reestr_xlsx,
    resolve_reestr_xlsx_path,
)
from .qualification_links import (
    qualification_count_by_standard_id,
    assessment_tool_count_by_qualification_id,
    assessment_tool_count_by_standard_id,
    qualification_flags,
    assessment_tool_flags,
    relink_all_qualifications,
    standards_qualification_coverage,
    audit_qualification_links,
    relink_and_audit,
)
from .progress import qualifications_fetch_progress, assessment_tools_fetch_progress
from .auth import (
    authenticate_user, create_access_token, get_current_user,
    get_current_admin, get_password_hash, oauth2_scheme
)
from sqlalchemy.orm import Session
from sqlalchemy import text
from .db.schema import (
    ensure_ps_status_columns,
    ensure_maket_columns,
    ensure_spk_columns,
    ensure_fgos_columns,
    ensure_users_columns,
    ensure_assessment_tools_columns,
)
from .level_matrix import load_matrix, load_structured_matrix, matrix_summary, DOCX_PATH
from .reference_data import (
    get_formation_levels,
    get_qualification_levels,
    get_qualification_level,
    get_universal_skill_catalog,
    get_matrix_context,
    get_reference_bundle,
    get_order_148n_indicators,
    normalize_descriptors,
    normalize_qualification_level_code,
)
from .fts_index import build_fts_match_query, ensure_fts_populated, area_filter_clause
from .competence_profile import (
    build_formation_profile,
    merge_raw_data,
    suggest_competence_profile,
    validate_competence_payload,
)
from .prof_training_registry import (
    ensure_prof_training_seeded,
    import_prof_training_from_path,
    list_prof_training_professions,
    prof_training_sections,
)

Base.metadata.create_all(bind=engine)
for col in ensure_ps_status_columns():
    print(f"DB migration: added column {col}")
for col in ensure_maket_columns():
    print(f"DB migration: added column {col}")
for col in ensure_spk_columns():
    print(f"DB migration: added column {col}")
for col in ensure_fgos_columns():
    print(f"DB migration: added column {col}")
for col in ensure_users_columns():
    print(f"DB migration: added column {col}")
for col in ensure_assessment_tools_columns():
    print(f"DB migration: added column {col}")


def ensure_assessment_tool_revisions() -> None:
    """Однократно при старте: активна только последняя ревизия ОС (.002 > .001 и т.д.)."""
    try:
        result = sync_assessment_tool_revision_status()
        if result.get("deactivated") or result.get("activated"):
            print(
                "OS revisions synced: "
                f"groups={result.get('groups')} "
                f"activated={result.get('activated')} "
                f"deactivated={result.get('deactivated')}"
            )
    except Exception as exc:
        print(f"OS revision sync failed: {exc}")


ensure_assessment_tool_revisions()


def ensure_spk_name_normalization() -> None:
    db = SessionLocal()
    try:
        updated = reconcile_spk_names_in_db(db)
        if updated:
            print(f"SPK names normalized: {updated} rows updated")
    except Exception as exc:
        db.rollback()
        print(f"SPK name normalization failed: {exc}")
    finally:
        db.close()


ensure_spk_name_normalization()


def ensure_prof_training_professions() -> None:
    """Загрузка перечня профессий/должностей для профобучения (приказ №534), если таблица пуста."""
    db = SessionLocal()
    try:
        result = ensure_prof_training_seeded(db)
        if result.get("status") == "ok":
            print(
                "Prof training professions seeded: "
                f"total={result.get('total')} active={result.get('active')}"
            )
        elif result.get("status") == "exists":
            print(
                "Prof training professions: "
                f"total={result.get('total')} active={result.get('active')}"
            )
        elif result.get("status") == "empty":
            print("Prof training professions: seed JSON missing, skip")
    except Exception as exc:
        db.rollback()
        print(f"Prof training professions seed failed: {exc}")
    finally:
        db.close()


ensure_prof_training_professions()


def ensure_admin_credentials() -> None:
    """Гарантирует актуальный логин/пароль администратора."""
    admin_email = "admin@aonk.ru"
    admin_password = "Aonk2026!"
    old_admin_email = "admin@admin.ru"

    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.email == admin_email).first()
        old_admin = db.query(User).filter(User.email == old_admin_email).first()
        hashed = get_password_hash(admin_password)

        if admin:
            admin.email = admin_email
            admin.hashed_password = hashed
            admin.role = "admin"
            admin.is_active = True
            if old_admin and old_admin.id != admin.id:
                db.delete(old_admin)
        elif old_admin:
            old_admin.email = admin_email
            old_admin.hashed_password = hashed
            old_admin.role = "admin"
            old_admin.is_active = True
        else:
            db.add(
                User(
                    email=admin_email,
                    hashed_password=hashed,
                    role="admin",
                    is_active=True,
                )
            )
        db.commit()
        print(f"Admin ready: {admin_email}")
    except Exception as exc:
        db.rollback()
        print(f"Admin ensure failed: {exc}")
    finally:
        db.close()


ensure_admin_credentials()

app = FastAPI()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def warm_level_matrix_cache() -> None:
    ensure_admin_credentials()
    try:
        data = load_matrix(force_refresh=True)
        structured = load_structured_matrix(force_refresh=False)
        print(
            f"Level matrix: {data.get('paragraph_count', 0)} paragraphs, "
            f"{data.get('table_count', 0)} tables, "
            f"{len(structured.get('qualification_levels', []))} qualification levels"
        )
    except Exception as exc:
        print(f"Level matrix extract failed: {exc}")
    try:
        indexed = ensure_fts_populated()
        print(f"FTS index: {indexed} standards indexed for search")
    except Exception as exc:
        print(f"FTS index failed: {exc}")


# ---------- Модели Pydantic ----------

class CompetenceCreate(BaseModel):
    name: str
    qualification_name: str
    qualification_level: str
    prof_standard_id: Optional[int] = None
    qualification_id: Optional[int] = None
    competence_kind: Optional[str] = "professional"
    labor_functions: List[Dict[str, Any]]
    structure: Dict[str, List[str]]
    descriptors: Optional[Dict] = {}
    discipline_mapping: Optional[List[Dict]] = []
    ed_technologies: Optional[List[str]] = []
    assessment_tools: List[Dict]
    resources: Optional[List[str]] = []
    developer: str
    validator: Optional[str] = None
    status: Optional[str] = "проект"
    description: Optional[str] = ""
    industry: Optional[str] = ""
    hours: Optional[str] = ""
    education_level: Optional[str] = ""
    education_kind: Optional[str] = ""
    education_training_profession_id: Optional[int] = None
    education_training_profession: Optional[str] = ""
    fgos_id: Optional[int] = None
    fgos_code: Optional[str] = ""
    fgos_name: Optional[str] = ""
    fgos_category: Optional[str] = ""
    universal_skills: Optional[List[Dict[str, Any]]] = None

class CompetenceUpdate(BaseModel):
    name: Optional[str] = None
    qualification_name: Optional[str] = None
    qualification_level: Optional[str] = None
    prof_standard_id: Optional[int] = None
    qualification_id: Optional[int] = None
    competence_kind: Optional[str] = None
    labor_functions: Optional[List[Dict]] = None
    structure: Optional[Dict] = None
    descriptors: Optional[Dict] = None
    discipline_mapping: Optional[List[Dict]] = None
    ed_technologies: Optional[List[str]] = None
    assessment_tools: Optional[List[Dict]] = None
    resources: Optional[List[str]] = None
    developer: Optional[str] = None
    validator: Optional[str] = None
    validation_notes: Optional[str] = None
    status: Optional[str] = None
    description: Optional[str] = None
    industry: Optional[str] = None
    hours: Optional[str] = None
    education_level: Optional[str] = None
    education_kind: Optional[str] = None
    education_training_profession_id: Optional[int] = None
    education_training_profession: Optional[str] = None
    fgos_id: Optional[int] = None
    fgos_code: Optional[str] = None
    fgos_name: Optional[str] = None
    fgos_category: Optional[str] = None
    universal_skills: Optional[List[Dict[str, Any]]] = None

class SuggestProfileRequest(BaseModel):
    qualification_level: str
    structure: Optional[Dict[str, List[str]]] = None
    competence_kind: Optional[str] = "professional"

class CoverageRequest(BaseModel):
    standard_id: int
    selected_tf_codes: List[str]

class FeedbackCreate(BaseModel):
    section: str
    text: str

# ---------- Аутентификация ----------

@app.post("/token")
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    db = SessionLocal()
    user = authenticate_user(db, form_data.username, form_data.password)
    db.close()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(data={"sub": user.email})
    return {"access_token": access_token, "token_type": "bearer", "role": user.role}

@app.get("/users/me")
async def get_me(current_user: User = Depends(get_current_user)):
    return {"email": current_user.email, "role": current_user.role}

@app.post("/users/register")
async def register_user(email: str, password: str, role: str = "user", current_user: User = Depends(get_current_admin)):
    db = SessionLocal()
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(400, "Email already registered")
    hashed = get_password_hash(password)
    new_user = User(email=email, hashed_password=hashed, role=role)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    db.close()
    return {"message": "User created", "email": new_user.email}

# ---------- Профессиональные стандарты ----------

def _standard_list_item(
    s: StandardRaw,
    qual_counts: dict[int, int],
    os_counts: dict[int, int] | None = None,
) -> dict:
    return {
        "id": s.id,
        "name": s.name,
        "reg_number": s.reg_number,
        "date": s.approval_date,
        "status": getattr(s, "status", None) or "active",
        "revoked_date": getattr(s, "revoked_date", None),
        "professional_area_code": s.professional_area_code,
        "ps_code": getattr(s, "ps_code", None),
        "kind_activity": s.kind_activity,
        "spk_name": getattr(s, "spk_name", None),
        **qualification_flags(s.id, qual_counts),
        **assessment_tool_flags(s.id, os_counts or {}),
    }


def _area_code_expr():
    """Код области: professional_area_code или первые 2 цифры ps_code."""
    from sqlalchemy import case

    return case(
        (
            StandardRaw.professional_area_code.isnot(None)
            & (StandardRaw.professional_area_code != ""),
            StandardRaw.professional_area_code,
        ),
        else_=func.substr(StandardRaw.ps_code, 1, 2),
    )


def _apply_standards_list_filters(
    query,
    *,
    q: str,
    spk: str,
    area: str,
    only_with_qualifications: bool,
    qual_counts: dict[int, int],
):
    q = (q or "").strip()
    spk = (spk or "").strip()
    area = (area or "").strip()
    if area:
        area = area.zfill(2)

    if q:
        like = f"%{q}%"
        query = query.filter(
            or_(
                StandardRaw.name.ilike(like),
                StandardRaw.reg_number.ilike(like),
                StandardRaw.kind_activity.ilike(like),
                StandardRaw.spk_name.ilike(like),
                StandardRaw.ps_code.ilike(like),
            )
        )
    if spk:
        query = query.filter(func.lower(StandardRaw.spk_name) == spk.lower())
    if area:
        query = query.filter(
            or_(
                StandardRaw.professional_area_code == area,
                StandardRaw.ps_code.like(f"{area}.%"),
            )
        )
    if only_with_qualifications:
        ids_with = [sid for sid, cnt in qual_counts.items() if cnt > 0]
        if ids_with:
            query = query.filter(StandardRaw.id.in_(ids_with))
        else:
            query = query.filter(sa_false())
    return query


@app.get("/standards")
async def list_standards(
    current_user: User = Depends(get_current_user),
    page: int = Query(1, ge=1),
    limit: Optional[int] = Query(
        None,
        ge=1,
        le=200,
        description="Если задан — постраничный ответ {items,total,...}. Без параметра — полный список (для пикеров).",
    ),
    q: str = Query(""),
    spk: str = Query(""),
    area: str = Query(""),
    only_with_qualifications: bool = Query(False),
):
    from sqlalchemy.orm import load_only

    session = SessionLocal()
    try:
        qual_counts = qualification_count_by_standard_id(session)
        os_counts = assessment_tool_count_by_standard_id(session)
        base = session.query(StandardRaw).options(
            load_only(
                StandardRaw.id,
                StandardRaw.name,
                StandardRaw.reg_number,
                StandardRaw.approval_date,
                StandardRaw.status,
                StandardRaw.revoked_date,
                StandardRaw.professional_area_code,
                StandardRaw.ps_code,
                StandardRaw.kind_activity,
                StandardRaw.spk_name,
            )
        )
        base = _apply_standards_list_filters(
            base,
            q=q,
            spk=spk,
            area=area,
            only_with_qualifications=only_with_qualifications,
            qual_counts=qual_counts,
        )

        if limit is None:
            standards = base.order_by(StandardRaw.reg_number).all()
            return [_standard_list_item(s, qual_counts, os_counts) for s in standards]

        total = base.count()
        items = (
            base.order_by(StandardRaw.reg_number)
            .offset((page - 1) * limit)
            .limit(limit)
            .all()
        )
        with_qualifications_count = sum(1 for c in qual_counts.values() if c > 0)

        # Сводка по областям (по всему реестру, без текстового поиска) — для фильтра
        area_expr = _area_code_expr()
        area_rows = (
            session.query(area_expr, func.count(StandardRaw.id))
            .group_by(area_expr)
            .all()
        )
        area_counts = {
            str(code).zfill(2): int(cnt)
            for code, cnt in area_rows
            if code and str(code).strip() and str(code).strip().replace(".", "").isdigit()
        }

        return {
            "items": [_standard_list_item(s, qual_counts, os_counts) for s in items],
            "total": total,
            "page": page,
            "limit": limit,
            "pages": max(1, (total + limit - 1) // limit) if limit else 1,
            "with_qualifications_count": with_qualifications_count,
            "area_counts": area_counts,
        }
    finally:
        session.close()


@app.get("/standards/spk-list")
async def standards_spk_list(current_user: User = Depends(get_current_user)):
    """Список СПК с числом закреплённых профстандартов."""
    session = SessionLocal()
    try:
        return list_spk_names(session)
    finally:
        session.close()


@app.post("/standards/import-spk")
async def import_spk_assignments(current_user: User = Depends(get_current_admin)):
    """Загрузить закрепление ПС за СПК из Reestr_PS.xlsx."""
    path = resolve_reestr_xlsx_path()
    if not path:
        raise HTTPException(
            status_code=404,
            detail="Файл Reestr_PS.xlsx не найден (ожидается C:\\IT\\DRC\\Reestr_PS.xlsx)",
        )
    session = SessionLocal()
    try:
        result = sync_spk_from_reestr_xlsx(session, path)
        return {"status": "ok", **result}
    finally:
        session.close()


@app.get("/standards/qualification-coverage")
async def standards_qualification_coverage_stats(current_user: User = Depends(get_current_user)):
    session = SessionLocal()
    try:
        return standards_qualification_coverage(session)
    finally:
        session.close()

def _short_qualification_level(value: str | None) -> str:
    text = (value or "").strip()
    if not text:
        return ""
    if len(text) <= 12 and re.fullmatch(r"\d+(?:\s*[-–]\s*\d+)?[^\d]*", text):
        return re.sub(r"\s+", " ", text).strip()
    match = re.search(r"\d+", text)
    return match.group(0) if match else ""


@app.get("/standards/{standard_id}/labor-functions")
async def get_labor_functions(standard_id: int, current_user: User = Depends(get_current_user)):
    session = SessionLocal()
    try:
        std = session.query(StandardRaw).filter(StandardRaw.id == standard_id).first()
        if not std:
            raise HTTPException(404, "Стандарт не найден")

        enriched_pf_map: dict[str, Any] = {}
        try:
            from .db.enriched_models import EnrichedStandard
            enriched = session.query(EnrichedStandard).filter(
                EnrichedStandard.reg_number == std.reg_number
            ).first()
            if enriched:
                for gf in enriched.generalized_functions:
                    for pf in gf.particular_functions:
                        enriched_pf_map[pf.code] = pf
        except Exception:
            pass

        result = []
        for gf in std.generalized_functions:
            for pf in gf.particular_functions:
                labor_actions_detail: list[dict[str, Any]] = []
                enriched_pf = enriched_pf_map.get(pf.code)
                if enriched_pf and enriched_pf.labor_actions:
                    for la in enriched_pf.labor_actions:
                        labor_actions_detail.append({
                            "text": la.text or "",
                            "knowledges": [k.text for k in (la.knowledges or []) if k.text],
                            "skills": [s.text for s in (la.skills or []) if s.text],
                        })
                else:
                    pf_knowledges = [k.text for k in (pf.knowledges or []) if k.text]
                    pf_skills = [s.text for s in (pf.skills or []) if s.text]
                    if pf.labor_actions:
                        for la in pf.labor_actions:
                            labor_actions_detail.append({
                                "text": la.text or "",
                                "knowledges": pf_knowledges,
                                "skills": pf_skills,
                            })
                    elif pf_knowledges or pf_skills:
                        labor_actions_detail.append({
                            "text": pf.name or pf.code or "",
                            "knowledges": pf_knowledges,
                            "skills": pf_skills,
                        })

                result.append({
                    "id": pf.id,
                    "code": pf.code,
                    "name": pf.name,
                    "otf_code": gf.code,
                    "otf_name": gf.name,
                    "otf_level": _short_qualification_level(gf.level),
                    "standard_id": std.id,
                    "standard_reg_number": std.reg_number,
                    "standard_name": std.name,
                    "labor_actions": labor_actions_detail,
                })
        return result
    finally:
        session.close()

@app.get("/standards/search")
async def search_standards(
    q: str,
    limit: int = 50,
    area: Optional[str] = None,
    current_user: User = Depends(get_current_user),
):
    if not q or len(q.strip()) < 2:
        return []
    query = q.strip()
    fts_query = build_fts_match_query(query)
    area_code = area.strip() if area else None
    if area_code:
        area_code = area_code.zfill(2)

    session = SessionLocal()
    try:
        rows: list[Any] = []
        seen_ids: set[int] = set()

        def append_rows(new_rows) -> None:
            for r in new_rows:
                if r.id in seen_ids:
                    continue
                seen_ids.add(r.id)
                rows.append(r)
                if len(rows) >= limit:
                    break

        area_sql = ""
        area_params: dict[str, str] = {}
        if area_code:
            area_sql, area_params = area_filter_clause(area_code)

        # FTS (если индекс заполнен)
        if fts_query:
            fts_params: dict[str, Any] = {"query": fts_query, "limit": limit, **area_params}
            fts_sql = text(f"""
                SELECT rs.id, rs.name, rs.reg_number, rs.kind_activity, rs.purpose,
                       rs.professional_area_code, rs.ps_code, rank
                FROM fts_standards
                JOIN raw_standards rs ON rs.id = fts_standards.standard_id
                WHERE fts_standards MATCH :query{area_sql}
                ORDER BY rank
                LIMIT :limit
            """)
            try:
                append_rows(session.execute(fts_sql, fts_params).fetchall())
            except Exception:
                session.rollback()

        # LIKE-поиск — всегда, чтобы работало без FTS и по коду ПС
        if len(rows) < limit:
            like = f"%{query}%"
            like_params: dict[str, Any] = {"like": like, "limit": limit * 3, **area_params}
            like_sql = text(f"""
                SELECT rs.id, rs.name, rs.reg_number, rs.kind_activity, rs.purpose,
                       rs.professional_area_code, rs.ps_code, 0 AS rank
                FROM raw_standards rs
                WHERE (
                    rs.reg_number LIKE :like
                    OR rs.name LIKE :like
                    OR rs.kind_activity LIKE :like
                    OR rs.purpose LIKE :like
                    OR rs.spk_name LIKE :like
                    OR rs.ps_code LIKE :like
                ){area_sql}
                ORDER BY rs.reg_number
                LIMIT :limit
            """)
            append_rows(session.execute(like_sql, like_params).fetchall())

        spk_by_id: dict[int, str | None] = {}
        if rows:
            ids = [r.id for r in rows]
            spk_by_id = {
                row.id: row.spk_name
                for row in session.query(StandardRaw.id, StandardRaw.spk_name)
                .filter(StandardRaw.id.in_(ids))
                .all()
            }

        qual_counts = qualification_count_by_standard_id(session)
        os_counts = assessment_tool_count_by_standard_id(session)
        return [
            {
                "id": r.id,
                "name": r.name,
                "reg_number": r.reg_number,
                "kind_activity": r.kind_activity,
                "purpose": r.purpose,
                "professional_area_code": r.professional_area_code,
                "ps_code": getattr(r, "ps_code", None),
                "spk_name": spk_by_id.get(r.id),
                "score": r.rank,
                **qualification_flags(r.id, qual_counts),
                **assessment_tool_flags(r.id, os_counts),
            }
            for r in rows[:limit]
        ]
    finally:
        session.close()


def _okso_like_needles(code: str) -> list[str]:
    text = (code or "").strip()
    if not text:
        return []
    parts = [p for p in text.split(".") if p]
    if len(parts) > 3:
        parts = parts[-3:]
    needles = {text, normalize_okso_code(text)}
    try:
        needles.add(".".join(str(int(p)) if p.isdigit() else p for p in parts))
    except ValueError:
        pass
    return [n for n in needles if n]


@app.get("/standards/by-okso")
async def standards_by_okso(
    code: str,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
):
    """ПС, у которых в разделе ОКСО (ОТФ) есть код выбранного ФГОС."""
    fgos_code = (code or "").strip()
    if not fgos_code or len(fgos_code) < 4:
        return []

    needles = _okso_like_needles(fgos_code)
    session = SessionLocal()
    try:
        like_filters = []
        search_columns = (
            GeneralizedFunctionRaw.okso_codes,
            GeneralizedFunctionRaw.okso_units,
            GeneralizedFunctionRaw.code,
            GeneralizedFunctionRaw.education_training,
            GeneralizedFunctionRaw.other_characteristics,
        )
        for needle in needles:
            pattern = f"%{needle}%"
            for column in search_columns:
                like_filters.append(column.cast(String).like(pattern))

        matched: dict[int, list[str]] = {}

        def add_match(standard_id: int | None, values: list[str]) -> None:
            if not standard_id:
                return
            for value in values:
                if not okso_matches_fgos(value, fgos_code):
                    continue
                bucket = matched.setdefault(int(standard_id), [])
                shown = normalize_okso_code(value) or value
                if not re.match(r"^\d{2}(\.\d{2}){1,2}$", shown):
                    from_text = [
                        c
                        for c in extract_okso_codes_from_text(value)
                        if okso_matches_fgos(c, fgos_code)
                    ]
                    shown = from_text[0] if from_text else (normalize_okso_code(fgos_code) or fgos_code)
                if shown not in bucket:
                    bucket.append(shown)

        json_rows = (
            session.query(
                GeneralizedFunctionRaw.standard_id,
                GeneralizedFunctionRaw.okso_codes,
                GeneralizedFunctionRaw.okso_units,
            )
            .filter(
                or_(
                    GeneralizedFunctionRaw.okso_codes.isnot(None),
                    GeneralizedFunctionRaw.okso_units.isnot(None),
                )
            )
            .all()
        )
        for standard_id, okso_codes, okso_units in json_rows:
            add_match(standard_id, extract_okso_values(okso_codes) + extract_okso_values(okso_units))

        gf_rows = (
            session.query(
                GeneralizedFunctionRaw.standard_id,
                GeneralizedFunctionRaw.okso_codes,
                GeneralizedFunctionRaw.okso_units,
                GeneralizedFunctionRaw.code,
                GeneralizedFunctionRaw.education_training,
                GeneralizedFunctionRaw.other_characteristics,
            )
            .filter(or_(*like_filters) if like_filters else sa_false())
            .all()
        )
        for standard_id, okso_codes, okso_units, gf_code, education, other in gf_rows:
            values = extract_okso_values(okso_codes) + extract_okso_values(okso_units)
            for blob in (gf_code, education, other):
                if blob:
                    values.extend(extract_okso_codes_from_text(str(blob)))
                    values.append(str(blob))
            add_match(standard_id, values)

        if not matched:
            return []

        ids = list(matched.keys())
        from sqlalchemy.orm import defer

        std_rows = (
            session.query(StandardRaw)
            .options(defer(StandardRaw.source_xml), defer(StandardRaw.source_html))
            .filter(StandardRaw.id.in_(ids))
            .order_by(StandardRaw.reg_number)
            .limit(limit)
            .all()
        )
        qual_counts = qualification_count_by_standard_id(session)
        os_counts = assessment_tool_count_by_standard_id(session)
        return [
            {
                "id": std.id,
                "name": std.name,
                "reg_number": std.reg_number,
                "kind_activity": std.kind_activity,
                "purpose": std.purpose,
                "professional_area_code": std.professional_area_code,
                "ps_code": std.ps_code,
                "spk_name": std.spk_name,
                "matched_okso_codes": matched.get(std.id, []),
                **qualification_flags(std.id, qual_counts),
                **assessment_tool_flags(std.id, os_counts),
            }
            for std in std_rows
        ]
    finally:
        session.close()


def _okpdtr_like_needles(code: str) -> list[str]:
    text = (code or "").strip()
    digits = re.sub(r"\D", "", text)
    return [n for n in dict.fromkeys([text, digits]) if n]


@app.get("/standards/by-okpdtr")
async def standards_by_okpdtr(
    code: str,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
):
    """ПС, у которых в разделе ОКПДТР (ОТФ) есть код выбранной профессии."""
    okpdtr_code = (code or "").strip()
    digits = re.sub(r"\D", "", okpdtr_code)
    if not digits or len(digits) < 4:
        return []

    needles = _okpdtr_like_needles(okpdtr_code)
    session = SessionLocal()
    try:
        like_filters = []
        search_columns = (
            GeneralizedFunctionRaw.okpdtr_codes,
            GeneralizedFunctionRaw.okpdtr_units,
            GeneralizedFunctionRaw.code,
            GeneralizedFunctionRaw.education_training,
            GeneralizedFunctionRaw.other_characteristics,
            GeneralizedFunctionRaw.possible_job_titles,
        )
        for needle in needles:
            pattern = f"%{needle}%"
            for column in search_columns:
                like_filters.append(column.cast(String).like(pattern))

        matched: dict[int, list[str]] = {}

        def add_match(standard_id: int | None, values: list[str]) -> None:
            if not standard_id:
                return
            for value in values:
                if not okpdtr_matches(value, okpdtr_code):
                    continue
                bucket = matched.setdefault(int(standard_id), [])
                shown = normalize_okpdtr_code(value) or value
                if not re.fullmatch(r"\d{4,6}", shown):
                    from_text = [
                        c
                        for c in extract_okpdtr_codes_from_text(value)
                        if okpdtr_matches(c, okpdtr_code)
                    ]
                    shown = from_text[0] if from_text else (normalize_okpdtr_code(okpdtr_code) or okpdtr_code)
                if shown not in bucket:
                    bucket.append(shown)

        json_rows = (
            session.query(
                GeneralizedFunctionRaw.standard_id,
                GeneralizedFunctionRaw.okpdtr_codes,
                GeneralizedFunctionRaw.okpdtr_units,
            )
            .filter(
                or_(
                    GeneralizedFunctionRaw.okpdtr_codes.isnot(None),
                    GeneralizedFunctionRaw.okpdtr_units.isnot(None),
                )
            )
            .all()
        )
        for standard_id, okpdtr_codes, okpdtr_units in json_rows:
            add_match(standard_id, extract_okso_values(okpdtr_codes) + extract_okso_values(okpdtr_units))

        gf_rows = (
            session.query(
                GeneralizedFunctionRaw.standard_id,
                GeneralizedFunctionRaw.okpdtr_codes,
                GeneralizedFunctionRaw.okpdtr_units,
                GeneralizedFunctionRaw.code,
                GeneralizedFunctionRaw.education_training,
                GeneralizedFunctionRaw.other_characteristics,
                GeneralizedFunctionRaw.possible_job_titles,
            )
            .filter(or_(*like_filters) if like_filters else sa_false())
            .all()
        )
        for standard_id, okpdtr_codes, okpdtr_units, gf_code, education, other, titles in gf_rows:
            values = extract_okso_values(okpdtr_codes) + extract_okso_values(okpdtr_units)
            for blob in (gf_code, education, other, titles):
                if blob:
                    text = blob if isinstance(blob, str) else str(blob)
                    values.extend(extract_okpdtr_codes_from_text(text))
                    values.append(text)
            add_match(standard_id, values)

        if not matched:
            return []

        ids = list(matched.keys())
        from sqlalchemy.orm import defer

        std_rows = (
            session.query(StandardRaw)
            .options(defer(StandardRaw.source_xml), defer(StandardRaw.source_html))
            .filter(StandardRaw.id.in_(ids))
            .order_by(StandardRaw.reg_number)
            .limit(limit)
            .all()
        )
        qual_counts = qualification_count_by_standard_id(session)
        os_counts = assessment_tool_count_by_standard_id(session)
        return [
            {
                "id": std.id,
                "name": std.name,
                "reg_number": std.reg_number,
                "kind_activity": std.kind_activity,
                "purpose": std.purpose,
                "professional_area_code": std.professional_area_code,
                "ps_code": std.ps_code,
                "spk_name": std.spk_name,
                "matched_okpdtr_codes": matched.get(std.id, []),
                **qualification_flags(std.id, qual_counts),
                **assessment_tool_flags(std.id, os_counts),
            }
            for std in std_rows
        ]
    finally:
        session.close()


@app.get("/standards/{reg_number}")
async def get_standard(reg_number: str, current_user: User = Depends(get_current_user)):
    from sqlalchemy.orm import defer, selectinload

    session = SessionLocal()
    try:
        std = (
            session.query(StandardRaw)
            .options(
                defer(StandardRaw.source_xml),
                defer(StandardRaw.source_html),
                selectinload(StandardRaw.generalized_functions)
                .selectinload(GeneralizedFunctionRaw.particular_functions)
                .selectinload(ParticularFunctionRaw.labor_actions),
                selectinload(StandardRaw.generalized_functions)
                .selectinload(GeneralizedFunctionRaw.particular_functions)
                .selectinload(ParticularFunctionRaw.skills),
                selectinload(StandardRaw.generalized_functions)
                .selectinload(GeneralizedFunctionRaw.particular_functions)
                .selectinload(ParticularFunctionRaw.knowledges),
            )
            .filter(StandardRaw.reg_number == reg_number)
            .first()
        )
        if not std:
            raise HTTPException(status_code=404, detail="Standard not found")
        result = {
            "id": std.id,
            "reg_number": std.reg_number,
            "registration_number": std.reg_number,
            "name": std.name,
            "order_number": std.order_number,
            "approval_date": std.approval_date,
            "status": getattr(std, "status", None) or "active",
            "revoked_date": getattr(std, "revoked_date", None),
            "kind_activity": std.kind_activity,
            "purpose": std.purpose,
            "professional_area_code": std.professional_area_code,
            "okved_codes": std.okved_codes,
            "ps_code": getattr(std, "ps_code", None),
            "okved_units": getattr(std, "okved_units", None),
            "opd_code": getattr(std, "opd_code", None),
            "opd_name": getattr(std, "opd_name", None),
            "okz_group_code": getattr(std, "okz_group_code", None),
            "okz_group_name": getattr(std, "okz_group_name", None),
            "developer_org": getattr(std, "developer_org", None),
            "developer_head": getattr(std, "developer_head", None),
            "co_developers": getattr(std, "co_developers", None),
            "effective_date": getattr(std, "effective_date", None),
            "expiration_date": getattr(std, "expiration_date", None),
            "abbreviations": getattr(std, "abbreviations", None),
            "source_kind": getattr(std, "source_kind", None),
            "spk_name": getattr(std, "spk_name", None),
            "generalized_functions": []
        }
        for gf in std.generalized_functions:
            gf_dict = {
                "code": gf.code,
                "name": gf.name,
                "level": gf.level,
                "possible_job_titles": gf.possible_job_titles,
                "okz_codes": gf.okz_codes,
                "okpdtr_codes": gf.okpdtr_codes,
                "okso_codes": gf.okso_codes,
                "okz_units": getattr(gf, "okz_units", None),
                "okpdtr_units": getattr(gf, "okpdtr_units", None),
                "okso_units": getattr(gf, "okso_units", None),
                "etks_units": getattr(gf, "etks_units", None),
                "education_training": getattr(gf, "education_training", None),
                "practical_experience": getattr(gf, "practical_experience", None),
                "special_admission": getattr(gf, "special_admission", None),
                "other_characteristics": getattr(gf, "other_characteristics", None),
                "particular_functions": []
            }
            for pf in gf.particular_functions:
                pf_dict = {
                    "code": pf.code,
                    "name": pf.name,
                    "sub_qualification": pf.sub_qualification,
                    "labor_actions": [{"text": la.text} for la in pf.labor_actions],
                    "required_skills": [s.text for s in pf.skills],
                    "necessary_knowledges": [k.text for k in pf.knowledges],
                    "other_characteristics": getattr(pf, "other_characteristics", None),
                }
                gf_dict["particular_functions"].append(pf_dict)
            result["generalized_functions"].append(gf_dict)
        return result
    finally:
        session.close()


@app.get("/standards/{reg_number}/document", response_class=HTMLResponse)
async def get_standard_print_html(reg_number: str, current_user: User = Depends(get_current_user)):
    from .ps_document import build_ps_document_dict, render_ps_html

    session = SessionLocal()
    try:
        std = session.query(StandardRaw).filter(StandardRaw.reg_number == reg_number).first()
        if not std:
            raise HTTPException(status_code=404, detail="Standard not found")
        doc = build_ps_document_dict(std)
        return HTMLResponse(content=render_ps_html(doc))
    finally:
        session.close()


@app.get("/standards/{reg_number}/document.docx")
async def get_standard_document_docx(reg_number: str, current_user: User = Depends(get_current_user)):
    from .ps_document import build_ps_document_dict, build_ps_docx_bytes

    session = SessionLocal()
    try:
        std = session.query(StandardRaw).filter(StandardRaw.reg_number == reg_number).first()
        if not std:
            raise HTTPException(status_code=404, detail="Standard not found")
        doc = build_ps_document_dict(std)
        data = build_ps_docx_bytes(doc)
        filename = f"PS_{reg_number}.docx"
        return Response(
            content=data,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    finally:
        session.close()

# ---------- Обогащённые стандарты ----------

@app.get("/enriched-standards")
async def list_enriched_standards(current_user: User = Depends(get_current_user)):
    session = SessionLocal()
    try:
        from .db.enriched_models import EnrichedStandard

        qual_counts = qualification_count_by_standard_id(session)
        os_counts = assessment_tool_count_by_standard_id(session)
        rows = (
            session.query(EnrichedStandard, StandardRaw)
            .join(StandardRaw, StandardRaw.reg_number == EnrichedStandard.reg_number)
            .order_by(EnrichedStandard.reg_number)
            .all()
        )
        return [
            {
                "name": enr.name,
                "reg_number": enr.reg_number,
                "date": enr.approval_date,
                "id": raw.id,
                "professional_area_code": raw.professional_area_code,
                "ps_code": getattr(raw, "ps_code", None),
                "spk_name": getattr(raw, "spk_name", None),
                "kind_activity": raw.kind_activity,
                **qualification_flags(raw.id, qual_counts),
                **assessment_tool_flags(raw.id, os_counts),
            }
            for enr, raw in rows
        ]
    finally:
        session.close()

@app.get("/enriched-standards/{reg_number}")
async def get_enriched_standard(reg_number: str, current_user: User = Depends(get_current_user)):
    session = SessionLocal()
    try:
        from .db.enriched_models import EnrichedStandard
        std = session.query(EnrichedStandard).filter(EnrichedStandard.reg_number == reg_number).first()
        if not std:
            raise HTTPException(404, "Обогащённый стандарт не найден")
        def serialize_standard(std_obj):
            result = {
                "id": std_obj.id,
                "reg_number": std_obj.reg_number,
                "registration_number": std_obj.reg_number,
                "name": std_obj.name,
                "order_number": std_obj.order_number,
                "approval_date": std_obj.approval_date,
                "kind_activity": std_obj.kind_activity,
                "purpose": std_obj.purpose,
                "professional_area_code": std_obj.professional_area_code,
                "okved_codes": std_obj.okved_codes,
                "generalized_functions": []
            }
            for gf in std_obj.generalized_functions:
                gf_dict = {
                    "code": gf.code,
                    "name": gf.name,
                    "level": gf.level,
                    "possible_job_titles": gf.possible_job_titles,
                    "okz_codes": gf.okz_codes,
                    "okpdtr_codes": gf.okpdtr_codes,
                    "okso_codes": gf.okso_codes,
                    "particular_functions": []
                }
                for pf in gf.particular_functions:
                    pf_dict = {
                        "code": pf.code,
                        "name": pf.name,
                        "sub_qualification": pf.sub_qualification,
                        "labor_actions": []
                    }
                    for la in pf.labor_actions:
                        la_dict = {
                            "id": la.id,
                            "text": la.text,
                            "skills": [{"id": s.id, "text": s.text} for s in la.skills],
                            "knowledges": [{"id": k.id, "text": k.text} for k in la.knowledges]
                        }
                        pf_dict["labor_actions"].append(la_dict)
                    gf_dict["particular_functions"].append(pf_dict)
                result["generalized_functions"].append(gf_dict)
            return result
        return serialize_standard(std)
    finally:
        session.close()

# ---------- Административные эндпоинты для ПС ----------

@app.post("/upload")
async def upload_file(file: UploadFile = File(...), current_user: User = Depends(get_current_admin)):
    content = await file.read()
    try:
        standard = parse_xml(content)
        session = SessionLocal()
        try:
            save_raw_standard(session, standard, element_id=None)
            session.commit()
        finally:
            session.close()
        return {"message": "success", "reg_number": standard.registration_number}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/fetch-registry-bulk")
async def fetch_registry_bulk(current_user: User = Depends(get_current_admin)):
    try:
        results = fetch_all_standards_bulk()
        return {"status": "ok", "loaded": results}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/standards/content-audit")
async def standards_content_audit(current_user: User = Depends(get_current_admin)):
    """
    Сверка содержимого БД с XLSX-реестром по reg_number:
    ловит подмены (один reg — разные код/название).
    Путь к XLSX: scripts/xlsx_path.txt или Downloads.
    """
    import sys

    scripts_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "scripts")
    if scripts_dir not in sys.path:
        sys.path.insert(0, scripts_dir)
    try:
        from audit_ps_content_vs_xlsx import run_audit, write_audit_reports
    except Exception as exc:
        raise HTTPException(500, detail=f"Не удалось загрузить модуль аудита: {exc}")

    try:
        report = run_audit()
        txt_path, json_path = write_audit_reports(report)
    except FileNotFoundError as exc:
        raise HTTPException(400, detail=str(exc))
    except Exception as exc:
        import traceback

        traceback.print_exc()
        raise HTTPException(500, detail=str(exc))

    return {
        "status": "ok",
        "summary": report.get("summary"),
        "critical_count": len(report.get("critical") or []),
        "critical": (report.get("critical") or [])[:50],
        "code_only": (report.get("code_only") or [])[:30],
        "name_only": (report.get("name_only") or [])[:30],
        "missing_in_db": (report.get("missing_in_db") or [])[:50],
        "db_duplicate_ps_codes": (report.get("db_duplicate_ps_codes") or [])[:30],
        "highlight_tiflosurdo": report.get("highlight_tiflosurdo") or [],
        "report_txt": txt_path,
        "report_json": json_path,
    }


class ReloadMismatchedRequest(BaseModel):
    regs: Optional[List[str]] = None
    dry_run: bool = False
    refresh_map: bool = True
    relink: bool = True


@app.post("/standards/reload-mismatched")
async def standards_reload_mismatched(
    body: ReloadMismatchedRequest = ReloadMismatchedRequest(),
    current_user: User = Depends(get_current_admin),
):
    """
    Точечная перезагрузка ПС с подменой содержимого (critical из аудита или список reg).
    Источник — XML Минтруда по ELEMENT_ID (не classinform).
    """
    import sys

    scripts_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "scripts")
    if scripts_dir not in sys.path:
        sys.path.insert(0, scripts_dir)
    try:
        from reload_mismatched_ps import run_reload
    except Exception as exc:
        raise HTTPException(500, detail=f"Не удалось загрузить модуль догрузки: {exc}")

    try:
        return {
            "status": "ok",
            **run_reload(
                body.regs,
                dry_run=body.dry_run,
                refresh_map=body.refresh_map,
                relink=body.relink,
            ),
        }
    except Exception as exc:
        import traceback

        traceback.print_exc()
        raise HTTPException(500, detail=str(exc))


@app.get("/enrichment/stats")
async def enrichment_stats(
    cleanup: bool = True,
    current_user: User = Depends(get_current_user),
):
    session = SessionLocal()
    try:
        return get_enrichment_stats(session, cleanup_orphans=cleanup)
    finally:
        session.close()

@app.post("/enrichment/cleanup-orphans")
async def enrichment_cleanup_orphans(current_user: User = Depends(get_current_admin)):
    session = SessionLocal()
    try:
        removed = cleanup_orphaned_enriched(session, commit=True)
        stats = get_enrichment_stats(session, cleanup_orphans=False)
        return {"status": "ok", "removed": removed, **stats}
    finally:
        session.close()

@app.post("/run-enrichment")
async def run_enrichment(
    reg_number: str = None,
    only_missing: bool = True,
    current_user: User = Depends(get_current_admin),
):
    session = SessionLocal()
    try:
        if reg_number:
            enrich_standard(reg_number, session)
            stats = get_enrichment_stats(session)
            return {
                "status": "ok",
                "processed": [reg_number],
                "failed": [],
                **stats,
            }

        result = enrich_standards_batch(session, only_missing=only_missing)
        return {"status": "ok", **result}
    finally:
        session.close()

# ---------- Квалификации ----------

def serialize_qualification(
    q: Qualification,
    reg_by_id: dict[int, str] | None = None,
    os_counts: dict[int, int] | None = None,
) -> dict:
    """Полная квалификация (карточка / детальная страница)."""
    reg_number = None
    if q.prof_standard_id is not None:
        if reg_by_id is not None:
            reg_number = reg_by_id.get(q.prof_standard_id)
        elif getattr(q, "professional_standard", None) is not None:
            reg_number = q.professional_standard.reg_number
    tools = list(getattr(q, "assessment_tools", None) or [])
    active_tools = [
        t for t in tools
        if (getattr(t, "status", None) or "active") == "active"
    ]
    tool_count = (
        os_counts.get(q.id, 0)
        if os_counts is not None
        else len(active_tools)
    )
    return {
        "id": q.id,
        "code": q.code,
        "name": q.name,
        "level": q.level,
        "activity_area": q.activity_area,
        "labor_functions": q.labor_functions,
        "prof_standard_name": q.prof_standard_name,
        "prof_standard_order": q.prof_standard_order,
        "prof_standard_id": q.prof_standard_id,
        "prof_standard_reg_number": reg_number,
        "qualification_requirement": q.qualification_requirement,
        "possible_job_titles": q.possible_job_titles,
        "special_admission": q.special_admission,
        "exam_documents": q.exam_documents,
        "certificate_validity": q.certificate_validity,
        "okz_codes": q.okz_codes,
        "okpdtr_codes": q.okpdtr_codes,
        "okso_codes": q.okso_codes,
        "council_protocol": q.council_protocol,
        "nark_order": q.nark_order,
        "created_at": q.created_at,
        "updated_at": q.updated_at,
        "assessment_tool_count": tool_count,
        "has_assessment_tools": tool_count > 0,
        "assessment_tools": [
            {
                "id": tool.id,
                "code": tool.code,
                "name": tool.name,
                "status": getattr(tool, "status", None) or "active",
                "document_type": tool.document_type,
                "document_number": tool.document_number,
                "document_date": tool.document_date,
            }
            for tool in tools
        ],
    }


def serialize_qualification_list_item(
    q: Qualification,
    reg_by_id: dict[int, str] | None = None,
    os_counts: dict[int, int] | None = None,
) -> dict:
    """Лёгкий DTO для списка карточек (без labor_functions и прочих тяжёлых JSON)."""
    reg_number = None
    if q.prof_standard_id is not None and reg_by_id is not None:
        reg_number = reg_by_id.get(q.prof_standard_id)
    return {
        "id": q.id,
        "code": q.code,
        "name": q.name,
        "level": q.level,
        "activity_area": q.activity_area,
        "prof_standard_name": q.prof_standard_name,
        "prof_standard_order": q.prof_standard_order,
        "prof_standard_id": q.prof_standard_id,
        "prof_standard_reg_number": reg_number,
        **assessment_tool_flags(q.id, os_counts or {}),
    }


@app.get("/qualifications/by-standard/{standard_id}")
async def get_qualifications_by_standard(standard_id: int, current_user: User = Depends(get_current_user)):
    session = SessionLocal()
    try:
        quals = session.query(Qualification).filter(Qualification.prof_standard_id == standard_id).all()
        return [{
            "id": q.id,
            "code": q.code,
            "name": q.name,
            "labor_functions": q.labor_functions,
        } for q in quals]
    finally:
        session.close()

@app.get("/qualifications/stats")
async def qualifications_stats(current_user: User = Depends(get_current_user)):
    return get_qualification_stats()


@app.post("/qualifications/relink-standards")
async def relink_qualifications_to_standards(current_user: User = Depends(get_current_admin)):
    """Пересвязать квалификации НАРК с профстандартами (по коду квалификации и метаданным)."""
    session = SessionLocal()
    try:
        return relink_and_audit(session)
    finally:
        session.close()


@app.post("/qualifications/fix-10104-to-40104")
async def fix_qualification_codes_10104(current_user: User = Depends(get_current_admin)):
    """Переименовать коды квалификаций 10.104xx.xx → 40.104xx.xx."""
    import sys

    scripts_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "scripts")
    if scripts_dir not in sys.path:
        sys.path.insert(0, scripts_dir)
    from fix_qual_codes_10104_to_40104 import fix_qualification_codes_10104_to_40104

    session = SessionLocal()
    try:
        return fix_qualification_codes_10104_to_40104(session)
    finally:
        session.close()


@app.get("/qualifications/link-audit")
async def qualifications_link_audit(current_user: User = Depends(get_current_admin)):
    """Аудит текущих связей квалификация ↔ ПС (конфликты кода, названия, года приказа)."""
    session = SessionLocal()
    try:
        return audit_qualification_links(session)
    finally:
        session.close()


@app.post("/qualifications/export-unlinked")
async def qualifications_export_unlinked(current_user: User = Depends(get_current_admin)):
    """Выгрузка полного списка несвязанных квалификаций в TXT/CSV/JSON."""
    import sys

    scripts_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "scripts")
    if scripts_dir not in sys.path:
        sys.path.insert(0, scripts_dir)
    try:
        from export_unlinked_qualifications import (
            OUT_CSV,
            OUT_JSON,
            OUT_TXT,
            export_unlinked,
        )
    except Exception as exc:
        raise HTTPException(500, detail=f"Не удалось загрузить модуль выгрузки: {exc}")

    try:
        payload = export_unlinked()
    except Exception as exc:
        import traceback

        traceback.print_exc()
        raise HTTPException(500, detail=str(exc))

    return {
        "status": "ok",
        "total": payload.get("total"),
        "groups": payload.get("groups"),
        "with_ps_in_db_but_unlinked": payload.get("with_ps_in_db_but_unlinked"),
        "missing_ps_in_db": payload.get("missing_ps_in_db"),
        "report_txt": OUT_TXT,
        "report_csv": OUT_CSV,
        "report_json": OUT_JSON,
        "items": payload.get("items") or [],
    }


@app.get("/qualifications/public/stats")
async def qualifications_public_stats():
    """Публичная сводка для главной страницы."""
    stats = get_qualification_stats()
    return {
        "local_count": stats.get("local_count", 0),
        "expected": stats.get("expected", 0),
        "missing": stats.get("missing", 0),
    }


@app.get("/qualifications/public")
async def list_public_qualifications(limit: int = 6):
    """Краткий список для главной (без полной карточки)."""
    limit = min(max(limit, 1), 20)
    session = SessionLocal()
    try:
        quals = (
            session.query(Qualification)
            .order_by(Qualification.updated_at.desc(), Qualification.id.desc())
            .limit(limit)
            .all()
        )
        return [
            {
                "id": q.id,
                "code": q.code,
                "name": q.name,
                "level": q.level,
                "activity_area": q.activity_area,
            }
            for q in quals
        ]
    finally:
        session.close()


@app.get("/reference/level-matrix")
async def get_level_matrix(refresh: bool = False):
    """Матрица соответствия уровней квалификации и сформированности компетенций (из DOCX)."""
    return load_matrix(force_refresh=refresh)


@app.get("/reference/level-matrix/structured")
async def get_structured_level_matrix(refresh: bool = False):
    """Структурированная матрица: 9 уровней квалификации × 3 уровня сформированности + soft skills."""
    return load_structured_matrix(force_refresh=refresh)


@app.get("/reference/level-matrix/summary")
async def get_level_matrix_summary(refresh: bool = False):
    data = load_matrix(force_refresh=refresh)
    return {
        **matrix_summary(data),
        "docx_path": str(DOCX_PATH),
        "docx_exists": DOCX_PATH.exists(),
    }


@app.get("/reference/formation-levels")
async def reference_formation_levels(refresh: bool = False):
    """Уровни сформированности компетенции: базовый, продвинутый, экспертный."""
    return get_formation_levels(force_refresh=refresh)


@app.get("/reference/qualification-levels")
async def reference_qualification_levels(refresh: bool = False):
    """9 уровней квалификации по приказу №148н с дескрипторами сформированности."""
    return get_qualification_levels(force_refresh=refresh)


@app.get("/reference/qualification-levels/{level}")
async def reference_qualification_level(level: int, refresh: bool = False):
    row = get_qualification_level(level, force_refresh=refresh)
    if not row:
        raise HTTPException(status_code=404, detail="Уровень квалификации не найден")
    return row


@app.get("/reference/universal-skills")
async def reference_universal_skills(refresh: bool = False):
    """Каталог универсальных (надпрофессиональных) навыков по уровням квалификации."""
    return get_universal_skill_catalog(force_refresh=refresh)


@app.get("/reference/prof-training-professions")
async def reference_prof_training_professions(
    q: Optional[str] = None,
    category: Optional[str] = None,
    section: Optional[str] = None,
    only_active: bool = True,
    limit: int = 40,
    offset: int = 0,
):
    """
    Перечень профессий рабочих / должностей служащих для профессионального обучения
    (приказ Минпросвещения России от 14.07.2023 № 534).
    """
    return list_prof_training_professions(
        None,
        q=q,
        category=category,
        section=section,
        only_active=only_active,
        limit=limit,
        offset=offset,
    )


@app.get("/reference/prof-training-sections")
async def reference_prof_training_sections(
    only_active: bool = True,
    current_user: User = Depends(get_current_user),
):
    session = SessionLocal()
    try:
        return {"items": prof_training_sections(session, only_active=only_active)}
    finally:
        session.close()


@app.post("/reference/prof-training-professions/import")
async def import_prof_training_professions_endpoint(
    path: Optional[str] = None,
    current_user: User = Depends(get_current_admin),
):
    """
    Импорт перечня из markdown/текста приказа №534.
    По умолчанию берёт локальный снимок источника (agent-tools / data/order_534_source.md).
    """
    from .prof_training_registry import MARKDOWN_CANDIDATES

    session = SessionLocal()
    try:
        source = path
        if not source:
            for candidate in MARKDOWN_CANDIDATES:
                if candidate.is_file():
                    source = str(candidate)
                    break
        if not source:
            raise HTTPException(400, detail="Не найден файл источника приказа №534")
        result = import_prof_training_from_path(session, source)
        if result.get("status") == "error":
            raise HTTPException(400, detail=result.get("detail") or "Ошибка импорта")
        return result
    finally:
        session.close()


@app.get("/reference")
async def reference_bundle(refresh: bool = False):
    """Полный набор справочников для фронтенда."""
    return get_reference_bundle(force_refresh=refresh)


@app.get("/reference/matrix-context")
async def reference_matrix_context(level: str):
    """Контекст матрицы для указанного уровня квалификации (например level=6 или 6.1)."""
    ctx = get_matrix_context(level)
    if not ctx:
        raise HTTPException(status_code=404, detail="Не удалось определить уровень квалификации")
    return ctx


@app.post("/fetch-qualifications")
async def fetch_qualifications_from_nark(
    background_tasks: BackgroundTasks,
    only_missing: bool = True,
    current_user: User = Depends(get_current_admin),
):
    if qualifications_fetch_progress.get("status") == "running":
        raise HTTPException(status_code=409, detail="Загрузка квалификаций уже выполняется")

    def _run_fetch() -> None:
        qualifications_fetch_progress.update(
            {
                "status": "running",
                "message": "Сбор ссылок и загрузка карточек с nok-nark.ru...",
                "processed": 0,
                "failed": 0,
            }
        )
        try:
            if only_missing:
                result = fetch_missing_qualifications(save=True, rediscover=True)
                missing = max(
                    result.get("index_gap", 0),
                    max(0, result.get("expected_site_count", 4049) - result.get("local_count", 0)),
                )
                processed = result.get("processed") or []
                failed = result.get("failed") or []
                site_count = result.get("site_count", 0)
            else:
                result = fetch_all_qualifications(save=True, only_missing=False)
                missing = result.get("missing_vs_expected", 0)
                processed = result.get("processed") or []
                failed = result.get("failed") or []
                site_count = result.get("site_count", 0)
            msg = f"Готово. В БД: {result['local_count']}, индекс: {site_count}"
            if missing:
                msg += f". Не хватает ещё ~{missing} — запустите догрузку снова"
            qualifications_fetch_progress.update(
                {
                    "status": "done",
                    "message": msg,
                    "local_count": result["local_count"],
                    "processed": len(processed),
                    "failed": len(failed),
                    "site_count": site_count,
                    "missing_vs_expected": missing,
                }
            )
        except Exception as e:
            qualifications_fetch_progress.update(
                {"status": "error", "message": str(e)}
            )

    background_tasks.add_task(_run_fetch)
    return {"status": "started", "only_missing": only_missing}


@app.get("/fetch-qualifications/status")
async def fetch_qualifications_status(current_user: User = Depends(get_current_admin)):
    return qualifications_fetch_progress


def serialize_assessment_tool(tool: AssessmentTool, *, detailed: bool = False) -> dict:
    data = {
        "id": tool.id,
        "code": tool.code,
        "name": tool.name,
        "qualification_code": tool.qualification_code,
        "qualification_id": tool.qualification_id,
        "status": getattr(tool, "status", None) or "active",
        "spk_name": tool.spk_name,
        "prof_standard_name": tool.prof_standard_name,
        "prof_standard_order": tool.prof_standard_order,
        "activity_area": tool.activity_area,
        "document_type": tool.document_type,
        "document_number": tool.document_number,
        "document_date": tool.document_date,
    }
    if not detailed:
        return data
    data.update(
        {
            "qualification_label": tool.qualification_label,
            "material_support": tool.material_support,
            "staffing": tool.staffing,
            "sample_tasks_url": tool.sample_tasks_url,
            "pmk_sample_tasks_url": tool.pmk_sample_tasks_url,
            "source_url": tool.source_url,
            "created_at": tool.created_at,
            "updated_at": tool.updated_at,
        }
    )
    if tool.qualification is not None:
        data["qualification"] = {
            "id": tool.qualification.id,
            "code": tool.qualification.code,
            "name": tool.qualification.name,
            "level": tool.qualification.level,
        }
    return data


@app.get("/assessment-tools/stats")
async def assessment_tools_stats(current_user: User = Depends(get_current_admin)):
    return get_assessment_tool_stats()


@app.post("/assessment-tools/relink")
async def relink_assessment_tools(current_user: User = Depends(get_current_admin)):
    return link_assessment_tools_to_qualifications()


@app.post("/assessment-tools/sync-revisions")
async def sync_assessment_tool_revisions(current_user: User = Depends(get_current_admin)):
    """Активировать только последние ревизии ОС (.002 деактивирует .001 и т.д.)."""
    return sync_assessment_tool_revision_status()


@app.post("/fetch-assessment-tools")
async def fetch_assessment_tools_from_nark(
    background_tasks: BackgroundTasks,
    only_missing: bool = True,
    current_user: User = Depends(get_current_admin),
):
    if assessment_tools_fetch_progress.get("status") == "running":
        raise HTTPException(status_code=409, detail="Загрузка оценочных средств уже выполняется")

    def _run_fetch() -> None:
        assessment_tools_fetch_progress.update(
            {
                "status": "running",
                "message": "Сбор ссылок и загрузка карточек ОС с nok-nark.ru...",
                "processed": 0,
                "failed": 0,
            }
        )
        try:
            result = fetch_all_assessment_tools(save=True, only_missing=only_missing, rediscover=True)
            processed = result.get("processed") or []
            failed = result.get("failed") or []
            site_count = result.get("site_count", 0)
            missing = result.get("missing_vs_expected", 0)
            msg = (
                f"Готово. В БД: {result['local_count']}, индекс: {site_count}, "
                f"связано с квалификациями: {result.get('linked', 0)}"
            )
            if missing:
                msg += f". Не хватает ещё ~{missing}"
            assessment_tools_fetch_progress.update(
                {
                    "status": "done",
                    "message": msg,
                    "local_count": result["local_count"],
                    "processed": len(processed),
                    "failed": len(failed),
                    "site_count": site_count,
                    "linked": result.get("linked", 0),
                    "missing_vs_expected": missing,
                }
            )
        except Exception as e:
            assessment_tools_fetch_progress.update({"status": "error", "message": str(e)})

    background_tasks.add_task(_run_fetch)
    return {"status": "started", "only_missing": only_missing}


@app.get("/fetch-assessment-tools/status")
async def fetch_assessment_tools_status(current_user: User = Depends(get_current_admin)):
    return assessment_tools_fetch_progress


@app.get("/assessment-tools")
async def list_assessment_tools(current_user: User = Depends(get_current_admin)):
    from sqlalchemy.orm import load_only

    session = SessionLocal()
    try:
        tools = (
            session.query(AssessmentTool)
            .options(
                load_only(
                    AssessmentTool.id,
                    AssessmentTool.code,
                    AssessmentTool.name,
                    AssessmentTool.qualification_code,
                    AssessmentTool.qualification_id,
                    AssessmentTool.status,
                    AssessmentTool.spk_name,
                    AssessmentTool.prof_standard_name,
                    AssessmentTool.prof_standard_order,
                    AssessmentTool.activity_area,
                    AssessmentTool.document_type,
                    AssessmentTool.document_number,
                    AssessmentTool.document_date,
                )
            )
            .order_by(AssessmentTool.code)
            .all()
        )
        return [serialize_assessment_tool(tool, detailed=False) for tool in tools]
    finally:
        session.close()


@app.get("/assessment-tools/{id}")
async def get_assessment_tool(id: int, current_user: User = Depends(get_current_admin)):
    from sqlalchemy.orm import joinedload

    session = SessionLocal()
    try:
        tool = (
            session.query(AssessmentTool)
            .options(joinedload(AssessmentTool.qualification))
            .filter(AssessmentTool.id == id)
            .first()
        )
        if not tool:
            raise HTTPException(404, "Оценочное средство не найдено")
        return serialize_assessment_tool(tool, detailed=True)
    finally:
        session.close()


# ---------- ФГОС СПО ----------


@app.get("/qualifications")
async def list_qualifications(current_user: User = Depends(get_current_admin)):
    from sqlalchemy.orm import load_only

    session = SessionLocal()
    try:
        quals = (
            session.query(Qualification)
            .options(
                load_only(
                    Qualification.id,
                    Qualification.code,
                    Qualification.name,
                    Qualification.level,
                    Qualification.activity_area,
                    Qualification.prof_standard_name,
                    Qualification.prof_standard_order,
                    Qualification.prof_standard_id,
                )
            )
            .all()
        )
        ps_ids = {q.prof_standard_id for q in quals if q.prof_standard_id is not None}
        reg_by_id: dict[int, str] = {}
        if ps_ids:
            for std_id, reg in (
                session.query(StandardRaw.id, StandardRaw.reg_number)
                .filter(StandardRaw.id.in_(ps_ids))
                .all()
            ):
                if reg:
                    reg_by_id[std_id] = str(reg)
        os_counts = assessment_tool_count_by_qualification_id(session)
        return [serialize_qualification_list_item(q, reg_by_id, os_counts) for q in quals]
    finally:
        session.close()

@app.get("/qualifications/{id}")
async def get_qualification(id: int, current_user: User = Depends(get_current_admin)):
    from sqlalchemy.orm import joinedload

    session = SessionLocal()
    try:
        q = (
            session.query(Qualification)
            .options(joinedload(Qualification.assessment_tools))
            .filter(Qualification.id == id)
            .first()
        )
        if not q:
            raise HTTPException(404, "Квалификация не найдена")
        reg_by_id: dict[int, str] = {}
        if q.prof_standard_id is not None:
            reg = (
                session.query(StandardRaw.reg_number)
                .filter(StandardRaw.id == q.prof_standard_id)
                .scalar()
            )
            if reg:
                reg_by_id[q.prof_standard_id] = str(reg)
        return serialize_qualification(q, reg_by_id)
    finally:
        session.close()

# ---------- ФГОС СПО ----------

def _fgos_search_haystack(item: FgosSpo) -> str:
    return " ".join(
        part
        for part in (
            item.code,
            item.name,
            item.qualification,
            item.group_name,
            item.industry_name,
        )
        if part
    )


def fgos_matches_query(item: FgosSpo, query: str) -> bool:
    """SQLite LIKE не сворачивает кириллицу: «техносферная» ≠ «Техносферная»."""
    needle = (query or "").casefold().strip()
    if not needle:
        return False
    return needle in _fgos_search_haystack(item).casefold()


def serialize_fgos(item: FgosSpo, *, detailed: bool = False) -> dict:
    cat = FGOS_CATEGORY_BY_ID.get(item.category or "spo", {})
    base = {
        "id": item.id,
        "category": item.category or "spo",
        "category_title": cat.get("title", ""),
        "category_label": cat.get("short_label", ""),
        "code": item.code,
        "name": item.name,
        "kind": item.kind,
        "level": item.level,
        "qualification": item.qualification,
        "qualification_tracks_count": len(item.qualification_tracks or []),
        "industry_code": item.industry_code,
        "industry_name": item.industry_name,
        "group_code": item.group_code,
        "group_name": item.group_name,
    }
    if not detailed:
        return base
    pdf = item.pdf_url
    if pdf and pdf.startswith("/"):
        pdf = f"https://classinform.ru{pdf}"
    source = item.source_url
    if source and source.startswith("/"):
        source = f"https://classinform.ru{source}"
    return {
        **base,
        "order": item.order,
        "order_date": item.order_date,
        "order_number": item.order_number,
        "qualification_tracks": item.qualification_tracks or [],
        "study_duration": item.study_duration or {},
        "activity_areas": item.activity_areas or [],
        "ok_competencies": item.ok_competencies or [],
        "pk_competencies": item.pk_competencies or [],
        "pdf_url": pdf,
        "source_url": source,
        "created_at": item.created_at.isoformat() if item.created_at else None,
        "updated_at": item.updated_at.isoformat() if item.updated_at else None,
    }


@app.get("/fgos/categories")
async def fgos_categories(current_user: User = Depends(get_current_admin)):
    from .fgos_parser import get_fgos_stats_by_category

    counts = get_fgos_stats_by_category()
    return [
        {
            **cat,
            "local_count": counts.get(cat["id"], 0),
            "root_url": f"https://classinform.ru{cat['root_path']}",
        }
        for cat in FGOS_CATEGORIES
    ]


@app.get("/fgos/stats")
async def fgos_stats(
    category: Optional[str] = None,
    current_user: User = Depends(get_current_admin),
):
    from .fgos_parser import get_fgos_stats, get_fgos_stats_by_category

    if category:
        if category not in FGOS_CATEGORY_IDS:
            raise HTTPException(400, "Неизвестная категория ФГОС")
        by_cat = get_fgos_stats_by_category()
        return {
            "local_count": by_cat.get(category, 0),
            "category": category,
            "source": "classinform.ru",
        }
    return {**get_fgos_stats(), "by_category": get_fgos_stats_by_category(), "source": "classinform.ru"}


@app.get("/fgos/search")
async def search_fgos(
    q: str = "",
    categories: Optional[str] = None,
    limit: int = 40,
    current_user: User = Depends(get_current_user),
):
    """Поиск ФГОС по коду/названию. categories — список id через запятую (spo,bachelor,...)."""
    query = (q or "").strip()
    if len(query) < 2:
        return {"total": 0, "items": []}

    cat_ids: list[str] = []
    if categories:
        for raw in categories.split(","):
            cid = raw.strip()
            if not cid:
                continue
            if cid not in FGOS_CATEGORY_IDS:
                raise HTTPException(400, f"Неизвестная категория ФГОС: {cid}")
            cat_ids.append(cid)

    needle = query.casefold()
    session = SessionLocal()
    try:
        from sqlalchemy.orm import defer

        qset = session.query(FgosSpo).options(
            defer(FgosSpo.raw_data),
            defer(FgosSpo.qualification_tracks),
            defer(FgosSpo.study_duration),
            defer(FgosSpo.activity_areas),
            defer(FgosSpo.ok_competencies),
            defer(FgosSpo.pk_competencies),
        )
        if cat_ids:
            qset = qset.filter(FgosSpo.category.in_(cat_ids))
        matched = [item for item in qset.order_by(FgosSpo.code).all() if fgos_matches_query(item, needle)]
        total = len(matched)
        items = matched[: min(max(1, limit), 100)]
        return {"total": total, "items": [serialize_fgos(item) for item in items]}
    finally:
        session.close()


@app.get("/fgos")
async def list_fgos(
    category: Optional[str] = None,
    current_user: User = Depends(get_current_admin),
):
    session = SessionLocal()
    try:
        q = session.query(FgosSpo)
        if category:
            if category not in FGOS_CATEGORY_IDS:
                raise HTTPException(400, "Неизвестная категория ФГОС")
            q = q.filter(FgosSpo.category == category)
        items = q.order_by(FgosSpo.code).all()
        return [serialize_fgos(item) for item in items]
    finally:
        session.close()


@app.get("/fgos/{item_id}")
async def get_fgos(item_id: int, current_user: User = Depends(get_current_admin)):
    session = SessionLocal()
    try:
        item = session.query(FgosSpo).filter(FgosSpo.id == item_id).first()
        if not item:
            raise HTTPException(status_code=404, detail="ФГОС не найден")
        return serialize_fgos(item, detailed=True)
    finally:
        session.close()

# ---------- Компетенции ----------

def _build_competence_raw_data(
    *,
    existing: dict | None,
    description: str = "",
    industry: str = "",
    hours: str = "",
    education_level: str = "",
    education_kind: str = "",
    education_training_profession_id: int | None = None,
    education_training_profession: str = "",
    fgos_id: int | None = None,
    fgos_code: str = "",
    fgos_name: str = "",
    fgos_category: str = "",
    competence_kind: str = "professional",
    qualification_level: str | None,
    universal_skills: list | None = None,
) -> dict:
    formation_profile = build_formation_profile(
        competence_kind=competence_kind,
        qualification_level=qualification_level,
        universal_skills=universal_skills,
    )
    raw = merge_raw_data(
        existing,
        description=description,
        industry=industry,
        hours=hours,
        formation_profile=formation_profile,
    )
    if education_level:
        raw["education_level"] = education_level
    elif "education_level" in raw:
        raw.pop("education_level", None)
    if education_kind:
        raw["education_kind"] = education_kind
    if education_training_profession:
        raw["education_training_profession"] = education_training_profession
    elif "education_training_profession" in raw:
        raw.pop("education_training_profession", None)
    if education_training_profession_id is not None:
        raw["education_training_profession_id"] = education_training_profession_id
    elif "education_training_profession_id" in raw:
        raw.pop("education_training_profession_id", None)
    if fgos_id is not None:
        raw["fgos_id"] = fgos_id
        raw["fgos_code"] = fgos_code
        raw["fgos_name"] = fgos_name
        raw["fgos_category"] = fgos_category
    else:
        raw.pop("fgos_id", None)
        raw.pop("fgos_code", None)
        raw.pop("fgos_name", None)
        raw.pop("fgos_category", None)
    return raw


def serialize_competence(comp: Competence, include_matrix: bool = False) -> dict:
    raw = comp.raw_data or {}
    formation_profile = raw.get("formation_profile") or {}
    status = comp.status.value if comp.status else None
    ql_code = normalize_qualification_level_code(comp.qualification_level)
    payload = {
        "id": comp.id,
        "name": comp.name,
        "status": status,
        "qualification_name": comp.qualification_name,
        "qualification_level": comp.qualification_level,
        "qualification_level_code": ql_code,
        "prof_standard_id": comp.prof_standard_id,
        "qualification_id": comp.qualification_id,
        "competence_kind": formation_profile.get("competence_kind", "professional"),
        "formation_profile": formation_profile,
        "universal_skills": formation_profile.get("universal_skills") or [],
        "education_level": raw.get("education_level", ""),
        "education_kind": raw.get("education_kind", ""),
        "education_training_profession_id": raw.get("education_training_profession_id"),
        "education_training_profession": raw.get("education_training_profession", ""),
        "fgos_id": raw.get("fgos_id"),
        "fgos_code": raw.get("fgos_code", ""),
        "fgos_name": raw.get("fgos_name", ""),
        "fgos_category": raw.get("fgos_category", ""),
        "developer": comp.developer,
        "validator": comp.validator,
        "validation_notes": comp.validation_notes,
        "description": raw.get("description", ""),
        "industry": raw.get("industry", ""),
        "hours": raw.get("hours", ""),
        "labor_functions": comp.labor_functions,
        "structure": comp.structure,
        "descriptors": normalize_descriptors(comp.descriptors),
        "discipline_mapping": comp.discipline_mapping,
        "ed_technologies": comp.ed_technologies,
        "assessment_tools": comp.assessment_tools,
        "resources": comp.resources,
        "created_at": comp.created_at.isoformat() if comp.created_at else None,
        "updated_at": comp.updated_at.isoformat() if comp.updated_at else None,
        "is_active": comp.is_active,
    }
    if include_matrix:
        payload["matrix_context"] = get_matrix_context(comp.qualification_level)
    return payload


@app.get("/competences/public")
async def list_public_competences(
    q: Optional[str] = None,
    industry: Optional[str] = None,
    status: Optional[str] = None,
):
    """Публичный реестр: утверждённые и компетенции на экспертизе."""
    session = SessionLocal()
    try:
        query = session.query(Competence).filter(
            Competence.is_active == 1,
            Competence.status.in_([CompetenceStatus.APPROVED, CompetenceStatus.REVIEW]),
        )
        if status:
            try:
                query = query.filter(Competence.status == CompetenceStatus(status))
            except ValueError:
                pass
        competences = query.order_by(Competence.updated_at.desc()).all()
        result = [serialize_competence(c) for c in competences]
        if industry:
            result = [c for c in result if c.get("industry") == industry]
        if q:
            q_lower = q.lower()
            result = [
                c for c in result
                if q_lower in (c.get("name") or "").lower()
                or q_lower in str(c.get("id", ""))
            ]
        return result
    finally:
        session.close()


@app.get("/competences/public/stats")
async def get_public_competence_stats():
    session = SessionLocal()
    try:
        active_q = session.query(Competence).filter(
            Competence.is_active == 1,
            Competence.status == CompetenceStatus.APPROVED,
        )
        review_q = session.query(Competence).filter(
            Competence.is_active == 1,
            Competence.status == CompetenceStatus.REVIEW,
        )
        archived_q = session.query(Competence).filter(Competence.is_active == 0)
        active = active_q.count()
        review = review_q.count()
        archived = archived_q.count()
        return {"total": active + review, "active": active, "review": review, "archived": archived}
    finally:
        session.close()


@app.get("/competences/public/{comp_id}")
async def get_public_competence(comp_id: int):
    session = SessionLocal()
    try:
        comp = session.query(Competence).filter(Competence.id == comp_id).first()
        if not comp or not comp.is_active:
            raise HTTPException(404, "Компетенция не найдена")
        if comp.status not in (CompetenceStatus.APPROVED, CompetenceStatus.REVIEW):
            raise HTTPException(404, "Компетенция не найдена")
        return serialize_competence(comp, include_matrix=True)
    finally:
        session.close()


@app.post("/competences/suggest-profile")
async def suggest_competence_profile_endpoint(
    req: SuggestProfileRequest,
    current_user: User = Depends(get_current_user),
):
    return suggest_competence_profile(
        req.qualification_level,
        req.structure,
        req.competence_kind or "professional",
    )


def _enrich_competence_document_payload(session, payload: dict) -> dict:
    """Дополняет данные компетенции для DOCX: имя ПС, показатели №148н."""
    out = dict(payload or {})
    ps_id = out.get("prof_standard_id")
    if ps_id and not out.get("prof_standard_name"):
        std = session.query(StandardRaw).filter(StandardRaw.id == ps_id).first()
        if std:
            name = (std.name or "").strip()
            reg = (std.reg_number or "").strip()
            out["prof_standard_name"] = f"{name} (рег. {reg})" if reg else name

    ql = out.get("qualification_level") or out.get("qualification_level_code")
    ql_code = normalize_qualification_level_code(ql)
    if ql_code and not out.get("qualification_level_label"):
        out["qualification_level_label"] = f"{ql_code}-й уровень"
    if not str(out.get("order_148n_indicators") or "").strip() and ql_code:
        out["order_148n_indicators"] = get_order_148n_indicators(ql_code)
    return out


def _competence_docx_response(payload: dict) -> Response:
    from .competence_document import (
        build_competence_docx_bytes,
        competence_docx_filename,
        content_disposition_attachment,
    )

    data = build_competence_docx_bytes(payload)
    filename = competence_docx_filename(payload)
    return Response(
        content=data,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": content_disposition_attachment(filename)},
    )


@app.post("/competences/document.docx")
async def create_competence_document_docx(
    data: Dict[str, Any],
    current_user: User = Depends(get_current_user),
):
    """Сформировать DOCX из черновика / тела запроса (без сохранения в БД)."""
    session = SessionLocal()
    try:
        payload = _enrich_competence_document_payload(session, data)
        if not str(payload.get("name") or payload.get("title") or "").strip():
            raise HTTPException(400, detail="Укажите название компетенции")
        return _competence_docx_response(payload)
    finally:
        session.close()


@app.get("/competences/{comp_id}/document.docx")
async def get_competence_document_docx(
    comp_id: int,
    current_user: User = Depends(get_current_user),
):
    session = SessionLocal()
    try:
        comp = session.query(Competence).filter(Competence.id == comp_id).first()
        if not comp:
            raise HTTPException(404, detail="Компетенция не найдена")
        payload = _enrich_competence_document_payload(
            session, serialize_competence(comp, include_matrix=False)
        )
        return _competence_docx_response(payload)
    finally:
        session.close()


@app.get("/competences/public/{comp_id}/document.docx")
async def get_public_competence_document_docx(comp_id: int):
    session = SessionLocal()
    try:
        comp = session.query(Competence).filter(Competence.id == comp_id).first()
        if not comp or not comp.is_active:
            raise HTTPException(404, detail="Компетенция не найдена")
        if comp.status not in (CompetenceStatus.APPROVED, CompetenceStatus.REVIEW):
            raise HTTPException(404, detail="Компетенция не найдена")
        payload = _enrich_competence_document_payload(
            session, serialize_competence(comp, include_matrix=False)
        )
        return _competence_docx_response(payload)
    finally:
        session.close()


@app.post("/competences")
async def create_competence(data: CompetenceCreate, current_user: User = Depends(get_current_user)):
    session = SessionLocal()
    try:
        competence_kind = data.competence_kind or "professional"
        status = CompetenceStatus(data.status) if data.status else CompetenceStatus.DRAFT
        strict = status == CompetenceStatus.REVIEW
        validation_errors = validate_competence_payload(
            competence_kind=competence_kind,
            qualification_level=data.qualification_level,
            labor_functions=data.labor_functions,
            descriptors=data.descriptors,
            assessment_tools=data.assessment_tools,
            strict=strict,
        )
        if validation_errors:
            raise HTTPException(400, detail="; ".join(validation_errors))

        if competence_kind == "professional":
            std = session.query(StandardRaw).filter(StandardRaw.id == data.prof_standard_id).first()
            if not std:
                raise HTTPException(404, "Профессиональный стандарт не найден")
        if data.qualification_id:
            qual = session.query(Qualification).filter(Qualification.id == data.qualification_id).first()
            if not qual:
                raise HTTPException(404, "Квалификация не найдена")

        raw_data = _build_competence_raw_data(
            existing=None,
            description=data.description or "",
            industry=data.industry or "",
            hours=data.hours or "",
            education_level=data.education_level or "",
            education_kind=data.education_kind or "",
            education_training_profession_id=data.education_training_profession_id,
            education_training_profession=data.education_training_profession or "",
            fgos_id=data.fgos_id,
            fgos_code=data.fgos_code or "",
            fgos_name=data.fgos_name or "",
            fgos_category=data.fgos_category or "",
            competence_kind=competence_kind,
            qualification_level=data.qualification_level,
            universal_skills=data.universal_skills,
        )
        new_comp = Competence(
            name=data.name,
            qualification_name=data.qualification_name,
            qualification_level=data.qualification_level,
            prof_standard_id=data.prof_standard_id,
            qualification_id=data.qualification_id,
            labor_functions=data.labor_functions,
            structure=data.structure,
            descriptors=normalize_descriptors(data.descriptors or {}),
            discipline_mapping=data.discipline_mapping or [],
            ed_technologies=data.ed_technologies or [],
            assessment_tools=data.assessment_tools,
            resources=data.resources or [],
            developer=data.developer,
            validator=data.validator,
            status=status,
            raw_data=raw_data,
            user_id=current_user.id
        )
        session.add(new_comp)
        session.commit()
        session.refresh(new_comp)
        return serialize_competence(new_comp, include_matrix=True)
    except HTTPException:
        session.rollback()
        raise
    except Exception as e:
        session.rollback()
        raise HTTPException(400, detail=str(e))
    finally:
        session.close()

@app.get("/competences")
async def list_competences(current_user: User = Depends(get_current_user)):
    session = SessionLocal()
    try:
        query = session.query(Competence).filter(Competence.is_active == 1)
        if current_user.role != "admin":
            query = query.filter(Competence.user_id == current_user.id)
        competences = query.all()
        return [serialize_competence(c) for c in competences]
    finally:
        session.close()

@app.get("/competences/stats")
async def get_competence_stats(current_user: User = Depends(get_current_user)):
    session = SessionLocal()
    try:
        query = session.query(Competence).filter(Competence.is_active == 1)
        if current_user.role != "admin":
            query = query.filter(Competence.user_id == current_user.id)
        total = query.count()
        active = query.filter(Competence.status == CompetenceStatus.APPROVED).count()
        review = query.filter(Competence.status == CompetenceStatus.REVIEW).count()
        archived = session.query(Competence).filter(Competence.is_active == 0)
        if current_user.role != "admin":
            archived = archived.filter(Competence.user_id == current_user.id)
        archived_count = archived.count()
        return {"total": total, "active": active, "review": review, "archived": archived_count}
    finally:
        session.close()

@app.get("/competences/{comp_id}")
async def get_competence(comp_id: int, current_user: User = Depends(get_current_user)):
    session = SessionLocal()
    try:
        comp = session.query(Competence).filter(Competence.id == comp_id).first()
        if not comp:
            raise HTTPException(404, "Компетенция не найдена")
        if current_user.role != "admin" and comp.user_id != current_user.id:
            raise HTTPException(403, "Доступ запрещён")
        return serialize_competence(comp, include_matrix=True)
    finally:
        session.close()

@app.put("/competences/{comp_id}")
async def update_competence(comp_id: int, data: CompetenceUpdate, current_user: User = Depends(get_current_user)):
    session = SessionLocal()
    try:
        comp = session.query(Competence).filter(Competence.id == comp_id).first()
        if not comp:
            raise HTTPException(404, "Компетенция не найдена")
        if current_user.role != "admin" and comp.user_id != current_user.id:
            raise HTTPException(403, "Доступ запрещён")

        update_data = data.dict(exclude_unset=True)
        raw_fields: dict[str, Any] = {}
        for key in (
            "description",
            "industry",
            "hours",
            "education_level",
            "education_kind",
            "education_training_profession_id",
            "education_training_profession",
            "fgos_id",
            "fgos_code",
            "fgos_name",
            "fgos_category",
            "universal_skills",
            "competence_kind",
        ):
            if key in update_data:
                raw_fields[key] = update_data.pop(key)

        if "descriptors" in update_data:
            update_data["descriptors"] = normalize_descriptors(update_data["descriptors"] or {})

        for key, value in update_data.items():
            if hasattr(comp, key):
                if key == "status" and value:
                    setattr(comp, key, CompetenceStatus(value))
                else:
                    setattr(comp, key, value)

        existing_raw = comp.raw_data or {}
        existing_profile = existing_raw.get("formation_profile") or {}
        competence_kind = raw_fields.get("competence_kind") or existing_profile.get("competence_kind", "professional")
        training_id = raw_fields.get(
            "education_training_profession_id",
            existing_raw.get("education_training_profession_id"),
        )
        comp.raw_data = _build_competence_raw_data(
            existing=existing_raw,
            description=raw_fields.get("description", existing_raw.get("description", "")),
            industry=raw_fields.get("industry", existing_raw.get("industry", "")),
            hours=raw_fields.get("hours", existing_raw.get("hours", "")),
            education_level=raw_fields.get("education_level", existing_raw.get("education_level", "")),
            education_kind=raw_fields.get("education_kind", existing_raw.get("education_kind", "")),
            education_training_profession_id=training_id,
            education_training_profession=raw_fields.get(
                "education_training_profession",
                existing_raw.get("education_training_profession", ""),
            ),
            fgos_id=raw_fields.get("fgos_id", existing_raw.get("fgos_id")),
            fgos_code=raw_fields.get("fgos_code", existing_raw.get("fgos_code", "")),
            fgos_name=raw_fields.get("fgos_name", existing_raw.get("fgos_name", "")),
            fgos_category=raw_fields.get("fgos_category", existing_raw.get("fgos_category", "")),
            competence_kind=competence_kind,
            qualification_level=comp.qualification_level,
            universal_skills=raw_fields.get("universal_skills", existing_profile.get("universal_skills")),
        )

        strict = comp.status == CompetenceStatus.REVIEW
        validation_errors = validate_competence_payload(
            competence_kind=competence_kind,
            qualification_level=comp.qualification_level,
            labor_functions=comp.labor_functions,
            descriptors=comp.descriptors,
            assessment_tools=comp.assessment_tools,
            strict=strict,
        )
        if validation_errors:
            raise HTTPException(400, detail="; ".join(validation_errors))

        session.commit()
        session.refresh(comp)
        return serialize_competence(comp, include_matrix=True)
    except HTTPException:
        session.rollback()
        raise
    finally:
        session.close()

@app.delete("/competences/{comp_id}")
async def delete_competence(comp_id: int, current_user: User = Depends(get_current_user)):
    session = SessionLocal()
    try:
        comp = session.query(Competence).filter(Competence.id == comp_id).first()
        if not comp:
            raise HTTPException(404, "Компетенция не найдена")
        if current_user.role != "admin" and comp.user_id != current_user.id:
            raise HTTPException(403, "Доступ запрещён")
        comp.is_active = 0
        session.commit()
        return {"status": "ok"}
    finally:
        session.close()

# ---------- Расчёт покрытия ----------

@app.post("/competence/coverage")
async def calculate_coverage(req: CoverageRequest, current_user: User = Depends(get_current_user)):
    session = SessionLocal()
    try:
        quals = session.query(Qualification).filter(Qualification.prof_standard_id == req.standard_id).all()
        result = []
        for q in quals:
            q_tf_codes = [tf.get('code', '') for tf in q.labor_functions if tf.get('code')]
            if not q_tf_codes:
                continue
            selected_set = set(req.selected_tf_codes)
            q_set = set(q_tf_codes)
            coverage = len(selected_set.intersection(q_set)) / len(q_set) * 100 if q_set else 0
            result.append({
                "qualification_id": q.id,
                "qualification_code": q.code,
                "qualification_name": q.name,
                "coverage_percent": round(coverage, 1),
                "total_tf": len(q_set),
                "covered_tf": len(selected_set.intersection(q_set)),
                "missing_tf": list(q_set - selected_set)
            })
        result.sort(key=lambda x: x['coverage_percent'], reverse=True)
        return result
    finally:
        session.close()

# ---------- Обратная связь ----------

@app.post("/feedback")
async def create_feedback(data: FeedbackCreate, current_user: User = Depends(get_current_user)):
    session = SessionLocal()
    try:
        feedback = Feedback(section=data.section, text=data.text)
        session.add(feedback)
        session.commit()
        session.refresh(feedback)
        return {"status": "ok", "id": feedback.id}
    except Exception as e:
        session.rollback()
        raise HTTPException(400, detail=str(e))
    finally:
        session.close()

@app.get("/feedback")
async def list_feedback(current_user: User = Depends(get_current_admin)):
    session = SessionLocal()
    try:
        items = session.query(Feedback).order_by(Feedback.created_at.desc()).all()
        return [
            {
                "id": f.id,
                "section": f.section,
                "text": f.text,
                "created_at": f.created_at.isoformat() if f.created_at else None
            }
            for f in items
        ]
    finally:
        session.close()

# ---------- Регистрация ----------

@app.post("/register")
async def register(data: dict):
    session = SessionLocal()
    try:
        reg = Registration(
            full_name=data['fullName'],
            email=data['email'],
            phone=data['phone'],
            organization=data['organization'],
            position=data['position']
        )
        session.add(reg)
        session.commit()
        session.refresh(reg)
        return {"status": "ok", "id": reg.id}
    except Exception as e:
        session.rollback()
        raise HTTPException(400, detail=str(e))
    finally:
        session.close()

@app.get("/registrations")
async def get_registrations(current_user: User = Depends(get_current_admin)):
    session = SessionLocal()
    try:
        registrations = session.query(Registration).order_by(Registration.created_at.desc()).all()
        return [
            {
                "id": r.id,
                "full_name": r.full_name,
                "email": r.email,
                "phone": r.phone,
                "organization": r.organization,
                "position": r.position,
                "created_at": r.created_at.isoformat()
            }
            for r in registrations
        ]
    finally:
        session.close()