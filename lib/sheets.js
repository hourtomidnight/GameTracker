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

module.exports = { getSheetsClient, getColumnValues, SPREADSHEET_ID };
