from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from .parser import parse_xml, fetch_all_standards_bulk
from .db import SessionLocal, Base, engine
from .db.raw_models import StandardRaw
from .db_operations import save_raw_standard
from .enrichment import enrich_standard
import os

# Создаём таблицы при старте (если ещё нет)
Base.metadata.create_all(bind=engine)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    content = await file.read()
    try:
        standard = parse_xml(content)
        session = SessionLocal()
        try:
            # При загрузке через интерфейс element_id неизвестен, передаём None
            save_raw_standard(session, standard, element_id=None)
            session.commit()
        finally:
            session.close()
        return {"message": "success", "reg_number": standard.registration_number}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/standards")
async def list_standards():
    """Возвращает список стандартов из raw-БД."""
    session = SessionLocal()
    try:
        standards = session.query(StandardRaw).all()
        return [{"name": s.name, "reg_number": s.reg_number, "date": s.approval_date} for s in standards]
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
            "registration_number": std.reg_number,
            "name": std.name,
            "order_number": std.order_number,
            "approval_date": std.approval_date,
            "kind_activity": std.kind_activity,
            "purpose": std.purpose,
            "generalized_functions": []
        }
        for gf in std.generalized_functions:
            gf_dict = {
                "code": gf.code,
                "name": gf.name,
                "level": gf.level,
                "possible_job_titles": gf.possible_job_titles,
                "particular_functions": []
            }
            for pf in gf.particular_functions:
                pf_dict = {
                    "code": pf.code,
                    "name": pf.name,
                    "sub_qualification": pf.sub_qualification,
                    "labor_actions": [{"text": la.text} for la in pf.labor_actions],
                    "required_skills": [s.text for s in pf.skills],    # из raw-таблиц
                    "necessary_knowledges": [k.text for k in pf.knowledges]
                }
                gf_dict["particular_functions"].append(pf_dict)
            result["generalized_functions"].append(gf_dict)
        return result
    finally:
        session.close()

@app.post("/fetch-registry-bulk")
async def fetch_registry_bulk():
    """
    Загружает стандарты из реестра и сохраняет в raw-БД.
    """
    try:
        results = fetch_all_standards_bulk()
        return {"status": "ok", "loaded": results}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/run-enrichment")
async def run_enrichment(reg_number: str = None):
    """
    Запускает обогащение для одного стандарта (по reg_number) или для всех.
    """
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
        
        # Рекурсивное преобразование в словарь
        def serialize_standard(std_obj):
            result = {
                "id": std_obj.id,
                "reg_number": std_obj.reg_number,
                "name": std_obj.name,
                "order_number": std_obj.order_number,
                "approval_date": std_obj.approval_date,
                "kind_activity": std_obj.kind_activity,
                "purpose": std_obj.purpose,
                "generalized_functions": []
            }
            for gf in std_obj.generalized_functions:
                gf_dict = {
                    "code": gf.code,
                    "name": gf.name,
                    "level": gf.level,
                    "possible_job_titles": gf.possible_job_titles,
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