@echo off
cd /d "%~dp0.."
set SRC=%~1
if "%SRC%"=="" set SRC=C:\Users\Mihail\.cursor\projects\c-IT-DRC\agent-tools\8c6234e2-715b-463a-ae4c-34d562689ae1.txt
venv\Scripts\python.exe scripts\import_prof_training_professions.py "%SRC%"
pause
