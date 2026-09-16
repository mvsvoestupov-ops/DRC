"""Добавление новых колонок в существующую SQLite-базу."""
from __future__ import annotations

from sqlalchemy import inspect, text

from .session import engine


def _add_column_if_missing(table: str, column: str, ddl: str) -> bool:
    inspector = inspect(engine)
    if table not in inspector.get_table_names():
        return False
    existing = {col["name"] for col in inspector.get_columns(table)}
    if column in existing:
        return False
    with engine.connect() as conn:
        conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {ddl}"))
        conn.commit()
    return True


def ensure_ps_status_columns() -> list[str]:
    added: list[str] = []
    specs = (
        ("raw_standards", "status", "status VARCHAR DEFAULT 'active'"),
        ("raw_standards", "revoked_date", "revoked_date VARCHAR"),
        ("enriched_standards", "status", "status VARCHAR DEFAULT 'active'"),
        ("enriched_standards", "revoked_date", "revoked_date VARCHAR"),
    )
    for table, column, ddl in specs:
        if _add_column_if_missing(table, column, ddl):
            added.append(f"{table}.{column}")
    return added


def ensure_maket_columns() -> list[str]:
    """Колонки макета ПС (I–V) + source blobs."""
    added: list[str] = []
    standard_specs = (
        ("ps_code", "ps_code VARCHAR"),
        ("okved_units", "okved_units JSON"),
        ("opd_code", "opd_code VARCHAR"),
        ("opd_name", "opd_name TEXT"),
        ("okz_group_code", "okz_group_code VARCHAR"),
        ("okz_group_name", "okz_group_name TEXT"),
        ("developer_org", "developer_org TEXT"),
        ("developer_head", "developer_head TEXT"),
        ("co_developers", "co_developers JSON"),
        ("effective_date", "effective_date VARCHAR"),
        ("expiration_date", "expiration_date VARCHAR"),
        ("abbreviations", "abbreviations JSON"),
        ("source_xml", "source_xml TEXT"),
        ("source_html", "source_html TEXT"),
        ("source_kind", "source_kind VARCHAR"),
    )
    for column, ddl in standard_specs:
        if _add_column_if_missing("raw_standards", column, ddl):
            added.append(f"raw_standards.{column}")

    gf_specs = (
        ("okz_units", "okz_units JSON"),
        ("okpdtr_units", "okpdtr_units JSON"),
        ("okso_units", "okso_units JSON"),
        ("etks_units", "etks_units JSON"),
        ("education_training", "education_training TEXT"),
        ("practical_experience", "practical_experience TEXT"),
        ("special_admission", "special_admission TEXT"),
        ("other_characteristics", "other_characteristics TEXT"),
    )
    for column, ddl in gf_specs:
        if _add_column_if_missing("raw_generalized_functions", column, ddl):
            added.append(f"raw_generalized_functions.{column}")

    if _add_column_if_missing("raw_particular_functions", "other_characteristics", "other_characteristics TEXT"):
        added.append("raw_particular_functions.other_characteristics")

    return added


def ensure_spk_columns() -> list[str]:
    added: list[str] = []
    if _add_column_if_missing("raw_standards", "spk_name", "spk_name TEXT"):
        added.append("raw_standards.spk_name")
    return added


def ensure_users_columns() -> list[str]:
    """Колонки таблицы users (миграция существующей БД)."""
    added: list[str] = []
    if _add_column_if_missing("users", "is_active", "is_active BOOLEAN DEFAULT 1"):
        added.append("users.is_active")
    return added


def ensure_fgos_columns() -> list[str]:
    """Колонки таблицы fgos_spo (миграция существующей БД)."""
    added: list[str] = []
    specs = (
        ("kind", "kind VARCHAR(20) DEFAULT 'specialty'"),
        ("industry_code", "industry_code VARCHAR(20)"),
        ("industry_name", "industry_name TEXT"),
        ("group_code", "group_code VARCHAR(20)"),
        ("group_name", "group_name TEXT"),
        ("order_date", "order_date VARCHAR(50)"),
        ("order_number", "order_number VARCHAR(50)"),
        ("source_url", "source_url VARCHAR(512)"),
        ("qualification_tracks", "qualification_tracks JSON"),
        ("category", "category VARCHAR(32) DEFAULT 'spo'"),
    )
    for column, ddl in specs:
        if _add_column_if_missing("fgos_spo", column, ddl):
            added.append(f"fgos_spo.{column}")

    # Проставить category=spo существующим записям без категории
    inspector = inspect(engine)
    if "fgos_spo" in inspector.get_table_names():
        cols = {col["name"] for col in inspector.get_columns("fgos_spo")}
        if "category" in cols:
            with engine.connect() as conn:
                conn.execute(
                    text("UPDATE fgos_spo SET category = 'spo' WHERE category IS NULL OR category = ''")
                )
                conn.commit()
    return added


def ensure_competence_public_code_column() -> list[str]:
    added: list[str] = []
    if _add_column_if_missing("competences", "public_code", "public_code VARCHAR(32)"):
        added.append("competences.public_code")
    return added


def ensure_assessment_tools_columns() -> list[str]:
    """Статус ревизии ОС: active / inactive."""
    added: list[str] = []
    if _add_column_if_missing(
        "assessment_tools",
        "status",
        "status VARCHAR(20) DEFAULT 'active'",
    ):
        added.append("assessment_tools.status")
    return added
