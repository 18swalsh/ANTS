#!/bin/bash
set -e

cd "$(dirname "$0")"

# Ensure common Node install paths are available for non-terminal runs
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

# Log location
LOG_DIR="$HOME/Library/Logs/ANTS Bandcamp Uploader"
mkdir -p "$LOG_DIR"
BUILD_LOG="$LOG_DIR/build.log"

# Skip Playwright browser download during build (we download on first run)
export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
export npm_config_playwright_skip_browser_download=1

# Fix Windows ZIP backslash paths (renderer\index.html -> renderer/index.html)
# 1) Top-level files named like "renderer\index.html"
bad_files=$(find . -maxdepth 1 -type f -name 'renderer\\*' 2>/dev/null || true)
if [ -n "$bad_files" ]; then
  mkdir -p renderer
  while IFS= read -r f; do
    base="${f##*\\}"
    if [ -n "$base" ]; then
      mv "$f" "renderer/$base"
    fi
  done <<< "$bad_files"
fi

# 2) Files already inside renderer folder but still named like "renderer\index.html"
bad_inside=$(find renderer -maxdepth 1 -type f -name 'renderer\\*' 2>/dev/null || true)
if [ -n "$bad_inside" ]; then
  while IFS= read -r f; do
    base="${f##*\\}"
    if [ -n "$base" ]; then
      mv "$f" "renderer/$base"
    fi
  done <<< "$bad_inside"
fi

if [ -d "dist" ]; then
  rm -rf "dist"
fi

if ! command -v npm >/dev/null 2>&1; then
  osascript -e 'display dialog "Node.js is required. Please install Node.js from nodejs.org, then run this again." buttons {"OK"} default button "OK" with icon caution'
  exit 1
fi

npm install --ignore-scripts >>"$BUILD_LOG" 2>&1
if [ $? -ne 0 ]; then
  osascript -e 'display dialog "Build failed during npm install.\n\nSee log: '"$BUILD_LOG"'" buttons {"OK"} default button "OK" with icon caution'
  exit 1
fi

# Ensure no leftover Playwright browsers (prevents symlink copy errors)
rm -rf "node_modules/playwright/.local-browsers" "node_modules/playwright-core/.local-browsers"

npm run pack:mac >>"$BUILD_LOG" 2>&1
if [ $? -ne 0 ]; then
  osascript -e 'display dialog "Build failed during packaging.\n\nSee log: '"$BUILD_LOG"'" buttons {"OK"} default button "OK" with icon caution'
  exit 1
fi

osascript -e 'display dialog "Mac build complete.\n\nUse the ZIP in dist (ANTS Bandcamp Uploader-*.zip).\n\nLog: '"$BUILD_LOG"'" buttons {"OK"} default button "OK"'
