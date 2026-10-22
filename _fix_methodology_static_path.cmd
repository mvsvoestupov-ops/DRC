@echo off
chcp 65001 >nul
set "OLD=C:\IT\DRC\frontend\public\methodology"
set "NEW=C:\IT\DRC\frontend\public\methodology-media"
if not exist "%OLD%\" (
  echo Нет папки %OLD% — нечего переносить.
  if exist "%NEW%\" dir /b "%NEW%"
  exit /b 0
)
mkdir "%NEW%" 2>nul
move /Y "%OLD%\*.*" "%NEW%\" >nul
rmdir "%OLD%" 2>nul
if exist "%OLD%\" rmdir /S /Q "%OLD%"
echo Перенесено в methodology-media:
dir /b "%NEW%"
