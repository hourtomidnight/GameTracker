const express = require('express');
const session = require('express-session');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { getColumnValues } = require('./lib/sheets');
const { listRooms, getRoom, saveRoom } = require('./lib/rooms');
const { uploadImageToDrive } = require('./lib/drive');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use(session({
  secret: 'roomreset-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

function isAuthenticated(req, res, next) {
  if (req.session && req.session.authenticated) return next();
  return res.status(401).json({ error: 'Not authenticated' });
}

app.post('/api/login', (req, res) => {
  const { password } = req.body;
  const pwPath = path.join(__dirname, 'data', 'password.txt');
  const expected = fs.existsSync(pwPath) ? fs.readFileSync(pwPath, 'utf8').trim() : '';
  if (password && password === expected) {
    req.session.authenticated = true;
    return res.json({ ok: true });
  }
  return res.status(401).json({ error: 'Invalid password' });
});

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.get('/api/operators', isAuthenticated, async (req, res) => {
  try {
    const operators = await getColumnValues('Dropdown', 'A', 2);
    res.json({ operators });
  } catch (error) {
    console.error('Error fetching operators:', error.message);
    res.status(500).json({ error: 'Failed to fetch operators' });
  }
});

app.get('/api/rooms', isAuthenticated, (req, res) => {
  try {
    const rooms = listRooms();
    res.json({ rooms });
  } catch (error) {
    console.error('Error listing rooms:', error.message);
    res.status(500).json({ error: 'Failed to list rooms' });
  }
});

app.get('/api/rooms/:slug', isAuthenticated, (req, res) => {
  try {
    const room = getRoom(req.params.slug);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    res.json({ room });
  } catch (error) {
    if (error.message.includes('Invalid slug')) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Error getting room:', error.message);
    res.status(500).json({ error: 'Failed to get room' });
  }
});

app.post('/api/rooms/:slug', isAuthenticated, (req, res) => {
  try {
    const { name, sheetTab, steps } = req.body;
    if (!name || !sheetTab || !Array.isArray(steps)) {
      return res.status(400).json({ error: 'name, sheetTab, and steps[] are required' });
    }
    const saved = saveRoom(req.params.slug, { name, sheetTab, steps });
    res.json({ room: saved });
  } catch (error) {
    if (error.message.includes('Invalid slug')) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Error saving room:', error.message);
    res.status(500).json({ error: 'Failed to save room' });
  }
});

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

app.post('/api/rooms/:slug/image', isAuthenticated, upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image uploaded' });
  try {
    const result = await uploadImageToDrive(req.params.slug, req.file.buffer, req.file.mimetype);
    res.json(result);
  } catch (error) {
    if (error.message.includes('Invalid slug')) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Error uploading image to Drive:', error.message);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

// Error handling middleware for multer and route errors
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

app.listen(PORT, () => console.log(`RoomReset server running on port ${PORT}`));

module.exports = { app, isAuthenticated };
