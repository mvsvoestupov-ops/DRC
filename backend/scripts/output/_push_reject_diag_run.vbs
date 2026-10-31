Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = "C:\IT\DRC"
rc = sh.Run("cmd.exe /c C:\IT\DRC\backend\scripts\output\_push_reject_diag_run.cmd", 0, True)
WScript.Quit rc
