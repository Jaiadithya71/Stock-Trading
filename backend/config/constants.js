// backend/config/constants.js - EXPANDED LIQUID UNIVERSE
const path = require("path");

const INDICES_INSTRUMENTS = {
  "BANKNIFTY": { token: "99926009", exchange: "NSE" },
  "NIFTY": { token: "99926000", exchange: "NSE" },
  "INDIA VIX": { token: "99926017", exchange: "NSE" },
  "BANKNIFTY_FUT": { token: "52353", exchange: "NFO", symbol: "BANKNIFTY-FUT" },
  "NIFTY_FUT": { token: "52352", exchange: "NFO", symbol: "NIFTY-FUT" }
};

let futuresLoaded = false;

async function initializeFuturesInstruments() {
  if (futuresLoaded) return INDICES_INSTRUMENTS;
  try {
    const InstrumentFetcher = require("../services/instrumentFetcher");
    const fetcher = new InstrumentFetcher();
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
  },

  // EXPANDED HIGH-LIQUIDITY UNIVERSE (NIFTY 100 & LIQUID F&O STOCKS WITH 5x MIS MARGIN)
  STOCK_UNIVERSE: [
    // Banking & Financials
    { symbol: 'HDFCBANK', token: '1333', sector: 'Banking', weight: 0.14, name: 'HDFC Bank Ltd.' },
    { symbol: 'ICICIBANK', token: '4963', sector: 'Banking', weight: 0.10, name: 'ICICI Bank Ltd.' },
    { symbol: 'SBIN', token: '3045', sector: 'Banking', weight: 0.06, name: 'State Bank of India' },
    { symbol: 'AXISBANK', token: '5900', sector: 'Banking', weight: 0.05, name: 'Axis Bank Ltd.' },
    { symbol: 'KOTAKBANK', token: '1922', sector: 'Banking', weight: 0.05, name: 'Kotak Mahindra Bank' },
    { symbol: 'BAJFINANCE', token: '317', sector: 'Financials', weight: 0.04, name: 'Bajaj Finance Ltd.' },
    { symbol: 'BAJAJFINSV', token: '16675', sector: 'Financials', weight: 0.02, name: 'Bajaj Finserv Ltd.' },
    { symbol: 'INDUSINDBK', token: '5258', sector: 'Banking', weight: 0.02, name: 'IndusInd Bank' },
    // IT & Tech
    { symbol: 'INFY', token: '1594', sector: 'IT', weight: 0.08, name: 'Infosys Ltd.' },
    { symbol: 'TCS', token: '11536', sector: 'IT', weight: 0.07, name: 'Tata Consultancy Services' },
    { symbol: 'HCLTECH', token: '7229', sector: 'IT', weight: 0.03, name: 'HCL Technologies Ltd.' },
    { symbol: 'WIPRO', token: '3787', sector: 'IT', weight: 0.02, name: 'Wipro Ltd.' },
    { symbol: 'TECHM', token: '13538', sector: 'IT', weight: 0.02, name: 'Tech Mahindra Ltd.' },
    // Energy & Conglomerate
    { symbol: 'RELIANCE', token: '2885', sector: 'Energy', weight: 0.12, name: 'Reliance Industries Ltd.' },
    { symbol: 'NTPC', token: '11630', sector: 'Energy', weight: 0.03, name: 'NTPC Ltd.' },
    { symbol: 'POWERGRID', token: '14977', sector: 'Energy', weight: 0.02, name: 'Power Grid Corp' },
    { symbol: 'ONGC', token: '2475', sector: 'Energy', weight: 0.02, name: 'Oil & Natural Gas Corp' },
    { symbol: 'BPCL', token: '526', sector: 'Energy', weight: 0.01, name: 'Bharat Petroleum Corp' },
    // Auto & Mobility
    { symbol: 'TATAMOTORS', token: '3456', sector: 'Auto', weight: 0.04, name: 'Tata Motors Ltd.' },
    { symbol: 'MARUTI', token: '10999', sector: 'Auto', weight: 0.03, name: 'Maruti Suzuki India' },
    { symbol: 'M&M', token: '2031', sector: 'Auto', weight: 0.03, name: 'Mahindra & Mahindra' },
    { symbol: 'HEROMOTOCO', token: '1348', sector: 'Auto', weight: 0.01, name: 'Hero MotoCorp Ltd.' },
    { symbol: 'EICHERMOT', token: '910', sector: 'Auto', weight: 0.01, name: 'Eicher Motors Ltd.' },
    // Metals & Infrastructure
    { symbol: 'LT', token: '11483', sector: 'Infra', weight: 0.05, name: 'Larsen & Toubro Ltd.' },
    { symbol: 'TATASTEEL', token: '3499', sector: 'Metals', weight: 0.03, name: 'Tata Steel Ltd.' },
    { symbol: 'JSWSTEEL', token: '11723', sector: 'Metals', weight: 0.02, name: 'JSW Steel Ltd.' },
    { symbol: 'HINDALCO', token: '1363', sector: 'Metals', weight: 0.02, name: 'Hindalco Industries' },
    { symbol: 'COALINDIA', token: '20374', sector: 'Metals', weight: 0.02, name: 'Coal India Ltd.' },
    // FMCG & Consumer
    { symbol: 'ITC', token: '1660', sector: 'FMCG', weight: 0.05, name: 'ITC Ltd.' },
    { symbol: 'HINDUNILVR', token: '1394', sector: 'FMCG', weight: 0.04, name: 'Hindustan Unilever Ltd.' },
    { symbol: 'TITAN', token: '3506', sector: 'Consumer', weight: 0.03, name: 'Titan Company Ltd.' },
    { symbol: 'ASIANPAINT', token: '236', sector: 'Consumer', weight: 0.02, name: 'Asian Paints Ltd.' },
    { symbol: 'NESTLEIND', token: '17963', sector: 'FMCG', weight: 0.02, name: 'Nestle India Ltd.' },
    { symbol: 'BRITANNIA', token: '547', sector: 'FMCG', weight: 0.01, name: 'Britannia Industries' },
    { symbol: 'TATACONSUM', token: '3432', sector: 'FMCG', weight: 0.01, name: 'Tata Consumer Products' },
    // Telecom & Pharma
    { symbol: 'BHARTIARTL', token: '10604', sector: 'Telecom', weight: 0.05, name: 'Bharti Airtel Ltd.' },
    { symbol: 'SUNPHARMA', token: '3351', sector: 'Pharma', weight: 0.03, name: 'Sun Pharmaceutical' },
    { symbol: 'CIPLA', token: '694', sector: 'Pharma', weight: 0.02, name: 'Cipla Ltd.' },
    { symbol: 'DRREDDY', token: '881', sector: 'Pharma', weight: 0.01, name: 'Dr. Reddy\'s Labs' },
    { symbol: 'APOLLOHOSP', token: '157', sector: 'Healthcare', weight: 0.01, name: 'Apollo Hospitals' }
  ],

  BACKTEST_RESULTS_FILE: path.join(__dirname, "../data/backtest_results.json"),
  OPTION_SYMBOLS: {
    "BANKNIFTY": { token: "99926009", spotExchange: "NSE", exchange: "NFO", strikeInterval: 100, lotSize: 15 },
    "NIFTY": { token: "99926000", spotExchange: "NSE", exchange: "NFO", strikeInterval: 50, lotSize: 25 },
    "FINNIFTY": { token: "99926037", spotExchange: "NSE", exchange: "NFO", strikeInterval: 50, lotSize: 40 },
    "MIDCPNIFTY": { token: "99926074", spotExchange: "NSE", exchange: "NFO", strikeInterval: 25, lotSize: 50 }
  }
};