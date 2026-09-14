Set shell = CreateObject("WScript.Shell")
shell.CurrentDirectory = "C:\IT\DRC\backend"
shell.Run "cmd /c venv\Scripts\python.exe scripts\fetch_assessment_tools.py --only-missing > scripts\output\fetch_assessment_tools.log 2>&1", 0, True
