@echo off
setlocal
cd /d "%~dp0"

if not exist node_modules (
  npm.cmd install
)

echo Starting dev mode...
npm.cmd start
