@echo off
chcp 65001 >nul
cd /d "%~dp0"
REM Быстрый push+deploy без паузы.
call "%~dp0deploy-fos-step6.cmd" /y
echo.
pause
exit /b %ERRORLEVEL%
