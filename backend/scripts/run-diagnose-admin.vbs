Set shell = CreateObject("WScript.Shell")
shell.CurrentDirectory = "C:\IT\DRC\backend"
shell.Run "cmd /c venv\Scripts\python.exe scripts\diagnose_admin_login.py > scripts\output\diagnose_admin_login.log 2>&1", 0, True
