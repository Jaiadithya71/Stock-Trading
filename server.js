// Trading Dashboard - Node.js Backend
// Install dependencies: npm install smartapi-javascript express body-parser crypto

const { SmartAPI } = require("smartapi-javascript");
const express = require("express");
const bodyParser = require("body-parser");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

// Encryption configuration
const ENCRYPTION_KEY = crypto.randomBytes(32); // Store this securely in production
const IV_LENGTH = 16;
const CREDENTIALS_FILE = path.join(__dirname, "credentials.enc");

// Encryption helpers
function encrypt(text) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

function decrypt(text) {
  const parts = text.split(":");
  const iv = Buffer.from(parts[0], "hex");
  const encrypted = parts[1];
  const decipher = crypto.createDecipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

// Storage management
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
}

function userExists(username) {
  if (!fs.existsSync(CREDENTIALS_FILE)) return false;
  const data = fs.readFileSync(CREDENTIALS_FILE, "utf8");
  if (!data) return false;
  const allCreds = JSON.parse(data);
  return allCreds.hasOwnProperty(username);
}

// Trading Dashboard Classes
class TradingDashboard {
  constructor(credentials) {
    this.credentials = credentials;
    this.smart_api = new SmartAPI({
      api_key: credentials.api_key
    });
    this.authenticated = false;
    this.highs = {};
    this.lows = {};
  }

  async authenticate() {
    try {
      // Generate TOTP using the stored token
      const totp = this.generateTOTP(this.credentials.totp_token);
      
      console.log("🔐 Attempting authentication...");
      console.log("Client ID:", this.credentials.client_id);
      console.log("TOTP:", totp);
      
      const sessionData = await this.smart_api.generateSession(
        this.credentials.client_id,
        this.credentials.password,
        totp
      );
      
      console.log("Session response:", sessionData);
      
      if (sessionData && sessionData.status === true && sessionData.data) {
        this.authToken = sessionData.data.jwtToken;
        this.refreshToken = sessionData.data.refreshToken;
        this.feedToken = sessionData.data.feedToken;
        
        // Set auth token for subsequent API calls
        await this.smart_api.setSessionExpiryHook({
          token: this.refreshToken
        });
        
        // Get profile to confirm authentication
        const profile = await this.smart_api.getProfile(this.refreshToken);
        console.log("Profile:", profile);
        
        this.authenticated = true;
        console.log("✅ Authentication successful");
        
        return { 
          success: true, 
          message: "Authenticated successfully",
          data: {
            clientId: profile.data.clientcode,
            name: profile.data.name
          }
        };
      } else {
        const errorMsg = sessionData?.message || "Authentication failed";
        throw new Error(errorMsg);
      }
    } catch (error) {
      console.error("❌ Authentication error:", error);
      return { 
        success: false, 
        message: error.message || "Authentication failed"
      };
    }
  }

