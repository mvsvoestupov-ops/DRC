@echo off
echo --- backend :10000 ---
curl.exe -s -S -m 5 -w "\nHTTP %%{http_code}\n" http://127.0.0.1:10000/competences/public/stats
echo.
echo --- vite proxy :5173/api ---
curl.exe -s -S -m 5 -w "\nHTTP %%{http_code}\n" http://127.0.0.1:5173/api/competences/public/stats
echo.
pause
