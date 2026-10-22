@echo off
chcp 65001 >nul
cd /d C:\IT\DRC

echo === 1. Картинки в methodology-media ===
call "%~dp0_copy_methodology_images.cmd"
if not exist "frontend\public\methodology-media\overview.jpg" (
  echo copy не дал файлы — пробую VBS с сервера...
  cscript //nologo "%~dp0_restore_methodology_media.vbs"
)

echo.
echo === 2. Проверка / запуск Vite на 5173 ===
curl -fsS -o NUL http://127.0.0.1:5173/ 2>NUL
if errorlevel 1 (
  echo Vite не отвечает — запускаю pnpm dev в новом окне...
  start "DRC Vite" cmd /k "cd /d C:\IT\DRC\frontend && pnpm.cmd dev -- --host 127.0.0.1 --port 5173"
  echo Жду 8 сек...
  ping -n 9 127.0.0.1 >NUL
) else (
  echo Vite уже работает.
)

echo.
echo === 3. HTTP-коды локально ===
cscript //nologo "%~dp0_check_local_methodology.vbs"
type "%~dp0_check_local_methodology_out.txt"

echo.
echo Откройте: http://127.0.0.1:5173/methodology
start http://127.0.0.1:5173/methodology
pause
