Option Explicit
Dim fso, srcDir, dstDir, names, i, src, dst
Set fso = CreateObject("Scripting.FileSystemObject")
srcDir = "C:\Users\Mihail\AppData\Local\Temp\cursor\screenshots"
dstDir = "C:\IT\DRC\frontend\public\methodology-media"
If Not fso.FolderExists(dstDir) Then fso.CreateFolder dstDir

' overview = полный вид шага 1 (лента шагов конструктора)
If fso.FileExists(srcDir & "\wizard-step1.png") Then
  fso.CopyFile srcDir & "\wizard-step1.png", dstDir & "\overview.png", True
End If

For i = 1 To 7
  src = srcDir & "\wizard-step" & i & ".png"
  dst = dstDir & "\step" & i & ".png"
  If fso.FileExists(src) Then
    fso.CopyFile src, dst, True
    WScript.Echo "OK step" & i
  Else
    WScript.Echo "MISSING " & src
  End If
Next
Dim logPath, log, f
logPath = "C:\IT\DRC\_import_wizard_out.txt"
Set log = fso.CreateTextFile(logPath, True)
log.WriteLine "dst: " & dstDir
If fso.FolderExists(dstDir) Then
  For Each f In fso.GetFolder(dstDir).Files
    log.WriteLine f.Name & vbTab & f.Size
  Next
End If
log.Close
WScript.Echo "Done -> " & dstDir
