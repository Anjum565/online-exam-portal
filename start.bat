@echo off
echo ========================================================
echo   Starting Online Examination System
echo ========================================================
cd /d "%~dp0backend"
echo Launching Server on http://localhost:5000...
node server.js
pause
