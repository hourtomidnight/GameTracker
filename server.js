const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const { google } = require('googleapis');

const app = express();
const PORT = 3000;

// Session secret - you can change this to anything you want
const SESSION_SECRET = 'htm-escape-room-secret-' + Date.now();

// Session middleware - shared across all routes
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    httpOnly: true,
    sameSite: 'lax'
  }
}));

app.use(express.json());

// Create data directories if they don't exist
const csvDir = path.join(__dirname, 'csv_files');
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(csvDir)) {
  fs.mkdirSync(csvDir);
}
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

// Serve CSV files directory
app.use('/csv', express.static(csvDir));

// File paths for persistent storage
const storageFile = path.join(dataDir, 'storage.json');
const passwordFile = path.join(dataDir, 'password.txt');

// Load storage from file or initialize
let storage = {};
if (fs.existsSync(storageFile)) {
  try {
    storage = JSON.parse(fs.readFileSync(storageFile, 'utf8'));
    console.log('Loaded storage from file');
  } catch (err) {
    console.error('Error loading storage:', err);
    storage = {};
  }
}

// Load password from file or use default
let authPassword = 'escape123';
if (fs.existsSync(passwordFile)) {
  try {
    authPassword = fs.readFileSync(passwordFile, 'utf8').trim();
    console.log('Loaded password from file');
  } catch (err) {
    console.error('Error loading password:', err);
  }
}

// Google Sheets Setup
const SPREADSHEET_ID = '1TCrSmXbHZnlltAJn1940vrMo_Z6z3PuLskcGPSQu7Yk';
const CREDENTIALS_PATH = path.join(__dirname, 'google-credentials.json');

// Game name to sheet tab mapping
const GAME_SHEET_MAP = {
  'ADG': 'Assassins Game',
  'Nibiru': 'Nibiru Game',
  'Pharaohs': 'Pharaohs',
  'Crypt': 'Crypt'
};

// Initialize Google Sheets API
let sheetsAPI = null;
async function initGoogleSheets() {
  try {
    if (!fs.existsSync(CREDENTIALS_PATH)) {
      console.warn('Google credentials not found. Sheets integration disabled.');
      return;
    }

    const auth = new google.auth.GoogleAuth({
      keyFile: CREDENTIALS_PATH,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    sheetsAPI = google.sheets({ version: 'v4', auth });
    console.log('Google Sheets API initialized');
  } catch (error) {
    console.error('Error initializing Google Sheets:', error.message);
  }
}

// Helper: Find next row to append data
async function getNextRow(sheetName) {
  if (!sheetsAPI) return null;

  try {
    // Get current data to find last row
    const response = await sheetsAPI.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A:K`, // Only need columns A-K
    });

    const rows = response.data.values || [];
    const nextRow = rows.length + 1;
    
    console.log(`Next available row in ${sheetName}: ${nextRow}`);
    return nextRow;
  } catch (error) {
    console.error('Error finding next row:', error.message);
    return null;
  }
}

// Helper: Update row with game data
async function updateSheetRow(sheetName, rowIndex, data, isComplete) {
  if (!sheetsAPI || !rowIndex) return;

  try {
    // Define expected headers and their positions
    const expectedHeaders = {
      'A': 'Game Master',
      'B': 'Date',
      'C': 'Start Time',
      'D': '',  // Skip
      'E': 'Clues',
      'F': 'Time',
      'G': '',  // Skip
      'H': 'New Players',
      'I': 'Experienced',
      'J': 'Notes',
      'K': 'How Did You Hear'
    };

    // Always ensure headers exist (will only update if any are missing)
    await ensureHeaders(sheetName, expectedHeaders);

    // Map data to columns
    const values = [
      [
        data.gameMaster || '',           // A: Game Master
        data.date || '',                  // B: Date
        data.startTime || '',             // C: Start Time
        '',                               // D: (skip)
        data.totalHints || '',            // E: Clues
        data.elapsedTime || '',           // F: Time
        '',                               // G: (skip)
        data.newPlayers || '',            // H: New Players
        data.experienced || '',           // I: Experienced
        data.notes || '',                 // J: Notes
        data.howDidYouHear || ''          // K: How did you hear
      ]
    ];

    await sheetsAPI.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A${rowIndex}:K${rowIndex}`,
      valueInputOption: 'USER_ENTERED',
      resource: { values }
    });

    // Set background color: yellow if in progress, light green if complete
    const color = isComplete 
      ? { red: 0.85, green: 1, blue: 0.85 }    // Light green
      : { red: 1, green: 1, blue: 0.7 };        // Light yellow

    await sheetsAPI.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      resource: {
        requests: [{
          repeatCell: {
            range: {
              sheetId: await getSheetId(sheetName),
              startRowIndex: rowIndex - 1,
              endRowIndex: rowIndex,
              startColumnIndex: 0,
              endColumnIndex: 11 // A through K
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: color
              }
            },
            fields: 'userEnteredFormat.backgroundColor'
          }
        }]
      }
    });

    console.log(`Updated ${sheetName} row ${rowIndex} (${isComplete ? 'complete' : 'in progress'})`);
  } catch (error) {
    console.error('Error updating sheet row:', error.message);
  }
}

