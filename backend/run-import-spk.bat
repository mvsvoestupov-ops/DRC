@echo off
cd /d %~dp0
echo Importing SPK assignments from Reestr_PS.xlsx...
call venv\Scripts\python.exe scripts\import_spk_from_reestr.py "C:\IT\DRC\Reestr_PS.xlsx"
pause
