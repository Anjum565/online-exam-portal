@echo off
title Online Examination Portal Launcher
color 0A

echo ===================================================
echo     ONLINE EXAMINATION PORTAL - QUICK LAUNCHER
echo ===================================================
echo.

cd /d "C:\Users\Harjinder\.gemini\antigravity-ide\scratch\exam-system"

echo [1/3] Checking Node backend server...
powershell -Command "if (!(Get-Process -Name 'node' -ErrorAction SilentlyContinue)) { Start-Process 'node' -ArgumentList 'backend/server.js' -WindowStyle Hidden; Write-Host '   Backend started on port 5000' } else { Write-Host '   Backend is already running on port 5000' }"

echo.
echo [2/3] Your Local Wi-Fi / Hotspot Exam URL:
powershell -Command "$ip = (Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias 'Wi-Fi*','Ethernet*' | Where-Object { $_.IPAddress -notlike '169.254*' -and $_.IPAddress -notlike '127.*' } | Select-Object -First 1).IPAddress; Write-Host '   --> http://' $ip ':5000 (Fastest for students on your Wi-Fi/Hotspot)' -ForegroundColor Cyan"

echo.
echo [3/3] Starting Public Internet Cloudflare Link...
echo.
echo ===================================================
echo Please keep this window open while exams are active.
echo Your public link will appear below (https://...trycloudflare.com):
echo ===================================================
echo.

.\cloudflared.exe tunnel --protocol http2 --url http://localhost:5000
pause
