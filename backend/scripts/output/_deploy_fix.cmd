@echo off
cd /d C:\IT\DRC
git add backend/app/repair_missing_tf_from_html.py deploy-remote.sh
git commit -m "fix: stream HTML TF repair to avoid OOM on deploy"
git push -u origin main
call push-and-deploy.cmd /deploy
exit /b %ERRORLEVEL%
