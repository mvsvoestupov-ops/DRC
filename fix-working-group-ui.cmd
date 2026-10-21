@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

REM Принудительно выложить актуальную вёрстку «Рабочая группа» на сервер.
REM Код уже в GitHub main; проблема обычно в старом frontend/dist у nginx.

echo.
echo == 1/2 push актуального кода ^(если есть локальные правки^)
call "%~dp0push-and-deploy.cmd" /push /y
if errorlevel 1 (
  echo Push не обязателен, если main уже актуален — продолжаем sync фронта.
)

echo.
echo == 2/2 пересборка и выкладка фронта на все nginx-корни
call "%~dp0sync-frontend-layout.cmd"
if errorlevel 1 (
  echo Не удалось синхронизировать фронт.
  exit /b 1
)

echo.
echo Готово. Откройте https://drc.ao-nk.online в режиме инкогнито или Ctrl+F5.
echo В окне рабочей группы должны быть:
echo   - бейдж «Руководитель»
echo   - подсветка выбранного пользователя + галочка
echo   - снизу полоса с ФИО и кнопкой «Пригласить» справа
endlocal
exit /b 0
