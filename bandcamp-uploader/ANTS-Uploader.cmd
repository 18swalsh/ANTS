@echo off
setlocal

set SCRIPT=%~dp0gui-launcher.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%SCRIPT%"
