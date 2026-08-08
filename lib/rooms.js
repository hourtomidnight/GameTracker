const fs = require('fs');
const path = require('path');

const ROOMS_DIR = path.join(__dirname, '..', 'data', 'reset-rooms');

function roomPath(slug) {
  return path.join(ROOMS_DIR, `${slug}.json`);
}

function listRooms() {
  if (!fs.existsSync(ROOMS_DIR)) return [];
  return fs.readdirSync(ROOMS_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      const data = JSON.parse(fs.readFileSync(path.join(ROOMS_DIR, f), 'utf8'));
      return { name: data.name, slug: data.slug };
    });
}

function getRoom(slug) {
  const p = roomPath(slug);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function saveRoom(slug, roomData) {
  if (!fs.existsSync(ROOMS_DIR)) fs.mkdirSync(ROOMS_DIR, { recursive: true });
  const data = { ...roomData, slug };
  fs.writeFileSync(roomPath(slug), JSON.stringify(data, null, 2));
  return data;
}

module.exports = { listRooms, getRoom, saveRoom };
