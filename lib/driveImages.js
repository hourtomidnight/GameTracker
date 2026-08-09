const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

const CREDS_PATH = path.join(__dirname, '..', 'google-credentials.json');
const ROOT_FOLDER_ID = process.env.ROOMRESET_DRIVE_ROOT_FOLDER_ID;

let driveClient = null;

function getDriveClient() {
  if (driveClient) return driveClient;
  if (!fs.existsSync(CREDS_PATH)) return null;
  const auth = new google.auth.GoogleAuth({
    keyFile: CREDS_PATH,
    scopes: ['https://www.googleapis.com/auth/drive.readonly']
  });
  driveClient = google.drive({ version: 'v3', auth });
  return driveClient;
}

async function listDriveImages() {
  const drive = getDriveClient();
  if (!drive || !ROOT_FOLDER_ID) return [];
  const response = await drive.files.list({
    q: `'${ROOT_FOLDER_ID}' in parents and (mimeType contains 'image/') and trashed=false`,
    fields: 'files(id, name)',
    orderBy: 'name'
  });
  return (response.data.files || []).map(f => ({ id: f.id, name: f.name }));
}

async function streamDriveImage(fileId, res) {
  const drive = getDriveClient();
  if (!drive) throw new Error('Drive is not configured');
  const meta = await drive.files.get({ fileId, fields: 'mimeType' });
  const stream = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'stream' }
  );
  res.setHeader('Content-Type', meta.data.mimeType || 'application/octet-stream');
  stream.data.pipe(res);
}

module.exports = { listDriveImages, streamDriveImage };
