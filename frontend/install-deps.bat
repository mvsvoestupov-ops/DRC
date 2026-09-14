@echo off
cd /d %~dp0
echo Installing dependencies (antd, react-resizable, etc.)...
call pnpm.cmd install
if %ERRORLEVEL% NEQ 0 (
  echo.
  echo pnpm failed, trying npm...
  call npm install
)
echo.
echo Done. Run: pnpm.cmd dev
pause
