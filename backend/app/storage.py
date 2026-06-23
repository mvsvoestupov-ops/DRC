from typing import Dict, List
from .models import ProfessionalStandard

storage: Dict[str, ProfessionalStandard] = {}

def save_standard(standard: ProfessionalStandard):
    storage[standard.registration_number] = standard

def get_all() -> List[ProfessionalStandard]:
    return list(storage.values())

def get_by_reg(reg: str) -> ProfessionalStandard:
    return storage.get(reg)