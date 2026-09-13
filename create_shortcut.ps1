$desktop = [Environment]::GetFolderPath('Desktop')
$wsh = New-Object -ComObject WScript.Shell
$sc = $wsh.CreateShortcut("$desktop\Launch Exam Portal.lnk")
$sc.TargetPath = "C:\Users\Harjinder\.gemini\antigravity-ide\scratch\exam-system\Launch-Exam-Portal.bat"
$sc.WorkingDirectory = "C:\Users\Harjinder\.gemini\antigravity-ide\scratch\exam-system"
$sc.Description = "Start Online Examination Portal"
$sc.Save()
Write-Host "Desktop shortcut created at: $desktop\Launch Exam Portal.lnk"
