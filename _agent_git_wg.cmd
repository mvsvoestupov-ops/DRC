@echo off
chcp 65001 >nul
cd /d C:\IT\DRC
echo === status ===
git status -sb
echo.
echo === WorkingGroupPanel tracked? ===
git ls-files -- frontend/src/app/components/WorkingGroupPanel.tsx
echo.
echo === diff vs HEAD (stat) ===
git diff --stat HEAD -- frontend/src/app/components/WorkingGroupPanel.tsx
echo.
echo === unstaged/untracked mention ===
git status --short -- frontend/src/app/components/WorkingGroupPanel.tsx
echo.
echo === last commits touching file ===
git log -5 --oneline -- frontend/src/app/components/WorkingGroupPanel.tsx
echo.
echo === origin/main has selected footer? ===
git show origin/main:frontend/src/app/components/WorkingGroupPanel.tsx 2>nul | findstr /C:"CheckCircle2" /C:"bg-primary/5" /C:"Пригласить" /C:"UserPlus"
echo.
echo === local file markers ===
findstr /C:"CheckCircle2" /C:"bg-primary/5" /C:"alreadyMember" frontend\src\app\components\WorkingGroupPanel.tsx
echo.
echo === HEAD vs origin/main ===
git rev-parse --short HEAD
git rev-parse --short origin/main 2>nul
git log -1 --oneline origin/main 2>nul
