Option Explicit

Dim shell, fso, backend, outDir, officialPath, mintrudPath, jsonPath, txtPath
Dim xl, wbOff, wbMin, wsOff, wsMin
Dim lastOff, lastMin, i, reg, code, name
Dim dictOff, dictMin, allOff, allMin, key, dupReg, dupCode
Dim onlyOff(), onlyMin(), nOnlyOff, nOnlyMin
Dim regCount, codeCount, line, ts

Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
backend = "C:\IT\DRC\backend"
outDir = backend & "\scripts\output"
officialPath = outDir & "\Реестр профессиональных стандартов 18.08.2026 (2).xlsx"
mintrudPath = outDir & "\reestr_mintrud_2026-08-31.xlsx"
jsonPath = outDir & "\compare_official_vs_mintrud_export.json"
txtPath = outDir & "\compare_official_vs_mintrud_export.txt"

If Not fso.FileExists(officialPath) Then
  WScript.Echo "Не найден: " & officialPath
  WScript.Quit 1
End If
If Not fso.FileExists(mintrudPath) Then
  WScript.Echo "Не найден: " & mintrudPath
  WScript.Quit 1
End If

Set dictOff = CreateObject("Scripting.Dictionary")
Set dictMin = CreateObject("Scripting.Dictionary")
Set allOff = CreateObject("Scripting.Dictionary")
Set allMin = CreateObject("Scripting.Dictionary")
Set dupReg = CreateObject("Scripting.Dictionary")
Set dupCode = CreateObject("Scripting.Dictionary")

Set xl = CreateObject("Excel.Application")
xl.Visible = False
xl.DisplayAlerts = False

Set wbOff = xl.Workbooks.Open(officialPath, , True)
Set wsOff = wbOff.Worksheets(1)
lastOff = wsOff.UsedRange.Rows.Count

Dim headerRow
headerRow = 1
If InStr(LCase(CStr(wsOff.Cells(1, 1).Value)), "п/п") > 0 Then headerRow = 2

Dim regCol, codeCol, nameCol, c
regCol = 0: codeCol = 0: nameCol = 0
For c = 1 To 15
  Dim h
  h = LCase(CStr(wsOff.Cells(headerRow, c).Value))
  If regCol = 0 And InStr(h, "регистрацион") > 0 Then regCol = c
  If codeCol = 0 And InStr(h, "код проф") > 0 Then codeCol = c
  If nameCol = 0 And InStr(h, "наимен") > 0 Then nameCol = c
Next
If regCol = 0 Then regCol = 2
If codeCol = 0 Then codeCol = 3
If nameCol = 0 Then nameCol = 6

