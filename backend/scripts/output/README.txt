Отчёт появится здесь после успешного запуска анализа:

  backend\run-analyze-standards.bat

или из командной строки (cmd.exe, не PowerShell):

  cd C:\IT\DRC\backend
  venv\Scripts\python.exe scripts\analyze_missing_standards.py

Файлы:
  missing_standards_report.txt  — текстовый отчёт
  missing_standards_report.json — данные для догрузки

Дубликат текстового отчёта также сохраняется в:
  backend\missing_standards_report.txt
