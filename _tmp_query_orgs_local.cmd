@echo off
chcp 65001 >nul
cd /d C:\IT\DRC\backend
python -c "import sqlite3; c=sqlite3.connect('profstandart.db'); rows=c.execute(\"SELECT organization, COUNT(*) AS users FROM users WHERE organization IS NOT NULL AND TRIM(organization) != '' GROUP BY organization ORDER BY organization COLLATE NOCASE\").fetchall(); print('organization\tusers'); [print(f'{o}\t{n}') for o,n in rows]; print('---'); print('orgs:', len(rows)); print('users:', sum(n for _,n in rows))"
