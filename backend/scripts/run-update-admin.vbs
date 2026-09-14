Set shell = CreateObject("WScript.Shell")
shell.CurrentDirectory = "C:\IT\DRC\backend"
ret = shell.Run("cmd /c venv\Scripts\python.exe scripts\create_test_users.py > scripts\output\update_admin.log 2>&1", 0, True)
WScript.Quit ret
