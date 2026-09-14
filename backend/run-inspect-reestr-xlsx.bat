@echo off
cd /d %~dp0
venv\Scripts\python.exe scripts\inspect_reestr_ps_xlsx.py "C:\IT\DRC\Reestr_PS.xlsx"
pause
