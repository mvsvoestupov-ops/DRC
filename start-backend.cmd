@echo off
chcp 65001 >nul
REM После перезагрузки VPS: включить и запустить backend.
set "SSH_HOST=201.34.149.65"
set "SSH_USER=root"
set "SSH_KEY=%USERPROFILE%\.ssh\id_ed25519_drc"
set "SSH_OPTS=-p 22 -o StrictHostKeyChecking=accept-new"
if exist "%SSH_KEY%" set SSH_OPTS=-i %SSH_KEY% -p 22 -o StrictHostKeyChecking=accept-new

echo == enable + start drc-backend
ssh %SSH_OPTS% %SSH_USER%@%SSH_HOST% "systemctl enable drc-backend; systemctl start drc-backend; systemctl --no-pager --lines=20 status drc-backend"
echo.
echo == listen
ssh %SSH_OPTS% %SSH_USER%@%SSH_HOST% "ss -lntp | grep -E '8001|uvicorn' || true"
echo.
echo Готово. API: https://drc.ao-nk.online/api
