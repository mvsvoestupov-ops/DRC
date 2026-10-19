Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = "C:\IT\DRC"
sh.Run "cmd.exe /c ""C:\IT\DRC\_agent_run.cmd""", 0, True