// Helper: Ensure headers exist in row 1
async function ensureHeaders(sheetName, expectedHeaders) {
  if (!sheetsAPI) return;

  try {
    // Read current row 1
    const response = await sheetsAPI.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A1:K1`
    });

    const currentHeaders = (response.data.values && response.data.values[0]) || [];
    const headerValues = [];
    let needsUpdate = false;

    // Build header row - add missing headers, keep existing ones
    Object.keys(expectedHeaders).forEach((col, index) => {
      const expectedHeader = expectedHeaders[col];
      const currentHeader = currentHeaders[index] || '';

      // If expected header exists and current is blank, add it
      if (expectedHeader && !currentHeader) {
        needsUpdate = true;
        headerValues[index] = expectedHeader;
        console.log(`Adding missing header in column ${col}: "${expectedHeader}"`);
      } else {
        // Keep existing header (even if different from expected)
        headerValues[index] = currentHeader;
      }
    });

    // Update headers if any are missing
    if (needsUpdate) {
      await sheetsAPI.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${sheetName}!A1:K1`,
        valueInputOption: 'RAW',
        resource: {
          values: [headerValues]
        }
      });

      // Format header row (bold, gray background)
      await sheetsAPI.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        resource: {
          requests: [{
            repeatCell: {
              range: {
                sheetId: await getSheetId(sheetName),
                startRowIndex: 0,
                endRowIndex: 1,
                startColumnIndex: 0,
                endColumnIndex: 11
              },
              cell: {
                userEnteredFormat: {
                  textFormat: { bold: true },
                  backgroundColor: { red: 0.9, green: 0.9, blue: 0.9 }
                }
              },
              fields: 'userEnteredFormat(textFormat,backgroundColor)'
            }
          }]
        }
      });

      console.log(`Updated headers in ${sheetName}`);
    } else {
      console.log(`Headers already exist in ${sheetName}`);
    }
  } catch (error) {
    console.error('Error ensuring headers:', error.message);
  }
}

// Helper: Get sheet ID from name
async function getSheetId(sheetName) {
  try {
    const response = await sheetsAPI.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID
    });
    
    const sheet = response.data.sheets.find(s => s.properties.title === sheetName);
    return sheet ? sheet.properties.sheetId : 0;
  } catch (error) {
    console.error('Error getting sheet ID:', error);
    return 0;
  }
}

// Save storage to file
function saveStorage() {
  try {
    fs.writeFileSync(storageFile, JSON.stringify(storage, null, 2));
  } catch (err) {
    console.error('Error saving storage:', err);
  }
}

// Save password to file
function savePassword(password) {
  try {
    fs.writeFileSync(passwordFile, password);
    authPassword = password;
  } catch (err) {
    console.error('Error saving password:', err);
  }
}

// Check if user is authenticated
const isAuthenticated = (req, res, next) => {
  if (req.session && req.session.authenticated) {
    return next();
  }
  res.status(401).json({ error: 'Not authenticated', redirect: '/login' });
};

