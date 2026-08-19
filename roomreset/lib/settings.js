const fs = require('fs');
const path = require('path');

const SETTINGS_PATH = path.join(__dirname, '..', 'data', 'settings.json');

const DEFAULTS = {
  operatorsTab: 'Drop Down options',
  operatorsColumn: 'B',
  operatorsStartRow: 1
};

function getSettings() {
  if (!fs.existsSync(SETTINGS_PATH)) return { ...DEFAULTS };
  try {
    const saved = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
    return { ...DEFAULTS, ...saved };
  } catch (e) {
    return { ...DEFAULTS };
  }
}

function saveSettings(partial) {
  const current = getSettings();
  const updated = { ...current, ...partial };
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(updated, null, 2));
  return updated;
}

module.exports = { getSettings, saveSettings };
