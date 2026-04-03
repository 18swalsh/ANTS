# ANTS Apps Script

This script powers the Google Form/Sheet/Drive workflow.

## Setup
1. Create a Google Form with fields:
   - Artist Name
   - Track Title
   - Audio Upload (file upload enabled)
2. Link the Form to a Google Sheet (Responses go into `Form Responses 1`).
3. Open **Extensions → Apps Script** and paste `Code.gs` contents.
4. Refresh the Sheet. You will see an **ANTS** menu.
5. Run **ANTS → Setup Sheets** once.
6. Open the **Settings** tab and adjust:
   - `responses_sheet_name` if your sheet is not `Form Responses 1`
   - `col_artist`, `col_title`, `col_file` if your form labels differ
   - `root_folder_id` if you want exports inside a specific Drive folder

## Monthly Export
1. In the Sheet, choose **ANTS → Export Month**.
2. Enter `YYYY-MM` (example: `2026-04`).
3. The script creates:
   - A `YYYY-MM Snapshot` tab with fixed randomized order
   - Drive folder `ANTS_Submissions/YYYY-MM/Export`
   - `bandcamp_upload.csv` + `upload_checklist.txt`

## Notes
- Duplicate artist submissions are flagged in `Errors`.
- File names are saved as `Artist - Title.ext` (no track numbers).
