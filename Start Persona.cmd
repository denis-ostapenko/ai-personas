@echo off
cd /d "%~dp0"
node scripts/start-app.mjs persona
if errorlevel 1 pause
