// ============================================================================
// FILE: backend/services/stockSignalEngine.js
// Intraday Momentum & Breakout Strategy Engine for NSE Cash Equities
// Confluence: 15-Min ORB + VWAP + 20 EMA + Dynamic Risk Parity Sizing
// ============================================================================

const fs = require('fs');
const { RISK_SETTINGS_FILE } = require('../config/constants');

class StockSignalEngine {
  constructor() {
    this.lastSignals = {};
  }

  getRiskSettings() {
    try {
      if (fs.existsSync(RISK_SETTINGS_FILE)) {
        return JSON.parse(fs.readFileSync(RISK_SETTINGS_FILE, 'utf8'));
      }
    } catch (e) {
      // fallback
    }
    return { capital: 100000, riskPerTradePct: 1.0, maxDailyLoss: 5000, maxOpenPositions: 3, killSwitchActive: false };
  }

  /**
   * Evaluate signals across the stock universe
   * @param {Array} stockList - array of stock quote objects from stockMarketDataProvider
   * @returns {Array} List of evaluated trade signals
   */
  evaluateUniverse(stockList = []) {
    const settings = this.getRiskSettings();

    if (settings.killSwitchActive) {
      return stockList.map(s => ({
        symbol: s.symbol,
        signal: 'NEUTRAL_HOLD',
        rationale: '🔒 EMERGENCY KILL SWITCH ACTIVE: All trading halted.',
        confidence: '100%'
      }));
    }

    const evaluatedSignals = [];

    for (const stock of stockList) {
      const { symbol, ltp, vwap, orbHigh, orbLow, ema20, pChange, volume, high, low } = stock;
      let signal = 'NEUTRAL_HOLD';
      let confidence = 0.70;
      let rationale = `Price consolidating around ₹${ltp.toLocaleString('en-IN')}. Awaiting ORB breakout.`;
      let stopLoss = 0;
      let target = 0;

      // 1. Dynamic ATR (Average True Range) Estimation for large-cap equities
      // Floor at 1.2% of LTP to ensure stop is never choked inside intraday noise
      const intradayRange = (high && low && high > low) ? (high - low) : (ltp * 0.015);
      const atr = parseFloat(Math.max(intradayRange * 0.75, ltp * 0.012).toFixed(2));

      // 2. Breakout Confirmation Filter: require at least 0.1% clearance beyond ORB boundaries
      const isCleanBreakout = ltp > (orbHigh * 1.001);
      const isCleanBreakdown = ltp < (orbLow * 0.999);

      // STRATEGY 1: Opening Range Breakout (ORB) Long
      // Price breaks cleanly above 15-min High + Above VWAP + Above 20 EMA
      if (isCleanBreakout && ltp > vwap && ltp > ema20) {
        signal = 'BUY_LONG';
        confidence = 0.88;
        // Institutional Stop Loss: 1.2 x ATR below entry
        stopLoss = parseFloat((ltp - (1.2 * atr)).toFixed(2));
        const risk = ltp - stopLoss;
        target = parseFloat((ltp + (risk * 2.0)).toFixed(2)); // Strict 1:2 Risk:Reward
        rationale = `Bullish ORB Breakout above ₹${orbHigh} (ATR: ₹${atr}) with VWAP support (₹${vwap}) and +${pChange}% momentum.`;
      }
      // STRATEGY 2: Opening Range Breakdown (ORB) Short (Intraday MIS)
      // Price breaks cleanly below 15-min Low + Below VWAP + Below 20 EMA
      else if (isCleanBreakdown && ltp < vwap && ltp < ema20) {
        signal = 'SELL_SHORT';
        confidence = 0.86;
        // Institutional Stop Loss: 1.2 x ATR above entry
        stopLoss = parseFloat((ltp + (1.2 * atr)).toFixed(2));
        const risk = stopLoss - ltp;
        target = parseFloat((ltp - (risk * 2.0)).toFixed(2)); // Strict 1:2 Risk:Reward
        rationale = `Bearish ORB Breakdown below ₹${orbLow} (ATR: ₹${atr}) with VWAP resistance (₹${vwap}) and ${pChange}% drift.`;
      }
      // STRATEGY 3: 20-EMA Pullback in Established Uptrend
      else if (pChange > 0.6 && Math.abs(ltp - ema20) / ltp < 0.003 && ltp >= vwap) {
        signal = 'BUY_LONG';
        confidence = 0.82;
        stopLoss = parseFloat((ltp - (1.0 * atr)).toFixed(2));
        const risk = ltp - stopLoss;
        target = parseFloat((ltp + (risk * 2.0)).toFixed(2));
        rationale = `Uptrend EMA Pullback: Price testing 20-EMA support (₹${ema20}) with positive breadth.`;
      }

      // Dynamic Risk Budgeting Sizing
      // Risk Amount = 1% of Capital (₹1,000 on ₹1,00,000)
      const capital = settings.capital || 100000;
      const riskPerTrade = capital * ((settings.riskPerTradePct || 1.0) / 100);
      const perShareRisk = Math.abs(ltp - (stopLoss || ltp * 0.99)) || 1.0;
      let calculatedShares = Math.floor(riskPerTrade / perShareRisk);

      // Sanity bounds: max position value cap (25% of capital with 5x leverage)
      const maxAllowedShares = Math.floor((capital * 1.25) / ltp);
      calculatedShares = Math.max(1, Math.min(calculatedShares, maxAllowedShares));

      const signalItem = {
        symbol,
        token: stock.token,
        signal,
        action: signal === 'BUY_LONG' ? 'BUY' : (signal === 'SELL_SHORT' ? 'SELL' : 'HOLD'),
        ltp,
        vwap,
        orbHigh,
        orbLow,
        ema20,
        stopLoss,
        target,
        confidence: Math.round(confidence * 100) + '%',
        rationale,
        pChange: pChange !== undefined ? pChange : 0,
        sector: stock.sector || 'Equities',
        riskAllocation: {
          allocatedShares: signal !== 'NEUTRAL_HOLD' ? calculatedShares : 0,
          riskAmount: riskPerTrade,
          estimatedExposure: signal !== 'NEUTRAL_HOLD' ? parseFloat((calculatedShares * ltp).toFixed(2)) : 0,
          marginRequired: signal !== 'NEUTRAL_HOLD' ? parseFloat(((calculatedShares * ltp) / 5).toFixed(2)) : 0
        },
        timestamp: new Date().toISOString()
      };

      evaluatedSignals.push(signalItem);
    }

    return evaluatedSignals;
  }
}

module.exports = new StockSignalEngine();
