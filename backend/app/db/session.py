from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import sessionmaker
import os

# Для демо используем SQLite, но можно переключить на PostgreSQL через переменную окружения
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./profstandart.db")
# Для PostgreSQL пример: "postgresql://user:pass@localhost/profstandart"

_sqlite = "sqlite" in DATABASE_URL
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False, "timeout": 60} if _sqlite else {},
)


@event.listens_for(engine, "connect")
def _sqlite_on_connect(dbapi_connection, connection_record):
    """PRAGMA на каждое соединение: WAL и более быстрый sync для чтения списков."""
    if not _sqlite:
        return
    cursor = dbapi_connection.cursor()
    try:
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.execute("PRAGMA busy_timeout=60000")
        cursor.execute("PRAGMA temp_store=MEMORY")
        cursor.execute("PRAGMA cache_size=-65536")  # ~64 MiB
        cursor.execute("PRAGMA mmap_size=268435456")  # 256 MiB
        cursor.execute("PRAGMA foreign_keys=ON")
    finally:
        cursor.close()


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

with engine.connect() as conn:
    if _sqlite:
        conn.execute(text("PRAGMA journal_mode=WAL"))
        conn.execute(text("PRAGMA busy_timeout=60000"))
    conn.execute(text("""
        CREATE VIRTUAL TABLE IF NOT EXISTS fts_standards_fts USING fts5(
            name, kind_activity, purpose, labor_functions_text, content=fts_standards
        )
    """))
    conn.commit()
