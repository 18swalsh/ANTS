# ANTS Monthly Workflow Setup

## 1) Google Form + Sheet
- Create a Google Form with fields:
  - Artist Name
  - Track Title
  - Audio Upload (file upload enabled)
- Link the form to a Google Sheet (responses go to `Form Responses 1`).

## 2) Apps Script
- Open **Extensions → Apps Script** and paste `apps-script/Code.gs`.
- Refresh the Sheet.
- Run **ANTS → Setup Sheets** once.
- Edit the **Settings** tab if your form labels differ or if the response sheet name is not `Form Responses 1`.

## 3) Monthly Export
- Run **ANTS → Export Month**.
- Enter `YYYY-MM`.
- Drive output: `ANTS_Submissions/YYYY-MM/Export` with:
  - Audio files named `Artist - Title.ext`
  - `bandcamp_upload.csv`
  - `upload_checklist.txt`

## 4) Bandcamp Upload
- Download the Export folder locally (or sync via Drive).
- In `bandcamp-uploader/`:
  - `npm install`
  - `npm run upload`
- Log in to Bandcamp when prompted, navigate to the album edit page, then continue.
  - Default album edit URL: https://americasnexttopsong.bandcamp.com/edit_album

### Easiest Way (Windows)
- Double-click `bandcamp-uploader\\run-uploader.cmd`

### Standalone EXE (No Node Needed)
- Build once and share `bandcamp-uploader\\dist\\ANTS-Bandcamp-Uploader.exe`
- See `bandcamp-uploader\\STANDALONE.md`

## 5) Cross-Platform GUI (Recommended)
- Use the Electron app in `electron-uploader/`.
- See `electron-uploader\\README.md` for install/run/build steps (macOS + Windows).

## Defaults
- Album artist: `America's Next Top Song`
- Track title format: `Artist - Title`
- Tags: `world`, `colorado`
- Description: `Monthly compilation albums, themed each month. For fun, for free, for you and me.`
- Pricing: free / name-your-price
- Publish: manual only
