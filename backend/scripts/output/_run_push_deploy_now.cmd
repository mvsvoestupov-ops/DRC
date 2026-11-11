@echo off
chcp 65001 >nul
cd /d C:\IT\DRC
set "LOG=C:\IT\DRC\backend\scripts\output\_agent_push_deploy.log"
echo === %date% %time% === > "%LOG%"
call C:\IT\DRC\push-role-wizard-flow.cmd /y >> "%LOG%" 2>&1
echo EXIT=%ERRORLEVEL% >> "%LOG%"
exit /b %ERRORLEVEL%
