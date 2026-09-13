$examDir = "C:\Users\Harjinder\.gemini\antigravity-ide\scratch\exam-system"
$desktop = [Environment]::GetFolderPath('Desktop')
$cfUrl = "https://dice-mission-helping-northeast.trycloudflare.com"

# Determine Local Wi-Fi / Hotspot IP
$localIp = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { 
    $_.IPAddress -like '192.168.*' -or $_.IPAddress -like '10.*' 
} | Select-Object -First 1).IPAddress
if (-not $localIp) { $localIp = "127.0.0.1" }

Set-Content -Path "$examDir\active_tunnel_url.txt" -Value $cfUrl -Force

$timestamp = (Get-Date).ToString('dd-MMM-yyyy hh:mm:ss tt')
$linksText = @"
======================================================================
           ONLINE EXAMINATION SYSTEM - ACTIVE ACCESS LINKS
======================================================================
Last Updated : $timestamp
Backend Status : ONLINE on port 5000

----------------------------------------------------------------------
1. PRIMARY ACCESS ON THIS COMPUTER (USE THIS ON YOUR PC):
   --> http://localhost:5000
   --> http://localhost:5000/login
   (Never expires, never drops, works even without internet)

2. LOCAL WI-FI / HOTSPOT ACCESS (For Students on Phone / Tablet / PC):
   --> http://$($localIp):5000
   (Fastest, zero lag for anyone connected to your Wi-Fi or Hotspot)

3. PUBLIC INTERNET LINK (Cloudflare Tunnel - Access from Anywhere):
   --> $cfUrl
   (Share this link with students or teachers anywhere in the world)
----------------------------------------------------------------------

ADMIN & FACULTY QUICK ACCESS:
- Faculty Teacher Setup: http://localhost:5000/register/faculty
- Admin Command Center : http://localhost:5000/admin/dashboard

======================================================================
* To stop the portal anytime, run 'Stop Exam Portal' from your Desktop.
======================================================================
"@

Set-Content -Path "$desktop\Exam-Portal-Active-Links.txt" -Value $linksText -Force

$wsh = New-Object -ComObject WScript.Shell
$scPublic = $wsh.CreateShortcut("$desktop\Open Public Cloudflare Exam Portal.lnk")
$scPublic.TargetPath = $cfUrl
$scPublic.Description = "Open Public Examination Portal via Cloudflare"
$scPublic.Save()

Write-Host "Updated desktop links with: $cfUrl (Local IP: $localIp)"
