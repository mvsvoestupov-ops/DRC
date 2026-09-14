Set shell = CreateObject("WScript.Shell")
shell.CurrentDirectory = "C:\IT\DRC\backend"
shell.Run "cmd /c venv\Scripts\python.exe scripts\inventory_ps_xml_tags.py > scripts\output\inventory_ps_xml_run.log 2>&1", 0, True
