@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul
set "OUT=C:\IT\DRC\backend\scripts\output\_server_health.txt"
set "RAW=C:\IT\DRC\backend\scripts\output\_server_health_raw.txt"
set "SSH_HOST=201.34.149.65"
set "SSH_USER=root"
set "SSH_KEY=%USERPROFILE%\.ssh\id_ed25519_drc"
set "SSH_OPTS=-p 22 -o StrictHostKeyChecking=accept-new -o ConnectTimeout=15"
if exist "%SSH_KEY%" set "SSH_OPTS=-i %SSH_KEY% -p 22 -o StrictHostKeyChecking=accept-new -o ConnectTimeout=15"

> "%RAW%" echo === DRC server health raw %date% %time% ===
>>"%RAW%" echo.

>>"%RAW%" echo === 1. curl -I (public) ===
curl -I -sS -m 20 https://drc.ao-nk.online 2>&1>>"%RAW%"
>>"%RAW%" echo.
curl -I -sS -m 20 https://drc.ao-nk.online/api/ 2>&1>>"%RAW%"
>>"%RAW%" echo.
curl -I -sS -m 20 https://drc.ao-nk.online/docs 2>&1>>"%RAW%"
>>"%RAW%" echo.
curl -I -sS -m 20 https://drc.ao-nk.online/health 2>&1>>"%RAW%"
>>"%RAW%" echo.

>>"%RAW%" echo === 2. systemctl drc-backend nginx ===
ssh %SSH_OPTS% %SSH_USER%@%SSH_HOST% "systemctl is-active drc-backend 2>/dev/null; systemctl is-active nginx 2>/dev/null; echo '---'; systemctl --no-pager --lines=12 status drc-backend 2>&1; echo '---'; systemctl --no-pager --lines=12 status nginx 2>&1" 2>&1>>"%RAW%"
>>"%RAW%" echo.

>>"%RAW%" echo === 3. memory disk uptime ===
ssh %SSH_OPTS% %SSH_USER%@%SSH_HOST% "free -h; echo '---'; df -h /; echo '---'; uptime" 2>&1>>"%RAW%"
>>"%RAW%" echo.

>>"%RAW%" echo === 4. journalctl drc-backend ===
ssh %SSH_OPTS% %SSH_USER%@%SSH_HOST% "journalctl -u drc-backend -n 40 --no-pager 2>&1" 2>&1>>"%RAW%"
>>"%RAW%" echo.

>>"%RAW%" echo === 5. nginx error log tail ===
ssh %SSH_OPTS% %SSH_USER%@%SSH_HOST% "for f in /var/log/nginx/error.log /var/log/nginx/drc_error.log; do if [ -f \"\$f\" ]; then echo \"--- \$f ---\"; tail -n 30 \"\$f\"; fi; done; if [ ! -f /var/log/nginx/error.log ] && [ ! -f /var/log/nginx/drc_error.log ]; then echo '(no nginx error log found)'; fi" 2>&1>>"%RAW%"
>>"%RAW%" echo.

>>"%RAW%" echo === 6. frontend dist ===
ssh %SSH_OPTS% %SSH_USER%@%SSH_HOST% "for d in /opt/drc/frontend/dist /opt/drc/frontend/build; do if [ -d \"\$d\" ]; then echo \"DIR \$d\"; ls -la \"\$d/index.html\" 2>/dev/null || echo 'no index.html'; stat \"\$d/index.html\" 2>/dev/null | grep -E 'Modify|File:'; fi; done; echo '--- nginx root hint ---'; grep -RIn --include='*.conf' -E 'root |server_name.*drc' /etc/nginx/sites-enabled /etc/nginx/conf.d 2>/dev/null | head -n 20" 2>&1>>"%RAW%"

call "C:\IT\DRC\backend\scripts\output\_server_health_summarize.cmd" "%RAW%" "%OUT%"
exit /b %ERRORLEVEL%
