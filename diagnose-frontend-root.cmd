@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

set "SSH_HOST=201.34.149.65"
set "SSH_PORT=22"
set "SSH_USER=root"
set "SSH_KEY=%USERPROFILE%\.ssh\id_ed25519_drc"
if not exist "%SSH_KEY%" if exist "%USERPROFILE%\.ssh\id_ed25519" set "SSH_KEY=%USERPROFILE%\.ssh\id_ed25519"
if not exist "%SSH_KEY%" if exist "%USERPROFILE%\.ssh\id_rsa" set "SSH_KEY=%USERPROFILE%\.ssh\id_rsa"
set "SSH_OPTS=-p %SSH_PORT% -o StrictHostKeyChecking=accept-new"
if exist "%SSH_KEY%" set "SSH_OPTS=-i %SSH_KEY% -p %SSH_PORT% -o StrictHostKeyChecking=accept-new"

echo == nginx: куда смотрит drc.ao-nk.online
ssh %SSH_OPTS% %SSH_USER%@%SSH_HOST% "echo '--- server_name / root / alias ---'; grep -RIn --include='*.conf' -E 'server_name|root |alias |drc\.ao-nk' /etc/nginx 2>/dev/null | head -n 80; echo; echo '--- index.html hashes ---'; md5sum /opt/drc/frontend/dist/index.html /opt/drc/frontend/build/index.html /opt/veche_rg/frontend/build/index.html 2>/dev/null; echo; echo '--- JS in dist index ---'; grep -oE 'assets/index-[A-Za-z0-9_-]+\\.js' /opt/drc/frontend/dist/index.html 2>/dev/null; echo '--- JS in build index ---'; grep -oE 'assets/index-[A-Za-z0-9_-]+\\.js' /opt/drc/frontend/build/index.html 2>/dev/null; echo; echo '--- curl local host header ---'; curl -sS -H 'Host: drc.ao-nk.online' http://127.0.0.1/ | grep -oE 'assets/index-[A-Za-z0-9_-]+\\.(js|css)' | head -n 10; echo; echo '--- WG marker in served? ---'; JS=\$(curl -sS -H 'Host: drc.ao-nk.online' http://127.0.0.1/ | grep -oE '/assets/index-[A-Za-z0-9_-]+\\.js' | head -n1); echo served_js=\$JS; if [ -n \"\$JS\" ]; then curl -sS -H 'Host: drc.ao-nk.online' \"http://127.0.0.1\$JS\" | grep -o 'alreadyMember\|bg-primary/5\|CheckCircle' | sort -u | head; fi"

echo.
echo == public https index assets
curl -sS https://drc.ao-nk.online/ | findstr /R "assets/index-"
endlocal
