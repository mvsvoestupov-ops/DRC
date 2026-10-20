@echo off
chcp 65001 >nul
cd /d C:\IT\DRC
set "OUT=%~dp0_agent_check_backend_out.txt"
call "%~dp0check-backend.cmd" > "%OUT%" 2>&1
