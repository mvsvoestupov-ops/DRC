Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")
scriptDir = FSO.GetParentFolderName(WScript.ScriptFullName)
backendDir = FSO.GetParentFolderName(scriptDir)
WshShell.CurrentDirectory = backendDir
py = backendDir & "\venv\Scripts\python.exe"
If Not FSO.FileExists(py) Then py = "python"
cmd = """" & py & """ scripts\fetch_missing_qualifications.py"
WshShell.Run "cmd /c " & cmd & " & pause", 1, True
