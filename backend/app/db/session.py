from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import os

# Для демо используем SQLite, но можно переключить на PostgreSQL через переменную окружения
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./profstandart.db")
# Для PostgreSQL пример: "postgresql://user:pass@localhost/profstandart"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
from sqlalchemy import text
with engine.connect() as conn:
    conn.execute(text("""
        CREATE VIRTUAL TABLE IF NOT EXISTS fts_standards_fts USING fts5(
            name, kind_activity, purpose, labor_functions_text, content=fts_standards
        )
    """))
    conn.commit()