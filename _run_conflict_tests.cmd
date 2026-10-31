@echo off
chcp 65001 >nul
cd /d C:\IT\DRC\frontend
call pnpm.cmd exec vitest run src/lib/competenceConflict.test.ts
echo.
pause
