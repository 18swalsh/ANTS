@echo off
setlocal
cd /d "%~dp0"

npm install
npm run pack:win

echo Done. Find the ZIP in electron-uploader\dist
pause
