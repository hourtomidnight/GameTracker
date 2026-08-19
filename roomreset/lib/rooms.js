const fs = require('fs');
const path = require('path');

const ROOMS_DIR = path.join(__dirname, '..', 'data', 'reset-rooms');
const SLUG_PATTERN = /^[a-z0-9-]+$/;

function validateSlug(slug) {
  if (!SLUG_PATTERN.test(slug)) {
    throw new Error(`Invalid slug: must contain only lowercase letters, numbers, and hyphens`);
  }
}

function roomPath(slug) {
  validateSlug(slug);
  return path.join(ROOMS_DIR, `${slug}.json`);
}

function listRooms() {
  if (!fs.existsSync(ROOMS_DIR)) return [];
  return fs.readdirSync(ROOMS_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(ROOMS_DIR, f), 'utf8'));
        return { name: data.name, slug: data.slug };
      } catch (error) {
        console.error(`Error parsing room file ${f}:`, error.message);
        return null;
      }
    })
    .filter(room => room !== null);
}

function getRoom(slug) {
  const p = roomPath(slug);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (error) {
    throw new Error(`Error parsing room file: ${error.message}`);
  }
}

function saveRoom(slug, roomData) {
  if (!fs.existsSync(ROOMS_DIR)) fs.mkdirSync(ROOMS_DIR, { recursive: true });
  const data = { ...roomData, slug };
  fs.writeFileSync(roomPath(slug), JSON.stringify(data, null, 2));
  return data;
}

module.exports = { listRooms, getRoom, saveRoom };
