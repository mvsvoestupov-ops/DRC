Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = "C:\IT\DRC\frontend"
sh.Run "cmd /k cd /d C:\IT\DRC\frontend && pnpm.cmd dev -- --host 127.0.0.1 --port 5173", 1, False
WScript.Sleep 5000
sh.Run "http://127.0.0.1:5173/methodology", 1, False