For i = headerRow + 1 To lastOff
  reg = Trim(CStr(wsOff.Cells(i, regCol).Value))
  code = Trim(CStr(wsOff.Cells(i, codeCol).Value))
  name = Trim(CStr(wsOff.Cells(i, nameCol).Value))
  If reg = "" Or Not IsNumeric(reg) Then GoTo NextOff
  If Len(code) <> 6 Or InStr(code, ".") = 0 Then GoTo NextOff
  If Not allOff.Exists(code) Then
    allOff.Add code, reg & "|" & name
    dictOff.Add code, "{""ps_code"":""" & JsonEscape(code) & """,""reg_number"":""" & JsonEscape(reg) & """,""name"":""" & JsonEscape(name) & """}"
  End If
NextOff:
Next
wbOff.Close False

Set wbMin = xl.Workbooks.Open(mintrudPath, , True)
Set wsMin = wbMin.Worksheets(1)
lastMin = wsMin.UsedRange.Rows.Count
Dim startMin
startMin = 1
If InStr(CStr(wsMin.Cells(1, 1).Value), "Регистрационный") > 0 Then startMin = 2

For i = startMin To lastMin
  reg = Trim(CStr(wsMin.Cells(i, 1).Value))
  code = Trim(CStr(wsMin.Cells(i, 2).Value))
  name = Trim(CStr(wsMin.Cells(i, 3).Value))
  If reg = "" And code = "" Then GoTo NextMin
  If code <> "" Then
    If dictMin.Exists(code) Then
      dupCode(code) = dupCode(code) + 1
    Else
      dictMin.Add code, "{""ps_code"":""" & JsonEscape(code) & """,""reg_number"":""" & JsonEscape(reg) & """,""name"":""" & JsonEscape(name) & """}"
    End If
  End If
  If reg <> "" Then
    If dupReg.Exists(reg) Then
      dupReg(reg) = dupReg(reg) + 1
    Else
      dupReg.Add reg, 1
    End If
  End If
  allMin.Add CStr(i), reg & "|" & code
NextMin:
Next
wbMin.Close False
xl.Quit

nOnlyOff = 0
ReDim onlyOff(1000)
Dim k
For Each k In dictOff.Keys
  If Not dictMin.Exists(k) Then
    onlyOff(nOnlyOff) = dictOff(k)
    nOnlyOff = nOnlyOff + 1
  End If
Next

nOnlyMin = 0
ReDim onlyMin(1000)
For Each k In dictMin.Keys
  If Not dictOff.Exists(k) Then
    onlyMin(nOnlyMin) = dictMin(k)
    nOnlyMin = nOnlyMin + 1
  End If
Next

Dim dupRegJson, dupCodeJson, dr, dc
dupRegJson = "["
For Each k In dupReg.Keys
  If dupReg(k) > 1 Then dupRegJson = dupRegJson & "{""reg_number"":""" & JsonEscape(CStr(k)) & """,""count"":" & dupReg(k) & "},"
Next
If Right(dupRegJson, 1) = "," Then dupRegJson = Left(dupRegJson, Len(dupRegJson) - 1)
dupRegJson = dupRegJson & "]"

dupCodeJson = "["
For Each k In dupCode.Keys
  dupCodeJson = dupCodeJson & "{""ps_code"":""" & JsonEscape(CStr(k)) & """,""count"":" & (dupCode(k) + 1) & "},"
Next
If Right(dupCodeJson, 1) = "," Then dupCodeJson = Left(dupCodeJson, Len(dupCodeJson) - 1)
dupCodeJson = dupCodeJson & "]"

Dim onlyOffJson, onlyMinJson, j
onlyOffJson = "["
For j = 0 To nOnlyOff - 1
  onlyOffJson = onlyOffJson & onlyOff(j) & ","
Next
If Right(onlyOffJson, 1) = "," Then onlyOffJson = Left(onlyOffJson, Len(onlyOffJson) - 1)
onlyOffJson = onlyOffJson & "]"

onlyMinJson = "["
For j = 0 To nOnlyMin - 1
  onlyMinJson = onlyMinJson & onlyMin(j) & ","
Next
If Right(onlyMinJson, 1) = "," Then onlyMinJson = Left(onlyMinJson, Len(onlyMinJson) - 1)
onlyMinJson = onlyMinJson & "]"

Dim json
json = "{" & vbCrLf
json = json & "  ""official_count"": " & allOff.Count & "," & vbCrLf
json = json & "  ""official_unique_codes"": " & dictOff.Count & "," & vbCrLf
json = json & "  ""mintrud_count"": " & (lastMin - startMin + 1) & "," & vbCrLf
json = json & "  ""mintrud_unique_codes"": " & dictMin.Count & "," & vbCrLf
json = json & "  ""only_in_official_count"": " & nOnlyOff & "," & vbCrLf
json = json & "  ""only_in_mintrud_count"": " & nOnlyMin & "," & vbCrLf
json = json & "  ""only_in_official"": " & onlyOffJson & "," & vbCrLf
json = json & "  ""only_in_mintrud"": " & onlyMinJson & "," & vbCrLf
json = json & "  ""duplicate_reg_numbers"": " & dupRegJson & "," & vbCrLf
json = json & "  ""duplicate_ps_codes"": " & dupCodeJson & vbCrLf
json = json & "}" & vbCrLf

Dim tf
Set tf = fso.CreateTextFile(jsonPath, True, True)
tf.Write json
tf.Close

Set tf = fso.CreateTextFile(txtPath, True, True)
tf.WriteLine "СРАВНЕНИЕ: официальный XLSX 18.08.2026 (2) vs reestr_mintrud_2026-08-31"
tf.WriteLine "Официальный: " & dictOff.Count & " кодов ПС из " & allOff.Count & " строк"
tf.WriteLine "Экспорт сайта: " & dictMin.Count & " кодов ПС из " & (lastMin - startMin + 1) & " строк"
tf.WriteLine "Только в официальном: " & nOnlyOff
tf.WriteLine "Только в экспорте сайта: " & nOnlyMin
tf.WriteLine ""
tf.WriteLine "=== ТОЛЬКО В ОФИЦИАЛЬНОМ ==="
For j = 0 To nOnlyOff - 1
  tf.WriteLine onlyOff(j)
Next
tf.WriteLine ""
tf.WriteLine "=== ДУБЛИ ПО REG ==="
For Each k In dupReg.Keys
  If dupReg(k) > 1 Then tf.WriteLine "reg=" & k & " count=" & (dupReg(k) + 1)
Next
tf.WriteLine ""
tf.WriteLine "=== ДУБЛИ ПО CODE ==="
For Each k In dupCode.Keys
  tf.WriteLine "code=" & k & " count=" & (dupCode(k) + 1)
Next
tf.Close

WScript.Echo "Готово. only_in_official=" & nOnlyOff & " duplicates_code=" & dupCode.Count
WScript.Quit 0

Function JsonEscape(s)
  s = Replace(s, "\", "\\")
  s = Replace(s, """", "\""")
  s = Replace(s, vbCrLf, "\n")
  s = Replace(s, vbLf, "\n")
  s = Replace(s, vbCr, "\n")
  JsonEscape = s
End Function
