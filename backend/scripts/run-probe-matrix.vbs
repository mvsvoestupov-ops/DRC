Set shell = CreateObject("WScript.Shell")
shell.CurrentDirectory = "C:\IT\DRC\backend"
shell.Run "cmd /c venv\Scripts\python.exe scripts\extract_docx_text.py ""C:\IT\DRC\docx\Matrix_for_projekt.docx"" scripts\output\matrix_for_projekt_probe.txt > scripts\output\matrix_for_projekt_probe_run.log 2>&1", 0, True
