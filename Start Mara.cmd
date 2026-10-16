@echo off
cd /d "%~dp0"
node scripts/start-app.mjs mara
if errorlevel 1 pause
