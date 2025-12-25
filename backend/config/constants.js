// backend/config/constants.js - UPDATED WITH OPTION CHAIN
const path = require("path");

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
  
  INDICES_INSTRUMENTS: {
    "BANKNIFTY": { token: "99926009", exchange: "NSE" },
    "NIFTY": { token: "99926000", exchange: "NSE" },
    "INDIA VIX": { token: "99926017", exchange: "NSE" }
  },
  
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
  },

  // Option Chain Configuration
  OPTION_SYMBOLS: {
    "NIFTY": {
      symbol: "NIFTY",
      displayName: "Nifty 50",
      token: "99926000",
      exchange: "NFO",
      spotExchange: "NSE",
      lotSize: 50,
      tickSize: 0.05,
      strikeInterval: 50
    },
    "BANKNIFTY": {
      symbol: "BANKNIFTY",
      displayName: "Bank Nifty",
      token: "99926009",
      exchange: "NFO",
      spotExchange: "NSE",
      lotSize: 15,
      tickSize: 0.05,
      strikeInterval: 100
    },
    "FINNIFTY": {
      symbol: "FINNIFTY",
      displayName: "Fin Nifty",
      token: "99926037",
      exchange: "NFO",
      spotExchange: "NSE",
      lotSize: 40,
      tickSize: 0.05,
      strikeInterval: 50
    }
  },
  
  OPTION_CONFIG: {
    strikesAbove: 15,
    strikesBelow: 15,
    cacheDuration: 5000,
    maxExpiryMonths: 3
  },
  
  OPTION_TYPES: {
    CALL: "CE",
    PUT: "PE"
  }
};