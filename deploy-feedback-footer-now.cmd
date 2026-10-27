@echo off
chcp 65001 >nul
cd /d "%~dp0"
REM Быстрый push+deploy без паузы в начале.
call "%~dp0deploy-feedback-footer.cmd" /y
echo.
pause
exit /b %ERRORLEVEL%
