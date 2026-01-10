const fs = require("fs");
const { CREDENTIALS_FILE } = require("../config/constants");
const { encrypt, decrypt } = require("../utils/encryption");

// Cache for environment-based credentials
let envCredentialsCache = null;

/**
 * Load credentials from environment variable (for Render deployment)
 * Format: CREDENTIALS_JSON = {"username": {"api_key": "encrypted", ...}}
 */
function loadCredentialsFromEnv() {
  if (envCredentialsCache !== null) {
    return envCredentialsCache;
  }

  if (process.env.CREDENTIALS_JSON) {
    try {
      envCredentialsCache = JSON.parse(process.env.CREDENTIALS_JSON);
      console.log("📦 Loaded credentials from environment variable");
      return envCredentialsCache;
    } catch (error) {
      console.error("❌ Failed to parse CREDENTIALS_JSON:", error.message);
      envCredentialsCache = {};
      return envCredentialsCache;
    }
  }

  return null;
}

function saveCredentials(username, credentials) {
  // Check if running in environment-variable mode
  if (process.env.CREDENTIALS_JSON) {
    console.log("⚠️  Cannot save credentials in environment-variable mode");
    console.log("💡 Add credentials to CREDENTIALS_JSON env var manually");
    return;
  }

  let allCreds = {};
  if (fs.existsSync(CREDENTIALS_FILE)) {
    const data = fs.readFileSync(CREDENTIALS_FILE, "utf8");
    if (data) allCreds = JSON.parse(data);
  }

  allCreds[username] = {
    api_key: encrypt(credentials.api_key),
    client_id: encrypt(credentials.client_id),
    password: encrypt(credentials.password),
    totp_token: encrypt(credentials.totp_token)
  };

  fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(allCreds, null, 2));
}

function loadCredentials(username) {
  // Try environment variable first (for Render deployment)
  const envCreds = loadCredentialsFromEnv();
  if (envCreds) {
    if (!envCreds[username]) return null;

    try {
      return {
        api_key: decrypt(envCreds[username].api_key),
        client_id: decrypt(envCreds[username].client_id),
        password: decrypt(envCreds[username].password),
        totp_token: decrypt(envCreds[username].totp_token)
      };
    } catch (error) {
      console.error("❌ Error decrypting env credentials:", error.message);
      return null;
    }
  }

  // Fall back to file-based credentials (local development)
  if (!fs.existsSync(CREDENTIALS_FILE)) return null;

  try {
    const data = fs.readFileSync(CREDENTIALS_FILE, "utf8");
    if (!data) return null;

    const allCreds = JSON.parse(data);
    if (!allCreds[username]) return null;

    return {
      api_key: decrypt(allCreds[username].api_key),
      client_id: decrypt(allCreds[username].client_id),
      password: decrypt(allCreds[username].password),
      totp_token: decrypt(allCreds[username].totp_token)
    };
  } catch (error) {
    console.error("❌ Error loading credentials. Encryption key may have changed.");
    console.error("Delete 'credentials.enc' and 'encryption.key' files to reset.");
    return null;
  }
}

function userExists(username) {
  // Check environment variable first
  const envCreds = loadCredentialsFromEnv();
  if (envCreds) {
    return envCreds.hasOwnProperty(username);
  }

  // Fall back to file
  if (!fs.existsSync(CREDENTIALS_FILE)) return false;
  const data = fs.readFileSync(CREDENTIALS_FILE, "utf8");
  if (!data) return false;
  const allCreds = JSON.parse(data);
  return allCreds.hasOwnProperty(username);
}

module.exports = {
  saveCredentials,
  loadCredentials,
  userExists
};