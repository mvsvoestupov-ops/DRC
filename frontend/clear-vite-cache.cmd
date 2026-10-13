@echo off
cd /d "%~dp0"
echo Stopping Vite cache at node_modules\.vite ...
if exist "node_modules\.vite" (
  rmdir /s /q "node_modules\.vite"
  echo Cache removed.
) else (
  echo Cache folder already gone.
)
echo.
echo Restart the frontend:
echo   pnpm.cmd dev -- --host 127.0.0.1 --port 5173
echo Then hard-refresh the browser (Ctrl+F5).
