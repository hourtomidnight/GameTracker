const fs = require('fs');
const path = require('path');

const IMAGES_DIR = path.join(__dirname, '..', 'data', 'reset-images');
const SLUG_PATTERN = /^[a-z0-9-]+$/;

const EXT_BY_MIME = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif'
};

function saveImage(roomSlug, fileBuffer, mimeType) {
  if (!SLUG_PATTERN.test(roomSlug)) {
    throw new Error('Invalid slug: must contain only lowercase letters, numbers, and hyphens');
  }
  const roomDir = path.join(IMAGES_DIR, roomSlug);
  fs.mkdirSync(roomDir, { recursive: true });
  const ext = EXT_BY_MIME[mimeType] || 'jpg';
  const filename = `${Date.now()}.${ext}`;
  fs.writeFileSync(path.join(roomDir, filename), fileBuffer);
  return { source: 'local', url: `/images/${roomSlug}/${filename}` };
}

module.exports = { saveImage, IMAGES_DIR };
