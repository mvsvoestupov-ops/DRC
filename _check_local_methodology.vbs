Option Explicit
Dim http, urls, i, u, code, out
out = "C:\IT\DRC\_check_local_methodology_out.txt"
urls = Array( _
  "http://127.0.0.1:5173/", _
  "http://127.0.0.1:5173/methodology", _
  "http://127.0.0.1:5173/methodology/", _
  "http://127.0.0.1:5173/methodology/development", _
  "http://127.0.0.1:5173/methodology-media/overview.jpg", _
  "http://127.0.0.1:5173/methodology/index.html" _
)
Dim fso, ts
Set fso = CreateObject("Scripting.FileSystemObject")
Set ts = fso.CreateTextFile(out, True)
For i = 0 To UBound(urls)
  u = urls(i)
  On Error Resume Next
  Set http = CreateObject("MSXML2.ServerXMLHTTP.6.0")
  http.Open "GET", u, False
  http.setTimeouts 2000, 2000, 5000, 5000
  http.Send
  If Err.Number <> 0 Then
    ts.WriteLine "ERR  " & u & "  " & Err.Description
    Err.Clear
  Else
    code = http.Status
    ts.WriteLine code & "  " & u & "  len=" & LenB(http.ResponseBody)
  End If
  On Error GoTo 0
Next
ts.Close
WScript.Echo "Wrote " & out
