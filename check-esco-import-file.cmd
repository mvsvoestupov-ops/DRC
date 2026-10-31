@echo off
chcp 65001 >nul
setlocal
set "SSH_HOST=201.34.149.65"
set "SSH_USER=root"
set "SSH_PORT=22"
set "REMOTE_FILE=/opt/drc/backend/app/esco_rdf_import.py"
set "REMOTE_RDF=/opt/drc/ESCO/esco-v1.2.0.rdf"

set "SSH_KEY="
if exist "%USERPROFILE%\.ssh\id_ed25519_drc" set "SSH_KEY=%USERPROFILE%\.ssh\id_ed25519_drc"
if not defined SSH_KEY if exist "%USERPROFILE%\.ssh\id_ed25519" set "SSH_KEY=%USERPROFILE%\.ssh\id_ed25519"
if not defined SSH_KEY if exist "%USERPROFILE%\.ssh\id_rsa" set "SSH_KEY=%USERPROFILE%\.ssh\id_rsa"

if defined SSH_KEY (
  echo SSH-ключ: %SSH_KEY%
  set SSH_OPTS=-i "%SSH_KEY%" -p %SSH_PORT% -o StrictHostKeyChecking=accept-new -o ConnectTimeout=20
) else (
  echo SSH-ключ не найден — пробую без -i
  set SSH_OPTS=-p %SSH_PORT% -o StrictHostKeyChecking=accept-new -o ConnectTimeout=20
)

echo.
echo == файл импортера на сервере
ssh %SSH_OPTS% %SSH_USER%@%SSH_HOST% "ls -lh %REMOTE_FILE%; echo ---; grep -n 'XMLPullParser\|huge_tree\|iterparse\|_iter_skos_concepts' %REMOTE_FILE% || echo MARKERS_NOT_FOUND"

echo.
echo == RDF на сервере
ssh %SSH_OPTS% %SSH_USER%@%SSH_HOST% "ls -lh %REMOTE_RDF% 2>/dev/null || echo RDF_MISSING"

echo.
echo == версия lxml
ssh %SSH_OPTS% %SSH_USER%@%SSH_HOST% "cd /opt/drc/backend && ./venv/bin/python -c \"import lxml; from lxml import etree; print('lxml', lxml.__version__); print('has_XMLPullParser', hasattr(etree,'XMLPullParser'))\""

echo.
echo Ожидаемо в esco_rdf_import.py: _iter_skos_concepts и XMLPullParser^(huge_tree=True^)
echo Если MARKERS_NOT_FOUND — снова:
echo   scp -P 22 "C:\IT\DRC\backend\app\esco_rdf_import.py" root@201.34.149.65:/opt/drc/backend/app/esco_rdf_import.py
endlocal
exit /b 0
