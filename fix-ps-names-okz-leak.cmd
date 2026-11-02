@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

REM =====================================================================
REM  Исправление названий ПС, перезаписанных наименованием ОКЗ
REM
REM  Причина: в classinform_parser цикл ОКЗ писал в переменную name и
REM  затирал название профстандарта. Пример 19.085 / 1674:
REM    было:  Квалифицированные рабочие промышленности…
REM    надо:  Работник авиатопливообеспечения
REM
REM  Из cmd.exe:
REM    1) Сначала задеплойте код:
REM         push-and-deploy.cmd /y "fix: PS name overwritten by OKZ title"
REM    2) Локально:
REM         fix-ps-names-okz-leak.cmd
REM         fix-ps-names-okz-leak.cmd 1674
REM    3) На сервере (после деплоя):
REM         fix-ps-names-okz-leak.cmd /server
REM         fix-ps-names-okz-leak.cmd /server 1674
REM =====================================================================

set "SSH_HOST=201.34.149.65"
set "SSH_PORT=22"
set "SSH_USER=root"
set "SSH_KEY=%USERPROFILE%\.ssh\id_ed25519_drc"
set "REMOTE_DIR=/opt/drc"
set "MODE=local"
set "REGS="

if /I "%~1"=="/server" (
  set "MODE=server"
  if not "%~2"=="" set "REGS=%~2"
) else (
  if not "%~1"=="" set "REGS=%~1"
)

if not exist "%SSH_KEY%" if exist "%USERPROFILE%\.ssh\id_ed25519" set "SSH_KEY=%USERPROFILE%\.ssh\id_ed25519"
if not exist "%SSH_KEY%" if exist "%USERPROFILE%\.ssh\id_rsa" set "SSH_KEY=%USERPROFILE%\.ssh\id_rsa"

if /I "%MODE%"=="server" goto :server

echo == local repair  regs=%REGS%
cd /d "%~dp0backend"
if exist "venv\Scripts\python.exe" (
  "venv\Scripts\python.exe" -u scripts\repair_ps_names_okz_leak.py %REGS%
) else (
  py -3 -u scripts\repair_ps_names_okz_leak.py %REGS%
)
if errorlevel 1 exit /b 1

echo.
echo == verify 1674
if exist "venv\Scripts\python.exe" (
  "venv\Scripts\python.exe" -c "from app.db import SessionLocal; from app.db.raw_models import StandardRaw; s=SessionLocal(); r=s.query(StandardRaw).filter_by(reg_number='1674').one(); print(r.reg_number, r.ps_code, '=>', r.name)"
) else (
  py -3 -c "from app.db import SessionLocal; from app.db.raw_models import StandardRaw; s=SessionLocal(); r=s.query(StandardRaw).filter_by(reg_number='1674').one(); print(r.reg_number, r.ps_code, '=>', r.name)"
)
exit /b 0

:server
echo == server repair  %SSH_USER%@%SSH_HOST% regs=%REGS%
where ssh >nul 2>&1
if errorlevel 1 (
  echo ssh не найден
  exit /b 1
)

set "SSH_OPTS=-p %SSH_PORT% -o StrictHostKeyChecking=accept-new"
if exist "%SSH_KEY%" set SSH_OPTS=-i %SSH_KEY% -p %SSH_PORT% -o StrictHostKeyChecking=accept-new

ssh %SSH_OPTS% %SSH_USER%@%SSH_HOST% "cd %REMOTE_DIR%/backend && ./venv/bin/python -u scripts/repair_ps_names_okz_leak.py %REGS%"
if errorlevel 1 exit /b 1

ssh %SSH_OPTS% %SSH_USER%@%SSH_HOST% "cd %REMOTE_DIR%/backend && ./venv/bin/python -c \"from app.db import SessionLocal; from app.db.raw_models import StandardRaw; s=SessionLocal(); r=s.query(StandardRaw).filter_by(reg_number='1674').one(); print(r.reg_number, r.ps_code, '=>', r.name)\""
exit /b %ERRORLEVEL%
