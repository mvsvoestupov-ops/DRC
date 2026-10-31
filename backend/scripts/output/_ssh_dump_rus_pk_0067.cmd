@echo off
setlocal
set KEY=%USERPROFILE%\.ssh\id_ed25519_drc
set HOST=root@201.34.149.65
set OUT=C:\IT\DRC\backend\scripts\output\_rus_pk_0067.json
set LOG=C:\IT\DRC\backend\scripts\output\_rus_pk_0067_ssh.log
echo [%date% %time%] start>>"%LOG%"
scp -i "%KEY%" -o StrictHostKeyChecking=accept-new C:\IT\DRC\backend\scripts\output\_dump_rus_pk_0067_remote.py %HOST%:/tmp/_dump_rus_pk_0067.py>>"%LOG%" 2>&1
if errorlevel 1 goto fail
ssh -i "%KEY%" %HOST% "cd /opt/drc/backend && (test -x venv/bin/python && venv/bin/python /tmp/_dump_rus_pk_0067.py || python3 /tmp/_dump_rus_pk_0067.py)">"%OUT%" 2>>"%LOG%"
if errorlevel 1 goto fail
echo [%date% %time%] ok>>"%LOG%"
exit /b 0
:fail
echo [%date% %time%] fail>>"%LOG%"
exit /b 1
