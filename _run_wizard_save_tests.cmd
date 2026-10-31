@echo off
chcp 65001 >nul
cd /d C:\IT\DRC\frontend
echo Установка vitest (если ещё нет)...
call pnpm.cmd add -D vitest@3.2.4
echo.
echo Запуск тестов: сохранение шагов 1–7 + конфликт 3 пользователей...
call pnpm.cmd test
echo.
pause
