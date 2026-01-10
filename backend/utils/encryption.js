const crypto = require("crypto");
const fs = require("fs");
const { IV_LENGTH, ENCRYPTION_KEY_FILE } = require("../config/constants");

// Generate or load encryption key
// Priority: 1. Environment variable, 2. File, 3. Generate new
function getEncryptionKey() {
  // Check for environment variable first (for Render deployment)
  if (process.env.ENCRYPTION_KEY) {
    console.log("🔑 Using encryption key from environment variable");
    return Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
  }

  // Fall back to file-based key (for local development)
  if (fs.existsSync(ENCRYPTION_KEY_FILE)) {
    console.log("🔑 Using encryption key from file");
    return fs.readFileSync(ENCRYPTION_KEY_FILE);
  }

  // Generate new key and save it (local development only)
  const key = crypto.randomBytes(32);
  fs.writeFileSync(ENCRYPTION_KEY_FILE, key);
  console.log("🔑 New encryption key generated and saved");
  console.log("💡 For deployment, set ENCRYPTION_KEY env var to:", key.toString('hex'));
  return key;
}

const ENCRYPTION_KEY = getEncryptionKey();

function encrypt(text) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

function decrypt(text) {
  try {
    const parts = text.split(":");
    const iv = Buffer.from(parts[0], "hex");
    const encrypted = parts[1];
    const decipher = crypto.createDecipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (error) {
    console.error("❌ Decryption error:", error.message);
    throw new Error("Failed to decrypt data");
  }
}

module.exports = {
  encrypt,
  decrypt
};