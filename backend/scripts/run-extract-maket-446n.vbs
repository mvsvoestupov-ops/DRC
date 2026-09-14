Set shell = CreateObject("WScript.Shell")
shell.CurrentDirectory = "C:\IT\DRC\backend"
shell.Run "cmd /c venv\Scripts\python.exe scripts\extract_maket_446n.py > scripts\output\extract_maket_446n.log 2>&1", 0, True
