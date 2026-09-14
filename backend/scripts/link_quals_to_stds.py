from app.db import SessionLocal
from app.db.qualifications_models import Qualification
from app.db.raw_models import StandardRaw

session = SessionLocal()
quals = session.query(Qualification).all()
for q in quals:
    if q.prof_standard_name and q.prof_standard_name != 'Нет связанного профессионального стандарта':
        # Ищем ПС по названию (частичное совпадение)
        std = session.query(StandardRaw).filter(
            StandardRaw.name.ilike(f'%{q.prof_standard_name[:30]}%')
        ).first()
        if std:
            q.prof_standard_id = std.id
            print(f"Связано {q.code} -> {std.reg_number} (по названию)")
        else:
            # Ищем по номеру приказа (очищаем)
            if q.prof_standard_order:
                order_clean = q.prof_standard_order.replace('Приказ', '').strip()
                std = session.query(StandardRaw).filter(
                    StandardRaw.order_number.ilike(f'%{order_clean[:20]}%')
                ).first()
                if std:
                    q.prof_standard_id = std.id
                    print(f"Связано {q.code} -> {std.reg_number} (по приказу)")
    session.commit()
session.close()