// Login endpoint
app.post('/api/auth/login', (req, res) => {
  const { password } = req.body;
  
  if (password === authPassword) {
    req.session.authenticated = true;
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, error: 'Invalid password' });
  }
});

// Logout endpoint
app.post('/api/auth/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// Check authentication status
app.get('/api/auth/check', (req, res) => {
  res.json({ authenticated: !!(req.session && req.session.authenticated) });
});

// Storage API endpoints (password-protected)
app.get('/api/storage/:key', isAuthenticated, (req, res) => {
  const value = storage[req.params.key];
  if (value !== undefined) {
    res.json({ key: req.params.key, value });
  } else {
    res.status(404).json({ error: 'Key not found' });
  }
});

app.post('/api/storage/:key', isAuthenticated, (req, res) => {
  const key = req.params.key;
  const value = req.body.value;
  
  // Special handling for password changes
  if (key === 'authPassword') {
    savePassword(value);
  } else {
    storage[key] = value;
    saveStorage();
  }
  
  res.json({ key, value });
});

app.delete('/api/storage/:key', isAuthenticated, (req, res) => {
  delete storage[req.params.key];
  saveStorage();
  res.json({ deleted: true });
});

// Google Sheets Integration Endpoints

// Get available sheet tabs
app.get('/api/sheets/tabs', isAuthenticated, async (req, res) => {
  if (!sheetsAPI) {
    return res.json({ tabs: [] });
  }

  try {
    const response = await sheetsAPI.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID
    });
    
    // Filter to only tabs starting with "pi-"
    const allTabs = response.data.sheets.map(sheet => sheet.properties.title);
    const piTabs = allTabs.filter(tab => tab.toLowerCase().startsWith('pi-'));
    
    console.log(`Found ${piTabs.length} tabs with 'pi-' prefix:`, piTabs);
    res.json({ tabs: piTabs });
  } catch (error) {
    console.error('Error fetching sheet tabs:', error.message);
    res.status(500).json({ error: 'Failed to fetch sheet tabs' });
  }
});

// Get "How Did You Hear" options from sheet
app.post('/api/sheets/how-did-you-hear', isAuthenticated, async (req, res) => {
  const { tab, column, startRow } = req.body;
  
  if (!sheetsAPI) {
    return res.json({ options: [] });
  }

  try {
    const range = `${tab}!${column}${startRow}:${column}`;
    const response = await sheetsAPI.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: range
    });

    const values = response.data.values || [];
    const options = values.map(row => row[0]).filter(val => val && val.trim());
    
    console.log(`Loaded ${options.length} "How Did You Hear" options from ${tab}!${column}${startRow}`);
    res.json({ options });
  } catch (error) {
    console.error('Error fetching how-did-you-hear options:', error.message);
    res.status(500).json({ error: 'Failed to fetch options' });
  }
});

// Get scheduled game times from sheet
app.post('/api/sheets/scheduled-times', isAuthenticated, async (req, res) => {
  const { scheduleTab, gamePrefix } = req.body;
  
  if (!sheetsAPI || !scheduleTab || !gamePrefix) {
    return res.json({ times: [] });
  }

  try {
    // Fetch columns A (prefix) and B (time) from the schedule tab
    const range = `${scheduleTab}!A:B`;
    const response = await sheetsAPI.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: range
    });

    const values = response.data.values || [];
    const times = [];
    
    // Skip header row (index 0), start from row 1
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      const prefix = row[0]?.trim();
      const timeSlot = row[1]?.trim();
      
      // Match prefix and get time slot
      if (prefix === gamePrefix && timeSlot) {
        times.push(timeSlot);
      }
    }
    
    console.log(`Found ${times.length} time slots for ${gamePrefix} from ${scheduleTab}`);
    res.json({ times });
  } catch (error) {
    console.error('Error fetching scheduled times:', error.message);
    res.status(500).json({ error: 'Failed to fetch scheduled times' });
  }
});

