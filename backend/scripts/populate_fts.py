import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from app.db import SessionLocal
from app.db.raw_models import StandardRaw
from sqlalchemy import text

def populate_fts():
    session = SessionLocal()
    # Очищаем основную таблицу (FTS-индекс обновится автоматически, если настроены триггеры,
    # но мы перестроим его вручную в конце)
    print("Очистка таблицы fts_standards...")
    session.execute(text("DELETE FROM fts_standards"))
    session.commit()

    print("Загрузка стандартов...")
    standards = session.query(StandardRaw).all()
    total = len(standards)
    print(f"Найдено стандартов: {total}")

    for idx, std in enumerate(standards, 1):
        if idx % 100 == 0:
            print(f"Обработано {idx}/{total}...")
        # Собираем все тексты
        texts = []
        for gf in std.generalized_functions:
            texts.append(gf.name or "")
            for pf in gf.particular_functions:
                texts.append(pf.name or "")
                for la in pf.labor_actions:
                    texts.append(la.text or "")
        labor_text = " ".join(texts)

        # Вставляем в основную таблицу
        session.execute(
            text("""
                INSERT INTO fts_standards (standard_id, name, kind_activity, purpose, labor_functions_text)
                VALUES (:sid, :name, :kind, :purpose, :labor)
            """),
            {
                "sid": std.id,
                "name": std.name or "",
                "kind": std.kind_activity or "",
                "purpose": std.purpose or "",
                "labor": labor_text
            }
        )
        if idx % 200 == 0:
            session.commit()

    session.commit()
    print("Данные вставлены. Перестраиваем FTS-индекс...")
    # Перестраиваем виртуальную таблицу
    session.execute(text("INSERT INTO fts_standards_fts(fts_standards_fts) VALUES('rebuild')"))
    session.commit()
    session.close()
    print(f"Готово! Проиндексировано {total} стандартов.")

if __name__ == "__main__":
    populate_fts()