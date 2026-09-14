Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")
scriptDir = FSO.GetParentFolderName(WScript.ScriptFullName)
backendDir = FSO.GetParentFolderName(scriptDir)
repoDir = FSO.GetParentFolderName(backendDir)
WshShell.CurrentDirectory = backendDir
py = backendDir & "\venv\Scripts\python.exe"
If Not FSO.FileExists(py) Then py = "python"
docx = repoDir & "\docx\Matrix_for_projekt.docx"
out = backendDir & "\scripts\output\matrix_levels.txt"
cmd = """" & py & """ scripts\extract_docx_text.py """ & docx & """ """ & out
WshShell.Run "cmd /c " & cmd, 0, True
