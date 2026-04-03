/**
 * ANTS Submission Manager
 * Google Apps Script for Forms/Sheets/Drive
 *
 * Sheets:
 * - Responses (linked from Google Form)
 * - YYYY-MM Snapshot (created at export)
 * - Errors
 * - Settings
 */

const SETTINGS_SHEET = 'Settings';
const ERRORS_SHEET = 'Errors';

const DEFAULT_SETTINGS = {
  album_artist: "America's Next Top Song",
  track_title_format: '{artist} - {title}',
  description:
    'Monthly compilation albums, themed each month. For fun, for free, for you and me.',
  tags: 'world, colorado',
  pricing_mode: 'free_name_your_price',
  allow_publish: 'false',
  // Column labels in the response sheet (must match your Form question titles)
  col_artist: 'Artist Name',
  col_title: 'Track Title',
  col_file: 'Audio Upload',
  // Response sheet name
  responses_sheet_name: 'Form Responses 1',
  // Root folder for monthly exports (Drive folder ID). Leave blank to create one.
  root_folder_id: ''
};

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('ANTS')
    .addItem('Setup Sheets', 'antsSetup')
    .addSeparator()
    .addItem('Export Month', 'antsExportMonth')
    .addToUi();
}

function antsSetup() {
  const ss = SpreadsheetApp.getActive();

  // Ensure Settings sheet
  let settings = ss.getSheetByName(SETTINGS_SHEET);
  if (!settings) settings = ss.insertSheet(SETTINGS_SHEET);

  settings.clear();
  settings.getRange(1, 1, 1, 2).setValues([['key', 'value']]);
  const rows = Object.keys(DEFAULT_SETTINGS).map((k) => [k, DEFAULT_SETTINGS[k]]);
  settings.getRange(2, 1, rows.length, 2).setValues(rows);
  settings.autoResizeColumns(1, 2);

  // Ensure Errors sheet
  let errors = ss.getSheetByName(ERRORS_SHEET);
  if (!errors) errors = ss.insertSheet(ERRORS_SHEET);
  errors.clear();
  errors.getRange(1, 1, 1, 4).setValues([['timestamp', 'artist', 'title', 'issue']]);
  errors.autoResizeColumns(1, 4);

  SpreadsheetApp.getUi().alert('ANTS setup complete. Update Settings as needed.');
}

function antsExportMonth() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActive();
  const settings = getSettings_();

  const month = prompt_(
    ui,
    'Export Month',
    'Enter month as YYYY-MM (e.g., 2026-04):'
  );
  if (!month) return;

  const responses = ss.getSheetByName(settings.responses_sheet_name);
  if (!responses) {
    ui.alert(
      `Could not find response sheet named "${settings.responses_sheet_name}".`
    );
    return;
  }

  const data = responses.getDataRange().getValues();
  if (data.length < 2) {
    ui.alert('No submissions found.');
    return;
  }

  const headers = data[0].map(String);
  const colArtist = findCol_(headers, settings.col_artist);
  const colTitle = findCol_(headers, settings.col_title);
  const colFile = findCol_(headers, settings.col_file);
  const colTimestamp = findCol_(headers, 'Timestamp');

  if (colArtist === -1 || colTitle === -1 || colFile === -1) {
    ui.alert(
      'Missing required columns. Check Settings for col_artist, col_title, col_file.'
    );
    return;
  }

  const rows = data.slice(1).map((row) => ({
    timestamp: row[colTimestamp] || '',
    artist: String(row[colArtist] || '').trim(),
    title: String(row[colTitle] || '').trim(),
    fileCell: row[colFile]
  }));

  const errors = [];
  const seen = new Set();
  const valid = [];

  for (const r of rows) {
    const key = normalize_(r.artist);
    if (!r.artist || !r.title) {
      errors.push([r.timestamp, r.artist, r.title, 'Missing artist or title']);
      continue;
    }
    if (!r.fileCell) {
      errors.push([r.timestamp, r.artist, r.title, 'Missing audio file']);
      continue;
    }
    if (seen.has(key)) {
      errors.push([r.timestamp, r.artist, r.title, 'Duplicate artist submission']);
      continue;
    }
    seen.add(key);
    valid.push(r);
  }

  writeErrors_(errors);
  if (valid.length === 0) {
    ui.alert('No valid submissions to export. Check Errors tab.');
    return;
  }

  const shuffled = shuffle_(valid);

  // Snapshot sheet
  const snapshotName = `${month} Snapshot`;
  const existing = ss.getSheetByName(snapshotName);
  const snapshot = existing || ss.insertSheet(snapshotName);
  snapshot.clear();
  snapshot.getRange(1, 1, 1, 5).setValues([
    ['Order', 'Artist', 'Title', 'FileName', 'Timestamp']
  ]);

  // Drive export
  const rootFolder = getOrCreateRootFolder_(settings.root_folder_id);
  if (!settings.root_folder_id) {
    setSetting_('root_folder_id', rootFolder.getId());
  }
  const monthFolder = getOrCreateChildFolder_(rootFolder, month);
  const exportFolder = getOrCreateChildFolder_(monthFolder, 'Export');
  const rawFolder = getOrCreateChildFolder_(monthFolder, 'Raw');
  clearFolder_(exportFolder);
  clearFolder_(rawFolder);

  const csvRows = [['track_title', 'track_artist', 'file_name']];
  const snapshotRows = [];

  for (let i = 0; i < shuffled.length; i++) {
    const r = shuffled[i];
    const fileIds = extractFileIds_(r.fileCell);
    const fileId = fileIds[0];
    if (!fileId) {
      errors.push([r.timestamp, r.artist, r.title, 'Could not parse file ID']);
      continue;
    }
    const src = DriveApp.getFileById(fileId);
    src.makeCopy(src.getName(), rawFolder); // Keep original name in Raw

    const safeName = `${sanitize_(r.artist)} - ${sanitize_(r.title)}`;
    const ext = getExtension_(src.getName());
    const finalName = `${safeName}${ext}`;
    const copy = src.makeCopy(finalName, exportFolder);

    const trackTitle = settings.track_title_format
      .replace('{artist}', r.artist)
      .replace('{title}', r.title);

    snapshotRows.push([i + 1, r.artist, r.title, finalName, r.timestamp]);
    csvRows.push([trackTitle, r.artist, finalName]);
  }

  snapshot.getRange(2, 1, snapshotRows.length, 5).setValues(snapshotRows);
  snapshot.autoResizeColumns(1, 5);

  if (errors.length > 0) writeErrors_(errors);

  // Write CSV + checklist
  const csvText = csvRows.map((r) => r.map(csvEscape_).join(',')).join('\n');
  exportFolder.createFile('bandcamp_upload.csv', csvText, MimeType.PLAIN_TEXT);

  const checklist = [
    'Bandcamp Upload Checklist',
    '1) Run the uploader script and log in.',
    '2) Confirm album title and album art.',
    '3) Verify track order and metadata.',
    '4) Review pricing and description/tags.',
    '5) Publish manually when ready.'
  ].join('\n');
  exportFolder.createFile('upload_checklist.txt', checklist, MimeType.PLAIN_TEXT);

  const exportUrl = exportFolder.getUrl();
  ui.alert(
    `Export complete for ${month}.\n\n` +
      `Saved to: ${month}/Export\n` +
      `${exportUrl}\n\n` +
      'Check Errors tab for any issues.'
  );
}

