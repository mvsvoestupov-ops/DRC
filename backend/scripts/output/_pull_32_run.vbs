Set shell = CreateObject("WScript.Shell")
shell.CurrentDirectory = "C:\IT\DRC\backend"
' Run pull script; log already handled by wrapper
rc = shell.Run("cmd /c C:\IT\DRC\backend\scripts\output\_run_pull_32.cmd", 0, True)
Set fso = CreateObject("Scripting.FileSystemObject")
Set log = fso.OpenTextFile("C:\IT\DRC\backend\scripts\output\_pull_32_vbs_exit.txt", 2, True)
log.WriteLine "VBS_EXIT=" & rc
log.Close
WScript.Quit rc
