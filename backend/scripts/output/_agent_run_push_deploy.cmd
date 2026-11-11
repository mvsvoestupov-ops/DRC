@echo off
if not exist "C:\IT\DRC\backend\scripts\output" mkdir "C:\IT\DRC\backend\scripts\output"
> "C:\IT\DRC\backend\scripts\output\_agent_push_deploy.log" (
  echo === agent push-deploy start %DATE% %TIME% ===
)
call "C:\IT\DRC\push-role-wizard-flow.cmd" /y >> "C:\IT\DRC\backend\scripts\output\_agent_push_deploy.log" 2>&1
set EXIT_CODE=%ERRORLEVEL%
>> "C:\IT\DRC\backend\scripts\output\_agent_push_deploy.log" echo EXIT_CODE=%EXIT_CODE%
>> "C:\IT\DRC\backend\scripts\output\_agent_push_deploy.log" echo === agent push-deploy end %DATE% %TIME% ===
exit /b %EXIT_CODE%
