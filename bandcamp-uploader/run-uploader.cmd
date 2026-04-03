@echo off
setlocal

cd /d "%~dp0"

echo ANTS Bandcamp Uploader Launcher

echo Checking dependencies...
if not exist node_modules\playwright (
  echo Installing dependencies (first run only)...
  npm install
  if errorlevel 1 (
    echo Failed to install dependencies. Please ensure Node.js is installed.
    pause
    exit /b 1
  )
)

echo Launching uploader...
node uploader.js

if errorlevel 1 (
  echo Uploader exited with an error.
  pause
  exit /b 1
)

echo Done.
pause
