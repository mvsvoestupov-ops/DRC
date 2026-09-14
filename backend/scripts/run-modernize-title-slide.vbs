Set shell = CreateObject("WScript.Shell")
shell.CurrentDirectory = "C:\IT\DRC\backend\scripts"
shell.Run "cmd /c python modernize_title_slide.py", 1, True
MsgBox "Готово! Проверьте файл:" & vbCrLf & "вариант шаблона титульного листа_modern.pptx" & vbCrLf & "в папке Downloads.", vbInformation, "Модернизация титульного листа"
