const fs = require("fs");
const { execSync } = require("child_process");
const { CREDENTIALS_FILE } = require("../config/constants");
const { encrypt, decrypt } = require("../utils/encryption");

// Cache for environment-based credentials
let envCredentialsCache = null;

/**
 * Read Windows User-level environment variable if process.env is not updated
 */
function getWinUserEnv(varName) {
  if (process.platform !== "win32") return null;
  try {
    const val = execSync(`powershell -NoProfile -Command "[System.Environment]::GetEnvironmentVariable('${varName}', 'User')"`, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"]
    }).trim();
    return val || null;
  } catch (e) {
    return null;
  }
}

/**
 * Check for direct individual environment variables
 * ANGLEONE_API_KEY / ANGELONE_API_KEY
 * ANGLEONE_USERNAME / ANGELONE_USERNAME
 * ANGLEONE_PWD / ANGELONE_PWD
 * ANGLEONE_TOKEN / ANGELONE_TOKEN
 */
function getDirectEnvCredentials() {
  const apiKey = process.env.ANGLEONE_API_KEY || process.env.ANGELONE_API_KEY || getWinUserEnv("ANGLEONE_API_KEY") || getWinUserEnv("ANGELONE_API_KEY");
  const username = process.env.ANGLEONE_USERNAME || process.env.ANGELONE_USERNAME || getWinUserEnv("ANGLEONE_USERNAME") || getWinUserEnv("ANGELONE_USERNAME");
  const password = process.env.ANGLEONE_PWD || process.env.ANGELONE_PWD || getWinUserEnv("ANGLEONE_PWD") || getWinUserEnv("ANGELONE_PWD");
  const totpToken = process.env.ANGLEONE_TOKEN || process.env.ANGELONE_TOKEN || getWinUserEnv("ANGLEONE_TOKEN") || getWinUserEnv("ANGELONE_TOKEN");

  if (apiKey && password && totpToken) {
    return {
      api_key: apiKey,
      client_id: username || "default",
      password: password,
      totp_token: totpToken
    };
  }
  return null;
}

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
      console.log("📦 Loaded credentials from CREDENTIALS_JSON environment variable");
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
  if (getDirectEnvCredentials() || process.env.CREDENTIALS_JSON) {
    console.log("⚠️  Cannot save credentials in environment-variable mode");
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
  // 1. Check direct individual OS environment variables first
  const directEnv = getDirectEnvCredentials();
  if (directEnv) {
    return {
      api_key: directEnv.api_key,
      client_id: directEnv.client_id !== "default" ? directEnv.client_id : (username || "default"),
      password: directEnv.password,
      totp_token: directEnv.totp_token
    };
  }

  // 2. Try CREDENTIALS_JSON environment variable next (for Render deployment)
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

  // 3. Fall back to file-based credentials (local development)
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
  // 1. Check direct individual OS environment variables first
  const directEnv = getDirectEnvCredentials();
  if (directEnv) {
    return true;
  }

  // 2. Check CREDENTIALS_JSON environment variable next
  const envCreds = loadCredentialsFromEnv();
  if (envCreds) {
    return envCreds.hasOwnProperty(username);
  }

  // 3. Fall back to file
  if (!fs.existsSync(CREDENTIALS_FILE)) return false;
  try {
    const data = fs.readFileSync(CREDENTIALS_FILE, "utf8");
    if (!data) return false;
    const allCreds = JSON.parse(data);
    return allCreds.hasOwnProperty(username);
  } catch (err) {
    return false;
  }
}

module.exports = {
  saveCredentials,
  loadCredentials,
  userExists
};