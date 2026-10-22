@echo off
chcp 65001 >nul
cd /d C:\IT\DRC\frontend
echo Запуск Vite: http://127.0.0.1:5173
echo Методология: http://127.0.0.1:5173/methodology
echo.
pnpm.cmd dev -- --host 127.0.0.1 --port 5173