// ----- Helpers -----

function getSettings_() {
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName(SETTINGS_SHEET);
  if (!sheet) throw new Error('Settings sheet missing. Run Setup Sheets.');

  const values = sheet.getDataRange().getValues();
  const map = {};
  for (let i = 1; i < values.length; i++) {
    const key = String(values[i][0] || '').trim();
    if (!key) continue;
    map[key] = String(values[i][1] || '').trim();
  }
  return Object.assign({}, DEFAULT_SETTINGS, map);
}

function writeErrors_(rows) {
  const ss = SpreadsheetApp.getActive();
  let sheet = ss.getSheetByName(ERRORS_SHEET);
  if (!sheet) sheet = ss.insertSheet(ERRORS_SHEET);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, 4).setValues([['timestamp', 'artist', 'title', 'issue']]);
  }
  if (rows.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 4).setValues(rows);
  }
}

function normalize_(s) {
  return String(s || '').trim().toLowerCase();
}

function findCol_(headers, name) {
  const target = String(name || '').trim().toLowerCase();
  return headers.findIndex((h) => String(h).trim().toLowerCase() === target);
}

function sanitize_(s) {
  return String(s || '')
    .replace(/[\\/\?%\*:|"<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getExtension_(name) {
  const idx = name.lastIndexOf('.');
  return idx >= 0 ? name.slice(idx) : '';
}

function shuffle_(arr) {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

function csvEscape_(v) {
  const s = String(v ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function extractFileIds_(cellValue) {
  if (!cellValue) return [];
  // For file upload responses, Apps Script often gives a string like
  // "https://drive.google.com/open?id=FILE_ID" or the file name.
  const s = String(cellValue);
  const matches = s.match(/[-\w]{25,}/g);
  return matches || [];
}

function getOrCreateRootFolder_(folderId) {
  if (folderId) {
    try {
      return DriveApp.getFolderById(folderId);
    } catch (e) {
      // fall through to create
    }
  }
  const existing = DriveApp.getFoldersByName('ANTS_Submissions');
  if (existing.hasNext()) return existing.next();
  return DriveApp.createFolder('ANTS_Submissions');
}

function getOrCreateChildFolder_(parent, name) {
  const it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

function prompt_(ui, title, prompt) {
  const resp = ui.prompt(title, prompt, ui.ButtonSet.OK_CANCEL);
  if (resp.getSelectedButton() !== ui.Button.OK) return '';
  return String(resp.getResponseText() || '').trim();
}

function setSetting_(key, value) {
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName(SETTINGS_SHEET);
  if (!sheet) return;

  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]).trim() === key) {
      sheet.getRange(i + 1, 2).setValue(value);
      return;
    }
  }

  // Append if not found
  sheet.getRange(sheet.getLastRow() + 1, 1, 1, 2).setValues([[key, value]]);
}

function clearFolder_(folder) {
  const files = folder.getFiles();
  while (files.hasNext()) {
    const file = files.next();
    file.setTrashed(true);
  }
  const folders = folder.getFolders();
  while (folders.hasNext()) {
    const sub = folders.next();
    sub.setTrashed(true);
  }
}
