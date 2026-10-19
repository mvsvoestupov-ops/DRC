@echo off
cd /d C:\IT\DRC
set "OUT=%~dp0_agent_git_out.txt"
(
  echo === status ===
  git status -sb
  echo === unpushed ===
  git log origin/main..HEAD --oneline
  echo === log3 ===
  git log -3 --oneline --name-only
  echo === origin main ===
  git rev-parse origin/main
  echo === HEAD ===
  git rev-parse HEAD
) > "%OUT%" 2>&1
