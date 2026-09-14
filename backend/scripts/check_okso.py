from app.db import SessionLocal
from app.db.enriched_models import EnrichedStandard

session = SessionLocal()

# Проверим, есть ли вообще обогащённые стандарты
stds = session.query(EnrichedStandard).limit(10).all()
if not stds:
    print("❌ В таблице enriched_standards нет записей. Сначала запустите обогащение.")
else:
    print(f"Найдено {len(stds)} обогащённых стандартов (первые 10):")
    for std in stds:
        print(f"\nСтандарт: {std.reg_number} – {std.name}")
        for gf in std.generalized_functions:
            if gf.okso_codes:
                print(f"  ОТФ {gf.code}: ОКСО = {gf.okso_codes}")
            else:
                print(f"  ОТФ {gf.code}: ОКСО отсутствуют")

session.close()