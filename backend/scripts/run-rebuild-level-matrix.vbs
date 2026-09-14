Set shell = CreateObject("WScript.Shell")
shell.CurrentDirectory = "C:\IT\DRC\backend"
shell.Run "cmd /c venv\Scripts\python.exe scripts\rebuild_level_matrix.py > scripts\output\rebuild_level_matrix.log 2>&1", 0, True
