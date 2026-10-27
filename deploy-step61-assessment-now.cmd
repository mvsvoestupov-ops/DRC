@echo off
chcp 65001 >nul
cd /d "%~dp0"
REM Быстрый push+deploy обновления 6.1 без паузы.
call "%~dp0deploy-step61-assessment.cmd" /y
echo.
pause
exit /b %ERRORLEVEL%
