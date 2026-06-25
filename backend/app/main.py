from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from .parser import parse_xml, fetch_all_standards_bulk, find_element_id_by_reg_number
from .db import SessionLocal, Base, engine
from .db.raw_models import StandardRaw
from .db.qualifications_models import Qualification
from .db.competence_models import Competence, CompetenceStatus
from .db_operations import save_raw_standard
from .enrichment import enrich_standard
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import os

Base.metadata.create_all(bind=engine)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------- Профессиональные стандарты ----------

@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
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

@app.get("/standards")
async def list_standards():
    session = SessionLocal()
    try:
        standards = session.query(StandardRaw).all()
        return [{"id": s.id, "name": s.name, "reg_number": s.reg_number, "date": s.approval_date} for s in standards]
    finally:
        session.close()

@app.get("/standards/{standard_id}/labor-functions")
async def get_labor_functions(standard_id: int):
    session = SessionLocal()
    try:
        std = session.query(StandardRaw).filter(StandardRaw.id == standard_id).first()
        if not std:
            raise HTTPException(404, "Стандарт не найден")
        result = []
        for gf in std.generalized_functions:
            for pf in gf.particular_functions:
                result.append({
                    "id": pf.id,
                    "code": pf.code,
                    "name": pf.name,
                    "otf_code": gf.code,
                    "otf_name": gf.name,
                })
        return result
    finally:
        session.close()

@app.get("/qualifications/by-standard/{standard_id}")
async def get_qualifications_by_standard(standard_id: int):
    session = SessionLocal()
    try:
        quals = session.query(Qualification).filter(Qualification.prof_standard_id == standard_id).all()
        return quals
    finally:
        session.close()

@app.get("/standards/{reg_number}")
async def get_standard(reg_number: str):
    session = SessionLocal()
    try:
        std = session.query(StandardRaw).filter(StandardRaw.reg_number == reg_number).first()
        if not std:
            raise HTTPException(status_code=404, detail="Standard not found")
        result = {
            "reg_number": std.reg_number,
            "registration_number": std.reg_number,
            "name": std.name,
            "order_number": std.order_number,
            "approval_date": std.approval_date,
            "kind_activity": std.kind_activity,
            "purpose": std.purpose,
            "professional_area_code": std.professional_area_code,
            "okved_codes": std.okved_codes,
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
                "particular_functions": []
            }
            for pf in gf.particular_functions:
                pf_dict = {
                    "code": pf.code,
                    "name": pf.name,
                    "sub_qualification": pf.sub_qualification,
                    "labor_actions": [{"text": la.text} for la in pf.labor_actions],
                    "required_skills": [s.text for s in pf.skills],
                    "necessary_knowledges": [k.text for k in pf.knowledges]
                }
                gf_dict["particular_functions"].append(pf_dict)
            result["generalized_functions"].append(gf_dict)
        return result
    finally:
        session.close()

@app.post("/fetch-registry-bulk")
async def fetch_registry_bulk():
    try:
        results = fetch_all_standards_bulk()
        return {"status": "ok", "loaded": results}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/run-enrichment")
async def run_enrichment(reg_number: str = None):
    session = SessionLocal()
    try:
        if reg_number:
            enrich_standard(reg_number, session)
            return {"status": "ok", "processed": [reg_number]}
        else:
            standards = session.query(StandardRaw).all()
            processed = []
            for std in standards:
                try:
                    enrich_standard(std.reg_number, session)
                    processed.append(std.reg_number)
                except Exception as e:
                    print(f"Ошибка при обогащении {std.reg_number}: {e}")
            return {"status": "ok", "processed": processed}
    finally:
        session.close()

@app.get("/enriched-standards")
async def list_enriched_standards():
    session = SessionLocal()
    try:
        from .db.enriched_models import EnrichedStandard
        standards = session.query(EnrichedStandard).all()
        return [{"name": s.name, "reg_number": s.reg_number, "date": s.approval_date} for s in standards]
    finally:
        session.close()

@app.get("/enriched-standards/{reg_number}")
async def get_enriched_standard(reg_number: str):
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

# ---------- Квалификации ----------

@app.get("/qualifications")
async def list_qualifications():
    session = SessionLocal()
    try:
        quals = session.query(Qualification).all()
        return quals
    finally:
        session.close()

@app.get("/qualifications/{id}")
async def get_qualification(id: int):
    session = SessionLocal()
    try:
        q = session.query(Qualification).filter(Qualification.id == id).first()
        if not q:
            raise HTTPException(404, "Квалификация не найдена")
        return q
    finally:
        session.close()

# ---------- Компетенции ----------

