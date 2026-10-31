@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul
cd /d C:\IT\DRC
set "OUT=C:\IT\DRC\backend\scripts\output\_push_reject_diag_raw.txt"
set "TMP=%TEMP%\drc-push-diag-objs.txt"
> "%OUT%" echo === push reject diag %date% %time% ===
>>"%OUT%" echo.
>>"%OUT%" echo == git status -sb ==
git status -sb >>"%OUT%" 2>&1
>>"%OUT%" echo.
>>"%OUT%" echo == commits origin/main..HEAD ==
git log --oneline origin/main..HEAD >>"%OUT%" 2>&1
>>"%OUT%" echo.
>>"%OUT%" echo == rev-list objects origin/main..HEAD ==
git rev-list --objects origin/main..HEAD > "%TMP%" 2>nul
type "%TMP%" >>"%OUT%"
>>"%OUT%" echo.
>>"%OUT%" echo == ESCO/rdf/db paths in range ==
findstr /I /C:"ESCO/" /C:".rdf" /C:".db" "%TMP%" >>"%OUT%" 2>nul
>>"%OUT%" echo.
>>"%OUT%" echo == blob sizes ^(objects in range^) ==
for /f "tokens=1,*" %%a in ('type "%TMP%"') do (
  set "OID=%%a"
  set "PATH=%%b"
  if not "%%b"=="" (
    for /f "delims=" %%s in ('git cat-file -s %%a 2^>nul') do set "SZ=%%s"
    if defined SZ if !SZ! GEQ 1048576 (
      echo !SZ! bytes  %%b  ^(oid %%a^) >>"%OUT%"
    )
  )
)
>>"%OUT%" echo.
>>"%OUT%" echo == .env in those commits ==
git log origin/main..HEAD --name-only --pretty=format: | findstr /I /R "\.env$" >>"%OUT%" 2>nul
>>"%OUT%" echo.
>>"%OUT%" echo == gh rulesets ==
gh api repos/mvsvoestupov-ops/DRC/rulesets >>"%OUT%" 2>&1
exit /b 0
