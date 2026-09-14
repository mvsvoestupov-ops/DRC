Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName) & "\.."
cmd = "cmd /c venv\Scripts\python.exe scripts\inspect_reestr_ps_xlsx.py ""C:\IT\DRC\Reestr_PS.xlsx"""
sh.Run cmd, 1, True
