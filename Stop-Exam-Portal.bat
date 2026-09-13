@echo off
title Stop Online Examination Portal
color 0C
echo ===================================================
echo     STOPPING ONLINE EXAMINATION SYSTEM
echo ===================================================
echo.
echo Stopping cloudflared tunnel...
taskkill /F /IM cloudflared.exe >nul 2>&1

echo Stopping node backend server...
powershell -Command "Get-CimInstance Win32_Process -Filter 'Name = ''node.exe''' | Where-Object { $_.CommandLine -like '*backend/server.js*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }" >nul 2>&1

echo.
echo [DONE] Examination Portal and Cloudflare tunnel have been stopped.
timeout /t 3 >nul
