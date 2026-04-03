const fs = require('fs');
const path = require('path');
const os = require('os');
const { chromium } = require('playwright');
const extract = require('extract-zip');

const DEFAULT_SETTINGS = {
  album_artist: "America's Next Top Song",
  track_title_format: '{artist} - {title}',
  description:
    'Monthly compilation albums, themed each month. For fun, for free, for you and me.',
  tags: ['world', 'colorado'],
  pricing_mode: 'free_name_your_price',
  allow_publish: false,
  selectors: {}
};

function loadSettings(settingsPath) {
  const pathToUse = settingsPath || path.join(__dirname, 'settings.json');
  if (fs.existsSync(pathToUse)) {
    const raw = fs.readFileSync(pathToUse, 'utf8');
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  }
  return { ...DEFAULT_SETTINGS };
}

function parseCsv(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const lines = text.split(/\r?\n/).filter(Boolean);
  const headers = splitCsvLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    const row = {};
    headers.forEach((h, idx) => (row[h] = cols[idx] || ''));
    rows.push(row);
  }
  return rows;
}

function splitCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ',' && !inQuotes) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function isZipFile(p) {
  return typeof p === 'string' && p.toLowerCase().endsWith('.zip');
}

function isCsvFile(p) {
  return typeof p === 'string' && p.toLowerCase().endsWith('.csv');
}

function findCsvFolder(rootDir) {
  const stack = [rootDir];
  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile() && entry.name.toLowerCase() === 'bandcamp_upload.csv') {
        return current;
      }
    }
  }
  return '';
}

async function ensureExportFolder(maybePath) {
  if (!maybePath) return '';
  if (fs.existsSync(maybePath) && fs.statSync(maybePath).isFile() && isCsvFile(maybePath)) {
    return path.dirname(maybePath);
  }
  if (fs.existsSync(maybePath) && fs.statSync(maybePath).isFile() && isZipFile(maybePath)) {
    const tempRoot = path.join(os.tmpdir(), `ants_export_${Date.now()}`);
    fs.mkdirSync(tempRoot, { recursive: true });
    await extract(maybePath, { dir: tempRoot });
    const csvFolder = findCsvFolder(tempRoot);
    if (!csvFolder) return '';
    return csvFolder;
  }
  return maybePath;
}

async function launchBrowser() {
  const launchOpts = {
    headless: false,
    args: ['--new-window', '--window-size=1280,900']
  };
  try {
    return await chromium.launch({ ...launchOpts, channel: 'chrome' });
  } catch (err) {
    return await chromium.launch(launchOpts);
  }
}

function createLogger(logPath) {
  return (msg) => {
    const line = `[${new Date().toISOString()}] ${msg}\n`;
    fs.appendFileSync(logPath, line, 'utf8');
  };
}

function createMultiLogger(loggers) {
  return (msg) => {
    for (const logger of loggers) logger(msg);
  };
}

function ensureNotAborted(signal) {
  if (signal && signal.aborted) {
    throw new Error('Upload canceled');
  }
}