class CompetenceCreate(BaseModel):
    name: str
    qualification_name: str
    qualification_level: str
    prof_standard_id: int
    qualification_id: Optional[int] = None
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

class CompetenceUpdate(BaseModel):
    name: Optional[str] = None
    qualification_name: Optional[str] = None
    qualification_level: Optional[str] = None
    prof_standard_id: Optional[int] = None
    qualification_id: Optional[int] = None
    labor_functions: Optional[List[Dict]] = None
    structure: Optional[Dict] = None
    descriptors: Optional[Dict] = None
    discipline_mapping: Optional[List[Dict]] = None
    ed_technologies: Optional[List[str]] = None
    assessment_tools: Optional[List[Dict]] = None
    resources: Optional[List[str]] = None
    developer: Optional[str] = None
    validator: Optional[str] = None
    status: Optional[str] = None
    description: Optional[str] = None
    industry: Optional[str] = None
    hours: Optional[str] = None

@app.post("/competences")
async def create_competence(data: CompetenceCreate):
    session = SessionLocal()
    try:
        std = session.query(StandardRaw).filter(StandardRaw.id == data.prof_standard_id).first()
        if not std:
            raise HTTPException(404, "Профессиональный стандарт не найден")
        if data.qualification_id:
            qual = session.query(Qualification).filter(Qualification.id == data.qualification_id).first()
            if not qual:
                raise HTTPException(404, "Квалификация не найдена")
        new_comp = Competence(
            name=data.name,
            qualification_name=data.qualification_name,
            qualification_level=data.qualification_level,
            prof_standard_id=data.prof_standard_id,
            qualification_id=data.qualification_id,
            labor_functions=data.labor_functions,
            structure=data.structure,
            descriptors=data.descriptors or {},
            discipline_mapping=data.discipline_mapping or [],
            ed_technologies=data.ed_technologies or [],
            assessment_tools=data.assessment_tools,
            resources=data.resources or [],
            developer=data.developer,
            validator=data.validator,
            status=CompetenceStatus(data.status) if data.status else CompetenceStatus.DRAFT,
            # дополнительные поля (опционально, но сохраним в JSON)
            raw_data={
                "description": data.description,
                "industry": data.industry,
                "hours": data.hours
            }
        )
        session.add(new_comp)
        session.commit()
        session.refresh(new_comp)
        return new_comp
    except Exception as e:
        session.rollback()
        raise HTTPException(400, detail=str(e))
    finally:
        session.close()

@app.get("/competences")
async def list_competences():
    session = SessionLocal()
    try:
        competences = session.query(Competence).filter(Competence.is_active == 1).all()
        return competences
    finally:
        session.close()

@app.get("/competences/stats")
async def get_competence_stats():
    session = SessionLocal()
    try:
        total = session.query(Competence).filter(Competence.is_active == 1).count()
        active = session.query(Competence).filter(Competence.status == CompetenceStatus.APPROVED, Competence.is_active == 1).count()
        review = session.query(Competence).filter(Competence.status == CompetenceStatus.REVIEW, Competence.is_active == 1).count()
        archived = session.query(Competence).filter(Competence.is_active == 0).count()
        return {"total": total, "active": active, "review": review, "archived": archived}
    finally:
        session.close()

@app.get("/competences/{comp_id}")
async def get_competence(comp_id: int):
    session = SessionLocal()
    try:
        comp = session.query(Competence).filter(Competence.id == comp_id).first()
        if not comp:
            raise HTTPException(404, "Компетенция не найдена")
        return comp
    finally:
        session.close()

@app.put("/competences/{comp_id}")
async def update_competence(comp_id: int, data: CompetenceUpdate):
    session = SessionLocal()
    try:
        comp = session.query(Competence).filter(Competence.id == comp_id).first()
        if not comp:
            raise HTTPException(404, "Компетенция не найдена")
        for key, value in data.dict(exclude_unset=True).items():
            if hasattr(comp, key):
                if key == "status" and value:
                    setattr(comp, key, CompetenceStatus(value))
                else:
                    setattr(comp, key, value)
        session.commit()
        session.refresh(comp)
        return comp
    finally:
        session.close()

@app.delete("/competences/{comp_id}")
async def delete_competence(comp_id: int):
    session = SessionLocal()
    try:
        comp = session.query(Competence).filter(Competence.id == comp_id).first()
        if not comp:
            raise HTTPException(404, "Компетенция не найдена")
        comp.is_active = 0
        session.commit()
        return {"status": "ok"}
    finally:
        session.close()

# ---------- Расчёт покрытия ----------

class CoverageRequest(BaseModel):
    standard_id: int
    selected_tf_codes: List[str]

@app.post("/competence/coverage")
async def calculate_coverage(req: CoverageRequest):
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