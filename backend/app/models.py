from pydantic import BaseModel
from typing import List, Optional, Dict, Any


class LaborAction(BaseModel):
    text: str


class ClassifierUnit(BaseModel):
    code: str = ""
    name: str = ""


class ParticularWorkFunction(BaseModel):
    code: str
    name: str
    sub_qualification: str
    labor_actions: List[LaborAction]
    required_skills: Optional[List[str]] = []
    necessary_knowledges: Optional[List[str]] = []
    other_characteristics: Optional[str] = None


class GeneralizedWorkFunction(BaseModel):
    code: str
    name: str
    level: str
    possible_job_titles: List[str]
    particular_functions: List[ParticularWorkFunction]
    # Коды (совместимость) и пары code+name
    okz_codes: Optional[List[str]] = []
    okpdtr_codes: Optional[List[str]] = []
    okso_codes: Optional[List[str]] = []
    okz_units: Optional[List[ClassifierUnit]] = []
    okpdtr_units: Optional[List[ClassifierUnit]] = []
    okso_units: Optional[List[ClassifierUnit]] = []
    etks_units: Optional[List[ClassifierUnit]] = []
    education_training: Optional[str] = None
    practical_experience: Optional[str] = None
    special_admission: Optional[str] = None
    other_characteristics: Optional[str] = None


class ProfessionalStandard(BaseModel):
    name: str
    registration_number: str
    order_number: str
    approval_date: str
    kind_activity: str
    purpose: str
    generalized_functions: List[GeneralizedWorkFunction]
    professional_area_code: Optional[str] = None
    okved_codes: Optional[List[str]] = []
    # Макет I / IV / V
    ps_code: Optional[str] = None
    okved_units: Optional[List[ClassifierUnit]] = []
    opd_code: Optional[str] = None
    opd_name: Optional[str] = None
    okz_group_code: Optional[str] = None
    okz_group_name: Optional[str] = None
    developer_org: Optional[str] = None
    developer_head: Optional[str] = None
    co_developers: Optional[List[str]] = []
    effective_date: Optional[str] = None
    expiration_date: Optional[str] = None
    abbreviations: Optional[List[Dict[str, Any]]] = []
    source_xml: Optional[str] = None
    source_html: Optional[str] = None
    source_kind: Optional[str] = None
