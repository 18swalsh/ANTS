@echo off
setlocal
cd /d "%~dp0"

npm install
npx.cmd icon-gen -i assets\ants_logo.png -o build\icons --ico --ico-name ants
npm run pack:win

echo Done. Find the ZIP in electron-uploader\dist
pause
