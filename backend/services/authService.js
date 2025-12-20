const crypto = require("crypto");

function generateTOTP(secret) {
  // Remove spaces and convert to uppercase
  const cleanSecret = secret.replace(/s/g, "").toUpperCase();
  
  // Decode base32 secret
  const base32chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  
  for (let i = 0; i < cleanSecret.length; i++) {
    const val = base32chars.indexOf(cleanSecret[i]);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, "0");
  }
  
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substr(i, 8), 2));
  }
  
  const secretBuffer = Buffer.from(bytes);
  
  // Generate HMAC
  const time = Math.floor(Date.now() / 1000 / 30);
  const timeBuffer = Buffer.alloc(8);
  timeBuffer.writeBigInt64BE(BigInt(time));
  
  const hmac = crypto.createHmac("sha1", secretBuffer);
  hmac.update(timeBuffer);
  const hash = hmac.digest();
  
  // Dynamic truncation
  const offset = hash[hash.length - 1] & 0xf;
  const truncated = ((hash[offset] & 0x7f) << 24) |
                    ((hash[offset + 1] & 0xff) << 16) |
                    ((hash[offset + 2] & 0xff) << 8) |
                    (hash[offset + 3] & 0xff);
  
  const otp = String(truncated % 1000000).padStart(6, "0");
  return otp;
}

module.exports = {
  generateTOTP
};