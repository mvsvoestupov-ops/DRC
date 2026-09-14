from sqlalchemy.orm import Session
from .db.raw_models import (
    StandardRaw, GeneralizedFunctionRaw, ParticularFunctionRaw,
    LaborActionRaw, SkillRaw, KnowledgeRaw
)
from .models import ProfessionalStandard, LaborAction, ClassifierUnit


def _units_to_json(units) -> list | None:
    if not units:
        return None
    result = []
    for u in units:
        if isinstance(u, ClassifierUnit):
            result.append({"code": u.code or "", "name": u.name or ""})
        elif isinstance(u, dict):
            result.append({"code": u.get("code", "") or "", "name": u.get("name", "") or ""})
        else:
            result.append({"code": str(u), "name": ""})
    return result


def _codes_from_units(units, fallback_codes=None) -> list | None:
    codes = []
    if units:
        for u in units:
            code = u.code if isinstance(u, ClassifierUnit) else (u.get("code") if isinstance(u, dict) else str(u))
            if code and code not in codes:
                codes.append(code)
    if not codes and fallback_codes:
        codes = list(fallback_codes)
    return codes or None


def save_raw_standard(session: Session, standard: ProfessionalStandard, element_id: str = None):
    existing = session.query(StandardRaw).filter(
        StandardRaw.reg_number == standard.registration_number
    ).first()
    preserved = {}
    if existing:
        for key in (
            "status", "revoked_date", "developer_org", "developer_head", "co_developers",
            "effective_date", "expiration_date", "source_xml", "source_html", "source_kind",
            "ps_code", "abbreviations",
        ):
            preserved[key] = getattr(existing, key, None)
        session.delete(existing)
        session.commit()

    okved_units = _units_to_json(standard.okved_units)
    okved_codes = list(standard.okved_codes or [])
    if not okved_codes and okved_units:
        okved_codes = [u["code"] for u in okved_units if u.get("code")]

    status = preserved.get("status") or "active"
    revoked_date = preserved.get("revoked_date")

    def _pick(attr, preserved_key=None):
        val = getattr(standard, attr, None)
        if val not in (None, "", [], {}):
            return val
        return preserved.get(preserved_key or attr)

    source_xml = standard.source_xml or preserved.get("source_xml")
    source_html = standard.source_html or preserved.get("source_html")
    source_kind = standard.source_kind or preserved.get("source_kind")
    if standard.source_xml:
        source_kind = standard.source_kind or "mintrud_xml"
    elif standard.source_html and not source_kind:
        source_kind = "classinform_html"

    std_raw = StandardRaw(
        reg_number=standard.registration_number,
        name=standard.name,
        order_number=standard.order_number,
        approval_date=standard.approval_date,
        kind_activity=standard.kind_activity,
        purpose=standard.purpose,
        element_id=element_id,
        professional_area_code=standard.professional_area_code,
        okved_codes=okved_codes or None,
        status=status,
        revoked_date=revoked_date,
        ps_code=_pick("ps_code"),
        okved_units=okved_units,
        opd_code=standard.opd_code,
        opd_name=standard.opd_name,
        okz_group_code=standard.okz_group_code,
        okz_group_name=standard.okz_group_name,
        developer_org=_pick("developer_org"),
        developer_head=_pick("developer_head"),
        co_developers=standard.co_developers or preserved.get("co_developers"),
        effective_date=_pick("effective_date"),
        expiration_date=_pick("expiration_date"),
        abbreviations=standard.abbreviations or preserved.get("abbreviations"),
        source_xml=source_xml,
        source_html=source_html,
        source_kind=source_kind,
    )
    session.add(std_raw)
    session.flush()

    for gf in standard.generalized_functions:
        okz_units = _units_to_json(gf.okz_units)
        okpdtr_units = _units_to_json(gf.okpdtr_units)
        okso_units = _units_to_json(gf.okso_units)
        etks_units = _units_to_json(gf.etks_units)
        gf_raw = GeneralizedFunctionRaw(
            standard_id=std_raw.id,
            code=gf.code,
            name=gf.name,
            level=gf.level,
            possible_job_titles=gf.possible_job_titles,
            okz_codes=_codes_from_units(gf.okz_units, gf.okz_codes),
            okpdtr_codes=_codes_from_units(gf.okpdtr_units, gf.okpdtr_codes),
            okso_codes=_codes_from_units(gf.okso_units, gf.okso_codes),
            okz_units=okz_units,
            okpdtr_units=okpdtr_units,
            okso_units=okso_units,
            etks_units=etks_units,
            education_training=gf.education_training,
            practical_experience=gf.practical_experience,
            special_admission=gf.special_admission,
            other_characteristics=gf.other_characteristics,
        )
        session.add(gf_raw)
        session.flush()
        for pf in gf.particular_functions:
            pf_raw = ParticularFunctionRaw(
                generalized_id=gf_raw.id,
                code=pf.code,
                name=pf.name,
                sub_qualification=pf.sub_qualification,
                other_characteristics=pf.other_characteristics,
            )
            session.add(pf_raw)
            session.flush()
            for la in pf.labor_actions:
                session.add(
                    LaborActionRaw(
                        particular_id=pf_raw.id,
                        text=la.text if isinstance(la, LaborAction) else la,
                    )
                )
            for skill_text in pf.required_skills or []:
                session.add(SkillRaw(particular_id=pf_raw.id, text=skill_text))
            for know_text in pf.necessary_knowledges or []:
                session.add(KnowledgeRaw(particular_id=pf_raw.id, text=know_text))
    session.commit()
    return std_raw


def apply_registry_metadata(
    session: Session,
    reg_number: str,
    *,
    ps_code: str | None = None,
    developer_org: str | None = None,
    effective_date: str | None = None,
    expiration_date: str | None = None,
) -> bool:
    """Обновляет метаданные реестра без перезаписи дерева ОТФ."""
    std = session.query(StandardRaw).filter(StandardRaw.reg_number == reg_number).first()
    if not std:
        return False
    if ps_code and not std.ps_code:
        std.ps_code = ps_code
        if not std.professional_area_code and "." in ps_code:
            std.professional_area_code = ps_code.split(".")[0]
    if developer_org and not std.developer_org:
        std.developer_org = developer_org
    if effective_date and not std.effective_date:
        std.effective_date = effective_date
    if expiration_date and not std.expiration_date:
        std.expiration_date = expiration_date
    session.commit()
    return True
