#!/bin/bash
set -e

cd "$(dirname "$0")"

# Ensure common Node install paths are available for non-terminal runs
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

if [ -d "dist" ]; then
  rm -rf "dist"
fi

if ! command -v npm >/dev/null 2>&1; then
  osascript -e 'display dialog "Node.js is required. Please install Node.js from nodejs.org, then run this again." buttons {"OK"} default button "OK" with icon caution'
  exit 1
fi

npm install
npm run pack:mac

osascript -e 'display dialog "Mac build complete.\n\nUse the ZIP in dist (ANTS Bandcamp Uploader-*.zip). Do not run any older app outside the ZIP." buttons {"OK"} default button "OK"'
