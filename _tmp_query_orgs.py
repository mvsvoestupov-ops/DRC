"""Read-only: unique users.organization values from DRC SQLite. Run on server."""
import sqlite3
from pathlib import Path

candidates = [
    Path("/opt/drc/backend/profstandart.db"),
    Path("/opt/drc/backend/app/profstandart.db"),
]
db = next((p for p in candidates if p.is_file()), None)
if db is None:
    found = sorted(Path("/opt/drc").rglob("*.db"))
    db = found[0] if found else None
if db is None:
    raise SystemExit("No sqlite db under /opt/drc")

print(f"DB={db}")
con = sqlite3.connect(str(db))
con.row_factory = sqlite3.Row
cur = con.cursor()
rows = cur.execute(
    """
    SELECT organization AS organization, COUNT(*) AS users
    FROM users
    WHERE organization IS NOT NULL AND TRIM(organization) != ''
    GROUP BY organization
    ORDER BY organization COLLATE NOCASE
    """
).fetchall()
print(f"unique_orgs={len(rows)}")
print("---")
for r in rows:
    print(f"{r['users']}\t{r['organization']}")
con.close()
