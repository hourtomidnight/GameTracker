const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// google-oauth-client.json holds a real Google account's OAuth Client ID/Secret
// (from Google Cloud Console > APIs & Services > Credentials > OAuth client ID,
// type "Web application"). Not the service account - that one can only read
// Drive (zero upload quota on a personal Gmail account). This lets a real
// person delegate upload access under their own quota.
const CLIENT_CONFIG_PATH = path.join(__dirname, '..', 'google-oauth-client.json');
const TOKEN_PATH = path.join(__dirname, '..', 'data', 'google-oauth-token.json');
const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

function loadClientConfig() {
  if (!fs.existsSync(CLIENT_CONFIG_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(CLIENT_CONFIG_PATH, 'utf8'));
  } catch (error) {
    throw new Error(`Invalid google-oauth-client.json: ${error.message}`);
  }
}

function buildClient(config) {
  return new google.auth.OAuth2(config.clientId, config.clientSecret, config.redirectUri);
}

function isConfigured() {
  return loadClientConfig() !== null;
}

function isConnected() {
  return fs.existsSync(TOKEN_PATH);
}

function getAuthUrl() {
  const config = loadClientConfig();
  if (!config) throw new Error('google-oauth-client.json is missing - see roomreset/README.md.');
  const client = buildClient(config);
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES
  });
}

async function handleCallback(code) {
  const config = loadClientConfig();
  if (!config) throw new Error('google-oauth-client.json is missing - see roomreset/README.md.');
  const client = buildClient(config);
  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token) {
    // Google only returns a refresh_token on the FIRST consent (or when
    // prompt=consent forces re-consent, which we always request above).
    // If this ever fires, the stored token would go stale after ~1hr with
    // no way to renew it.
    throw new Error('Google did not return a refresh token - try disconnecting and reconnecting.');
  }
  fs.mkdirSync(path.dirname(TOKEN_PATH), { recursive: true });
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
}

// Returns an authenticated OAuth2 client (auto-refreshes and persists new
// access tokens as they're issued) or null if never connected.
function getOAuthClient() {
  const config = loadClientConfig();
  if (!config || !isConnected()) return null;
  const client = buildClient(config);
  const stored = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
  client.setCredentials(stored);
  client.on('tokens', (fresh) => {
    const merged = { ...stored, ...fresh };
    if (!fresh.refresh_token) merged.refresh_token = stored.refresh_token;
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(merged, null, 2));
  });
  return client;
}

function disconnect() {
  if (fs.existsSync(TOKEN_PATH)) fs.unlinkSync(TOKEN_PATH);
}

module.exports = { isConfigured, isConnected, getAuthUrl, handleCallback, getOAuthClient, disconnect };
