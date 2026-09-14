from .base import Base
from .raw_models import *
from .enriched_models import *
from .qualifications_models import Qualification
from .assessment_tools_models import AssessmentTool
from .user_models import User
from .competence_models import Competence, CompetenceStatus
from .fgos_models import FgosSpo          # <-- добавить
from .session import engine, SessionLocal
from .feedback_models import Feedback
from .registration_models import Registration
from .fts_models import FtsStandard  # noqa: F401 — таблица fts_standards для поиска
from .prof_training_models import ProfTrainingProfession  # noqa: F401