async function runUpload({
  exportPath,
  albumTitle,
  albumArtPath,
  albumUrl,
  settings,
  settingsPath,
  signal,
  onStatus
}) {
  let uploadedCount = 0;
  let allUploadsComplete = false;
  const status = (msg) => {
    if (onStatus) onStatus(msg);
  };

  const loggers = [];
  const tempLogPath = path.join(os.tmpdir(), 'bandcamp_uploader_last_log.txt');
  loggers.push(createLogger(tempLogPath));

  const homeDir = os.homedir && os.homedir();
  if (homeDir) {
    const macLogsDir = path.join(homeDir, 'Library', 'Logs', 'ANTS Bandcamp Uploader');
    try {
      fs.mkdirSync(macLogsDir, { recursive: true });
      const macLogPath = path.join(macLogsDir, 'bandcamp_uploader_log.txt');
      loggers.push(createLogger(macLogPath));
    } catch (_) {
      // ignore
    }
  }

  const log = createMultiLogger(loggers);
  status('Initializing...');
  log('Uploader started.');

  log(`PLAYWRIGHT_BROWSERS_PATH=${process.env.PLAYWRIGHT_BROWSERS_PATH || ''}`);

  const resolvedExport = await ensureExportFolder(exportPath);
  if (!resolvedExport) throw new Error('Export path is invalid or missing bandcamp_upload.csv');

  const csvPath = path.join(resolvedExport, 'bandcamp_upload.csv');
  if (!fs.existsSync(csvPath)) throw new Error('bandcamp_upload.csv not found');

  const logPath = path.join(resolvedExport, 'bandcamp_uploader_log.txt');
  try {
    loggers.push(createLogger(logPath));
  } catch (_) {
    // ignore
  }

  const rows = parseCsv(csvPath);
  if (rows.length === 0) throw new Error('No tracks found in bandcamp_upload.csv');

  const mergedSettings = { ...loadSettings(settingsPath), ...(settings || {}) };
  // Ensure Playwright uses bundled browsers when packaged
  if (!process.env.PLAYWRIGHT_BROWSERS_PATH) {
    const resourcesPath = process.resourcesPath || '';
    if (resourcesPath && resourcesPath.includes('.app')) {
      // No bundled browsers; use default cache path
      process.env.PLAYWRIGHT_BROWSERS_PATH = '';
    } else {
      process.env.PLAYWRIGHT_BROWSERS_PATH = '0';
    }
  }
  let browser;
  try {
    log('Launching browser...');
    browser = await launchBrowser();
    log('Browser launched.');
  } catch (err) {
    log(`Browser launch failed: ${err.message || err}`);
    // Attempt to install Chromium on first run
    status('Downloading browser (first-time setup)...');
    log('Attempting to install Chromium via Playwright...');
    const { execFileSync } = require('child_process');
    try {
      execFileSync(process.execPath, [require.resolve('playwright/cli'), 'install', 'chromium'], {
        stdio: 'inherit'
      });
      log('Chromium install complete, retrying launch...');
      browser = await launchBrowser();
      log('Browser launched after install.');
    } catch (installErr) {
      log(`Chromium install failed: ${installErr.message || installErr}`);
      throw err;
    }
  }
  const context = await browser.newContext({ viewport: null });
  const page = await context.newPage();

  try {
    const editUrl = albumUrl || 'https://americasnexttopsong.bandcamp.com/edit_album';
    status('Opening Bandcamp...');
    await page.goto(editUrl, { waitUntil: 'domcontentloaded' });
    try { await page.bringToFront(); } catch (_) {}
    log('Opened Bandcamp page.');

  status('Waiting for album editor...');
  try {
    await page.waitForSelector('a.add-audio, input[name="title"]', { timeout: 180000 });
  } catch (_) {
    // continue
  }

  ensureNotAborted(signal);

  const sel = mergedSettings.selectors || {};

  const albumTitleSelectors = sel.albumTitle
    ? [sel.albumTitle]
    : ['input[name="title"]', 'input[placeholder*="album" i]', 'input[type="text"]'];

  await fillFirst(page, albumTitleSelectors, albumTitle);
  log('Album title filled.');

  const albumArtistSelectors = sel.albumArtist
    ? [sel.albumArtist]
    : ['input[name="artist"]', 'input[placeholder*="artist" i]'];
  await fillFirst(page, albumArtistSelectors, mergedSettings.album_artist);
  log('Album artist filled.');

  const descSelectors = sel.albumDescription
    ? [sel.albumDescription]
    : [
        'textarea[name="album.about"]',
        'textarea[data-test="album-description-input"]',
        'textarea[name="about"]:not([class*="subscriber"])',
        'textarea[placeholder*="about this album" i]',
        'textarea[placeholder*="about" i]'
      ];
  if (mergedSettings.description) {
    const filled = await fillFirstVisible(page, descSelectors, mergedSettings.description);
    if (filled) {
      log('Album description filled.');
    } else {
      log('Album description not found (skipping).');
    }
  }

  const tagSelectors = sel.albumTags
    ? [sel.albumTags]
    : [
        'input[name="album.tags"]',
        'input.ui-autocomplete-input',
        'input[placeholder*="tag" i]'
      ];
  if (Array.isArray(mergedSettings.tags)) {
    const filled = await fillFirstVisible(page, tagSelectors, mergedSettings.tags.join(', '));
    log(filled ? 'Album tags filled.' : 'Album tags not found (skipping).');
  } else if (mergedSettings.tags) {
    const filled = await fillFirstVisible(page, tagSelectors, String(mergedSettings.tags));
    log(filled ? 'Album tags filled.' : 'Album tags not found (skipping).');
  }

  if (albumArtPath) {
    if (sel.albumArtInput) {
      await page.locator(sel.albumArtInput).setInputFiles(albumArtPath);
    } else {
      const artInputs = page.locator('#edit-tralbum-form .art-upload-wrapper input[type="file"]');
      if ((await artInputs.count()) > 0) {
        await artInputs.first().setInputFiles(albumArtPath);
      } else {
        const imageInput = await pickFileInput(page, 'image');
        if (imageInput) await imageInput.setInputFiles(albumArtPath);
      }
    }
    log('Album art uploaded.');
  }

  if (mergedSettings.pricing_mode === 'free_name_your_price') {
    const priceSel = sel.priceInput
      ? [sel.priceInput]
      : ['input[name="album.price"]', 'input.price', 'input[name="price"]', 'input[type="number"]'];
    const priceFilled = await fillFirstVisible(page, priceSel, '0');
    log(priceFilled ? 'Album price set to 0.' : 'Album price not found (skipping).');

    const payMoreSel = sel.payMoreCheckbox
      ? [sel.payMoreCheckbox]
      : ['input[type="checkbox"][name*="pay" i]', 'input[type="checkbox"]'];
    await clickFirst(page, payMoreSel).catch(() => {});
  }
  log('Pricing set.');

  status(`Uploading ${rows.length} tracks...`);

  for (let i = 0; i < rows.length; i++) {
    ensureNotAborted(signal);
    const row = rows[i];
    const fileName = row.file_name;
    const filePath = path.join(resolvedExport, fileName);
    if (!fs.existsSync(filePath)) {
      log(`Missing audio file: ${filePath}`);
      continue;
    }

    let attempt = 0;
    let success = false;
    const maxAttempts = 1;
    while (attempt < maxAttempts && !success) {
      attempt += 1;
      try {
        status(`Uploading track ${i + 1}/${rows.length} (attempt ${attempt})...`);
        const titleInputs = page.locator('input[name^="track.title_"], input[name^="track.track_title_"], input[name^="track_title_"], input.title');
        const artistInputs = page.locator('input[name^="track.artist_"], input[name^="track.track_artist_"], input[name^="track_artist_"]');
        const priceInputs = page.locator('input[name^="track.track_price_"], input[name^="track_price_"], input.price');
        const trackPayMoreCheckboxes = page.locator('input[type="checkbox"][name^="track.nyp_"], input[name="track.nyp_"], input[data-test="name-your-price-checkbox"]');
        const beforeCount = await titleInputs.count();

        // direct hidden input
        const directInputs = page.locator(
          '#edit-tralbum-form .tracks li.add-audio div.input-wrapper input[type="file"], ' +
          '#edit-tralbum-form .tracks div.audio-upload.add-audio input[type="file"], ' +
          '#edit-tralbum-form .tracks li.add-audio input[type="file"]'
        );
        if ((await directInputs.count()) > 0) {
          // Ensure we never hit album art inputs
          const count = await directInputs.count();
          let chosen = null;
          for (let idx = 0; idx < count; idx++) {
            const input = directInputs.nth(idx);
            const accept = (await input.getAttribute('accept')) || '';
            const parentClass = (await input.evaluate((el) => el.closest('.art-upload-wrapper') ? 'art' : 'track')) || 'track';
            if (parentClass === 'track' && /audio|wav|mp3|flac|aiff/i.test(accept)) {
              chosen = input;
              break;
            }
          }
          if (!chosen) chosen = directInputs.first();
          await chosen.setInputFiles(filePath);
        } else if (sel.trackFileInput) {
          await page.locator(sel.trackFileInput).last().setInputFiles(filePath);
        } else {
          throw new Error('Track file input not found');
        }

        // Wait for file to appear in track list and finish processing
        const baseName = path.basename(fileName).toLowerCase();
        try {
          await page.waitForFunction(
            (name) => {
              const list = document.querySelector('.tracks');
              return list && list.innerText.toLowerCase().includes(name);
            },
            baseName,
            { timeout: 180000 }
          );
        } catch (err) {
          const shotPath = path.join(resolvedExport, `bandcamp_error_track_${i + 1}.png`);
          try { await page.screenshot({ path: shotPath, fullPage: true }); } catch (_) {}
          log(`Track file did not appear in list: ${fileName}`);
          throw new Error(`Upload failed: ${fileName} did not appear in track list`);
        }

        // Ensure the specific track row is done processing
        try {
          await page.waitForFunction(
            (name) => {
              const rows = Array.from(document.querySelectorAll('.tracks li.track'));
              const row = rows.find((r) => r.innerText.toLowerCase().includes(name));
              if (!row) return false;
              return !row.querySelector('.processing');
            },
            baseName,
            { timeout: 180000 }
          );
        } catch (_) {
          // if we can't detect processing, continue
        }
        const afterCount = await titleInputs.count();
        const newIndex = Math.max(0, afterCount - 1);

        // Select the newly added track row by index to ensure right-panel inputs are active
        try {
          const trackRowByIndex = page.locator('.tracks li.track').nth(newIndex);
          if (await trackRowByIndex.count() > 0) {
            await trackRowByIndex.click();
          }
        } catch (_) {}

        // wait until the new track title input is visible and editable
        const titleTarget = page.locator(`input[name="track.title_${newIndex}"]`).first();
        const titleFallback = titleInputs.nth(newIndex);
        const titleNode = (await titleTarget.count()) > 0 ? titleTarget : titleFallback;
        await titleNode.waitFor({ state: 'visible', timeout: 10000 });

        const artist = row.track_artist || '';
        let title = row.track_title || '';
        // If title is "Artist - Song", strip the artist prefix to keep song name only
        if (artist && title.toLowerCase().startsWith(`${artist.toLowerCase()} - `)) {
          title = title.slice(artist.length + 3);
        }

        // Fill the newly created track fields explicitly by index (visible only)
        let titleFilled = false;
        try {
          await titleNode.fill(title);
          titleFilled = true;
        } catch (_) {}

        // Direct DOM set fallback for title
        if (!titleFilled) {
          const titleSel = `input[name="track.title_${newIndex}"]`;
          const didTitle = await page.evaluate(
            ({ sel, val }) => {
              const el = document.querySelector(sel);
              if (!el) return false;
              el.value = val;
              el.dispatchEvent(new Event('input', { bubbles: true }));
              el.dispatchEvent(new Event('change', { bubbles: true }));
              return true;
            },
            { sel: titleSel, val: title }
          );
          if (!didTitle) log(`Missing title input: ${titleSel}`);
        }

        // Debug: after title fill, wait 3s and log visible track.artist_* input
        await page.waitForTimeout(500);
        try {
          const visibleArtistName = await page.evaluate(() => {
            const els = Array.from(document.querySelectorAll('input[name^="track.artist_"]'));
            const visible = els.find((el) => {
              const style = window.getComputedStyle(el);
              return style && style.display !== 'none' && style.visibility !== 'hidden' && el.offsetParent !== null;
            });
            return visible ? visible.getAttribute('name') : '';
          });
          log(`Visible artist input after title: ${visibleArtistName || 'NONE'}`);
        } catch (_) {}

        // Fill artist with enabled check + forced event dispatch + confirm value
        const artistNode = page.locator(`input[name="track.artist_${newIndex}"]`).first();
        try {
          await artistNode.waitFor({ state: 'visible', timeout: 10000 });
          // Wait until enabled/editable
          try {
            await page.waitForFunction(
              (sel) => {
                const el = document.querySelector(sel);
                return !!el && !el.disabled && !el.readOnly;
              },
              `input[name="track.artist_${newIndex}"]`,
              { timeout: 2000 }
            );
          } catch (_) {}

          await artistNode.fill(artist);
          await page.evaluate(
            ({ sel, val }) => {
              const el = document.querySelector(sel);
              if (!el) return;
              el.value = val;
              el.dispatchEvent(new Event('input', { bubbles: true }));
              el.dispatchEvent(new Event('change', { bubbles: true }));
            },
            { sel: `input[name="track.artist_${newIndex}"]`, val: artist }
          );
          const currentVal = await artistNode.inputValue().catch(() => '');
          log(`Artist value now: ${currentVal}`);
        } catch (_) {
          log(`Artist input not visible for index ${newIndex} (file ${fileName})`);
        }
        const priceTarget = priceInputs.nth(newIndex);
        if (await priceTarget.count() > 0) {
          await priceTarget.fill('0');
        }

        // Ensure "let fans pay if they want" is checked for the track
        const payMoreTarget = trackPayMoreCheckboxes.nth(newIndex);
        if (await payMoreTarget.count() > 0) {
          const checked = await payMoreTarget.isChecked().catch(() => false);
          if (!checked) {
            await payMoreTarget.check().catch(async () => {
              await payMoreTarget.click({ force: true });
            });
          }
        }

        log(`Track added: ${title} / ${artist}`);
        uploadedCount += 1;
        success = true;
      } catch (err) {
        log(`Track ${i + 1} failed: ${err.message}`);
        await page.waitForTimeout(2000);
        if (attempt === maxAttempts) {
          const shotPath = path.join(resolvedExport, `bandcamp_error_track_${i + 1}.png`);
          try { await page.screenshot({ path: shotPath, fullPage: true }); } catch (_) {}
          throw err;
        }
      }
    }
  }

  allUploadsComplete = await waitForAllUploads(page, rows, log);
  if (!allUploadsComplete || uploadedCount !== rows.length) {
    status('Upload incomplete — draft not saved.');
    throw new Error('Upload incomplete — some tracks did not finish.');
  }
  status('All tracks processed.');
  } catch (err) {
    try {
      const shotPath = path.join(resolvedExport, 'bandcamp_error_general.png');
      await page.screenshot({ path: shotPath, fullPage: true });
      log(`Saved error screenshot: ${shotPath}`);
    } catch (_) {}
    throw err;
  } finally {
    // Save draft only if all uploads completed
    if (allUploadsComplete && uploadedCount === rows.length) {
      try {
        log('Waiting 10 seconds before saving draft...');
        await page.waitForTimeout(10000);
        const saveDraft = page.locator('a.button.save-draft, a.button.save-draft.show-when-dirty, a.save-draft');
        if (await saveDraft.count() > 0) {
          try { await saveDraft.first().waitFor({ state: 'visible', timeout: 60000 }); } catch (_) {}
          await saveDraft.first().click();
          log('Clicked Save Album Draft.');
        }
      } catch (_) {}
    } else {
      log('Skipping Save Draft because uploads were incomplete.');
    }
    await browser.close();
  }
}

