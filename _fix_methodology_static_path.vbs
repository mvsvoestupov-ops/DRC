Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = "C:\IT\DRC"
rc = sh.Run("cmd /c _fix_methodology_static_path.cmd > _fix_methodology_static_path_out.txt 2>&1", 0, True)
WScript.Quit rc
