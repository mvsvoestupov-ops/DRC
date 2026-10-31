import json
import os
import sqlite3

paths = [
    "/opt/drc/backend/profstandart.db",
    "/var/www/drc.ao-nk.online/backend/profstandart.db",
    "/var/www/drc.ao-nk.ru/backend/profstandart.db",
    "/opt/drc/backend/app/profstandart.db",
]
db = next((p for p in paths if os.path.exists(p)), None)
if not db:
    raise SystemExit("DB not found")
con = sqlite3.connect(db)
con.row_factory = sqlite3.Row
row = con.execute("SELECT * FROM competences WHERE id=32").fetchone()
if not row:
    raise SystemExit("competence 32 not found in " + db)
print(json.dumps({"db": db, "row": dict(row)}, ensure_ascii=False, default=str))
