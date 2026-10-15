Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")
WshShell.CurrentDirectory = "C:\IT\DRC\docx"

src = "C:\СТАВРОПОЛЬ\Стратсессия № 3\ТЗ для международной гармонизации компетенции.docx"
dst = "C:\IT\DRC\docx\tz_international_harmonization.docx"

If Not FSO.FileExists(dst) Then
  If FSO.FileExists(src) Then
    FSO.CopyFile src, dst, True
  End If
End If

rc = WshShell.Run("cmd /c python _extract_tz.py > _extract_tz_log.txt 2>&1", 0, True)
If rc <> 0 Then
  rc = WshShell.Run("cmd /c py -3 _extract_tz.py > _extract_tz_log.txt 2>&1", 0, True)
End If

Set log = FSO.CreateTextFile("C:\IT\DRC\docx\_extract_tz_status.txt", True)
log.WriteLine "copy_exists=" & FSO.FileExists(dst)
log.WriteLine "txt_exists=" & FSO.FileExists("C:\IT\DRC\docx\tz_international_harmonization.txt")
log.WriteLine "rc=" & rc
log.Close
