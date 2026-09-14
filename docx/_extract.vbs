Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")
WshShell.CurrentDirectory = "C:\IT\DRC\docx"
' Prefer py launcher, then python
rc = WshShell.Run("cmd /c python _extract.py > _extract_log.txt 2>&1", 0, True)
If rc <> 0 Then
  rc = WshShell.Run("cmd /c py -3 _extract.py > _extract_log.txt 2>&1", 0, True)
End If
WshShell.Run "cmd /c dir /b > _dir_list.txt", 0, True
