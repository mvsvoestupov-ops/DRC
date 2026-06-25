from app.db import SessionLocal
from app.db.qualifications_models import Qualification

session = SessionLocal()
quals = session.query(Qualification).limit(20).all()
for q in quals:
    print(q.code, '|', q.prof_standard_name, '|', q.prof_standard_order)
session.close()