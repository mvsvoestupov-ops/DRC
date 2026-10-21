Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = "C:\IT\DRC"
rc = sh.Run("cmd /c _agent_git_wg.cmd > _agent_git_wg_out.txt 2>&1", 0, True)
WScript.Quit rc
