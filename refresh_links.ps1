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
1. PERMANENT 24/7 CLOUD LINK (WORKS WORLDWIDE - NEVER EXPIRES):
   --> https://online-examination-portal-5i90.onrender.com
   --> https://online-examination-portal-5i90.onrender.com/login
   (Hosted 24/7 on Render + MongoDB Atlas with UptimeRobot active)

2. PRIMARY LOCAL ACCESS (When testing locally on this PC):
   --> http://localhost:5000
   --> http://localhost:5000/login
   (Fastest, works completely offline)

3. LOCAL WI-FI / HOTSPOT ACCESS (For Students on Local Network):
   --> http://$($localIp):5000
----------------------------------------------------------------------

ADMIN & FACULTY CLOUD QUICK ACCESS:
- Live Cloud Portal    : https://online-examination-portal-5i90.onrender.com
- Faculty Teacher Setup: https://online-examination-portal-5i90.onrender.com/register/faculty
- Admin Command Center : https://online-examination-portal-5i90.onrender.com/admin/dashboard
- Live Health Status   : https://online-examination-portal-5i90.onrender.com/api/health

======================================================================
* To stop the portal anytime, run 'Stop Exam Portal' from your Desktop.
======================================================================
"@

Set-Content -Path "$desktop\Exam-Portal-Active-Links.txt" -Value $linksText -Force

$wsh = New-Object -ComObject WScript.Shell
$scCloud = $wsh.CreateShortcut("$desktop\Open 24-7 Cloud Exam Portal.lnk")
$scCloud.TargetPath = "https://online-examination-portal-5i90.onrender.com"
$scCloud.Description = "Open Permanent 24/7 Cloud Examination Portal"
$scCloud.Save()

Write-Host "Updated desktop links with permanent 24/7 cloud URL: https://online-examination-portal-5i90.onrender.com"
