@echo off
cd /d C:\IT\DRC\frontend
echo.
echo 1) In the OLD Vite window press Ctrl+C and wait until it exits.
echo 2) Then press any key here.
pause
if exist "node_modules\.vite" (
  echo Removing stale Vite cache...
  rmdir /s /q "node_modules\.vite"
)
echo Starting frontend: http://127.0.0.1:5173
echo API proxy: /api -^> http://127.0.0.1:10000
pnpm.cmd exec vite --force --host 127.0.0.1 --port 5173
