@echo off
setlocal

cd /d "%~dp0"

if not exist node_modules (
  echo Installing dependencies...
  npm install
  if errorlevel 1 (
    echo Failed to install dependencies.
    pause
    exit /b 1
  )
)

if not exist dist mkdir dist

echo Building standalone app...
call npm run build
if errorlevel 1 (
  echo Build failed.
  pause
  exit /b 1
)

echo Built: dist\ANTS-Bandcamp-Uploader.exe
pause
