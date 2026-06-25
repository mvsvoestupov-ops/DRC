from pydantic import BaseModel
from typing import List, Optional

class LaborAction(BaseModel):
    text: str

class ParticularWorkFunction(BaseModel):
    code: str
    name: str
    sub_qualification: str
    labor_actions: List[LaborAction]
    required_skills: Optional[List[str]] = []
    necessary_knowledges: Optional[List[str]] = []

class GeneralizedWorkFunction(BaseModel):
    code: str
    name: str
    level: str
    possible_job_titles: List[str]
    particular_functions: List[ParticularWorkFunction]
    # Новые поля для классификаторов
    okz_codes: Optional[List[str]] = []
    okpdtr_codes: Optional[List[str]] = []
    okso_codes: Optional[List[str]] = []

class ProfessionalStandard(BaseModel):
    name: str
    registration_number: str
    order_number: str
    approval_date: str
    kind_activity: str
    purpose: str
    generalized_functions: List[GeneralizedWorkFunction]
    # Новые поля для ПС
    professional_area_code: Optional[str] = None
    okved_codes: Optional[List[str]] = []