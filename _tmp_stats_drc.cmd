@echo off
chcp 65001 >nul
cd /d C:\IT\DRC
set "SSH_KEY=%USERPROFILE%\.ssh\id_ed25519"
if not exist "%SSH_KEY%" set "SSH_KEY=%USERPROFILE%\.ssh\id_ed25519_drc"
set "LOG=C:\IT\DRC\_tmp_stats_result.txt"

echo === DRC STATS (read-only) === > "%LOG%"
ssh -i "%SSH_KEY%" -p 22 -o ConnectTimeout=15 -o StrictHostKeyChecking=accept-new root@10.100.4.20 "pct exec 228 -- sqlite3 -header -column /opt/drc/backend/profstandart.db \"SELECT COUNT(*) AS users_total FROM users; SELECT COUNT(*) AS users_with_org FROM users WHERE organization IS NOT NULL AND TRIM(organization) != ''; SELECT COUNT(DISTINCT organization) AS distinct_orgs FROM users WHERE organization IS NOT NULL AND TRIM(organization) != ''; SELECT COUNT(*) AS competences_total FROM competences; SELECT status, COUNT(*) AS n FROM competences GROUP BY status ORDER BY n DESC;\"" >> "%LOG%" 2>&1
echo RC=%ERRORLEVEL% >> "%LOG%"
type "%LOG%"
