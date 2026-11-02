Set shell = CreateObject("WScript.Shell")
shell.CurrentDirectory = "C:\IT\DRC\backend\scripts\output"
rc = shell.Run("cmd /c C:\IT\DRC\backend\scripts\output\_server_health_run.cmd", 0, True)
Set fso = CreateObject("Scripting.FileSystemObject")
Set log = fso.OpenTextFile("C:\IT\DRC\backend\scripts\output\_server_health_vbs_exit.txt", 2, True)
log.WriteLine "VBS_EXIT=" & rc
log.WriteLine "TIME=" & Now
log.Close
WScript.Quit rc
