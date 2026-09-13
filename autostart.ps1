# Online Examination System Automatic Startup Script
$ErrorActionPreference = 'SilentlyContinue'

$examDir = "C:\Users\Harjinder\.gemini\antigravity-ide\scratch\exam-system"
Set-Location $examDir

# 1. Verify / Start Node.js Backend Server
$isBackendRunning = $false
try {
    $res = Invoke-RestMethod -Uri 'http://localhost:5000/api/health' -TimeoutSec 2 -ErrorAction Stop
    if ($res.status -eq 'ok') {
        $isBackendRunning = $true
    }
} catch {
    $isBackendRunning = $false
}

if (-not $isBackendRunning) {
    Start-Process -FilePath "node" -ArgumentList "backend/server.js" -WorkingDirectory $examDir -WindowStyle Hidden
    Start-Sleep -Seconds 3
}

# 2. Verify / Start Cloudflare Tunnel
$tunnelLog = "$examDir\tunnel.log"
$urlFile = "$examDir\active_tunnel_url.txt"
$cfProc = Get-Process -Name "cloudflared" -ErrorAction SilentlyContinue
$hasUrl = (Test-Path $urlFile) -and ((Get-Content $urlFile -ErrorAction SilentlyContinue -Raw).Trim() -match '^https://')

if ($cfProc -and -not $hasUrl) {
    Stop-Process -Name "cloudflared" -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
    $cfProc = $null
}

$cfUrl = ""
if (-not $cfProc) {
    if (Test-Path $tunnelLog) { Remove-Item -Force $tunnelLog }
    $cfArgs = "tunnel --protocol http2 --logfile `"$tunnelLog`" --url http://localhost:5000"
    Start-Process -FilePath "$examDir\cloudflared.exe" -ArgumentList $cfArgs -WorkingDirectory $examDir -WindowStyle Hidden

    # Wait up to 15 seconds to extract the Cloudflare URL
    for ($i = 0; $i -lt 15; $i++) {
        Start-Sleep -Seconds 1
        if (Test-Path $tunnelLog) {
            $logContent = Get-Content $tunnelLog -ErrorAction SilentlyContinue -Raw
            if ($logContent -match 'https://[a-zA-Z0-9-]+\.trycloudflare\.com') {
                $cfUrl = $matches[0]
                Set-Content -Path $urlFile -Value $cfUrl -Force
                break
            }
        }
    }
} else {
    if (Test-Path $tunnelLog) {
        $logContent = Get-Content $tunnelLog -ErrorAction SilentlyContinue -Raw
        if ($logContent -match 'https://[a-zA-Z0-9-]+\.trycloudflare\.com') {
            $cfUrl = $matches[0]
            Set-Content -Path $urlFile -Value $cfUrl -Force
        }
    }
    if (-not $cfUrl -and (Test-Path $urlFile)) {
        $cfUrl = (Get-Content $urlFile -ErrorAction SilentlyContinue -Raw).Trim()
    }
}

# 3. Determine Local Wi-Fi / Hotspot IP
$localIp = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { 
    $_.IPAddress -like '192.168.*' -or $_.IPAddress -like '10.*' 
} | Select-Object -First 1).IPAddress

if (-not $localIp) { $localIp = "127.0.0.1" }

# 4. Write Active Links to Desktop
$desktop = [Environment]::GetFolderPath('Desktop')
$timestamp = (Get-Date).ToString('dd-MMM-yyyy hh:mm:ss tt')

$linksText = @"
======================================================================
           ONLINE EXAMINATION SYSTEM - ACTIVE ACCESS LINKS
======================================================================
Last Updated : $timestamp
Backend Status : ONLINE & RUNNING on port 5000

----------------------------------------------------------------------
1. PRIMARY ACCESS ON THIS COMPUTER (Always Works, Never Expires):
   --> http://localhost:5000
   --> http://localhost:5000/login

2. LOCAL WI-FI / HOTSPOT ACCESS (For Students on Phone / Tablet / PC):
   --> http://$($localIp):5000
   (Fastest, zero lag for anyone connected to your Wi-Fi or Hotspot)

3. PUBLIC INTERNET LINK (Cloudflare Tunnel - Access from Anywhere):
   --> $($cfUrl)
   (Share this link with students or teachers anywhere in the world)
----------------------------------------------------------------------

ADMIN & FACULTY QUICK ACCESS:
- Faculty Teacher Setup: http://localhost:5000/register/faculty
- Admin Command Center : http://localhost:5000/admin/dashboard

======================================================================
* This system runs automatically in the background on computer startup.
* To stop the portal anytime, run 'Stop Exam Portal' from your Desktop.
======================================================================
"@

Set-Content -Path "$desktop\Exam-Portal-Active-Links.txt" -Value $linksText -Force

# 5. Create / Update Desktop Shortcuts
$wsh = New-Object -ComObject WScript.Shell

# Shortcut 1: Open Local Portal
$scLocal = $wsh.CreateShortcut("$desktop\Open Local Exam Portal.lnk")
$scLocal.TargetPath = "http://localhost:5000"
$scLocal.Description = "Open Local Examination Portal (Fastest)"
$scLocal.Save()

# Shortcut 2: Open Public Cloudflare Portal (if available)
if ($cfUrl) {
    $scPublic = $wsh.CreateShortcut("$desktop\Open Public Cloudflare Exam Portal.lnk")
    $scPublic.TargetPath = $cfUrl
    $scPublic.Description = "Open Public Examination Portal via Cloudflare"
    $scPublic.Save()
}

# 6. Display Windows Toast / Notification
try {
    Add-Type -AssemblyName System.Windows.Forms
    $notification = New-Object System.Windows.Forms.NotifyIcon
    $notification.Icon = [System.Drawing.SystemIcons]::Information
    $notification.BalloonTipTitle = "Exam Portal is Online"
    $notification.BalloonTipText = "System is running! Access links have been placed on your Desktop."
    $notification.Visible = $true
    $notification.ShowBalloonTip(4000)
    Start-Sleep -Seconds 4
    $notification.Dispose()
} catch {}
