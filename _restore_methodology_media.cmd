@echo off
chcp 65001 >nul
set "DST=C:\IT\DRC\frontend\public\methodology-media"
set "BASE=https://drc.ao-nk.online/methodology"
mkdir "%DST%" 2>nul
echo Скачиваю иллюстрации с сервера в methodology-media...
curl -fsSL -o "%DST%\overview.jpg" "%BASE%/overview.jpg"
curl -fsSL -o "%DST%\step1.jpg" "%BASE%/step1.jpg"
curl -fsSL -o "%DST%\step2.jpg" "%BASE%/step2.jpg"
curl -fsSL -o "%DST%\step3.jpg" "%BASE%/step3.jpg"
curl -fsSL -o "%DST%\step4.jpg" "%BASE%/step4.jpg"
curl -fsSL -o "%DST%\step5.jpg" "%BASE%/step5.jpg"
curl -fsSL -o "%DST%\step6.jpg" "%BASE%/step6.jpg"
curl -fsSL -o "%DST%\step7.jpg" "%BASE%/step7.jpg"
echo.
dir /b "%DST%"
echo.
echo Готово. Дальше: push-and-deploy.cmd /y
