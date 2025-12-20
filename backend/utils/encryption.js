const crypto = require("crypto");
const fs = require("fs");
const { IV_LENGTH, ENCRYPTION_KEY_FILE } = require("../config/constants");

// Generate or load encryption key
function getEncryptionKey() {
  if (fs.existsSync(ENCRYPTION_KEY_FILE)) {
    // Load existing key
    return fs.readFileSync(ENCRYPTION_KEY_FILE);
  } else {
    // Generate new key and save it
    const key = crypto.randomBytes(32);
    fs.writeFileSync(ENCRYPTION_KEY_FILE, key);
    console.log("🔑 New encryption key generated and saved");
    return key;
  }
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