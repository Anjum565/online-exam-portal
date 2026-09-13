# Install autostart into Windows Startup folder
$startup = [Environment]::GetFolderPath('Startup')
$desktop = [Environment]::GetFolderPath('Desktop')
$examDir = "C:\Users\Harjinder\.gemini\antigravity-ide\scratch\exam-system"

$wsh = New-Object -ComObject WScript.Shell

# 1. Startup folder shortcut (runs automatically on login)
$startupShortcut = $wsh.CreateShortcut("$startup\OnlineExamPortalAutostart.lnk")
$startupShortcut.TargetPath = "wscript.exe"
$startupShortcut.Arguments = "`"$examDir\autostart.vbs`""
$startupShortcut.WorkingDirectory = $examDir
$startupShortcut.Description = "Autostart Online Examination Portal on Windows boot"
$startupShortcut.Save()
Write-Host "Created Windows Startup Entry at: $startup\OnlineExamPortalAutostart.lnk"

# 2. Desktop Shortcut to Stop the Portal anytime
$stopShortcut = $wsh.CreateShortcut("$desktop\Stop Exam Portal.lnk")
$stopShortcut.TargetPath = "$examDir\Stop-Exam-Portal.bat"
$stopShortcut.WorkingDirectory = $examDir
$stopShortcut.Description = "Stop Online Examination Portal and Cloudflare Tunnel"
$stopShortcut.Save()
Write-Host "Created Desktop Shortcut: $desktop\Stop Exam Portal.lnk"

# 3. Desktop Shortcut to Restart or Launch Portal manually
$launchShortcut = $wsh.CreateShortcut("$desktop\Start Exam Portal.lnk")
$launchShortcut.TargetPath = "wscript.exe"
$launchShortcut.Arguments = "`"$examDir\autostart.vbs`""
$launchShortcut.WorkingDirectory = $examDir
$launchShortcut.Description = "Start Online Examination Portal in background"
$launchShortcut.Save()
Write-Host "Created Desktop Shortcut: $desktop\Start Exam Portal.lnk"
