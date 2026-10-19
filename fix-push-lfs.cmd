@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul
cd /d "%~dp0"

echo == Полная очистка ESCO RDF из незапушенных коммитов
echo    ^(прошлый soft-reset оставлял файл в индексе — GitHub снова отклонил push^)
echo.

where git >nul 2>&1
if errorlevel 1 (
  echo git не найден
  exit /b 1
)

git fetch origin main
if errorlevel 1 (
  echo Не удалось fetch origin/main — проверьте сеть/доступ к GitHub
  exit /b 1
)

REM --- .gitignore ---
findstr /C:"ESCO/" .gitignore >nul 2>&1
if errorlevel 1 (
  echo.>>.gitignore
  echo # Локальные дампы ESCO ^(GitHub limit 100MB^)>>.gitignore
  echo ESCO/>>.gitignore
  echo *.rdf>>.gitignore
)
echo .gitignore: ESCO/ и *.rdf игнорируются

echo.
echo Коммиты ВПЕРЕДИ origin/main:
git log --oneline origin/main..HEAD
echo.

for /f %%i in ('git rev-list --count origin/main..HEAD 2^>nul') do set AHEAD=%%i
if not defined AHEAD set AHEAD=0

if not "%AHEAD%"=="0" (
  echo.
  echo == git reset --mixed origin/main
  echo    HEAD = origin/main, все правки остаются в рабочей папке как unstaged
  git reset --mixed origin/main
  if errorlevel 1 (
    echo Ошибка reset
    exit /b 1
  )
) else (
  echo Нет коммитов впереди origin/main
)

REM Снять ESCO с индекса на всякий случай
git rm -r --cached --ignore-unmatch ESCO >nul 2>&1
git rm --cached --ignore-unmatch "ESCO/esco-v1.2.0.rdf" >nul 2>&1

echo.
echo == Собираем новый коммит БЕЗ ESCO
git add -A

git restore --staged -- ^
  "backend/.env" ^
  "frontend/.env" ^
  ".env" ^
  "chat 2.txt" ^
  "chat_290726.txt" ^
  "chat_Фулстек-разработчик_20260728_170951.txt" ^
  "frontend_old_backup" ^
  "DRCFigma" ^
  "пароли и команды.txt" ^
  "PassForDRC_mail.txt" ^
  "backend/venv" ^
  "backend/profstandart.db" ^
  "ESCO" ^
  "ESCO/esco-v1.2.0.rdf" 2>nul

git add .gitignore

echo.
echo Staged files ^(первые 40^):
git diff --cached --name-only | more +0 | more +0
for /f %%c in ('git diff --cached --name-only ^| find /c /v ""') do echo Всего в индексе: %%c

git diff --cached --name-only | findstr /I /C:"ESCO/" /C:".rdf" >nul 2>&1
if not errorlevel 1 (
  echo.
  echo ОШИБКА: ESCO всё ещё в индексе!
  git diff --cached --name-only | findstr /I /C:"ESCO/" /C:".rdf"
  git rm -r --cached --ignore-unmatch ESCO
  git restore --staged -- "ESCO" "ESCO/esco-v1.2.0.rdf" 2>nul
  git diff --cached --name-only | findstr /I /C:"ESCO/" /C:".rdf" >nul 2>&1
  if not errorlevel 1 (
    echo Не удалось убрать ESCO. Остановка.
    exit /b 1
  )
)

echo.
echo == Проверка размера blob'ов в индексе ^(порог 50 MB^)...
git diff --cached --name-only > "%TEMP%\drc-staged.txt"
set BIG=0
for /f "usebackq delims=" %%f in ("%TEMP%\drc-staged.txt") do (
  if exist "%%f" (
    for %%A in ("%%f") do (
      set SZ=%%~zA
      if !SZ! GEQ 52428800 (
        echo БОЛЬШОЙ ФАЙЛ в индексе: %%f  ^(!SZ! bytes^)
        set BIG=1
      )
    )
  )
)
if "!BIG!"=="1" (
  echo Уберите большие файлы из индекса и повторите.
  exit /b 1
)
echo OK: нет staged-файлов ^>50 MB

git diff --cached --quiet
if errorlevel 1 (
  git commit -m "Международное сопоставление: ИИ ГАРМ-ESCO, ОКЗ из ПС, методика"
  if errorlevel 1 (
    echo Ошибка commit
    exit /b 1
  )
) else (
  echo Нечего коммитить — возможно правки уже на origin/main
)

echo.
echo == Контроль: большие объекты в commits origin/main..HEAD
git rev-list --objects origin/main..HEAD > "%TEMP%\drc-objs.txt"
set FOUND_RDF=0
findstr /I /C:"ESCO/" /C:"esco-v1.2.0.rdf" "%TEMP%\drc-objs.txt" >nul 2>&1
if not errorlevel 1 (
  echo ОШИБКА: ESCO всё ещё в истории незапушенных коммитов!
  findstr /I /C:"ESCO/" /C:"esco-v1.2.0.rdf" "%TEMP%\drc-objs.txt"
  set FOUND_RDF=1
)
if "!FOUND_RDF!"=="1" exit /b 1
echo OK: ESCO нет в origin/main..HEAD

echo.
echo == git push origin main
git push origin main
if errorlevel 1 (
  echo.
  echo Push снова не прошёл. Пришлите вывод.
  echo Иногда помогает: git gc --prune=now
  exit /b 1
)

echo.
echo Push успешен. Деплой:
echo   deploy-only.cmd
echo.
echo Локальный файл ESCO\esco-v1.2.0.rdf не трогали — он просто не в git.
endlocal
exit /b 0
