from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from .parser import parse_xml, fetch_all_standards_bulk
from .storage import save_standard, get_all, get_by_reg
import os

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
        save_standard(standard)
        return {"message": "success", "reg_number": standard.registration_number}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/standards")
async def list_standards():
    return [{"name": s.name, "reg_number": s.registration_number, "date": s.approval_date} for s in get_all()]

@app.get("/standards/{reg_number}")
async def get_standard(reg_number: str):
    std = get_by_reg(reg_number)
    if not std:
        raise HTTPException(status_code=404, detail="Standard not found")
    return std.dict()

# Единственный эндпоинт для массовой загрузки
@app.post("/fetch-registry-bulk")
async def fetch_registry_bulk(enrich: bool = True):
    try:
        results = fetch_all_standards_bulk(enrich=enrich)
        return {"status": "ok", "loaded": results}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))