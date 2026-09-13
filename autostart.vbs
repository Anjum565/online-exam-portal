' Silent Launcher for Online Exam Portal Autostart
Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -File ""C:\Users\Harjinder\.gemini\antigravity-ide\scratch\exam-system\autostart.ps1""", 0, False
Set WshShell = Nothing
