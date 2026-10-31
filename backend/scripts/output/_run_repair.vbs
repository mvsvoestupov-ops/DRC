Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = "C:\IT\DRC\backend"
cmd = "cmd.exe /c C:\IT\DRC\backend\scripts\output\_run_repair.cmd"
rc = sh.Run(cmd, 0, True)
WScript.Quit rc
