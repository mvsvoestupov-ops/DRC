@echo off
chcp 65001 >nul
setlocal
set "SSH_HOST=201.34.149.65"
set "SSH_USER=root"
set "SSH_PORT=22"
set "SSH_KEY="
if exist "%USERPROFILE%\.ssh\id_ed25519_drc" set "SSH_KEY=%USERPROFILE%\.ssh\id_ed25519_drc"
if not defined SSH_KEY if exist "%USERPROFILE%\.ssh\id_ed25519" set "SSH_KEY=%USERPROFILE%\.ssh\id_ed25519"
if not defined SSH_KEY if exist "%USERPROFILE%\.ssh\id_rsa" set "SSH_KEY=%USERPROFILE%\.ssh\id_rsa"
if defined SSH_KEY (
  set SSH_OPTS=-i "%SSH_KEY%" -p %SSH_PORT% -o StrictHostKeyChecking=accept-new
) else (
  set SSH_OPTS=-p %SSH_PORT% -o StrictHostKeyChecking=accept-new
)

echo == file / head / counts on server
ssh %SSH_OPTS% %SSH_USER%@%SSH_HOST% "cd /opt/drc && ls -lh ESCO/esco-v1.2.0.rdf; file ESCO/esco-v1.2.0.rdf; echo '--- head ---'; head -c 400 ESCO/esco-v1.2.0.rdf; echo; echo '--- counts ---'; grep -o 'skos:Concept' ESCO/esco-v1.2.0.rdf | head -n 3; grep -c 'skos:Concept' ESCO/esco-v1.2.0.rdf; grep -c '</skos:Concept>' ESCO/esco-v1.2.0.rdf"
endlocal