// Start game session - create row
app.post('/api/sheets/start-session', isAuthenticated, async (req, res) => {
  const { sessionId, sheetTab, gameMaster, date, startTime, newPlayers, experienced } = req.body;

  if (!sheetTab) {
    return res.status(400).json({ error: 'No Google Sheet tab configured for this game' });
  }

  const rowIndex = await getNextRow(sheetTab);
  
  if (rowIndex) {
    await updateSheetRow(sheetTab, rowIndex, {
      gameMaster,
      date,
      startTime,
      newPlayers,
      experienced
    }, false);
  }

  res.json({ success: true, rowIndex });
});

// Update game session - update row
app.post('/api/sheets/update-session', isAuthenticated, async (req, res) => {
  const { rowIndex, sheetTab, totalHints, elapsedTime, notes, howDidYouHear } = req.body;

  if (!sheetTab) {
    return res.status(400).json({ error: 'No Google Sheet tab configured for this game' });
  }

  if (!rowIndex) {
    return res.status(400).json({ error: 'No row index provided' });
  }
  
  await updateSheetRow(sheetTab, rowIndex, {
    totalHints,
    elapsedTime,
    notes,
    howDidYouHear
  }, false);

  res.json({ success: true });
});

// Complete game session - final update with green highlight
app.post('/api/sheets/complete-session', isAuthenticated, async (req, res) => {
  const { rowIndex, sheetTab, gameMaster, date, startTime, totalHints, elapsedTime, newPlayers, experienced, notes, howDidYouHear } = req.body;

  if (!sheetTab) {
    return res.status(400).json({ error: 'No Google Sheet tab configured for this game' });
  }

  if (!rowIndex) {
    return res.status(400).json({ error: 'No row index provided' });
  }
  
  await updateSheetRow(sheetTab, rowIndex, {
    gameMaster,
    date,
    startTime,
    totalHints,
    elapsedTime,
    newPlayers,
    experienced,
    notes,
    howDidYouHear
  }, true); // Mark as complete

  res.json({ success: true });
});

// CSV API endpoints (password-protected)
app.get('/api/csv/list', isAuthenticated, (req, res) => {
  fs.readdir(csvDir, (err, files) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to read CSV directory' });
    }
    const csvFiles = files.filter(file => file.endsWith('.csv'));
    res.json({ files: csvFiles });
  });
});

app.post('/api/csv/save', isAuthenticated, (req, res) => {
  const { filename, data } = req.body;
  
  if (!filename || !data) {
    return res.status(400).json({ error: 'Missing filename or data' });
  }

  const filePath = path.join(csvDir, filename);
  const fileExists = fs.existsSync(filePath);
  
  if (fileExists) {
    const lines = data.split('\n');
    const dataOnly = lines.slice(1).join('\n');
    fs.appendFileSync(filePath, '\n' + dataOnly);
  } else {
    fs.writeFileSync(filePath, data);
  }
  
  res.json({ success: true, path: `/csv/${filename}` });
});

app.delete('/api/csv/delete/:filename', isAuthenticated, (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(csvDir, filename);
  
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }
  
  try {
    fs.unlinkSync(filePath);
    res.json({ success: true, message: 'File deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

// Serve login page
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

// Serve home page (redirect to login if not authenticated)
app.get('/', (req, res) => {
  if (req.session && req.session.authenticated) {
    res.sendFile(path.join(__dirname, 'home.html'));
  } else {
    res.redirect('/login');
  }
});

// Serve escape room tracker (redirect to login if not authenticated)
app.get('/escape-room', (req, res) => {
  if (req.session && req.session.authenticated) {
    res.sendFile(path.join(__dirname, 'index.html'));
  } else {
    res.redirect('/login');
  }
});

// Serve CSV downloads page (redirect to login if not authenticated)
app.get('/csv-downloads', (req, res) => {
  if (req.session && req.session.authenticated) {
    res.sendFile(path.join(__dirname, 'csv-downloads.html'));
  } else {
    res.redirect('/login');
  }
});

// Serve static files AFTER routes so routes take priority
app.use(express.static('.'));

// Initialize Google Sheets on startup
initGoogleSheets();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`HTM Server running on http://0.0.0.0:${PORT}`);
  console.log(`CSV files accessible at http://0.0.0.0:${PORT}/csv/`);
  console.log(`CSV files stored in: ${csvDir}`);
  console.log(`Data files stored in: ${dataDir}`);
});
