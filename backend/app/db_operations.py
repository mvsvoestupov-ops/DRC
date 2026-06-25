from sqlalchemy.orm import Session
from .db.raw_models import (
    StandardRaw, GeneralizedFunctionRaw, ParticularFunctionRaw,
    LaborActionRaw, SkillRaw, KnowledgeRaw
)
from .models import ProfessionalStandard, LaborAction

def save_raw_standard(session: Session, standard: ProfessionalStandard, element_id: str = None):
    # Проверяем, есть ли уже такой стандарт
    existing = session.query(StandardRaw).filter(StandardRaw.reg_number == standard.registration_number).first()
    if existing:
        session.delete(existing)
        session.commit()

    # Создаём стандарт с новыми полями
    std_raw = StandardRaw(
        reg_number=standard.registration_number,
        name=standard.name,
        order_number=standard.order_number,
        approval_date=standard.approval_date,
        kind_activity=standard.kind_activity,
        purpose=standard.purpose,
        element_id=element_id,
        professional_area_code=standard.professional_area_code,
        okved_codes=standard.okved_codes
    )
    session.add(std_raw)
    session.flush()

    for gf in standard.generalized_functions:
        gf_raw = GeneralizedFunctionRaw(
            standard_id=std_raw.id,
            code=gf.code,
            name=gf.name,
            level=gf.level,
            possible_job_titles=gf.possible_job_titles,
            okz_codes=gf.okz_codes,
            okpdtr_codes=gf.okpdtr_codes,
            okso_codes=gf.okso_codes
        )
        session.add(gf_raw)
        session.flush()
        for pf in gf.particular_functions:
            pf_raw = ParticularFunctionRaw(
                generalized_id=gf_raw.id,
                code=pf.code,
                name=pf.name,
                sub_qualification=pf.sub_qualification
            )
            session.add(pf_raw)
            session.flush()
            for la in pf.labor_actions:
                la_raw = LaborActionRaw(
                    particular_id=pf_raw.id,
                    text=la.text if isinstance(la, LaborAction) else la
                )
                session.add(la_raw)
    session.commit()