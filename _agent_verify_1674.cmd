@echo off
chcp 65001 >nul
set "OUT=C:\IT\DRC\backend\scripts\output\_server_1674_verify.txt"
set "SSH_KEY=%USERPROFILE%\.ssh\id_ed25519_drc"
if not exist "%SSH_KEY%" set "SSH_KEY=%USERPROFILE%\.ssh\id_ed25519"
echo === verify 1674 C/05.6 on server %date% %time% === > "%OUT%"
ssh -i "%SSH_KEY%" -p 22 -o StrictHostKeyChecking=accept-new root@201.34.149.65 "cd /opt/drc/backend && venv/bin/python -u -c \"import sqlite3; con=sqlite3.connect('profstandart.db'); con.row_factory=sqlite3.Row; std=con.execute('SELECT id FROM raw_standards WHERE reg_number=?',('1674',)).fetchone(); assert std; otf=con.execute('SELECT id FROM raw_generalized_functions WHERE standard_id=? AND trim(code) LIKE \\\"C%\\\" ORDER BY id LIMIT 1',(std['id'],)).fetchone(); pfs=con.execute('SELECT code,name FROM raw_particular_functions WHERE generalized_id=? ORDER BY id',(otf['id'],)).fetchall() if otf else []; codes=[(r['code'],r['name']) for r in pfs]; has=any('05.6' in (c or '').replace(' ','') for c,_ in codes); print('has_C_05_6=',has); print('tf_count=',len(codes)); [print(c, '|', n[:80] if n else '') for c,n in codes if '05' in (c or '')]\"" >> "%OUT%" 2>&1
exit /b 0
