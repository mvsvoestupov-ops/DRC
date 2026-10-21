@echo off
chcp 65001 >nul
set "SRC=C:\Users\Mihail\.cursor\projects\c-IT-DRC\assets"
set "DST=C:\IT\DRC\frontend\public\methodology"
mkdir "%DST%" 2>nul
copy /Y "%SRC%\methodology-competence-steps-overview.jpg" "%DST%\overview.jpg"
copy /Y "%SRC%\methodology-step1-general.jpg" "%DST%\step1.jpg"
copy /Y "%SRC%\methodology-step2-standard.jpg" "%DST%\step2.jpg"
copy /Y "%SRC%\methodology-step3-abc.jpg" "%DST%\step3.jpg"
copy /Y "%SRC%\methodology-step4-descriptors.jpg" "%DST%\step4.jpg"
copy /Y "%SRC%\methodology-step5-disciplines.jpg" "%DST%\step5.jpg"
copy /Y "%SRC%\methodology-step6-assessment.jpg" "%DST%\step6.jpg"
copy /Y "%SRC%\methodology-step7-mto.jpg" "%DST%\step7.jpg"
dir /b "%DST%"
echo.
echo Готово. Картинки в frontend\public\methodology\
echo Дальше: push-and-deploy.cmd /y

