@echo off
setlocal
set "RAW=%~1"
set "OUT=%~2"
if not exist "%RAW%" exit /b 1
> "%OUT%" (
  echo DRC production health summary
  echo Generated: %date% %time%
  echo.
  echo See sections below ^(parsed from raw capture^).
  echo Raw file: %RAW%
  echo.
  type "%RAW%"
)
exit /b 0
