Set shell = CreateObject("WScript.Shell")
shell.CurrentDirectory = "C:\IT\DRC\backend"
shell.Run "cmd /c venv\Scripts\python.exe scripts\_verify_okz_repair.py > scripts\output\verify_okz_repair.txt 2>&1", 0, True
