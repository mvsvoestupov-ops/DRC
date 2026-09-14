Set shell = CreateObject("WScript.Shell")
shell.CurrentDirectory = "C:\IT\DRC\backend"
shell.Run "cmd /c venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 10000 > scripts\output\uvicorn.log 2>&1", 0, False
shell.CurrentDirectory = "C:\IT\DRC\frontend"
shell.Run "cmd /c pnpm.cmd dev > ..\backend\scripts\output\vite.log 2>&1", 0, False
WScript.Echo "started"
