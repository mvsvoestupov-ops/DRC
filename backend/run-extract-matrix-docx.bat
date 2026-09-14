@echo off
cd /d "%~dp0"
venv\Scripts\python.exe scripts\extract_docx_text.py "..\docx\Matrix_for_projekt.docx" scripts\output\matrix_levels.txt
pause
