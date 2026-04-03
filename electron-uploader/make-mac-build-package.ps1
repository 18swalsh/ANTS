$ErrorActionPreference = "Stop"

$src = Split-Path -Parent $MyInvocation.MyCommand.Path
$stage = Join-Path (Split-Path -Parent $src) "_mac_build_stage"
$dest = Join-Path $src "mac-build-package.zip"

if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory -Path $stage | Out-Null

# Copy everything except build outputs, node_modules, and any zip artifacts
robocopy $src $stage /E /XD dist node_modules _mac_build_stage /XF mac-build-package.zip *.zip > $null

if (Test-Path $dest) { Remove-Item $dest -Force }
Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $dest

Write-Output "Created $dest"
