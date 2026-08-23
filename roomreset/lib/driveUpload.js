const { google } = require('googleapis');
const { Readable } = require('stream');
const { getOAuthClient } = require('./driveAuth');

const ROOT_FOLDER_ID = process.env.ROOMRESET_DRIVE_ROOT_FOLDER_ID;

const EXT_BY_MIME = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif'
};

async function findOrCreateRoomFolder(drive, roomSlug) {
  const q = `'${ROOT_FOLDER_ID}' in parents and name='${roomSlug}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const existing = await drive.files.list({ q, fields: 'files(id, name)' });
  if (existing.data.files && existing.data.files.length > 0) {
    return existing.data.files[0].id;
  }
  const created = await drive.files.create({
    requestBody: {
      name: roomSlug,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [ROOT_FOLDER_ID]
    },
    fields: 'id'
  });
  return created.data.id;
}

// Uploads under the OAuth-delegated user's own Drive quota (the service
// account used elsewhere in this app has zero upload quota on a personal
// Gmail account - see docs/PI-REBUILD.md). Files land in a subfolder named
// after the room's acronym/slug under ROOMRESET_DRIVE_ROOT_FOLDER_ID,
// created on first use.
async function uploadImageToDrive(roomSlug, fileBuffer, mimeType, originalName) {
  const client = getOAuthClient();
  if (!client) {
    throw new Error('Google Drive is not connected - connect it from Admin > Settings first.');
  }
  if (!ROOT_FOLDER_ID) {
    throw new Error('ROOMRESET_DRIVE_ROOT_FOLDER_ID is not set.');
  }
  const drive = google.drive({ version: 'v3', auth: client });
  const folderId = await findOrCreateRoomFolder(drive, roomSlug);

  const ext = EXT_BY_MIME[mimeType] || 'jpg';
  const filename = originalName ? `${Date.now()}-${originalName}` : `${Date.now()}.${ext}`;

  const created = await drive.files.create({
    requestBody: { name: filename, parents: [folderId] },
    media: { mimeType, body: Readable.from(fileBuffer) },
    fields: 'id'
  });

  return { source: 'drive', driveFileId: created.data.id, url: `/api/drive-image/${created.data.id}` };
}

module.exports = { uploadImageToDrive };
