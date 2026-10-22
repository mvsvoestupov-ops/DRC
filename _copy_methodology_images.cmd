@echo off
chcp 65001 >nul
set "SRC=C:\Users\Mihail\.cursor\projects\c-IT-DRC\assets"
set "DST=C:\IT\DRC\frontend\public\methodology-media"
set "OLD=C:\IT\DRC\frontend\public\methodology"
set "BASE=https://drc.ao-nk.online/methodology"
mkdir "%DST%" 2>nul

REM Не класть JPG в public\methodology — каталог перекрывает SPA /methodology (403).
REM Картинки только в methodology-media. В methodology/ допустим лишь index.html-заглушка.

if exist "%SRC%\methodology-competence-steps-overview.jpg" (
  copy /Y "%SRC%\methodology-competence-steps-overview.jpg" "%DST%\overview.jpg" >nul
  copy /Y "%SRC%\methodology-step1-general.jpg" "%DST%\step1.jpg" >nul
  copy /Y "%SRC%\methodology-step2-standard.jpg" "%DST%\step2.jpg" >nul
  copy /Y "%SRC%\methodology-step3-abc.jpg" "%DST%\step3.jpg" >nul
  copy /Y "%SRC%\methodology-step4-descriptors.jpg" "%DST%\step4.jpg" >nul
  copy /Y "%SRC%\methodology-step5-disciplines.jpg" "%DST%\step5.jpg" >nul
  copy /Y "%SRC%\methodology-step6-assessment.jpg" "%DST%\step6.jpg" >nul
  copy /Y "%SRC%\methodology-step7-mto.jpg" "%DST%\step7.jpg" >nul
  echo Скопировано из Cursor assets.
) else (
  echo Assets не найдены — качаю с сервера...
  curl -fsSL -o "%DST%\overview.jpg" "%BASE%/overview.jpg"
  curl -fsSL -o "%DST%\step1.jpg" "%BASE%/step1.jpg"
  curl -fsSL -o "%DST%\step2.jpg" "%BASE%/step2.jpg"
  curl -fsSL -o "%DST%\step3.jpg" "%BASE%/step3.jpg"
  curl -fsSL -o "%DST%\step4.jpg" "%BASE%/step4.jpg"
  curl -fsSL -o "%DST%\step5.jpg" "%BASE%/step5.jpg"
  curl -fsSL -o "%DST%\step6.jpg" "%BASE%/step6.jpg"
  curl -fsSL -o "%DST%\step7.jpg" "%BASE%/step7.jpg"
)

REM Убрать случайные JPG из конфликтного каталога, index.html оставить
if exist "%OLD%\*.jpg" del /Q "%OLD%\*.jpg"

dir /b "%DST%"
echo.
echo Готово. Картинки: frontend\public\methodology-media\
echo Дальше: push-and-deploy.cmd /y
