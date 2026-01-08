// backend/config/constants.js - UPDATED with dynamic futures loading
const path = require("path");

// Static indices (spot)
const INDICES_INSTRUMENTS = {
  "BANKNIFTY": { token: "99926009", exchange: "NSE" },
  "NIFTY": { token: "99926000", exchange: "NSE" },
  "INDIA VIX": { token: "99926017", exchange: "NSE" }
};

// Flag to track if futures have been loaded
let futuresLoaded = false;

/**
 * Initialize futures instruments dynamically
 * Called once during server startup
 */
async function initializeFuturesInstruments() {
  if (futuresLoaded) {
    return INDICES_INSTRUMENTS;
  }

  try {
    const InstrumentFetcher = require("../services/instrumentFetcher");
    const fetcher = new InstrumentFetcher();

    // Get nearest BANKNIFTY futures
    const bnfFutures = await fetcher.getNearestFutures("BANKNIFTY");
    if (bnfFutures) {
      INDICES_INSTRUMENTS["BANKNIFTY_FUT"] = {
        token: bnfFutures.token,
        exchange: bnfFutures.exchange,
        symbol: bnfFutures.symbol,
        expiry: bnfFutures.expiry
      };
      console.log(`✅ Loaded BANKNIFTY_FUT: ${bnfFutures.symbol} (token: ${bnfFutures.token})`);
    }

    // Optionally add NIFTY futures too
    const niftyFutures = await fetcher.getNearestFutures("NIFTY");
    if (niftyFutures) {
      INDICES_INSTRUMENTS["NIFTY_FUT"] = {
        token: niftyFutures.token,
        exchange: niftyFutures.exchange,
        symbol: niftyFutures.symbol,
        expiry: niftyFutures.expiry
      };
      console.log(`✅ Loaded NIFTY_FUT: ${niftyFutures.symbol} (token: ${niftyFutures.token})`);
    }

    futuresLoaded = true;
  } catch (error) {
    console.error("❌ Failed to load futures instruments:", error.message);
  }

  return INDICES_INSTRUMENTS;
}

module.exports = {
  IV_LENGTH: 16,
  ENCRYPTION_KEY_FILE: path.join(__dirname, "../encryption.key"),
  CREDENTIALS_FILE: path.join(__dirname, "../credentials.enc"),

  SYMBOL_TOKEN_MAP: {
    "HDFCBANK": "1333",
    "ICICIBANK": "4963",
    "AXISBANK": "5900",
    "KOTAKBANK": "1922",
    "SBIN": "3045",
    "INDUSINDBK": "5258",
    "BANDHANBNK": "2263",
    "PNB": "10666",
    "IDFCFIRSTB": "11184",
    "AUBANK": "21238",
    "FEDERALBNK": "1023",
    "BANKBARODA": "4668"
  },

  INDICES_INSTRUMENTS,
  initializeFuturesInstruments,

  TIME_INTERVALS: [
    "ONE_MINUTE",
    "THREE_MINUTE",
    "FIVE_MINUTE",
    "FIFTEEN_MINUTE",
    "THIRTY_MINUTE",
    "ONE_HOUR"
  ],

  MARKET_HOURS: {
    OPEN: { hour: 9, minute: 15 },
    CLOSE: { hour: 15, minute: 30 }
  }
};