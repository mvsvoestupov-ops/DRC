Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName) & "\.."
cmd = "cmd /c run-audit-ps-content.bat"
sh.Run cmd, 1, True