  generateTOTP(secret) {
    // TOTP implementation for 6-digit OTP (30-second window)
    const crypto = require("crypto");
    
    // Remove spaces and convert to uppercase
    const cleanSecret = secret.replace(/\s/g, "").toUpperCase();
    
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

  getLastTradingDay(currentDate) {
    let lastTradingDay = new Date(currentDate);
    const dayOfWeek = currentDate.getDay();
    
    if (dayOfWeek === 0) { // Sunday
      lastTradingDay.setDate(currentDate.getDate() - 2);
    } else if (dayOfWeek === 6) { // Saturday
      lastTradingDay.setDate(currentDate.getDate() - 1);
    } else if (dayOfWeek === 1) { // Monday
      lastTradingDay.setDate(currentDate.getDate() - 3);
    } else {
      lastTradingDay.setDate(currentDate.getDate() - 1);
    }
    
    return lastTradingDay;
  }

  getDateRange() {
    const now = new Date();
    const marketOpen = new Date(now);
    marketOpen.setHours(9, 15, 0, 0);
    const marketClose = new Date(now);
    marketClose.setHours(15, 30, 0, 0);
    
    let fromDate, toDate;
    
    if (now.getDay() === 0 || now.getDay() === 6) {
      // Weekend
      const lastTradingDay = this.getLastTradingDay(now);
      fromDate = new Date(lastTradingDay);
      fromDate.setHours(14, 30, 0, 0);
      toDate = new Date(lastTradingDay);
      toDate.setHours(15, 30, 0, 0);
    } else if (now < marketOpen) {
      // Before market open
      const lastTradingDay = this.getLastTradingDay(now);
      fromDate = new Date(lastTradingDay);
      fromDate.setHours(14, 30, 0, 0);
      toDate = new Date(lastTradingDay);
      toDate.setHours(15, 30, 0, 0);
    } else if (now > marketClose) {
      // After market close
      fromDate = new Date(marketClose);
      fromDate.setHours(14, 30, 0, 0);
      toDate = marketClose;
    } else {
      // During market hours
      fromDate = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago
      toDate = now;
    }
    
    return {
      fromDate: this.formatDateTime(fromDate),
      toDate: this.formatDateTime(toDate)
    };
  }

  formatDateTime(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  }

  async getCandleData(exchange, symboltoken, interval) {
    const { fromDate, toDate } = this.getDateRange();
    
    const params = {
      exchange,
      symboltoken,
      interval,
      fromdate: fromDate,
      todate: toDate
    };
    
    try {
      const response = await this.smart_api.getCandleData(params);
      return response;
    } catch (error) {
      console.error(`Error fetching candle data:`, error);
      return { status: false, data: null };
    }
  }

  getStatus(symbol, close) {
    if (!this.highs[symbol]) {
      this.highs[symbol] = close;
      this.lows[symbol] = close;
      return "Neutral";
    }
    
    if (close > this.highs[symbol]) {
      this.highs[symbol] = close;
      return "Buying";
    } else if (close < this.lows[symbol]) {
      this.lows[symbol] = close;
      return "Selling";
    }
    return "Neutral";
  }

  getSentiment(symbol, close) {
    if (!this.highs[symbol]) {
      this.highs[symbol] = close;
      this.lows[symbol] = close;
      return "Neutral";
    }
    
    if (close > this.highs[symbol]) {
      this.highs[symbol] = close;
      return "Bullish";
    } else if (close < this.lows[symbol]) {
      this.lows[symbol] = close;
      return "Bearish";
    }
    return "Neutral";
  }
}

// Express API Setup
const app = express();
app.use(bodyParser.json());
app.use(express.static("public"));
app.use(express.static('frontend'));

let activeDashboards = {};

// API Endpoints
app.post("/api/check-user", (req, res) => {
  const { username } = req.body;
  const exists = userExists(username);
  res.json({ exists });
});

app.post("/api/save-credentials", (req, res) => {
  const { username, credentials } = req.body;
  try {
    saveCredentials(username, credentials);
    res.json({ success: true, message: "Credentials saved successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post("/api/authenticate", async (req, res) => {
  const { username } = req.body;
  
  try {
    const credentials = loadCredentials(username);
    if (!credentials) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    
    const dashboard = new TradingDashboard(credentials);
    const authResult = await dashboard.authenticate();
    
    if (authResult.success) {
      activeDashboards[username] = dashboard;
      res.json(authResult);
    } else {
      res.status(401).json(authResult);
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post("/api/banknifty-data", async (req, res) => {
  const { username } = req.body;
  const dashboard = activeDashboards[username];
  
  if (!dashboard || !dashboard.authenticated) {
    return res.status(401).json({ success: false, message: "Not authenticated" });
  }
  
  const symbolTokenMap = {
    "HDFCBANK": "1333", "ICICIBANK": "4963", "AXISBANK": "5900", "KOTAKBANK": "1922",
    "SBIN": "3045", "INDUSINDBK": "5258", "BANDHANBNK": "2263", "PNB": "10666",
    "IDFCFIRSTB": "11184", "AUBANK": "21238", "FEDERALBNK": "1023", "BANKBARODA": "4668"
  };
  
  const results = [];
  
  for (const [symbol, token] of Object.entries(symbolTokenMap)) {
    const response = await dashboard.getCandleData("NSE", token, "ONE_MINUTE");
    
    if (response.status && response.data && response.data.length > 0) {
      const candle = response.data[response.data.length - 1];
      const ltp = candle[4];
      const volume = candle[5];
      const changePercent = ((candle[4] - candle[1]) / candle[1]) * 100;
      const status = dashboard.getStatus(symbol, candle[4]);
      
      results.push({
        bank: symbol,
        ltp: ltp.toFixed(2),
        volume,
        changePercent: changePercent.toFixed(2),
        status
      });
    }
  }
  
  res.json({ success: true, data: results });
});

app.post("/api/indices-data", async (req, res) => {
  const { username } = req.body;
  const dashboard = activeDashboards[username];
  
  if (!dashboard || !dashboard.authenticated) {
    return res.status(401).json({ success: false, message: "Not authenticated" });
  }
  
  const instruments = {
    "BANKNIFTY": { token: "99926009", exchange: "NSE" },
    "NIFTY": { token: "99926000", exchange: "NSE" },
    "INDIA VIX": { token: "99926017", exchange: "NSE" }
  };
  
  const intervals = ["ONE_MINUTE", "THREE_MINUTE", "FIVE_MINUTE", "FIFTEEN_MINUTE", "THIRTY_MINUTE", "ONE_HOUR"];
  const results = {};
  
  for (const [symbol, info] of Object.entries(instruments)) {
    results[symbol] = {};
    
    for (const interval of intervals) {
      const response = await dashboard.getCandleData(info.exchange, info.token, interval);
      
      if (response.status && response.data && response.data.length > 0) {
        const candle = response.data[response.data.length - 1];
        const sentiment = dashboard.getSentiment(symbol + "_" + interval, candle[4]);
        results[symbol][interval] = sentiment;
      } else {
        results[symbol][interval] = "No Data";
      }
    }
  }
  
  res.json({ success: true, data: results });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Trading Dashboard API running on port ${PORT}`);
  console.log(`📊 Access the dashboard at http://localhost:${PORT}`);
});