Option Explicit
Dim fso, http, stream, dst, base, names, i, url, path, sh
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
dst = "C:\IT\DRC\frontend\public\methodology-media"
base = "https://drc.ao-nk.online/methodology/"
If Not fso.FolderExists(dst) Then fso.CreateFolder dst
names = Array("overview.jpg","step1.jpg","step2.jpg","step3.jpg","step4.jpg","step5.jpg","step6.jpg","step7.jpg")
For i = 0 To UBound(names)
  url = base & names(i)
  path = dst & "\" & names(i)
  WScript.Echo "GET " & url
  Set http = CreateObject("MSXML2.ServerXMLHTTP.6.0")
  http.Open "GET", url, False
  http.Send
  If http.Status <> 200 Then
    WScript.Echo "FAIL " & names(i) & " status=" & http.Status
  Else
    Set stream = CreateObject("ADODB.Stream")
    stream.Type = 1
    stream.Open
    stream.Write http.ResponseBody
    stream.SaveToFile path, 2
    stream.Close
    WScript.Echo "OK " & names(i) & " " & fso.GetFile(path).Size & " bytes"
  End If
Next
' Remove leftover JPGs from conflicting folder; keep index.html stub
Dim oldDir, f
oldDir = "C:\IT\DRC\frontend\public\methodology"
If fso.FolderExists(oldDir) Then
  For Each f In fso.GetFolder(oldDir).Files
    If LCase(fso.GetExtensionName(f.Name)) = "jpg" Then f.Delete True
  Next
End If
WScript.Echo "Done. Open http://127.0.0.1:5173/methodology"
