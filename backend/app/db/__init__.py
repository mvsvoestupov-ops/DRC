from .base import Base
from .raw_models import *
from .enriched_models import *
from .qualifications_models import Qualification
from .competence_models import Competence, CompetenceStatus
from .fgos_models import FgosSpo          # <-- добавить
from .session import engine, SessionLocal