async function waitForAllUploads(page, rows, log) {
  const expectedCount = Array.isArray(rows) ? rows.length : Number(rows || 0);
  const fileNames = Array.isArray(rows) ? rows.map((r) => (r.file_name || '').toLowerCase()) : [];
  const logger = log || (() => {});
  try {
    await page.waitForFunction(
      (count, names) => {
        const processing = document.querySelectorAll('.tracks .processing');
        if (processing.length > 0) return false;
        const trackItems = document.querySelectorAll('.tracks li.track');
        if (trackItems.length < count) return false;
        if (Array.isArray(names) && names.length > 0) {
          const text = document.querySelector('.tracks')?.innerText?.toLowerCase() || '';
          for (const name of names) {
            if (name && !text.includes(name)) return false;
          }
        }
        return true;
      },
      expectedCount,
      fileNames,
      { timeout: 300000 }
    );
    logger('All track uploads finished.');
    return true;
  } catch (err) {
    logger(`Timed out waiting for uploads to finish: ${err.message}`);
    return false;
  }
}

async function pickFileInput(page, type) {
  const handles = await page.$$('input[type="file"]');
  let best = null;
  for (const h of handles) {
    const accept = (await h.getAttribute('accept')) || '';
    const name = (await h.getAttribute('name')) || '';
    const test = (accept + ' ' + name).toLowerCase();
    if (type === 'image') {
      if (test.includes('image') || test.includes('jpg') || test.includes('png')) best = h;
    }
    if (type === 'audio') {
      if (
        test.includes('audio') ||
        test.includes('wav') ||
        test.includes('mp3') ||
        test.includes('flac') ||
        test.includes('aiff') ||
        test.includes('track')
      ) {
        best = h;
      }
    }
  }
  return best;
}

async function fillFirst(page, selectors, value) {
  for (const sel of selectors) {
    const loc = page.locator(sel).first();
    if ((await loc.count()) > 0) {
      await loc.fill(value);
      return true;
    }
  }
  return false;
}

async function fillFirstVisible(page, selectors, value) {
  for (const sel of selectors) {
    const loc = page.locator(sel);
    const count = await loc.count();
    if (count === 0) continue;
    for (let i = 0; i < count; i++) {
      const item = loc.nth(i);
      if (await item.isVisible()) {
        await item.fill(value);
        return true;
      }
    }
  }
  return false;
}

async function fillLast(page, selectors, value) {
  for (const sel of selectors) {
    const loc = page.locator(sel).last();
    if ((await loc.count()) > 0) {
      await loc.fill(value);
      return true;
    }
  }
  return false;
}

async function clickFirst(page, selectors) {
  for (const sel of selectors) {
    const loc = page.locator(sel).first();
    if ((await loc.count()) > 0) {
      await loc.click();
      return true;
    }
  }
  return false;
}

module.exports = {
  runUpload
};
