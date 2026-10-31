@echo off
chcp 65001 >nul
cd /d C:\IT\DRC\frontend
echo Запуск тестов assessmentV2...
call pnpm.cmd exec vitest run src/lib/assessmentV2.test.ts
echo.
pause
