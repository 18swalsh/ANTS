# ANTS Bandcamp Uploader (Electron)

Cross-platform GUI for the ANTS Bandcamp upload flow.

## Setup
1. Install Node.js (18+ recommended).
2. In this folder:
   ```
   npm install
   ```

## Run (Development)
```
npm start
```

## Build (Unsigned)
### macOS
```
npm run pack:mac
```
Output ZIP will be in `dist/`.

### Windows
```
npm run pack:win
```

## Notes
- The app launches a visible browser and automates Bandcamp using Playwright.
- Logs are written to the export folder and `%TEMP%\bandcamp_uploader_last_log.txt`.
