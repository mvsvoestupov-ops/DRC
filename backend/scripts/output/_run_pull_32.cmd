@echo off
chcp 65001 >nul
setlocal
set "LOG=C:\IT\DRC\backend\scripts\output\_pull_32_log.txt"
echo === pull_32 start %DATE% %TIME% > "%LOG%"
call "C:\IT\DRC\backend\scripts\_pull_competence_32.cmd" >> "%LOG%" 2>&1
set "RC=%ERRORLEVEL%"
echo. >> "%LOG%"
echo === exit_code=%RC% >> "%LOG%"
echo EXIT_CODE=%RC%
exit /b %RC%
