Set shell = CreateObject("WScript.Shell")
shell.CurrentDirectory = "C:\IT\DRC\backend"
shell.Run "cmd /c venv\Scripts\python.exe scripts\parse_fgos_spo.py --save-db --remaining > scripts\output\parse_fgos_remaining.log 2>&1", 0, True
