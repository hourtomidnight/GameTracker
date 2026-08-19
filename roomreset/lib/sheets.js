const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

const SPREADSHEET_ID = process.env.ROOMRESET_SPREADSHEET_ID;
const CREDS_PATH = path.join(__dirname, '..', 'google-credentials.json');

let sheetsClient = null;

function getSheetsClient() {
  if (sheetsClient) return sheetsClient;
  if (!fs.existsSync(CREDS_PATH)) return null;
  const auth = new google.auth.GoogleAuth({
    keyFile: CREDS_PATH,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });
  sheetsClient = google.sheets({ version: 'v4', auth });
  return sheetsClient;
}

async function getColumnValues(tab, column, startRow) {
  const sheets = getSheetsClient();
  if (!sheets || !SPREADSHEET_ID) return [];
  const range = `${tab}!${column}${startRow}:${column}`;
  const response = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range });
  const values = response.data.values || [];
  return values.map(row => row[0]).filter(v => v && v.trim());
}

async function listSheetTabs() {
  const sheets = getSheetsClient();
  if (!sheets || !SPREADSHEET_ID) return [];
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  return meta.data.sheets.map(s => s.properties.title);
}

async function ensureTabExists(tab) {
  const sheets = getSheetsClient();
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const exists = meta.data.sheets.some(s => s.properties.title === tab);
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title: tab } } }] }
    });
  }
}

async function syncRoomSheetHeaders(tab, steps) {
  const sheets = getSheetsClient();
  if (!sheets || !SPREADSHEET_ID) return;
  await ensureTabExists(tab);
  const fixedHeaders = ['Operator', 'Helpers', 'Date', 'Start Time', 'End Time'];
  const headers = [...fixedHeaders, ...steps.map(s => s.title)];
  // Clear the full possible header range first so removed steps don't leave
  // orphaned headers past the current endCol that could later be silently reused.
  const clearRow = new Array(26).fill('');
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${tab}!A1:Z1`,
    valueInputOption: 'RAW',
    requestBody: { values: [clearRow] }
  });
  const endCol = String.fromCharCode(65 + headers.length - 1); // works up to column Z
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${tab}!A1:${endCol}1`,
    valueInputOption: 'RAW',
    requestBody: { values: [headers] }
  });
}

module.exports = { getSheetsClient, getColumnValues, listSheetTabs, syncRoomSheetHeaders, SPREADSHEET_ID };
