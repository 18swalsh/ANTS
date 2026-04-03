On Error Resume Next
Dim fso, shell, scriptDir, ps1, cmd, rc, logPath
Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")
logPath = shell.ExpandEnvironmentStrings("%TEMP%") & "\bandcamp_uploader_launcher_log.txt"

Set ts = fso.OpenTextFile(logPath, 8, True)
ts.WriteLine Now & " - Launcher started"
ts.Close

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
ps1 = scriptDir & "\gui-launcher.ps1"
If Not fso.FileExists(ps1) Then
  MsgBox "Missing gui-launcher.ps1 next to this file.", vbCritical, "ANTS Uploader"
  WScript.Quit(1)
End If
cmd = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & ps1 & """"
rc = shell.Run(cmd, 0, True)
If rc <> 0 Then
  MsgBox "Uploader failed to start. See log: " & logPath, vbCritical, "ANTS Uploader"
End If
