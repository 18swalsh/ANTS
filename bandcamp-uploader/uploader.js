const path = require('path');
const readline = require('readline');
const { runUpload } = require('../electron-uploader/core');

function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function getArg(name) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return '';
  return process.argv[idx + 1] || '';
}

async function main() {
  const exportPath = getArg('export-folder') || (await prompt('Export path: '));
  if (!exportPath) return;

  const albumTitle = getArg('album-title') || (await prompt('Album title: '));
  if (!albumTitle) return;

  const albumArtPath = getArg('album-art') || (await prompt('Album art (optional): '));
  const albumUrl = getArg('album-url') || (await prompt('Album edit URL (optional): '));

  await runUpload({
    exportPath,
    albumTitle,
    albumArtPath,
    albumUrl,
    settingsPath: path.join(__dirname, 'settings.json'),
    onStatus: (msg) => console.log(msg)
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
