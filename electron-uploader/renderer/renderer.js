const exportPath = document.getElementById('exportPath');
const albumTitle = document.getElementById('albumTitle');
const albumArt = document.getElementById('albumArt');
const albumUrl = document.getElementById('albumUrl');
const statusLog = document.getElementById('statusLog');
const startBtn = document.getElementById('start');
const cancelBtn = document.getElementById('cancel');

function appendStatus(message) {
  const time = new Date().toLocaleTimeString();
  statusLog.textContent += `[${time}] ${message}\n`;
  statusLog.scrollTop = statusLog.scrollHeight;
}

window.ants.onStatus((msg) => appendStatus(msg));
window.addEventListener('error', (event) => {
  try { window.ants.logToMain(`Window error: ${event.message}`); } catch (_) {}
});
window.addEventListener('unhandledrejection', (event) => {
  try { window.ants.logToMain(`Unhandled rejection: ${event.reason}`); } catch (_) {}
});

// Defaults for faster testing
exportPath.value = 'C:\\\\Users\\\\18swa\\\\Downloads\\\\Export-20260403T044616Z-3-001\\\\Export';
albumArt.value = 'C:\\\\Users\\\\18swa\\\\Downloads\\\\shutterstock_2288750351-scaled.jpg';
albumUrl.value = 'https://stevewalsh2.bandcamp.com/edit_album';
albumTitle.value = `Testing${new Date().toISOString().replace(/[:.]/g, '-')}`;

async function chooseExport() {
  const value = await window.ants.selectExport();
  if (value) exportPath.value = value;
}

async function chooseArt() {
  const value = await window.ants.selectArt();
  if (value) albumArt.value = value;
}

async function startUpload() {
  if (!exportPath.value || !albumTitle.value) {
    appendStatus('Export path and album title are required.');
    return;
  }

  startBtn.disabled = true;
  cancelBtn.disabled = false;
  statusLog.textContent = '';

  appendStatus('Starting upload...');
  try {
    await window.ants.logToMain('Start Upload clicked.');
    const result = await window.ants.startUpload({
      exportPath: exportPath.value,
      albumTitle: albumTitle.value,
      albumArtPath: albumArt.value,
      albumUrl: albumUrl.value
    });

    if (result && result.ok) {
      appendStatus('Completed.');
    } else if (result && result.error) {
      appendStatus(`Failed: ${result.error}`);
    }
  } catch (err) {
    appendStatus(`Failed: ${err.message || err}`);
    try { await window.ants.logToMain(`Start Upload error: ${err.message || err}`); } catch (_) {}
  }

  startBtn.disabled = false;
  cancelBtn.disabled = true;
}

async function cancelUpload() {
  await window.ants.cancelUpload();
  appendStatus('Cancel requested.');
}

startBtn.addEventListener('click', startUpload);
cancelBtn.addEventListener('click', cancelUpload);
document.getElementById('browseExport').addEventListener('click', chooseExport);
document.getElementById('browseArt').addEventListener('click', chooseArt);
