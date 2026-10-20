@echo off
chcp 65001 >nul
set "SSH_HOST=201.34.149.65"
set "SSH_USER=root"
set "SSH_KEY=%USERPROFILE%\.ssh\id_ed25519_drc"
set "SSH_OPTS=-p 22 -o StrictHostKeyChecking=accept-new"
if exist "%SSH_KEY%" set SSH_OPTS=-i %SSH_KEY% -p 22 -o StrictHostKeyChecking=accept-new

echo == status
ssh %SSH_OPTS% %SSH_USER%@%SSH_HOST% "systemctl is-active drc-backend; systemctl --no-pager --lines=30 status drc-backend"
echo.
echo == last journal
ssh %SSH_OPTS% %SSH_USER%@%SSH_HOST% "journalctl -u drc-backend -n 80 --no-pager"
echo.
echo == listen 8001
ssh %SSH_OPTS% %SSH_USER%@%SSH_HOST% "ss -lntp | grep -E '8001|uvicorn' || true"
