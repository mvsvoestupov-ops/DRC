@echo off
cd /d C:\IT\DRC
git status -sb
echo ---
git log origin/main..HEAD --oneline
echo ---
git log -3 --oneline --name-only
