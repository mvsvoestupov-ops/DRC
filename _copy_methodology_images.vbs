Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = "C:\IT\DRC"
rc = sh.Run("cmd /c _copy_methodology_images.cmd > _copy_methodology_images_out.txt 2>&1", 0, True)
WScript.Quit rc
