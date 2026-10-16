@echo off
cd /d "%~dp0"
node scripts/start-app.mjs advisor
if errorlevel 1 pause
