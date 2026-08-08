const { getSheetsClient, SPREADSHEET_ID } = require('./sheets');

function colLetter(index) {
  return String.fromCharCode(65 + index);
}

async function findOpenSession(tab) {
  const sheets = getSheetsClient();
  const response = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${tab}!A:Z` });
  const rows = response.data.values || [];
  const headers = rows[0] || [];
  const startCol = headers.indexOf('Start Time');
  const endCol = headers.indexOf('End Time');
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row[startCol] && !row[endCol]) {
      const completedSteps = headers.slice(5).filter((title, idx) => row[5 + idx]);
      return { rowIndex: i + 1, operator: row[0], startTime: row[3], completedSteps };
    }
  }
  return null;
}

async function startSession(tab, operator, helpers) {
  const sheets = getSheetsClient();
  const now = new Date();
  const row = [operator, helpers.join(', '), now.toLocaleDateString(), now.toLocaleTimeString(), ''];
  const append = await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${tab}!A:E`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] }
  });
  const updatedRange = append.data.updates.updatedRange; // e.g. "tab!A5:E5"
  const rowIndex = parseInt(updatedRange.match(/(\d+):/)[1], 10);
  return rowIndex;
}

async function writeStepCell(tab, rowIndex, stepTitle) {
  const sheets = getSheetsClient();
  const headerResp = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${tab}!A1:Z1` });
  const headers = headerResp.data.values?.[0] || [];
  const colIndex = headers.indexOf(stepTitle);
  if (colIndex === -1) throw new Error(`Unknown step title: ${stepTitle}`);
  const now = new Date().toLocaleTimeString();
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${tab}!${colLetter(colIndex)}${rowIndex}`,
    valueInputOption: 'RAW',
    requestBody: { values: [[now]] }
  });
}

async function finishSession(tab, rowIndex) {
  const sheets = getSheetsClient();
  const now = new Date().toLocaleTimeString();
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${tab}!E${rowIndex}`,
    valueInputOption: 'RAW',
    requestBody: { values: [[now]] }
  });
}

module.exports = { findOpenSession, startSession, writeStepCell, finishSession };
