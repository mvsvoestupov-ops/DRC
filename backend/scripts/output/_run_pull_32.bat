@echo off
chcp 65001 >nul
set LOG=%~dp0_pull_32_log.txt
echo started > "%LOG%"
call "%~dp0..\_pull_competence_32.cmd" >> "%LOG%" 2>&1
echo EXITCODE=%ERRORLEVEL% >> "%LOG%"
exit /b %ERRORLEVEL%
