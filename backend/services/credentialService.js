const fs = require("fs");
const { CREDENTIALS_FILE } = require("../config/constants");
const { encrypt, decrypt } = require("../utils/encryption");

function saveCredentials(username, credentials) {
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