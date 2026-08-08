const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
const { Readable } = require('stream');

const CREDS_PATH = path.join(__dirname, '..', 'google-credentials.json');
const ROOT_FOLDER_ID = process.env.ROOMRESET_DRIVE_ROOT_FOLDER_ID;

let driveClient = null;
const roomFolderCache = {};

function getDriveClient() {
  if (driveClient) return driveClient;
  if (!fs.existsSync(CREDS_PATH)) return null;
  const auth = new google.auth.GoogleAuth({
    keyFile: CREDS_PATH,
    scopes: ['https://www.googleapis.com/auth/drive']
  });
  driveClient = google.drive({ version: 'v3', auth });
  return driveClient;
}

async function getOrCreateRoomFolder(drive, roomSlug) {
  if (roomFolderCache[roomSlug]) return roomFolderCache[roomSlug];
  const query = `'${ROOT_FOLDER_ID}' in parents and name='${roomSlug}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const existing = await drive.files.list({ q: query, fields: 'files(id, name)' });
  if (existing.data.files.length > 0) {
    roomFolderCache[roomSlug] = existing.data.files[0].id;
    return roomFolderCache[roomSlug];
  }
  const created = await drive.files.create({
    requestBody: { name: roomSlug, mimeType: 'application/vnd.google-apps.folder', parents: [ROOT_FOLDER_ID] },
    fields: 'id'
  });
  roomFolderCache[roomSlug] = created.data.id;
  return created.data.id;
}

async function uploadImageToDrive(roomSlug, fileBuffer, mimeType) {
  const drive = getDriveClient();
  if (!drive || !ROOT_FOLDER_ID) throw new Error('Drive client not configured');
  const folderId = await getOrCreateRoomFolder(drive, roomSlug);
  const stream = Readable.from(fileBuffer);
  const created = await drive.files.create({
    requestBody: { name: `${Date.now()}.jpg`, parents: [folderId] },
    media: { mimeType, body: stream },
    fields: 'id'
  });
  const driveFileId = created.data.id;
  await drive.permissions.create({
    fileId: driveFileId,
    requestBody: { role: 'reader', type: 'anyone' }
  });
  return { driveFileId, viewUrl: `https://drive.google.com/uc?id=${driveFileId}` };
}

module.exports = { uploadImageToDrive };
