# Build Mac App (run on a Mac)
cd "$(dirname "$0")"

npm install
npm run pack:mac

echo "Done. Find the ZIP in electron-uploader/dist"
