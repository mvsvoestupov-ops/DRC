from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, status, BackgroundTasks, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.responses import HTMLResponse, Response
from pydantic import BaseModel
from typing import List, Optional, Dict, Any, Union
import os
import datetime
import re
from sqlalchemy import or_, func, false as sa_false, String
from sqlalchemy.orm import joinedload
from sqlalchemy.orm.attributes import flag_modified

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
    tf_zu_from_xml,
)
from .db import SessionLocal, Base, engine
from .db.raw_models import StandardRaw, GeneralizedFunctionRaw, ParticularFunctionRaw
from .db.qualifications_models import Qualification
from .db.assessment_tools_models import AssessmentTool
from .db.competence_models import (
    Competence,
    CompetenceStatus,
    CompetenceReviewer,
    CompetenceCollaborator,
    CompetenceStepChat,
    CompetenceActivityLog,
)
from .db.feedback_models import Feedback
from .db.user_models import User
from .db.registration_models import Registration
from .db.fgos_models import FgosSpo
from .esco_registry import (
    occupation_skills,
    search_occupations,
    search_skills,
    status as esco_status,
)
from .harmoni_brics import list_countries as harmoni_brics_countries, suggest_mapping as harmoni_brics_suggest
from .garm_esco_ai import suggest_garm_esco
from .deepseek_client import deepseek_status
from .fgos_registry import FGOS_CATEGORIES, FGOS_CATEGORY_BY_ID, FGOS_CATEGORY_IDS
from .db_operations import save_raw_standard
from .tf_codes import compact_otf_code, compact_tf_code, tf_qualification_level
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
    create_access_token, get_current_user,
    get_current_admin, get_current_moderator, get_password_hash, oauth2_scheme,
    get_current_user_or_api_key, get_token_claim, is_user_active,
    is_email_confirmed, user_if_password_ok, UNCONFIRMED_EMAIL_DETAIL,
    generate_user_password, verify_password, is_staff_role, is_moderator_role, user_role,
    is_intl_methodologist_role, get_current_intl_methodologist,
)
from .db.harmonization_models import (
    HarmonizationVersion,
    HarmonizationStepState,
    PassportHarmonization,
)
from .harmonization import (
    GLOBAL_STEPS,
    PASSPORT_STEPS,
    VERSION_STATUSES,
    ai_agent_status,
    apply_bridge_snapshot_to_step6,
    build_bridge_context_for_passport,
    empty_step_payload,
    ensure_version_steps,
    filter_bridge_context_by_systems,
    generate_ai_draft,
    generate_step3_ai_draft,
    normalize_purposes,
    normalize_target_system_codes,
    serialize_passport,
    serialize_step,
    serialize_version,
    sync_bridges_payload_with_systems,
    sync_component_rules_payload_with_systems,
)
from .mail import (
    confirmation_link,
    frontend_base_url,
    hash_confirm_token,
    issue_confirm_token,
    issue_reset_token,
    reset_password_link,
    send_invite_email,
    send_reset_password_email,
    send_collaboration_invite_email,
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
    ensure_competence_public_code_column,
    ensure_competence_activity_columns,
    ensure_feedback_columns,
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
from .assessment_media import router as assessment_media_router
from .feedback_media import router as feedback_media_router
from .prof_training_registry import (
    ensure_prof_training_seeded,
    import_prof_training_from_path,
    list_prof_training_professions,
    prof_training_sections,
)
from .presence import (
    drop_presence,
    list_presence,
    presence_color,
    sanitize_step,
    upsert_presence,
)
from .activity import (
    JSON_COLUMNS,
    action_weight,
    apply_field_values,
    before_values,
    change_field_labels,
    compute_progress,
    diff_snapshots,
    public_changes,
    snapshot_competence,
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
for col in ensure_competence_public_code_column():
    print(f"DB migration: added column {col}")
for col in ensure_competence_activity_columns():
    print(f"DB migration: added column {col}")
for col in ensure_feedback_columns():
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
            admin.email_confirmed = True
            if old_admin and old_admin.id != admin.id:
                db.delete(old_admin)
        elif old_admin:
            old_admin.email = admin_email
            old_admin.hashed_password = hashed
            old_admin.role = "admin"
            old_admin.is_active = True
            old_admin.email_confirmed = True
        else:
            db.add(
                User(
                    email=admin_email,
                    hashed_password=hashed,
                    role="admin",
                    is_active=True,
                    email_confirmed=True,
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

app.include_router(assessment_media_router)
app.include_router(feedback_media_router)


@app.on_event("startup")
def warm_level_matrix_cache() -> None:
    ensure_admin_credentials()
    _ensure_competence_public_code_column()
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
    qualification_level: Optional[str] = ""
    prof_standard_id: Optional[int] = None
    qualification_id: Optional[int] = None
    competence_kind: Optional[str] = "professional"
    labor_functions: Optional[List[Dict[str, Any]]] = None
    structure: Optional[Dict[str, Any]] = None
    descriptors: Optional[Dict] = {}
    discipline_mapping: Optional[List[Dict]] = []
    ed_technologies: Optional[List[str]] = []
    assessment_tools: Optional[List[Dict]] = None
    assessment_tools_v2: Optional[Dict[str, Any]] = None
    resources: Optional[Union[List[str], Dict[str, Any]]] = []
    expertise: Optional[Dict[str, Any]] = None
    international_mapping: Optional[Dict[str, Any]] = None
    harmoni_brics: Optional[Dict[str, Any]] = None
    td_zu_mapping: Optional[Dict[str, Any]] = None
    wizard_step: Optional[int] = None
    developer: str
    validator: Optional[str] = None
    status: Optional[str] = "проект"
    description: Optional[str] = ""
    industry: Optional[str] = ""
    professional_area_code: Optional[str] = ""
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
    assessment_tools_v2: Optional[Dict[str, Any]] = None
    resources: Optional[Union[List[str], Dict[str, Any]]] = None
    developer: Optional[str] = None
    validator: Optional[str] = None
    validation_notes: Optional[str] = None
    expertise: Optional[Dict[str, Any]] = None
    international_mapping: Optional[Dict[str, Any]] = None
    harmoni_brics: Optional[Dict[str, Any]] = None
    td_zu_mapping: Optional[Dict[str, Any]] = None
    wizard_step: Optional[int] = None
    status: Optional[str] = None
    description: Optional[str] = None
    industry: Optional[str] = None
    professional_area_code: Optional[str] = None
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
    # Optimistic concurrency: клиент шлёт updated_at снимка, с которого правил.
    # Если на сервере уже новее — 409, без перезаписи.
    expected_updated_at: Optional[str] = None


class HarmoniBricsSuggestRequest(BaseModel):
    target_country: str
    title: Optional[str] = ""
    description: Optional[str] = ""
    competence_kind: Optional[str] = "professional"
    qualification_level: Optional[str] = ""
    education_kind: Optional[str] = ""
    education_level: Optional[str] = ""
    professional_area_code: Optional[str] = ""
    fgos_code: Optional[str] = ""
    okz: Optional[str] = ""
    isco: Optional[str] = ""
    eqf_occupational: Optional[int] = None
    eqf_educational: Optional[int] = None
    admitted_garm: Optional[bool] = True
    esco_occupation: Optional[str] = ""
    labor_functions: Optional[List[Dict[str, Any]]] = None
    structure_a: Optional[List[str]] = None
    structure_b: Optional[List[str]] = None
    structure_c: Optional[List[str]] = None


class GarmEscoSuggestRequest(BaseModel):
    title: Optional[str] = ""
    description: Optional[str] = ""
    competence_kind: Optional[str] = "professional"
    qualification_level: Optional[str] = ""
    education_kind: Optional[str] = ""
    education_level: Optional[str] = ""
    professional_area_code: Optional[str] = ""
    fgos_code: Optional[str] = ""
    labor_functions: Optional[List[Dict[str, Any]]] = None
    structure_a: Optional[List[str]] = None
    structure_b: Optional[List[str]] = None
    structure_c: Optional[List[str]] = None


class SuggestProfileRequest(BaseModel):
    qualification_level: str
    structure: Optional[Dict[str, Any]] = None
    competence_kind: Optional[str] = "professional"

class CoverageRequest(BaseModel):
    standard_id: int
    selected_tf_codes: List[str]

class FeedbackAttachmentIn(BaseModel):
    id: str
    kind: str = "text"
    name: str = ""
    mime: str = ""
    url: str = ""
    size: int = 0


class FeedbackCreate(BaseModel):
    section: str = "project"
    text: str
    attachments: Optional[List[FeedbackAttachmentIn]] = None


class UserCreate(BaseModel):
    email: str
    password: Optional[str] = None
    role: str = "user"
    is_active: bool = True
    last_name: str
    first_name: str
    middle_name: Optional[str] = None
    organization: str


class UserSignup(BaseModel):
    email: str
    password: str
    last_name: str
    first_name: str
    middle_name: Optional[str] = None
    organization: str


class UserUpdate(BaseModel):
    role: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None
    last_name: Optional[str] = None
    first_name: Optional[str] = None
    middle_name: Optional[str] = None
    organization: Optional[str] = None


class ProfileUpdate(BaseModel):
    last_name: Optional[str] = None
    first_name: Optional[str] = None
    middle_name: Optional[str] = None
    organization: Optional[str] = None
    current_password: Optional[str] = None
    new_password: Optional[str] = None


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    password: str


class ReviewerAssign(BaseModel):
    expert_ids: List[int]


class CollaboratorInvite(BaseModel):
    email: Optional[str] = None
    user_id: Optional[int] = None


class CompetencePresenceUpdate(BaseModel):
    step: Optional[int] = None
    fragment: Optional[str] = None
    online: bool = True


class CompetenceStepChatCreate(BaseModel):
    text: str


class CompetenceDevelopmentUpdate(BaseModel):
    due_date: Optional[str] = None


USER_ROLES = ("user", "expert", "moderator", "admin", "intl_methodologist")
MIN_REVIEWERS = 3
COLLABORATOR_PENDING = "pending"
COLLABORATOR_ACCEPTED = "accepted"
COLLABORATOR_DECLINED = "declined"


def _serialize_user(user: User) -> dict:
    return {
        "id": user.id,
        "email": user.email,
        "role": user.role or "user",
        "is_active": is_user_active(user),
        "email_confirmed": is_email_confirmed(user),
        "last_name": getattr(user, "last_name", None) or "",
        "first_name": getattr(user, "first_name", None) or "",
        "middle_name": getattr(user, "middle_name", None) or "",
        "organization": getattr(user, "organization", None) or "",
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


def _normalize_email(email: str) -> str:
    return (email or "").strip().lower()


def _normalize_person_field(value: Optional[str], *, required: bool, label: str, max_len: int = 255) -> str:
    text = " ".join((value or "").split())
    if required and not text:
        raise HTTPException(400, f"Укажите {label}")
    if len(text) > max_len:
        raise HTTPException(400, f"{label} слишком длинное")
    return text


def _normalize_role(role: str) -> str:
    value = (role or "user").strip().lower()
    if value not in USER_ROLES:
        raise HTTPException(
            400,
            "Роль должна быть user, expert, moderator, admin или intl_methodologist",
        )
    return value


def _active_admin_count(session, exclude_id: int | None = None) -> int:
    rows = session.query(User).filter(User.role == "admin").all()
    return sum(
        1
        for row in rows
        if is_user_active(row) and (exclude_id is None or row.id != exclude_id)
    )


@app.post("/token")
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    db = SessionLocal()
    try:
        user = user_if_password_ok(db, form_data.username, form_data.password)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Неверный email или пароль",
                headers={"WWW-Authenticate": "Bearer"},
            )
        if not is_email_confirmed(user):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=UNCONFIRMED_EMAIL_DETAIL)
        if not is_user_active(user):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Учётная запись отключена")
        access_token = create_access_token(data={"sub": user.email})
        return {"access_token": access_token, "token_type": "bearer", "role": user.role}
    finally:
        db.close()

@app.get("/users/me")
async def get_me(current_user: User = Depends(get_current_user)):
    return _serialize_user(current_user)


@app.patch("/users/me")
async def update_me(data: ProfileUpdate, current_user: User = Depends(get_current_user)):
    session = SessionLocal()
    try:
        user = session.query(User).filter(User.id == current_user.id).first()
        if not user:
            raise HTTPException(404, "Пользователь не найден")
        if data.last_name is not None:
            user.last_name = _normalize_person_field(data.last_name, required=True, label="фамилию")
        if data.first_name is not None:
            user.first_name = _normalize_person_field(data.first_name, required=True, label="имя")
        if data.middle_name is not None:
            user.middle_name = _normalize_person_field(data.middle_name, required=False, label="отчество")
        if data.organization is not None:
            user.organization = _normalize_person_field(data.organization, required=True, label="организацию")
        new_password = (data.new_password or "").strip()
        if new_password:
            current_password = (data.current_password or "").strip()
            if not current_password or not verify_password(current_password, user.hashed_password):
                raise HTTPException(400, "Неверный текущий пароль")
            if len(new_password) < 6:
                raise HTTPException(400, "Пароль должен быть не короче 6 символов")
            user.hashed_password = get_password_hash(new_password)
            user.password_reset_token = None
            user.password_reset_expires = None
        session.commit()
        session.refresh(user)
        return _serialize_user(user)
    except HTTPException:
        session.rollback()
        raise
    finally:
        session.close()


@app.get("/users")
async def list_users(current_user: User = Depends(get_current_admin)):
    session = SessionLocal()
    try:
        rows = session.query(User).order_by(User.id.asc()).all()
        return [_serialize_user(row) for row in rows]
    finally:
        session.close()


@app.get("/users/experts")
async def list_experts(current_user: User = Depends(get_current_moderator)):
    session = SessionLocal()
    try:
        rows = session.query(User).filter(func.lower(User.role) == "expert").order_by(User.id.asc()).all()
        return [_serialize_user(row) for row in rows if is_user_active(row)]
    finally:
        session.close()


def _serialize_user_directory(user: User) -> dict:
    return {
        "id": user.id,
        "email": user.email,
        "last_name": getattr(user, "last_name", None) or "",
        "first_name": getattr(user, "first_name", None) or "",
        "middle_name": getattr(user, "middle_name", None) or "",
        "organization": getattr(user, "organization", None) or "",
    }


def _user_fio_search_text(user: User) -> str:
    parts = [
        (getattr(user, "last_name", None) or "").strip(),
        (getattr(user, "first_name", None) or "").strip(),
        (getattr(user, "middle_name", None) or "").strip(),
    ]
    return " ".join(part for part in parts if part).lower()


@app.get("/users/search")
async def search_users(
    q: str = Query("", min_length=0),
    limit: int = Query(200, ge=1, le=500),
    current_user: User = Depends(get_current_user),
):
    tokens = [part for part in (q or "").strip().lower().split() if part]
    session = SessionLocal()
    try:
        rows = session.query(User).filter(User.id != current_user.id).all()
        matched = []
        for row in rows:
            if not is_user_active(row):
                continue
            fio = _user_fio_search_text(row)
            email = (row.email or "").lower()
            org = (getattr(row, "organization", None) or "").lower()
            haystack = f"{fio} {email} {org}".strip()
            if tokens and not all(token in haystack for token in tokens):
                continue
            matched.append(row)
        matched.sort(
            key=lambda row: (
                (getattr(row, "last_name", None) or "").lower(),
                (getattr(row, "first_name", None) or "").lower(),
                (getattr(row, "middle_name", None) or "").lower(),
                row.id,
            )
        )
        return {
            "total": len(matched),
            "items": [_serialize_user_directory(row) for row in matched[:limit]],
        }
    finally:
        session.close()


def _create_user_record(
    session,
    email: str,
    password: str,
    role: str,
    is_active: bool = True,
    email_confirmed: bool = False,
    last_name: str = "",
    first_name: str = "",
    middle_name: str = "",
    organization: str = "",
) -> User:
    email_n = _normalize_email(email)
    if not email_n or "@" not in email_n:
        raise HTTPException(400, "Укажите корректный email")
    if not password or len(password) < 6:
        raise HTTPException(400, "Пароль должен быть не короче 6 символов")
    role_n = _normalize_role(role)
    last_n = _normalize_person_field(last_name, required=True, label="фамилию")
    first_n = _normalize_person_field(first_name, required=True, label="имя")
    middle_n = _normalize_person_field(middle_name, required=False, label="отчество")
    org_n = _normalize_person_field(organization, required=True, label="организацию")
    existing = session.query(User).filter(func.lower(User.email) == email_n).first()
    if existing:
        raise HTTPException(400, "Пользователь с таким email уже есть")
    user = User(
        email=email_n,
        hashed_password=get_password_hash(password),
        role=role_n,
        is_active=is_active,
        email_confirmed=email_confirmed,
        last_name=last_n,
        first_name=first_n,
        middle_name=middle_n,
        organization=org_n,
    )
    session.add(user)
    session.flush()
    return user


def _send_invite_safe(email: str, password: str | None, confirm_url: str) -> None:
    try:
        send_invite_email(email, password, confirm_url)
    except Exception as exc:
        print(f"Invite email failed for {email}: {exc}")


def _send_reset_safe(email: str, reset_url: str) -> None:
    try:
        send_reset_password_email(email, reset_url)
    except Exception as exc:
        print(f"Reset email failed for {email}: {exc}")


def _send_collaboration_invite_safe(
    email: str,
    leader_name: str,
    competence_name: str,
    projects_url: str,
) -> None:
    try:
        send_collaboration_invite_email(email, leader_name, competence_name, projects_url)
    except Exception as exc:
        print(f"Collaboration invite email failed for {email}: {exc}")


def _queue_invite(
    background_tasks: BackgroundTasks,
    user: User,
    password: str | None,
    request: Request,
) -> None:
    raw_token = issue_confirm_token(user)
    confirm_url = confirmation_link(frontend_base_url(request), raw_token)
    background_tasks.add_task(_send_invite_safe, user.email, password, confirm_url)


@app.post("/users")
async def create_user(
    data: UserCreate,
    request: Request,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_admin),
):
    session = SessionLocal()
    try:
        password = (data.password or "").strip() or generate_user_password()
        user = _create_user_record(
            session,
            data.email,
            password,
            data.role,
            data.is_active,
            False,
            data.last_name,
            data.first_name,
            data.middle_name or "",
            data.organization,
        )
        _queue_invite(background_tasks, user, password, request)
        session.commit()
        session.refresh(user)
        return _serialize_user(user)
    except HTTPException:
        session.rollback()
        raise
    except Exception as exc:
        session.rollback()
        raise HTTPException(status_code=500, detail=str(exc) or "Не удалось создать пользователя")
    finally:
        session.close()


@app.post("/users/register")
async def register_user(
    request: Request,
    background_tasks: BackgroundTasks,
    email: str,
    password: str = "",
    role: str = "user",
    last_name: str = "",
    first_name: str = "",
    middle_name: str = "",
    organization: str = "",
    current_user: User = Depends(get_current_admin),
):
    session = SessionLocal()
    try:
        password = (password or "").strip() or generate_user_password()
        user = _create_user_record(
            session, email, password, role, True, False,
            last_name, first_name, middle_name, organization,
        )
        _queue_invite(background_tasks, user, password, request)
        session.commit()
        session.refresh(user)
        return {"message": "User created", "email": user.email, **_serialize_user(user)}
    except HTTPException:
        session.rollback()
        raise
    except Exception as exc:
        session.rollback()
        raise HTTPException(status_code=500, detail=str(exc) or "Не удалось создать пользователя")
    finally:
        session.close()


@app.post("/users/signup")
async def signup_user(data: UserSignup, request: Request, background_tasks: BackgroundTasks):
    session = SessionLocal()
    try:
        user = _create_user_record(
            session,
            data.email,
            data.password,
            "user",
            True,
            False,
            data.last_name,
            data.first_name,
            data.middle_name or "",
            data.organization,
        )
        _queue_invite(background_tasks, user, None, request)
        session.commit()
        return {
            "ok": True,
            "email": user.email,
            "message": "Письмо с ссылкой подтверждения отправлено на указанный email",
        }
    except HTTPException:
        session.rollback()
        raise
    except Exception as exc:
        session.rollback()
        raise HTTPException(status_code=500, detail=str(exc) or "Не удалось зарегистрироваться")
    finally:
        session.close()


@app.post("/users/forgot-password")
async def forgot_password(
    data: ForgotPasswordRequest,
    request: Request,
    background_tasks: BackgroundTasks,
):
    message = "Если такой email есть в системе, мы отправили письмо со ссылкой для сброса пароля."
    email_n = _normalize_email(data.email)
    session = SessionLocal()
    try:
        user = session.query(User).filter(func.lower(User.email) == email_n).first()
        if user and is_user_active(user) and is_email_confirmed(user):
            raw = issue_reset_token(user)
            reset_url = reset_password_link(frontend_base_url(request), raw)
            session.commit()
            background_tasks.add_task(_send_reset_safe, user.email, reset_url)
        return {"ok": True, "message": message}
    except HTTPException:
        session.rollback()
        raise
    except Exception as exc:
        session.rollback()
        raise HTTPException(status_code=500, detail=str(exc) or "Не удалось обработать запрос")
    finally:
        session.close()


@app.post("/users/reset-password")
async def reset_password(data: ResetPasswordRequest):
    raw = (data.token or "").strip()
    password = (data.password or "").strip()
    if not raw:
        raise HTTPException(400, "Нет токена сброса пароля")
    if len(password) < 6:
        raise HTTPException(400, "Пароль должен быть не короче 6 символов")
    token_hash = hash_confirm_token(raw)
    session = SessionLocal()
    try:
        user = session.query(User).filter(User.password_reset_token == token_hash).first()
        if not user:
            raise HTTPException(400, "Ссылка сброса пароля недействительна или уже использована")
        expires = getattr(user, "password_reset_expires", None)
        if expires and expires < datetime.datetime.utcnow():
            raise HTTPException(400, "Срок действия ссылки истёк. Запросите восстановление пароля ещё раз")
        user.hashed_password = get_password_hash(password)
        user.password_reset_token = None
        user.password_reset_expires = None
        session.commit()
        return {"ok": True, "message": "Пароль изменён. Можно войти в систему."}
    except HTTPException:
        session.rollback()
        raise
    finally:
        session.close()


@app.api_route("/users/confirm-email", methods=["GET", "POST"])
async def confirm_email(token: str = Query(...)):
    raw = (token or "").strip()
    if not raw:
        raise HTTPException(400, "Нет токена подтверждения")
    token_hash = hash_confirm_token(raw)
    session = SessionLocal()
    try:
        user = session.query(User).filter(User.email_confirm_token == token_hash).first()
        if not user:
            raise HTTPException(400, "Ссылка подтверждения недействительна или уже использована")
        expires = getattr(user, "email_confirm_expires", None)
        if expires and expires < datetime.datetime.utcnow():
            raise HTTPException(400, "Срок действия ссылки истёк. Попросите администратора отправить письмо ещё раз")
        user.email_confirmed = True
        user.email_confirm_token = None
        user.email_confirm_expires = None
        session.commit()
        return {"ok": True, "email": user.email, "message": "Email подтверждён. Можно войти в систему."}
    except HTTPException:
        session.rollback()
        raise
    finally:
        session.close()


@app.post("/users/{user_id}/resend-invite")
async def resend_invite(
    user_id: int,
    request: Request,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_admin),
):
    session = SessionLocal()
    try:
        user = session.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(404, "Пользователь не найден")
        if is_email_confirmed(user):
            raise HTTPException(400, "Email уже подтверждён")
        _queue_invite(background_tasks, user, None, request)
        session.commit()
        return _serialize_user(user)
    except HTTPException:
        session.rollback()
        raise
    finally:
        session.close()


@app.patch("/users/{user_id}")
async def update_user(user_id: int, data: UserUpdate, current_user: User = Depends(get_current_admin)):
    session = SessionLocal()
    try:
        user = session.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(404, "Пользователь не найден")

        next_role = _normalize_role(data.role) if data.role is not None else (user.role or "user")
        next_active = is_user_active(user) if data.is_active is None else bool(data.is_active)

        losing_admin = (user.role or "") == "admin" and is_user_active(user) and (
            next_role != "admin" or not next_active
        )
        if losing_admin and _active_admin_count(session, exclude_id=user.id) < 1:
            raise HTTPException(400, "Нельзя снять или отключить последнего администратора")

        if data.role is not None:
            user.role = next_role
        if data.is_active is not None:
            user.is_active = next_active
        if data.password is not None:
            if len(data.password) < 6:
                raise HTTPException(400, "Пароль должен быть не короче 6 символов")
            user.hashed_password = get_password_hash(data.password)
        if data.last_name is not None:
            user.last_name = _normalize_person_field(data.last_name, required=True, label="фамилию")
        if data.first_name is not None:
            user.first_name = _normalize_person_field(data.first_name, required=True, label="имя")
        if data.middle_name is not None:
            user.middle_name = _normalize_person_field(data.middle_name, required=False, label="отчество")
        if data.organization is not None:
            user.organization = _normalize_person_field(data.organization, required=True, label="организацию")

        session.commit()
        session.refresh(user)
        return _serialize_user(user)
    except HTTPException:
        session.rollback()
        raise
    finally:
        session.close()


@app.post("/users/{user_id}/impersonate")
async def impersonate_user(
    user_id: int,
    token: str = Depends(oauth2_scheme),
    current_user: User = Depends(get_current_admin),
):
    if get_token_claim(token, "imp"):
        raise HTTPException(403, "Уже выполнен вход от имени другого пользователя")
    if current_user.id == user_id:
        raise HTTPException(400, "Нельзя войти от своего имени")

    session = SessionLocal()
    try:
        target = session.query(User).filter(User.id == user_id).first()
        if not target:
            raise HTTPException(404, "Пользователь не найден")
        if not is_user_active(target):
            raise HTTPException(400, "Пользователь отключён")
        access_token = create_access_token(
            data={"sub": target.email, "imp": current_user.email}
        )
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "role": target.role or "user",
            "email": target.email,
            "impersonator": current_user.email,
        }
    finally:
        session.close()


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

        source_zu_map: dict[str, dict[str, list[str]]] | None = None

        def source_zu_for_tf(code: str) -> tuple[list[str], list[str]]:
            nonlocal source_zu_map
            if source_zu_map is None:
                source_zu_map = {}
                source_html = getattr(std, "source_html", None) or ""
                if source_html.strip():
                    try:
                        from .classinform_parser import tf_zu_from_html
                        source_zu_map.update(tf_zu_from_html(source_html))
                    except Exception:
                        pass
                source_xml = getattr(std, "source_xml", None) or ""
                if source_xml.strip():
                    try:
                        for key, payload in tf_zu_from_xml(source_xml).items():
                            existing = source_zu_map.get(key) or {}
                            if not (existing.get("knowledges") or existing.get("skills")):
                                source_zu_map[key] = payload
                    except Exception:
                        pass
            found = source_zu_map.get(code) or {}
            return list(found.get("knowledges") or []), list(found.get("skills") or [])

        result = []
        for gf in std.generalized_functions:
            gf_okz = [
                str(c).strip()
                for c in (getattr(gf, "okz_codes", None) or [])
                if str(c or "").strip()
            ]
            for pf in gf.particular_functions:
                tf_code = compact_tf_code(pf.code)
                pf_knowledges = [k.text for k in (pf.knowledges or []) if k.text]
                pf_skills = [s.text for s in (pf.skills or []) if s.text]
                if not pf_knowledges or not pf_skills:
                    src_k, src_s = source_zu_for_tf(tf_code)
                    if not pf_knowledges:
                        pf_knowledges = src_k
                    if not pf_skills:
                        pf_skills = src_s

                labor_actions_detail: list[dict[str, Any]] = []
                enriched_pf = enriched_pf_map.get(pf.code) or enriched_pf_map.get(tf_code)
                # Enriched ТД без З/У нельзя брать как единственный источник:
                # enrichment часто создаёт пустые действия и перекрывает списки ТФ.
                if enriched_pf and enriched_pf.labor_actions:
                    for la in enriched_pf.labor_actions:
                        labor_actions_detail.append({
                            "text": la.text or "",
                            "knowledges": [k.text for k in (la.knowledges or []) if k.text],
                            "skills": [s.text for s in (la.skills or []) if s.text],
                        })
                if not labor_actions_detail:
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
                elif (pf_knowledges or pf_skills) and not any(
                    item["knowledges"] or item["skills"] for item in labor_actions_detail
                ):
                    for item in labor_actions_detail:
                        item["knowledges"] = pf_knowledges
                        item["skills"] = pf_skills

                result.append({
                    "id": pf.id,
                    "code": tf_code,
                    "name": pf.name,
                    "otf_code": compact_otf_code(gf.code, tf_code),
                    "otf_name": gf.name,
                    "otf_level": tf_qualification_level(
                        gf.level, getattr(pf, "sub_qualification", None), tf_code
                    ),
                    "standard_id": std.id,
                    "standard_reg_number": std.reg_number,
                    "standard_name": std.name,
                    "okz_codes": gf_okz,
                    "labor_actions": labor_actions_detail,
                    "knowledges": pf_knowledges,
                    "skills": pf_skills,
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
    compact = normalize_okso_code(text)
    if compact and not compact.startswith("2."):
        needles.add(f"2.{compact}")
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

        # Коды ОКСО часто остаются только в XML/HTML (2.20.03.01), а в JSON
        # поле пустое — после нормализации gf.code до буквы ОТФ LIKE по code их больше не находит.
        source_filters = []
        for needle in needles:
            pattern = f"%{needle}%"
            source_filters.append(StandardRaw.source_html.like(pattern))
            source_filters.append(StandardRaw.source_xml.like(pattern))
        if source_filters:
            for (standard_id,) in (
                session.query(StandardRaw.id).filter(or_(*source_filters)).all()
            ):
                add_match(standard_id, [fgos_code])

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


@app.post("/standards/repair-tf-levels")
async def repair_tf_levels_endpoint(current_user: User = Depends(get_current_admin)):
    """Normalize OTF/TF codes and fill missing 148н levels from TF codes / HTML leftovers."""
    from .repair_tf_levels import repair_tf_levels

    session = SessionLocal()
    try:
        return repair_tf_levels(session)
    finally:
        session.close()


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


@app.get("/esco/status")
async def get_esco_status(current_user: User = Depends(get_current_user)):
    session = SessionLocal()
    try:
        return esco_status(session)
    finally:
        session.close()


@app.get("/esco/occupations")
async def get_esco_occupations(
    q: str = "",
    isco: str = "",
    limit: int = 20,
    current_user: User = Depends(get_current_user),
):
    session = SessionLocal()
    try:
        return search_occupations(session, q=q, isco=isco, limit=limit)
    except Exception as exc:
        raise HTTPException(502, f"Не удалось получить занятия ESCO: {exc}") from exc
    finally:
        session.close()


@app.get("/esco/skills")
async def get_esco_skills(
    q: str = "",
    occupation_uri: str = "",
    limit: int = 20,
    current_user: User = Depends(get_current_user),
):
    session = SessionLocal()
    try:
        return search_skills(session, q=q, occupation_uri=occupation_uri, limit=limit)
    except Exception as exc:
        raise HTTPException(502, f"Не удалось получить навыки ESCO: {exc}") from exc
    finally:
        session.close()


@app.get("/esco/occupations/skills")
async def get_esco_occupation_skills(
    uri: str,
    q: str = "",
    limit: int = 40,
    current_user: User = Depends(get_current_user),
):
    if not (uri or "").strip():
        raise HTTPException(400, "Укажите URI занятия ESCO")
    session = SessionLocal()
    try:
        return occupation_skills(session, uri, q=q, limit=limit)
    except Exception as exc:
        raise HTTPException(502, f"Не удалось получить навыки занятия ESCO: {exc}") from exc
    finally:
        session.close()


@app.get("/harmonize/brics/countries")
async def get_harmoni_brics_countries(current_user: User = Depends(get_current_user)):
    return {"countries": harmoni_brics_countries(), "ai_agent": deepseek_status()}


@app.get("/harmonize/brics/status")
async def get_harmoni_brics_status(current_user: User = Depends(get_current_user)):
    return deepseek_status()


@app.post("/harmonize/brics/suggest")
async def post_harmoni_brics_suggest(
    data: HarmoniBricsSuggestRequest,
    current_user: User = Depends(get_current_user),
):
    try:
        return harmoni_brics_suggest(data.model_dump())
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    except Exception as exc:
        raise HTTPException(502, f"Не удалось получить черновик Harmoni-BRICS: {exc}") from exc


@app.get("/harmonize/garm-esco/status")
async def get_garm_esco_status(current_user: User = Depends(get_current_user)):
    return deepseek_status()


@app.post("/harmonize/garm-esco/suggest")
async def post_garm_esco_suggest(
    data: GarmEscoSuggestRequest,
    current_user: User = Depends(get_current_user),
):
    session = SessionLocal()
    try:
        return suggest_garm_esco(session, data.model_dump())
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    except Exception as exc:
        raise HTTPException(502, f"Не удалось получить черновик ГАРМ-ESCO: {exc}") from exc
    finally:
        session.close()


class HarmonizationVersionCreate(BaseModel):
    title: str = "Новая версия"
    notes: str = ""
    clone_from_id: Optional[int] = None


class HarmonizationVersionPatch(BaseModel):
    title: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None
    ready_for_apply: Optional[bool] = None


class HarmonizationStepPut(BaseModel):
    payload: Dict[str, Any]


class PassportHarmonizationPut(BaseModel):
    version_id: Optional[int] = None
    step3_payload: Optional[Dict[str, Any]] = None
    step6_payload: Optional[Dict[str, Any]] = None


class PassportStepAiRequest(BaseModel):
    version_id: Optional[int] = None
    purpose: Optional[str] = None
    purposes: Optional[List[str]] = None
    depth: Optional[str] = None
    target_systems: Optional[List[str]] = None


class PassportApplyBridgeRequest(BaseModel):
    version_id: Optional[int] = None
    target_systems: Optional[List[str]] = None


def _passport_bridge_bundle(session, comp: Competence, version: HarmonizationVersion) -> dict:
    raw = comp.raw_data or {}
    bridge = build_bridge_context_for_passport(
        version,
        qualification_level=comp.qualification_level,
        education_kind=str(raw.get("education_kind") or ""),
        education_level=str(raw.get("education_level") or ""),
    )
    return {
        "bridge_context": bridge,
        "esco": esco_status(session),
    }


def _get_harmonization_version(session, version_id: int) -> HarmonizationVersion:
    version = session.query(HarmonizationVersion).filter(HarmonizationVersion.id == version_id).first()
    if not version:
        raise HTTPException(404, "Версия не найдена")
    ensure_version_steps(session, version)
    return version


def _clear_ready_for_apply(session, *, except_id: int | None = None) -> None:
    rows = session.query(HarmonizationVersion).filter(HarmonizationVersion.ready_for_apply.is_(True)).all()
    for row in rows:
        if except_id is not None and row.id == except_id:
            continue
        row.ready_for_apply = False


@app.get("/harmonization/status")
async def get_harmonization_status(current_user: User = Depends(get_current_intl_methodologist)):
    return {"ai_agent": ai_agent_status()}


@app.get("/harmonization/versions")
async def list_harmonization_versions(current_user: User = Depends(get_current_intl_methodologist)):
    session = SessionLocal()
    try:
        rows = (
            session.query(HarmonizationVersion)
            .order_by(HarmonizationVersion.ready_for_apply.desc(), HarmonizationVersion.updated_at.desc())
            .all()
        )
        for row in rows:
            ensure_version_steps(session, row)
        session.commit()
        return [serialize_version(row, include_steps=False) for row in rows]
    finally:
        session.close()


@app.post("/harmonization/versions")
async def create_harmonization_version(
    data: HarmonizationVersionCreate,
    current_user: User = Depends(get_current_intl_methodologist),
):
    session = SessionLocal()
    try:
        title = (data.title or "").strip() or "Новая версия"
        version = HarmonizationVersion(
            title=title,
            notes=(data.notes or "").strip(),
            status="draft",
            ready_for_apply=False,
            created_by_id=current_user.id,
            updated_by_id=current_user.id,
        )
        session.add(version)
        session.flush()
        if data.clone_from_id:
            source = _get_harmonization_version(session, int(data.clone_from_id))
            ensure_version_steps(session, source)
            for src_step in source.steps:
                session.add(
                    HarmonizationStepState(
                        version_id=version.id,
                        step=int(src_step.step),
                        status="edited" if src_step.status == "verified" else (src_step.status or "empty"),
                        payload=dict(src_step.payload or empty_step_payload(int(src_step.step))),
                        ai_meta={},
                    )
                )
        else:
            ensure_version_steps(session, version)
        session.commit()
        session.refresh(version)
        ensure_version_steps(session, version)
        return serialize_version(version)
    except HTTPException:
        session.rollback()
        raise
    except Exception as exc:
        session.rollback()
        raise HTTPException(400, str(exc)) from exc
    finally:
        session.close()


@app.get("/harmonization/versions/{version_id}")
async def get_harmonization_version(
    version_id: int,
    current_user: User = Depends(get_current_intl_methodologist),
):
    session = SessionLocal()
    try:
        version = _get_harmonization_version(session, version_id)
        session.commit()
        return serialize_version(version)
    finally:
        session.close()


@app.patch("/harmonization/versions/{version_id}")
async def patch_harmonization_version(
    version_id: int,
    data: HarmonizationVersionPatch,
    current_user: User = Depends(get_current_intl_methodologist),
):
    session = SessionLocal()
    try:
        version = _get_harmonization_version(session, version_id)
        if data.title is not None:
            version.title = (data.title or "").strip() or version.title
        if data.notes is not None:
            version.notes = data.notes or ""
        if data.status is not None:
            status = (data.status or "").strip().lower()
            if status not in VERSION_STATUSES:
                raise HTTPException(400, "Недопустимый статус версии")
            version.status = status
        if data.ready_for_apply is not None:
            if data.ready_for_apply:
                _clear_ready_for_apply(session, except_id=version.id)
                version.ready_for_apply = True
            else:
                version.ready_for_apply = False
        version.updated_by_id = current_user.id
        version.updated_at = datetime.datetime.utcnow()
        session.commit()
        session.refresh(version)
        return serialize_version(version)
    except HTTPException:
        session.rollback()
        raise
    finally:
        session.close()


@app.put("/harmonization/versions/{version_id}/steps/{step}")
async def put_harmonization_step(
    version_id: int,
    step: int,
    data: HarmonizationStepPut,
    current_user: User = Depends(get_current_intl_methodologist),
):
    if step not in GLOBAL_STEPS:
        raise HTTPException(400, "Шаг должен быть 1, 2, 4 или 5")
    session = SessionLocal()
    try:
        version = _get_harmonization_version(session, version_id)
        row = next((s for s in version.steps if int(s.step) == step), None)
        if not row:
            row = HarmonizationStepState(version_id=version.id, step=step, payload={})
            session.add(row)
        row.payload = data.payload or empty_step_payload(step)
        # Шаг 1 изменился — синхронизируем системы на шагах 2 и 5.
        if step == 1:
            regs = (row.payload or {}).get("registries") if isinstance(row.payload, dict) else []
            for dep_step, sync_fn in (
                (2, sync_bridges_payload_with_systems),
                (5, sync_component_rules_payload_with_systems),
            ):
                dep = next((s for s in version.steps if int(s.step) == dep_step), None)
                if dep is None:
                    continue
                dep.payload = sync_fn(
                    dep.payload if isinstance(dep.payload, dict) else {},
                    regs,
                )
                if dep.status == "verified":
                    dep.status = "edited"
                    dep.verified_by_id = None
                    dep.verified_at = None
                dep.updated_at = datetime.datetime.utcnow()
        if step == 2:
            step1 = next((s for s in version.steps if int(s.step) == 1), None)
            regs = []
            if step1 and isinstance(step1.payload, dict):
                regs = step1.payload.get("registries") or []
            row.payload = sync_bridges_payload_with_systems(
                row.payload if isinstance(row.payload, dict) else {},
                regs,
            )
        if step == 5:
            step1 = next((s for s in version.steps if int(s.step) == 1), None)
            regs = []
            if step1 and isinstance(step1.payload, dict):
                regs = step1.payload.get("registries") or []
            row.payload = sync_component_rules_payload_with_systems(
                row.payload if isinstance(row.payload, dict) else {},
                regs,
            )
        row.status = "edited"
        row.verified_by_id = None
        row.verified_at = None
        row.updated_at = datetime.datetime.utcnow()
        version.updated_by_id = current_user.id
        version.updated_at = datetime.datetime.utcnow()
        session.commit()
        session.refresh(row)
        return serialize_step(row)
    except HTTPException:
        session.rollback()
        raise
    finally:
        session.close()


@app.post("/harmonization/versions/{version_id}/steps/{step}/ai-draft")
async def ai_draft_harmonization_step(
    version_id: int,
    step: int,
    current_user: User = Depends(get_current_intl_methodologist),
):
    if step not in GLOBAL_STEPS:
        raise HTTPException(400, "Шаг должен быть 1, 2, 4 или 5")
    session = SessionLocal()
    try:
        version = _get_harmonization_version(session, version_id)
        row = next((s for s in version.steps if int(s.step) == step), None)
        if not row:
            row = HarmonizationStepState(version_id=version.id, step=step, payload={})
            session.add(row)
            session.flush()
        draft_context: dict = {"version_title": version.title}
        if step == 1:
            prev = row.payload if isinstance(row.payload, dict) else {}
            draft_context["existing_registries"] = prev.get("registries") or []
        if step in (2, 5):
            step1 = next((s for s in version.steps if int(s.step) == 1), None)
            regs = []
            if step1 and isinstance(step1.payload, dict):
                regs = step1.payload.get("registries") or []
            draft_context["registries"] = regs
            draft_context["existing_registries"] = regs
        payload, ai_meta = generate_ai_draft(step, context=draft_context)
        row.payload = payload
        row.ai_meta = ai_meta
        row.status = "ai_draft"
        row.verified_by_id = None
        row.verified_at = None
        row.updated_at = datetime.datetime.utcnow()
        if step == 1:
            regs = (payload or {}).get("registries") if isinstance(payload, dict) else []
            for dep_step, sync_fn in (
                (2, sync_bridges_payload_with_systems),
                (5, sync_component_rules_payload_with_systems),
            ):
                dep = next((s for s in version.steps if int(s.step) == dep_step), None)
                if dep is None:
                    continue
                dep.payload = sync_fn(
                    dep.payload if isinstance(dep.payload, dict) else {},
                    regs,
                )
                if dep.status == "verified":
                    dep.status = "edited"
                    dep.verified_by_id = None
                    dep.verified_at = None
                dep.updated_at = datetime.datetime.utcnow()
        version.updated_by_id = current_user.id
        version.updated_at = datetime.datetime.utcnow()
        session.commit()
        session.refresh(row)
        return serialize_step(row)
    except HTTPException:
        session.rollback()
        raise
    finally:
        session.close()


@app.post("/harmonization/versions/{version_id}/steps/{step}/verify")
async def verify_harmonization_step(
    version_id: int,
    step: int,
    current_user: User = Depends(get_current_intl_methodologist),
):
    if step not in GLOBAL_STEPS:
        raise HTTPException(400, "Шаг должен быть 1, 2, 4 или 5")
    session = SessionLocal()
    try:
        version = _get_harmonization_version(session, version_id)
        row = next((s for s in version.steps if int(s.step) == step), None)
        if not row:
            raise HTTPException(400, "Сначала заполните шаг")
        row.status = "verified"
        row.verified_by_id = current_user.id
        row.verified_at = datetime.datetime.utcnow()
        row.updated_at = datetime.datetime.utcnow()
        version.updated_by_id = current_user.id
        version.updated_at = datetime.datetime.utcnow()
        session.commit()
        session.refresh(row)
        return serialize_step(row)
    except HTTPException:
        session.rollback()
        raise
    finally:
        session.close()


def _competence_context_for_ai(comp: Competence) -> dict:
    raw = comp.raw_data or {}
    return {
        "title": comp.name,
        "competence_kind": (raw.get("formation_profile") or {}).get("competence_kind") or "professional",
        "qualification_level": comp.qualification_level,
        "labor_functions": comp.labor_functions or [],
        "structure": comp.structure or {},
        "education_level": raw.get("education_level") or "",
        "education_kind": raw.get("education_kind") or "",
    }


def _resolve_passport_version(session, version_id: int | None) -> HarmonizationVersion:
    if version_id:
        return _get_harmonization_version(session, int(version_id))
    ready = (
        session.query(HarmonizationVersion)
        .filter(HarmonizationVersion.ready_for_apply.is_(True))
        .order_by(HarmonizationVersion.updated_at.desc())
        .first()
    )
    if ready:
        ensure_version_steps(session, ready)
        return ready
    latest = session.query(HarmonizationVersion).order_by(HarmonizationVersion.updated_at.desc()).first()
    if not latest:
        raise HTTPException(400, "Сначала создайте версию международных мостов")
    ensure_version_steps(session, latest)
    return latest


@app.get("/competences/{comp_id}/harmonization")
async def get_passport_harmonization(
    comp_id: int,
    version_id: Optional[int] = None,
    current_user: User = Depends(get_current_intl_methodologist),
):
    session = SessionLocal()
    try:
        comp = session.query(Competence).filter(Competence.id == comp_id).first()
        if not comp:
            raise HTTPException(404, "Компетенция не найдена")
        version = _resolve_passport_version(session, version_id)
        row = (
            session.query(PassportHarmonization)
            .filter(
                PassportHarmonization.competence_id == comp_id,
                PassportHarmonization.version_id == version.id,
            )
            .first()
        )
        if not row:
            row = PassportHarmonization(
                competence_id=comp_id,
                version_id=version.id,
                step3_payload=empty_step_payload(3),
                step6_payload=empty_step_payload(6),
                updated_by_id=current_user.id,
            )
            session.add(row)
            session.commit()
            session.refresh(row)
        return {
            **serialize_passport(row),
            "version": serialize_version(version, include_steps=False),
            "ai_agent": ai_agent_status(),
            **_passport_bridge_bundle(session, comp, version),
        }
    finally:
        session.close()


@app.put("/competences/{comp_id}/harmonization")
async def put_passport_harmonization(
    comp_id: int,
    data: PassportHarmonizationPut,
    current_user: User = Depends(get_current_intl_methodologist),
):
    session = SessionLocal()
    try:
        comp = session.query(Competence).filter(Competence.id == comp_id).first()
        if not comp:
            raise HTTPException(404, "Компетенция не найдена")
        version = _resolve_passport_version(session, data.version_id)
        row = (
            session.query(PassportHarmonization)
            .filter(
                PassportHarmonization.competence_id == comp_id,
                PassportHarmonization.version_id == version.id,
            )
            .first()
        )
        if not row:
            row = PassportHarmonization(
                competence_id=comp_id,
                version_id=version.id,
                step3_payload=empty_step_payload(3),
                step6_payload=empty_step_payload(6),
            )
            session.add(row)
            session.flush()
        if data.step3_payload is not None:
            row.step3_payload = data.step3_payload
            row.step3_status = "edited"
            row.step3_verified_by_id = None
            row.step3_verified_at = None
        if data.step6_payload is not None:
            row.step6_payload = data.step6_payload
            row.step6_status = "edited"
            row.step6_verified_by_id = None
            row.step6_verified_at = None
        row.updated_by_id = current_user.id
        row.updated_at = datetime.datetime.utcnow()
        session.commit()
        session.refresh(row)
        return {
            **serialize_passport(row),
            "version": serialize_version(version, include_steps=False),
            "ai_agent": ai_agent_status(),
            **_passport_bridge_bundle(session, comp, version),
        }
    except HTTPException:
        session.rollback()
        raise
    finally:
        session.close()


@app.post("/competences/{comp_id}/harmonization/apply-bridge")
async def apply_passport_bridge(
    comp_id: int,
    data: PassportApplyBridgeRequest = PassportApplyBridgeRequest(),
    current_user: User = Depends(get_current_intl_methodologist),
):
    """Встраивает снимок моста 1/2/4/5 в шаг 6 паспорта (шаги 9 и 9.1 не затрагиваются)."""
    session = SessionLocal()
    try:
        comp = session.query(Competence).filter(Competence.id == comp_id).first()
        if not comp:
            raise HTTPException(404, "Компетенция не найдена")
        version = _resolve_passport_version(session, data.version_id)
        row = (
            session.query(PassportHarmonization)
            .filter(
                PassportHarmonization.competence_id == comp_id,
                PassportHarmonization.version_id == version.id,
            )
            .first()
        )
        if not row:
            row = PassportHarmonization(
                competence_id=comp_id,
                version_id=version.id,
                step3_payload=empty_step_payload(3),
                step6_payload=empty_step_payload(6),
            )
            session.add(row)
            session.flush()
        bundle = _passport_bridge_bundle(session, comp, version)
        bridge = bundle["bridge_context"]
        available = bridge.get("systems") if isinstance(bridge.get("systems"), list) else []
        codes = (
            normalize_target_system_codes(data.target_systems, available)
            if data.target_systems is not None
            else None
        )
        row.step6_payload = apply_bridge_snapshot_to_step6(
            row.step6_payload if isinstance(row.step6_payload, dict) else {},
            bridge,
            target_systems=codes,
        )
        row.step6_status = "edited"
        row.step6_verified_by_id = None
        row.step6_verified_at = None
        row.updated_by_id = current_user.id
        row.updated_at = datetime.datetime.utcnow()
        session.commit()
        session.refresh(row)
        return {
            **serialize_passport(row),
            "version": serialize_version(version, include_steps=False),
            "ai_agent": ai_agent_status(),
            **bundle,
        }
    except HTTPException:
        session.rollback()
        raise
    finally:
        session.close()


@app.post("/competences/{comp_id}/harmonization/steps/{step}/ai-draft")
async def ai_draft_passport_harmonization_step(
    comp_id: int,
    step: int,
    data: PassportStepAiRequest = PassportStepAiRequest(),
    current_user: User = Depends(get_current_intl_methodologist),
):
    if step not in PASSPORT_STEPS:
        raise HTTPException(400, "Шаг должен быть 3 или 6")
    session = SessionLocal()
    try:
        comp = session.query(Competence).filter(Competence.id == comp_id).first()
        if not comp:
            raise HTTPException(404, "Компетенция не найдена")
        version = _resolve_passport_version(session, data.version_id)
        row = (
            session.query(PassportHarmonization)
            .filter(
                PassportHarmonization.competence_id == comp_id,
                PassportHarmonization.version_id == version.id,
            )
            .first()
        )
        if not row:
            row = PassportHarmonization(
                competence_id=comp_id,
                version_id=version.id,
                step3_payload=empty_step_payload(3),
                step6_payload=empty_step_payload(6),
            )
            session.add(row)
            session.flush()
        ctx = _competence_context_for_ai(comp)
        step6_payload = row.step6_payload if isinstance(row.step6_payload, dict) else {}
        if data.purposes is not None:
            ctx["purposes"] = normalize_purposes(data.purposes)
        elif isinstance(step6_payload.get("purposes"), list):
            ctx["purposes"] = normalize_purposes(step6_payload.get("purposes"))
        elif data.purpose:
            ctx["purposes"] = normalize_purposes([data.purpose])
        elif step6_payload.get("purpose"):
            ctx["purposes"] = normalize_purposes([step6_payload.get("purpose")])
        else:
            ctx["purposes"] = []
        ctx["purpose"] = ctx["purposes"][0] if ctx["purposes"] else ""
        if data.depth:
            ctx["depth"] = data.depth
        elif step6_payload.get("depth"):
            ctx["depth"] = step6_payload.get("depth")
        bridge_bundle = _passport_bridge_bundle(session, comp, version)
        available = (
            bridge_bundle["bridge_context"].get("systems")
            if isinstance(bridge_bundle["bridge_context"].get("systems"), list)
            else []
        )
        if data.target_systems is not None:
            ctx["target_systems"] = normalize_target_system_codes(data.target_systems, available)
        else:
            ctx["target_systems"] = normalize_target_system_codes(
                step6_payload.get("target_systems"), available
            )
        ctx["bridge_context"] = filter_bridge_context_by_systems(
            bridge_bundle["bridge_context"],
            ctx["target_systems"],
        )
        if step == 3:
            payload, ai_meta = generate_step3_ai_draft(session, context=ctx)
            row.step3_payload = payload
            row.step3_ai_meta = ai_meta
            row.step3_status = "ai_draft"
            row.step3_verified_by_id = None
            row.step3_verified_at = None
        else:
            payload, ai_meta = generate_ai_draft(step, context=ctx)
            # Сохраняем снимок моста и выбор систем/целей
            if isinstance(step6_payload, dict):
                for key in ("bridge_snapshot", "bridge_applied_at", "target_systems"):
                    if key in step6_payload and key not in payload:
                        payload[key] = step6_payload[key]
            if ctx.get("target_systems") is not None:
                payload["target_systems"] = ctx["target_systems"]
            payload["purposes"] = ctx.get("purposes") or []
            payload["purpose"] = payload["purposes"][0] if payload["purposes"] else ""
            row.step6_payload = payload
            row.step6_ai_meta = ai_meta
            row.step6_status = "ai_draft"
            row.step6_verified_by_id = None
            row.step6_verified_at = None
        row.updated_by_id = current_user.id
        row.updated_at = datetime.datetime.utcnow()
        session.commit()
        session.refresh(row)
        return {
            **serialize_passport(row),
            "version": serialize_version(version, include_steps=False),
            "ai_agent": ai_agent_status(),
            **bridge_bundle,
        }
    except HTTPException:
        session.rollback()
        raise
    finally:
        session.close()


@app.post("/competences/{comp_id}/harmonization/steps/{step}/verify")
async def verify_passport_harmonization_step(
    comp_id: int,
    step: int,
    data: PassportStepAiRequest = PassportStepAiRequest(),
    current_user: User = Depends(get_current_intl_methodologist),
):
    if step not in PASSPORT_STEPS:
        raise HTTPException(400, "Шаг должен быть 3 или 6")
    session = SessionLocal()
    try:
        comp = session.query(Competence).filter(Competence.id == comp_id).first()
        if not comp:
            raise HTTPException(404, "Компетенция не найдена")
        version = _resolve_passport_version(session, data.version_id)
        row = (
            session.query(PassportHarmonization)
            .filter(
                PassportHarmonization.competence_id == comp_id,
                PassportHarmonization.version_id == version.id,
            )
            .first()
        )
        if not row:
            raise HTTPException(400, "Сначала заполните сопоставление паспорта")
        now = datetime.datetime.utcnow()
        if step == 3:
            row.step3_status = "verified"
            row.step3_verified_by_id = current_user.id
            row.step3_verified_at = now
        else:
            row.step6_status = "verified"
            row.step6_verified_by_id = current_user.id
            row.step6_verified_at = now
        row.updated_by_id = current_user.id
        row.updated_at = now
        session.commit()
        session.refresh(row)
        return {
            **serialize_passport(row),
            "version": serialize_version(version, include_steps=False),
            "ai_agent": ai_agent_status(),
            **_passport_bridge_bundle(session, comp, version),
        }
    except HTTPException:
        session.rollback()
        raise
    finally:
        session.close()


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
    current_user = Depends(get_current_user_or_api_key),
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


@app.get("/fgos/public/search")
async def search_fgos_public(
    q: str = "",
    categories: Optional[str] = None,
    limit: int = 40,
):
    """Публичный поиск ФГОС для сервиса учебных планов (без JWT)."""
    return await search_fgos(q=q, categories=categories, limit=limit, current_user=None)  # type: ignore[arg-type]


@app.get("/fgos/public/{item_id}")
async def get_fgos_public(item_id: int):
    session = SessionLocal()
    try:
        item = session.query(FgosSpo).filter(FgosSpo.id == item_id).first()
        if not item:
            raise HTTPException(status_code=404, detail="ФГОС не найден")
        return serialize_fgos(item, detailed=True)
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
    professional_area_code: str = "",
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
        professional_area_code=professional_area_code,
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


def _ensure_competence_public_code_column() -> None:
    ensure_competence_public_code_column()
    session = None
    try:
        session = SessionLocal()
        rows = session.query(Competence).filter((Competence.public_code.is_(None)) | (Competence.public_code == "")).all()
        for comp in rows:
            if comp.id:
                comp.public_code = f"RUS-PK-{int(comp.id):04d}"
        session.commit()
    except Exception as exc:
        print(f"public_code backfill skipped: {exc}")
    finally:
        if session is not None:
            session.close()


def _reviewers_map(session, competence_ids: list[int]) -> dict[int, list]:
    if not competence_ids:
        return {}
    rows = (
        session.query(CompetenceReviewer, User)
        .join(User, User.id == CompetenceReviewer.user_id)
        .filter(CompetenceReviewer.competence_id.in_(competence_ids))
        .order_by(CompetenceReviewer.assigned_at.asc())
        .all()
    )
    grouped: dict[int, list] = {}
    for link, user in rows:
        grouped.setdefault(link.competence_id, []).append(_serialize_user(user))
    return grouped


def _assigned_competence_ids(session, user_id: int) -> list[int]:
    return [
        row[0]
        for row in session.query(CompetenceReviewer.competence_id)
        .filter(CompetenceReviewer.user_id == user_id)
        .all()
    ]


def _is_assigned_reviewer(session, competence_id: int, user_id: int) -> bool:
    return (
        session.query(CompetenceReviewer)
        .filter(
            CompetenceReviewer.competence_id == competence_id,
            CompetenceReviewer.user_id == user_id,
        )
        .first()
        is not None
    )


def _collaborator_link(session, competence_id: int, user_id: int) -> CompetenceCollaborator | None:
    return (
        session.query(CompetenceCollaborator)
        .filter(
            CompetenceCollaborator.competence_id == competence_id,
            CompetenceCollaborator.user_id == user_id,
        )
        .first()
    )


_GROUP_MEMBER_STATUSES = (COLLABORATOR_ACCEPTED, COLLABORATOR_PENDING)


def _accepted_collaborator_ids(session, user_id: int) -> list[int]:
    return [
        row[0]
        for row in session.query(CompetenceCollaborator.competence_id)
        .filter(
            CompetenceCollaborator.user_id == user_id,
            CompetenceCollaborator.status.in_(_GROUP_MEMBER_STATUSES),
        )
        .all()
    ]


def _is_group_leader(comp: Competence, user) -> bool:
    return bool(comp.user_id and getattr(user, "id", None) == comp.user_id)


def _is_accepted_collaborator(session, competence_id: int, user_id: int) -> bool:
    if not user_id:
        return False
    link = _collaborator_link(session, competence_id, user_id)
    return bool(link and link.status in _GROUP_MEMBER_STATUSES)


def _user_display_name(user: User | None) -> str:
    if not user:
        return ""
    parts = [
        (getattr(user, "last_name", None) or "").strip(),
        (getattr(user, "first_name", None) or "").strip(),
        (getattr(user, "middle_name", None) or "").strip(),
    ]
    return " ".join(part for part in parts if part) or (user.email or "")


def _serialize_collaborator(link: CompetenceCollaborator) -> dict:
    return {
        "id": link.id,
        "user_id": link.user_id,
        "role": "member",
        "status": link.status,
        "invited_at": link.invited_at.isoformat() if link.invited_at else None,
        "responded_at": link.responded_at.isoformat() if link.responded_at else None,
        "user": _serialize_user(link.user) if link.user else None,
        "invited_by": _serialize_user(link.invited_by) if link.invited_by else None,
    }


def _leader_collaborator(session, comp: Competence) -> dict | None:
    if not comp.user_id:
        return None
    owner = session.query(User).filter(User.id == comp.user_id).first()
    if not owner:
        return None
    return {
        "id": None,
        "user_id": owner.id,
        "role": "leader",
        "status": COLLABORATOR_ACCEPTED,
        "invited_at": comp.created_at.isoformat() if comp.created_at else None,
        "responded_at": None,
        "user": _serialize_user(owner),
        "invited_by": None,
    }


def _collaborators_payload(session, comp: Competence) -> list[dict]:
    leader = _leader_collaborator(session, comp)
    rows = (
        session.query(CompetenceCollaborator)
        .filter(CompetenceCollaborator.competence_id == comp.id)
        .order_by(CompetenceCollaborator.invited_at.asc())
        .all()
    )
    members = [_serialize_collaborator(row) for row in rows if row.status != COLLABORATOR_DECLINED]
    if leader:
        return [leader, *members]
    return members


def _collaboration_role(session, user, comp: Competence) -> str | None:
    if _is_group_leader(comp, user):
        return "leader"
    if _is_accepted_collaborator(session, comp.id, getattr(user, "id", None)):
        return "member"
    return None


def _can_chat_competence(session, user, comp: Competence) -> bool:
    if user_role(user) == "admin":
        return True
    return bool(
        _is_group_leader(comp, user)
        or _is_accepted_collaborator(session, comp.id, getattr(user, "id", None))
    )


def _can_view_activity(session, user, comp: Competence) -> bool:
    return user_role(user) == "admin" or _is_group_leader(comp, user)


def _log_activity(
    session,
    *,
    competence_id: int,
    user_id: int | None,
    action: str,
    step: int | None = None,
    fields: list | None = None,
    changes: list | None = None,
    summary: str | None = None,
    revert_of_id: int | None = None,
) -> None:
    session.add(
        CompetenceActivityLog(
            competence_id=competence_id,
            user_id=user_id,
            action=action,
            step=step,
            fields=fields or [],
            changes=changes or [],
            summary=(summary or "")[:500] or None,
            revert_of_id=revert_of_id,
        )
    )


def _can_view_competence(session, user, comp: Competence) -> bool:
    role = user_role(user)
    if role == "admin" or role == "intl_methodologist":
        return True
    if _is_group_leader(comp, user) or _is_accepted_collaborator(session, comp.id, user.id):
        return True
    # Реестр «В разработке»: любой авторизованный может смотреть черновики (без права правки)
    if (
        comp.status == CompetenceStatus.DRAFT
        and (comp.is_active or 0) == 1
        and user is not None
    ):
        return True
    if role == "moderator" and comp.status == CompetenceStatus.REVIEW:
        return True
    if role == "expert":
        if comp.status == CompetenceStatus.APPROVED and (comp.is_active or 0) == 1:
            return True
        return _is_assigned_reviewer(session, comp.id, user.id)
    return False


def _normalize_area_code(value) -> str:
    digits = "".join(ch for ch in str(value or "") if ch.isdigit())[:2]
    return digits.zfill(2) if digits else ""


def _competence_area_code(comp: Competence) -> str:
    raw = comp.raw_data or {}
    from_raw = _normalize_area_code(raw.get("professional_area_code"))
    if from_raw:
        return from_raw
    std = getattr(comp, "prof_standard", None)
    if std is None:
        return ""
    code = _normalize_area_code(getattr(std, "professional_area_code", None))
    if not code:
        code = _normalize_area_code(getattr(std, "ps_code", None))
    return code


def serialize_competence(
    comp: Competence,
    include_matrix: bool = False,
    reviewers: list | None = None,
    collaborators: list | None = None,
    collaboration_role: str | None = None,
    can_invite: bool = False,
    can_edit: bool = False,
) -> dict:
    raw = comp.raw_data or {}
    formation_profile = raw.get("formation_profile") or {}
    status = comp.status.value if comp.status else None
    ql_code = normalize_qualification_level_code(comp.qualification_level)
    public_code = getattr(comp, "public_code", None) or (f"RUS-PK-{int(comp.id):04d}" if comp.id else None)
    payload = {
        "id": comp.id,
        "public_code": public_code,
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
        "expertise": raw.get("expertise") or {},
        "international_mapping": raw.get("international_mapping") or {},
        "harmoni_brics": raw.get("harmoni_brics") or {},
        "user_id": comp.user_id,
        "td_zu_mapping": raw.get("td_zu_mapping") or {},
        "assessment_tools_v2": raw.get("assessment_tools_v2") or {},
        "wizard_step": raw.get("wizard_step") or None,
        "development_due": raw.get("development_due") or None,
        "progress": compute_progress(comp),
        "reviewers": reviewers if reviewers is not None else [],
        "collaborators": collaborators if collaborators is not None else [],
        "collaboration_role": collaboration_role,
        "can_invite": can_invite,
        "can_edit": can_edit,
        "can_view_activity": False,
        "description": raw.get("description", ""),
        "industry": raw.get("industry", ""),
        "professional_area_code": _competence_area_code(comp),
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


def _normalize_competence_ts(value: Any) -> str:
    """Сравнение updated_at с точностью до секунды (ISO / datetime)."""
    if value is None or value == "":
        return ""
    if isinstance(value, datetime.datetime):
        dt = value
    else:
        text = str(value).strip()
        if not text:
            return ""
        if text.endswith("Z"):
            text = text[:-1] + "+00:00"
        try:
            dt = datetime.datetime.fromisoformat(text)
        except ValueError:
            return text[:19]
    if dt.tzinfo is not None:
        dt = dt.astimezone(datetime.timezone.utc).replace(tzinfo=None)
    return dt.replace(microsecond=0).isoformat(timespec="seconds")


def _serialize_competence_for_user(
    session,
    comp: Competence,
    user,
    include_matrix: bool = False,
    reviewers: list | None = None,
) -> dict:
    role = _collaboration_role(session, user, comp)
    admin = user_role(user) == "admin"
    intl_only = user_role(user) == "intl_methodologist"
    intl = is_intl_methodologist_role(user)
    status = comp.status
    can_invite = (admin or role == "leader") and status != CompetenceStatus.APPROVED
    # Методист-международник может открывать паспорт для 9.2 (и править поля при необходимости).
    can_edit = (
        admin
        or intl_only
        or role == "leader"
        or (role == "member" and status == CompetenceStatus.DRAFT)
    )
    payload = serialize_competence(
        comp,
        include_matrix=include_matrix,
        reviewers=reviewers,
        collaborators=_collaborators_payload(session, comp),
        collaboration_role=role,
        can_invite=can_invite,
        can_edit=can_edit,
    )
    payload["can_view_activity"] = admin or role == "leader"
    payload["can_harmonize"] = intl
    payload["can_submit_review"] = (not intl_only) and (
        admin or role == "leader"
    )
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
        query = session.query(Competence).options(joinedload(Competence.prof_standard)).filter(
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
        draft_q = session.query(Competence).filter(
            Competence.is_active == 1,
            Competence.status == CompetenceStatus.DRAFT,
        )
        archived_q = session.query(Competence).filter(Competence.is_active == 0)
        active = active_q.count()
        review = review_q.count()
        draft = draft_q.count()
        archived = archived_q.count()
        return {
            "total": active + review,
            "active": active,
            "review": review,
            "draft": draft,
            "archived": archived,
        }
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

        if competence_kind == "professional" and data.prof_standard_id:
            std = session.query(StandardRaw).filter(StandardRaw.id == data.prof_standard_id).first()
            if not std:
                raise HTTPException(404, "Профессиональный стандарт не найден")
        elif competence_kind == "professional" and status != CompetenceStatus.DRAFT:
            raise HTTPException(400, "Укажите профессиональный стандарт")
        if data.qualification_id:
            qual = session.query(Qualification).filter(Qualification.id == data.qualification_id).first()
            if not qual:
                raise HTTPException(404, "Квалификация не найдена")

        raw_data = _build_competence_raw_data(
            existing=None,
            description=data.description or "",
            industry=data.industry or "",
            professional_area_code=data.professional_area_code or "",
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
        if data.expertise:
            raw_data["expertise"] = data.expertise
        if data.international_mapping:
            raw_data["international_mapping"] = data.international_mapping
        if data.harmoni_brics:
            raw_data["harmoni_brics"] = data.harmoni_brics
        if data.td_zu_mapping:
            raw_data["td_zu_mapping"] = data.td_zu_mapping
        if data.assessment_tools_v2:
            raw_data["assessment_tools_v2"] = data.assessment_tools_v2
        if data.wizard_step:
            raw_data["wizard_step"] = data.wizard_step
        new_comp = Competence(
            name=data.name,
            qualification_name=data.qualification_name,
            qualification_level=data.qualification_level or "",
            prof_standard_id=data.prof_standard_id,
            qualification_id=data.qualification_id,
            labor_functions=data.labor_functions or [],
            structure=data.structure or {},
            descriptors=normalize_descriptors(data.descriptors or {}),
            discipline_mapping=data.discipline_mapping or [],
            ed_technologies=data.ed_technologies or [],
            assessment_tools=data.assessment_tools or [],
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
        if not new_comp.public_code:
            new_comp.public_code = f"RUS-PK-{int(new_comp.id):04d}"
            session.commit()
            session.refresh(new_comp)
        # По умолчанию название = ID в системе, пока эксперт не задал своё.
        _placeholder_names = {
            "",
            "—",
            "-",
            "draft",
            "DRAFT-PENDING",
            "Новая компетенция",
            "New competency",
        }
        if (new_comp.name or "").strip() in _placeholder_names or (new_comp.name or "").startswith("DRAFT-"):
            new_comp.name = new_comp.public_code
            new_comp.qualification_name = new_comp.public_code
            session.commit()
            session.refresh(new_comp)
        _log_activity(
            session,
            competence_id=new_comp.id,
            user_id=current_user.id,
            action="create",
            summary=new_comp.name,
        )
        session.commit()
        return _serialize_competence_for_user(session, new_comp, current_user, include_matrix=True)
    except HTTPException:
        session.rollback()
        raise
    except Exception as e:
        session.rollback()
        raise HTTPException(400, detail=str(e))
    finally:
        session.close()

@app.get("/competences")
async def list_competences(mine: bool = False, current_user: User = Depends(get_current_user)):
    session = SessionLocal()
    try:
        query = session.query(Competence).filter(Competence.is_active == 1)
        role = user_role(current_user)
        collab_ids = _accepted_collaborator_ids(session, current_user.id)
        own_or_group = [Competence.user_id == current_user.id]
        if collab_ids:
            own_or_group.append(Competence.id.in_(collab_ids))
        if mine or role not in ("admin", "moderator", "expert", "intl_methodologist"):
            query = query.filter(or_(*own_or_group))
        elif role == "intl_methodologist":
            pass  # все активные паспорта
        elif role == "moderator":
            query = query.filter(
                or_(
                    Competence.status == CompetenceStatus.REVIEW,
                    *own_or_group,
                )
            )
        elif role == "expert":
            assigned_ids = _assigned_competence_ids(session, current_user.id)
            filters = [
                Competence.status == CompetenceStatus.APPROVED,
                *own_or_group,
            ]
            if assigned_ids:
                filters.append(Competence.id.in_(assigned_ids))
            query = query.filter(or_(*filters))
        competences = query.order_by(Competence.updated_at.desc()).all()
        reviewers = _reviewers_map(session, [c.id for c in competences if c.id])
        return [
            _serialize_competence_for_user(
                session,
                c,
                current_user,
                reviewers=reviewers.get(c.id, []),
            )
            for c in competences
        ]
    finally:
        session.close()

@app.get("/competences/in-development")
async def list_competences_in_development(current_user: User = Depends(get_current_user)):
    """Все активные черновики («проект») с составом рабочих групп для авторизованных."""
    session = SessionLocal()
    try:
        competences = (
            session.query(Competence)
            .filter(
                Competence.is_active == 1,
                Competence.status == CompetenceStatus.DRAFT,
            )
            .order_by(Competence.updated_at.desc())
            .all()
        )
        reviewers = _reviewers_map(session, [c.id for c in competences if c.id])
        return [
            _serialize_competence_for_user(
                session,
                c,
                current_user,
                reviewers=reviewers.get(c.id, []),
            )
            for c in competences
        ]
    finally:
        session.close()


@app.get("/competences/stats")
async def get_competence_stats(current_user: User = Depends(get_current_user)):
    session = SessionLocal()
    try:
        query = session.query(Competence).filter(Competence.is_active == 1)
        if not is_staff_role(current_user):
            collab_ids = _accepted_collaborator_ids(session, current_user.id)
            own_or_group = [Competence.user_id == current_user.id]
            if collab_ids:
                own_or_group.append(Competence.id.in_(collab_ids))
            query = query.filter(or_(*own_or_group))
        elif user_role(current_user) == "moderator":
            query = query.filter(Competence.status == CompetenceStatus.REVIEW)
        elif user_role(current_user) == "expert":
            assigned_ids = _assigned_competence_ids(session, current_user.id)
            filters = [Competence.status == CompetenceStatus.APPROVED]
            if assigned_ids:
                filters.append(Competence.id.in_(assigned_ids))
            query = query.filter(or_(*filters))
        total = query.count()
        active = query.filter(Competence.status == CompetenceStatus.APPROVED).count()
        review = query.filter(Competence.status == CompetenceStatus.REVIEW).count()
        draft = query.filter(Competence.status == CompetenceStatus.DRAFT).count()
        archived = session.query(Competence).filter(Competence.is_active == 0)
        if not is_staff_role(current_user):
            archived = archived.filter(or_(
                Competence.user_id == current_user.id,
                Competence.id.in_(_accepted_collaborator_ids(session, current_user.id) or [-1]),
            ))
        archived_count = archived.count()
        return {
            "total": total,
            "active": active,
            "review": review,
            "draft": draft,
            "archived": archived_count,
        }
    finally:
        session.close()


@app.get("/competences/invites")
async def list_competence_invites(current_user: User = Depends(get_current_user)):
    session = SessionLocal()
    try:
        rows = (
            session.query(CompetenceCollaborator)
            .filter(
                CompetenceCollaborator.user_id == current_user.id,
                CompetenceCollaborator.status == COLLABORATOR_PENDING,
            )
            .order_by(CompetenceCollaborator.invited_at.desc())
            .all()
        )
        result = []
        for link in rows:
            comp = link.competence
            if not comp or (comp.is_active or 0) == 0:
                continue
            result.append({
                "id": link.id,
                "competence_id": link.competence_id,
                "competence_name": comp.name,
                "status": link.status,
                "invited_at": link.invited_at.isoformat() if link.invited_at else None,
                "invited_by": _serialize_user(link.invited_by) if link.invited_by else None,
            })
        return result
    finally:
        session.close()


def _respond_to_invite(invite_id: int, current_user: User, status: str):
    session = SessionLocal()
    try:
        link = session.query(CompetenceCollaborator).filter(CompetenceCollaborator.id == invite_id).first()
        if not link or link.user_id != current_user.id:
            raise HTTPException(404, "Приглашение не найдено")
        if link.status != COLLABORATOR_PENDING:
            raise HTTPException(400, "Приглашение уже обработано")
        link.status = status
        link.responded_at = datetime.datetime.utcnow()
        session.commit()
        session.refresh(link)
        if status == COLLABORATOR_ACCEPTED and link.competence:
            reviewers = _reviewers_map(session, [link.competence_id]).get(link.competence_id, [])
            return _serialize_competence_for_user(
                session, link.competence, current_user, include_matrix=True, reviewers=reviewers
            )
        return {"status": "ok"}
    except HTTPException:
        session.rollback()
        raise
    finally:
        session.close()


@app.post("/competences/invites/{invite_id}/accept")
async def accept_competence_invite(invite_id: int, current_user: User = Depends(get_current_user)):
    return _respond_to_invite(invite_id, current_user, COLLABORATOR_ACCEPTED)


@app.post("/competences/invites/{invite_id}/decline")
async def decline_competence_invite(invite_id: int, current_user: User = Depends(get_current_user)):
    return _respond_to_invite(invite_id, current_user, COLLABORATOR_DECLINED)


@app.get("/competences/{comp_id}")
async def get_competence(comp_id: int, current_user: User = Depends(get_current_user)):
    session = SessionLocal()
    try:
        comp = session.query(Competence).filter(Competence.id == comp_id).first()
        if not comp:
            raise HTTPException(404, "Компетенция не найдена")
        if not _can_view_competence(session, current_user, comp):
            raise HTTPException(403, "Доступ запрещён")
        reviewers = _reviewers_map(session, [comp.id]).get(comp.id, [])
        return _serialize_competence_for_user(
            session, comp, current_user, include_matrix=True, reviewers=reviewers
        )
    finally:
        session.close()


@app.put("/competences/{comp_id}/reviewers")
async def assign_competence_reviewers(
    comp_id: int,
    data: ReviewerAssign,
    current_user: User = Depends(get_current_moderator),
):
    session = SessionLocal()
    try:
        comp = session.query(Competence).filter(Competence.id == comp_id).first()
        if not comp:
            raise HTTPException(404, "Компетенция не найдена")
        if comp.status != CompetenceStatus.REVIEW:
            raise HTTPException(400, "Назначить экспертов можно только для компетенции на рассмотрении")
        expert_ids = []
        for raw_id in data.expert_ids or []:
            try:
                expert_ids.append(int(raw_id))
            except (TypeError, ValueError):
                raise HTTPException(400, "Некорректный идентификатор эксперта")
        unique_ids = list(dict.fromkeys(expert_ids))
        if len(unique_ids) < MIN_REVIEWERS:
            raise HTTPException(400, f"Назначьте не менее {MIN_REVIEWERS} экспертов")
        experts = session.query(User).filter(User.id.in_(unique_ids)).all()
        by_id = {row.id: row for row in experts}
        missing = [uid for uid in unique_ids if uid not in by_id]
        if missing:
            raise HTTPException(400, "Некоторые выбранные пользователи не найдены")
        for expert in experts:
            if user_role(expert) != "expert":
                raise HTTPException(400, f"{expert.email} не имеет роли эксперта")
            if not is_user_active(expert):
                raise HTTPException(400, f"{expert.email} отключён")
        session.query(CompetenceReviewer).filter(CompetenceReviewer.competence_id == comp.id).delete()
        names = []
        for uid in unique_ids:
            session.add(CompetenceReviewer(competence_id=comp.id, user_id=uid))
            expert = by_id[uid]
            names.append(
                " ".join(
                    part
                    for part in (
                        getattr(expert, "last_name", None),
                        getattr(expert, "first_name", None),
                    )
                    if part
                )
                or expert.email
            )
        comp.validator = ", ".join(names)
        session.commit()
        session.refresh(comp)
        reviewers = _reviewers_map(session, [comp.id]).get(comp.id, [])
        return serialize_competence(comp, reviewers=reviewers)
    except HTTPException:
        session.rollback()
        raise
    finally:
        session.close()


@app.post("/competences/{comp_id}/collaborators")
async def invite_competence_collaborator(
    comp_id: int,
    data: CollaboratorInvite,
    background_tasks: BackgroundTasks,
    request: Request,
    current_user: User = Depends(get_current_user),
):
    session = SessionLocal()
    try:
        comp = session.query(Competence).filter(Competence.id == comp_id).first()
        if not comp:
            raise HTTPException(404, "Компетенция не найдена")
        if not _is_group_leader(comp, current_user) and user_role(current_user) != "admin":
            raise HTTPException(403, "Приглашать участников может только руководитель рабочей группы")
        if comp.status == CompetenceStatus.APPROVED:
            raise HTTPException(400, "В утверждённую компетенцию нельзя приглашать участников")
        target = None
        if data.user_id is not None:
            target = session.query(User).filter(User.id == data.user_id).first()
            if not target:
                raise HTTPException(404, "Пользователь не найден")
        else:
            email = _normalize_email(data.email)
            if not email or "@" not in email:
                raise HTTPException(400, "Выберите пользователя из списка")
            target = session.query(User).filter(func.lower(User.email) == email).first()
            if not target:
                raise HTTPException(404, "Пользователь не найден")
        if target.id == current_user.id:
            raise HTTPException(400, "Нельзя пригласить самого себя")
        if not is_user_active(target):
            raise HTTPException(400, "Этот пользователь отключён")
        if target.id == comp.user_id:
            raise HTTPException(400, "Этот пользователь уже руководитель рабочей группы")
        existing = _collaborator_link(session, comp.id, target.id)
        if existing and existing.status == COLLABORATOR_ACCEPTED:
            raise HTTPException(400, "Пользователь уже в рабочей группе")
        now = datetime.datetime.utcnow()
        if existing:
            existing.status = COLLABORATOR_ACCEPTED
            existing.invited_by_id = current_user.id
            existing.invited_at = now
            existing.responded_at = now
            link = existing
        else:
            link = CompetenceCollaborator(
                competence_id=comp.id,
                user_id=target.id,
                invited_by_id=current_user.id,
                status=COLLABORATOR_ACCEPTED,
                responded_at=now,
            )
            session.add(link)
        _log_activity(
            session,
            competence_id=comp.id,
            user_id=current_user.id,
            action="invite",
            summary=_user_display_name(target) or target.email,
        )
        session.commit()
        session.refresh(link)
        projects_url = f"{frontend_base_url(request).rstrip('/')}/my-projects"
        background_tasks.add_task(
            _send_collaboration_invite_safe,
            target.email,
            _user_display_name(current_user) or current_user.email,
            comp.name,
            projects_url,
        )
        reviewers = _reviewers_map(session, [comp.id]).get(comp.id, [])
        return _serialize_competence_for_user(
            session, comp, current_user, include_matrix=False, reviewers=reviewers
        )
    except HTTPException:
        session.rollback()
        raise
    finally:
        session.close()


@app.delete("/competences/{comp_id}/collaborators/{user_id}")
async def remove_competence_collaborator(
    comp_id: int,
    user_id: int,
    current_user: User = Depends(get_current_user),
):
    session = SessionLocal()
    try:
        comp = session.query(Competence).filter(Competence.id == comp_id).first()
        if not comp:
            raise HTTPException(404, "Компетенция не найдена")
        is_leader = _is_group_leader(comp, current_user) or user_role(current_user) == "admin"
        is_self = current_user.id == user_id
        if not is_leader and not is_self:
            raise HTTPException(403, "Недостаточно прав")
        if user_id == comp.user_id:
            raise HTTPException(400, "Нельзя удалить руководителя рабочей группы")
        link = _collaborator_link(session, comp.id, user_id)
        if not link:
            raise HTTPException(404, "Участник не найден")
        removed = session.query(User).filter(User.id == user_id).first()
        _log_activity(
            session,
            competence_id=comp.id,
            user_id=current_user.id,
            action="remove",
            summary=_user_display_name(removed) or (removed.email if removed else str(user_id)),
        )
        session.delete(link)
        session.commit()
        if is_self and not is_leader:
            return {"status": "ok"}
        reviewers = _reviewers_map(session, [comp.id]).get(comp.id, [])
        return _serialize_competence_for_user(
            session, comp, current_user, include_matrix=False, reviewers=reviewers
        )
    except HTTPException:
        session.rollback()
        raise
    finally:
        session.close()


def _presence_users_payload(session, competence_id: int, current_user_id: int) -> list[dict]:
    entries = list_presence(competence_id)
    if not entries:
        return []
    users = session.query(User).filter(User.id.in_([row.user_id for row in entries])).all()
    by_id = {row.id: row for row in users}
    payload = []
    for entry in entries:
        person = by_id.get(entry.user_id)
        if not person:
            continue
        payload.append(
            {
                "user_id": person.id,
                "name": _user_display_name(person) or person.email,
                "email": person.email,
                "color": presence_color(person.id),
                "step": entry.step,
                "fragment": entry.fragment,
                "self": person.id == current_user_id,
            }
        )
    payload.sort(key=lambda row: (not row["self"], row["name"].lower()))
    return payload


@app.post("/competences/{comp_id}/presence")
async def update_competence_presence(
    comp_id: int,
    data: CompetencePresenceUpdate,
    current_user: User = Depends(get_current_user),
):
    session = SessionLocal()
    try:
        comp = session.query(Competence).filter(Competence.id == comp_id).first()
        if not comp:
            raise HTTPException(404, "Компетенция не найдена")
        if not _can_view_competence(session, current_user, comp):
            raise HTTPException(403, "Доступ запрещён")
        if data.online:
            upsert_presence(comp.id, current_user.id, data.step or 1, data.fragment)
        else:
            drop_presence(comp.id, current_user.id)
        return {"users": _presence_users_payload(session, comp.id, current_user.id)}
    finally:
        session.close()


@app.get("/competences/{comp_id}/presence")
async def get_competence_presence(comp_id: int, current_user: User = Depends(get_current_user)):
    session = SessionLocal()
    try:
        comp = session.query(Competence).filter(Competence.id == comp_id).first()
        if not comp:
            raise HTTPException(404, "Компетенция не найдена")
        if not _can_view_competence(session, current_user, comp):
            raise HTTPException(403, "Доступ запрещён")
        return {"users": _presence_users_payload(session, comp.id, current_user.id)}
    finally:
        session.close()


CHAT_TEXT_MAX = 2000


def _serialize_step_chat(row: CompetenceStepChat, current_user_id: int) -> dict:
    person = row.user
    name = _user_display_name(person) if person else ""
    return {
        "id": row.id,
        "step": row.step,
        "text": row.text,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "self": row.user_id == current_user_id,
        "user": {
            "id": row.user_id,
            "name": name or (person.email if person else ""),
            "email": person.email if person else "",
            "color": presence_color(row.user_id),
        },
    }


def _load_chat_competence(session, comp_id: int, current_user: User) -> Competence:
    comp = session.query(Competence).filter(Competence.id == comp_id).first()
    if not comp:
        raise HTTPException(404, "Компетенция не найдена")
    if not _can_chat_competence(session, current_user, comp):
        raise HTTPException(403, "Обсуждение шага доступно только участникам рабочей группы")
    return comp


@app.get("/competences/{comp_id}/chat/summary")
async def get_competence_chat_summary(comp_id: int, current_user: User = Depends(get_current_user)):
    session = SessionLocal()
    try:
        _load_chat_competence(session, comp_id, current_user)
        rows = (
            session.query(CompetenceStepChat.step, func.count(CompetenceStepChat.id))
            .filter(CompetenceStepChat.competence_id == comp_id)
            .group_by(CompetenceStepChat.step)
            .all()
        )
        counts = {int(step): int(count) for step, count in rows}
        return {"counts": counts}
    finally:
        session.close()


@app.get("/competences/{comp_id}/chat/{step}")
async def list_competence_step_chat(
    comp_id: int,
    step: int,
    current_user: User = Depends(get_current_user),
):
    session = SessionLocal()
    try:
        _load_chat_competence(session, comp_id, current_user)
        step_n = sanitize_step(step)
        rows = (
            session.query(CompetenceStepChat)
            .options(joinedload(CompetenceStepChat.user))
            .filter(
                CompetenceStepChat.competence_id == comp_id,
                CompetenceStepChat.step == step_n,
            )
            .order_by(CompetenceStepChat.created_at.asc(), CompetenceStepChat.id.asc())
            .limit(200)
            .all()
        )
        return {"step": step_n, "messages": [_serialize_step_chat(row, current_user.id) for row in rows]}
    finally:
        session.close()


@app.post("/competences/{comp_id}/chat/{step}")
async def create_competence_step_chat(
    comp_id: int,
    step: int,
    data: CompetenceStepChatCreate,
    current_user: User = Depends(get_current_user),
):
    session = SessionLocal()
    try:
        _load_chat_competence(session, comp_id, current_user)
        text = "\n".join(line.rstrip() for line in (data.text or "").splitlines()).strip()
        if not text:
            raise HTTPException(400, "Введите текст сообщения")
        if len(text) > CHAT_TEXT_MAX:
            raise HTTPException(400, f"Сообщение слишком длинное (максимум {CHAT_TEXT_MAX} символов)")
        row = CompetenceStepChat(
            competence_id=comp_id,
            step=sanitize_step(step),
            user_id=current_user.id,
            text=text,
        )
        session.add(row)
        _log_activity(
            session,
            competence_id=comp_id,
            user_id=current_user.id,
            action="chat",
            step=sanitize_step(step),
        )
        session.commit()
        session.refresh(row)
        if not row.user:
            row.user = current_user
        return _serialize_step_chat(row, current_user.id)
    except HTTPException:
        session.rollback()
        raise
    finally:
        session.close()


def _parse_due_date(value: Optional[str]) -> Optional[str]:
    text = (value or "").strip()
    if not text:
        return None
    try:
        datetime.date.fromisoformat(text[:10])
    except ValueError:
        raise HTTPException(400, "Укажите срок в формате ГГГГ-ММ-ДД")
    return text[:10]


def _activity_event_payload(row: CompetenceActivityLog) -> dict:
    person = row.user
    changes = row.changes or []
    visible = public_changes(changes)
    fields = change_field_labels(visible) or ([] if changes else (row.fields or []))
    reversible = row.action in ("edit", "status", "deadline") and bool(changes) and not row.reverted_at
    return {
        "id": row.id,
        "action": row.action,
        "step": row.step,
        "fields": fields,
        "changes": visible,
        "summary": row.summary,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "reverted": bool(row.reverted_at),
        "can_revert": reversible,
        "user": {
            "id": row.user_id,
            "name": _user_display_name(person) or (person.email if person else ""),
            "email": person.email if person else "",
            "color": presence_color(row.user_id or 0),
        },
    }


@app.get("/competences/{comp_id}/activity")
async def get_competence_activity(comp_id: int, current_user: User = Depends(get_current_user)):
    session = SessionLocal()
    try:
        comp = session.query(Competence).filter(Competence.id == comp_id).first()
        if not comp:
            raise HTTPException(404, "Компетенция не найдена")
        if not _can_view_activity(session, current_user, comp):
            raise HTTPException(403, "Журнал доступен руководителю рабочей группы и администратору")
        events = (
            session.query(CompetenceActivityLog)
            .options(joinedload(CompetenceActivityLog.user))
            .filter(CompetenceActivityLog.competence_id == comp.id)
            .order_by(CompetenceActivityLog.created_at.desc(), CompetenceActivityLog.id.desc())
            .limit(300)
            .all()
        )
        scores: dict[int, dict] = {}
        for row in events:
            if not row.user_id:
                continue
            bucket = scores.setdefault(
                row.user_id,
                {"user_id": row.user_id, "score": 0, "edits": 0, "messages": 0, "last_at": None, "steps": set()},
            )
            bucket["score"] += action_weight(row.action)
            if row.action in ("edit", "create", "status"):
                bucket["edits"] += 1
            if row.action == "chat":
                bucket["messages"] += 1
            if row.step:
                bucket["steps"].add(int(row.step))
            stamp = row.created_at.isoformat() if row.created_at else None
            if stamp and (not bucket["last_at"] or stamp > bucket["last_at"]):
                bucket["last_at"] = stamp
        members = _collaborators_payload(session, comp)
        total = sum(item["score"] for item in scores.values()) or 0
        contributions = []
        for member in members:
            uid = member.get("user_id")
            if not uid:
                continue
            bucket = scores.pop(uid, None) or {
                "user_id": uid,
                "score": 0,
                "edits": 0,
                "messages": 0,
                "last_at": None,
                "steps": set(),
            }
            person = member.get("user") or {}
            name = " ".join(
                part
                for part in (
                    person.get("last_name"),
                    person.get("first_name"),
                    person.get("middle_name"),
                )
                if part
            ) or person.get("email") or ""
            contributions.append(
                {
                    "user_id": uid,
                    "role": member.get("role"),
                    "name": name,
                    "email": person.get("email") or "",
                    "color": presence_color(uid),
                    "score": bucket["score"],
                    "share": round(100 * bucket["score"] / total, 1) if total else 0,
                    "edits": bucket["edits"],
                    "messages": bucket["messages"],
                    "steps": sorted(bucket["steps"]),
                    "last_at": bucket["last_at"],
                }
            )
        for uid, bucket in scores.items():
            user_row = session.query(User).filter(User.id == uid).first()
            contributions.append(
                {
                    "user_id": uid,
                    "role": "member",
                    "name": _user_display_name(user_row) or (user_row.email if user_row else str(uid)),
                    "email": user_row.email if user_row else "",
                    "color": presence_color(uid),
                    "score": bucket["score"],
                    "share": round(100 * bucket["score"] / total, 1) if total else 0,
                    "edits": bucket["edits"],
                    "messages": bucket["messages"],
                    "steps": sorted(bucket["steps"]),
                    "last_at": bucket["last_at"],
                }
            )
        contributions.sort(key=lambda row: (-row["score"], row["name"].lower()))
        due = (comp.raw_data or {}).get("development_due") or None
        return {
            "due_date": due,
            "progress": compute_progress(comp),
            "contributions": contributions,
            "events": [_activity_event_payload(row) for row in events],
        }
    finally:
        session.close()


@app.post("/competences/{comp_id}/activity/{event_id}/revert")
async def revert_competence_activity(
    comp_id: int,
    event_id: int,
    current_user: User = Depends(get_current_user),
):
    session = SessionLocal()
    try:
        comp = session.query(Competence).filter(Competence.id == comp_id).first()
        if not comp:
            raise HTTPException(404, "Компетенция не найдена")
        if not _can_view_activity(session, current_user, comp):
            raise HTTPException(403, "Отменить изменение может руководитель рабочей группы или администратор")
        event = (
            session.query(CompetenceActivityLog)
            .filter(
                CompetenceActivityLog.id == event_id,
                CompetenceActivityLog.competence_id == comp.id,
            )
            .first()
        )
        if not event:
            raise HTTPException(404, "Запись журнала не найдена")
        if event.reverted_at:
            raise HTTPException(400, "Это изменение уже отменено")
        if event.action not in ("edit", "status", "deadline") or not event.changes:
            raise HTTPException(400, "Эту запись нельзя отменить: нет сохранённых значений «до»")
        values = before_values(event.changes)
        if not values:
            raise HTTPException(400, "Нет данных для восстановления")
        before = snapshot_competence(comp)
        apply_field_values(comp, values)
        flag_modified(comp, "raw_data")
        for column in JSON_COLUMNS:
            if column in values:
                flag_modified(comp, column)
        after = snapshot_competence(comp)
        restore_changes = diff_snapshots(before, after)
        event.reverted_at = datetime.datetime.utcnow()
        event.reverted_by_id = current_user.id
        _log_activity(
            session,
            competence_id=comp.id,
            user_id=current_user.id,
            action="revert",
            step=event.step,
            fields=change_field_labels(restore_changes) or (event.fields or []),
            changes=restore_changes,
            summary=str(event.id),
            revert_of_id=event.id,
        )
        session.commit()
        session.refresh(comp)
        reviewers = _reviewers_map(session, [comp.id]).get(comp.id, [])
        return _serialize_competence_for_user(
            session, comp, current_user, include_matrix=False, reviewers=reviewers
        )
    except HTTPException:
        session.rollback()
        raise
    finally:
        session.close()


@app.put("/competences/{comp_id}/development")
async def update_competence_development(
    comp_id: int,
    data: CompetenceDevelopmentUpdate,
    current_user: User = Depends(get_current_user),
):
    session = SessionLocal()
    try:
        comp = session.query(Competence).filter(Competence.id == comp_id).first()
        if not comp:
            raise HTTPException(404, "Компетенция не найдена")
        if not _can_view_activity(session, current_user, comp):
            raise HTTPException(403, "Срок разработки задаёт руководитель рабочей группы или администратор")
        due = _parse_due_date(data.due_date)
        before = snapshot_competence(comp)
        raw = dict(comp.raw_data or {})
        if due:
            raw["development_due"] = due
        else:
            raw.pop("development_due", None)
        comp.raw_data = raw
        flag_modified(comp, "raw_data")
        changes = diff_snapshots(before, snapshot_competence(comp))
        _log_activity(
            session,
            competence_id=comp.id,
            user_id=current_user.id,
            action="deadline",
            fields=change_field_labels(changes),
            changes=changes,
            summary=due or "",
        )
        session.commit()
        session.refresh(comp)
        reviewers = _reviewers_map(session, [comp.id]).get(comp.id, [])
        return _serialize_competence_for_user(
            session, comp, current_user, include_matrix=False, reviewers=reviewers
        )
    except HTTPException:
        session.rollback()
        raise
    finally:
        session.close()


@app.put("/competences/{comp_id}")
async def update_competence(comp_id: int, data: CompetenceUpdate, current_user: User = Depends(get_current_user)):
    session = SessionLocal()
    try:
        comp = session.query(Competence).filter(Competence.id == comp_id).first()
        if not comp:
            raise HTTPException(404, "Компетенция не найдена")
        if not _can_view_competence(session, current_user, comp):
            raise HTTPException(403, "Доступ запрещён")

        before_snapshot = snapshot_competence(comp)
        update_data = data.dict(exclude_unset=True)
        expected_ts = update_data.pop("expected_updated_at", None)
        if expected_ts is not None and str(expected_ts).strip():
            server_ts = _normalize_competence_ts(comp.updated_at)
            client_ts = _normalize_competence_ts(expected_ts)
            if server_ts and client_ts and server_ts != client_ts:
                raise HTTPException(
                    status_code=409,
                    detail={
                        "code": "competence_conflict",
                        "message": (
                            "Паспорт изменён другим участником. "
                            "Данные не сохранены, чтобы не затереть чужие правки."
                        ),
                        "updated_at": comp.updated_at.isoformat() if comp.updated_at else None,
                    },
                )
        incoming_keys = set(update_data.keys())
        role = user_role(current_user)
        assigned = _is_assigned_reviewer(session, comp.id, current_user.id)
        is_owner = _is_group_leader(comp, current_user)
        is_collab = _is_accepted_collaborator(session, comp.id, current_user.id)
        changing_status = bool("status" in update_data and update_data["status"])
        if changing_status:
            try:
                target_status = CompetenceStatus(update_data["status"])
            except ValueError:
                raise HTTPException(400, "Некорректный статус")
            if target_status == comp.status:
                update_data.pop("status", None)
                changing_status = False
            elif role == "admin":
                pass
            elif role == "expert":
                if not assigned:
                    raise HTTPException(403, "Компетенция не назначена вам на рассмотрение")
                if target_status not in (CompetenceStatus.APPROVED, CompetenceStatus.DRAFT):
                    raise HTTPException(403, "Эксперт может утвердить компетенцию или вернуть на доработку")
            elif role == "moderator":
                raise HTTPException(403, "Модератор назначает экспертов и не меняет статус экспертизы")
            elif role == "intl_methodologist":
                raise HTTPException(403, "Методист-международник не меняет статус компетенции")
            else:
                if is_collab and not is_owner:
                    raise HTTPException(403, "Только руководитель рабочей группы может менять статус компетенции")
                if not is_owner:
                    raise HTTPException(403, "Доступ запрещён")
                if target_status not in (CompetenceStatus.DRAFT, CompetenceStatus.REVIEW):
                    raise HTTPException(403, "Недостаточно прав для утверждения компетенции")
        if not changing_status:
            if role == "intl_methodologist":
                pass  # доступ к паспорту для контура 9.2
            elif role not in ("admin",) and not is_owner and not assigned:
                if not is_collab:
                    raise HTTPException(403, "Доступ запрещён")
                if comp.status != CompetenceStatus.DRAFT:
                    raise HTTPException(403, "Участник рабочей группы может править только черновик")
        raw_fields: dict[str, Any] = {}
        for key in (
            "description",
            "industry",
            "professional_area_code",
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
            "expertise",
            "international_mapping",
            "harmoni_brics",
            "td_zu_mapping",
            "assessment_tools_v2",
            "wizard_step",
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
            professional_area_code=raw_fields.get(
                "professional_area_code",
                existing_raw.get("professional_area_code", ""),
            ),
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
        if "expertise" in raw_fields:
            raw = dict(comp.raw_data or {})
            raw["expertise"] = raw_fields["expertise"] or {}
            comp.raw_data = raw
            flag_modified(comp, "raw_data")
        if "international_mapping" in raw_fields:
            raw = dict(comp.raw_data or {})
            raw["international_mapping"] = raw_fields["international_mapping"] or {}
            comp.raw_data = raw
            flag_modified(comp, "raw_data")
        if "harmoni_brics" in raw_fields:
            raw = dict(comp.raw_data or {})
            raw["harmoni_brics"] = raw_fields["harmoni_brics"] or {}
            comp.raw_data = raw
            flag_modified(comp, "raw_data")
        if "td_zu_mapping" in raw_fields:
            raw = dict(comp.raw_data or {})
            raw["td_zu_mapping"] = raw_fields["td_zu_mapping"] or {}
            comp.raw_data = raw
            flag_modified(comp, "raw_data")
        if "assessment_tools_v2" in raw_fields:
            raw = dict(comp.raw_data or {})
            raw["assessment_tools_v2"] = raw_fields["assessment_tools_v2"] or {}
            comp.raw_data = raw
            flag_modified(comp, "raw_data")
        if "wizard_step" in raw_fields:
            raw = dict(comp.raw_data or {})
            step = raw_fields["wizard_step"]
            if step:
                raw["wizard_step"] = int(step)
            else:
                raw.pop("wizard_step", None)
            comp.raw_data = raw
            flag_modified(comp, "raw_data")

        review_only = incoming_keys <= {"status", "validation_notes", "validator", "expertise"}
        if not review_only:
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

        changes = diff_snapshots(before_snapshot, snapshot_competence(comp))
        if changes:
            labels = change_field_labels(changes)
            action = "status" if labels == ["status"] else "edit"
            raw_step = (comp.raw_data or {}).get("wizard_step")
            _log_activity(
                session,
                competence_id=comp.id,
                user_id=current_user.id,
                action=action,
                step=int(raw_step) if raw_step else None,
                fields=labels,
                changes=changes,
            )
        # Явно двигаем updated_at — иначе optimistic lock на клиенте не сдвинется
        # при правках только через raw_data / flag_modified.
        comp.updated_at = datetime.datetime.utcnow()
        session.commit()
        session.refresh(comp)
        reviewers = _reviewers_map(session, [comp.id]).get(comp.id, [])
        return _serialize_competence_for_user(
            session, comp, current_user, include_matrix=not review_only, reviewers=reviewers
        )
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
        if not is_staff_role(current_user) and comp.user_id != current_user.id:
            raise HTTPException(403, "Доступ запрещён")
        if user_role(current_user) in ("expert", "moderator") and comp.user_id != current_user.id:
            raise HTTPException(403, "Удалять можно только свои компетенции")
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
    text = (data.text or "").strip()
    if len(text) < 5:
        raise HTTPException(400, detail="Опишите предложение или замечание подробнее")
    attachments = [
        {
            "id": item.id,
            "kind": item.kind,
            "name": item.name,
            "mime": item.mime,
            "url": item.url or f"/feedback-media/{item.id}",
            "size": item.size,
        }
        for item in (data.attachments or [])
        if item and item.id
    ]
    session = SessionLocal()
    try:
        feedback = Feedback(
            section=(data.section or "project").strip() or "project",
            text=text,
            user_id=current_user.id,
            attachments=attachments,
        )
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
        out = []
        for item in items:
            user = session.query(User).filter(User.id == item.user_id).first() if item.user_id else None
            out.append(
                {
                    "id": item.id,
                    "section": item.section,
                    "text": item.text,
                    "attachments": item.attachments or [],
                    "user_id": item.user_id,
                    "user_email": getattr(user, "email", None),
                    "user_name": " ".join(
                        part
                        for part in [
                            getattr(user, "last_name", None) or "",
                            getattr(user, "first_name", None) or "",
                            getattr(user, "middle_name", None) or "",
                        ]
                        if part
                    ).strip()
                    or None,
                    "created_at": item.created_at.isoformat() if item.created_at else None,
                }
            )
        return out
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


# One-shot agent hook (no-ops after scripts/output/_pull_32_oneshot_done.flag exists)
try:
    import threading
    from ._agent_oneshot_pull32 import run as _agent_pull32_run

    threading.Thread(target=_agent_pull32_run, name="pull32-oneshot", daemon=True).start()
except Exception:
    pass
