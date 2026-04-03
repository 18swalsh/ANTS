# Standalone App Build

If you want a no-Node experience for end users, build the Windows EXE once and share it.

## Build (run on a machine with Node.js)
1. Open a terminal in this folder.
2. Run:
   ```
   npm install
   npm run build
   ```
3. The EXE will be in `dist/ANTS-Bandcamp-Uploader.exe`.

## Use (end user)
- Double-click `ANTS-Uploader-GUI.vbs` (GUI) and follow the prompts.
- You can choose either the Export folder or the Export zip file.
- Note: The GUI uses Node.js in the background. If Node.js is missing, it will prompt to install it.
