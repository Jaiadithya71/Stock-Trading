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
    return { capital: 100000, riskPerTradePct: 1.0, maxDailyLoss: 5000, maxOpenPositions: 5, killSwitchActive: false };
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

    // Compute sector-wide performance map to filter conflicting trades
    const sectorMap = {};
    stockList.forEach(s => {
      const sec = s.sector || 'Equities';
      if (!sectorMap[sec]) sectorMap[sec] = { totalPct: 0, count: 0 };
      sectorMap[sec].totalPct += (s.pChange || 0);
      sectorMap[sec].count += 1;
    });

    for (const stock of stockList) {
      const { symbol, ltp, vwap, orbHigh, orbLow, ema20, pChange, volume, high, low } = stock;
      let signal = 'NEUTRAL_HOLD';
      let confidence = 0.70;
      let rationale = `Price consolidating around ₹${ltp.toLocaleString('en-IN')}. Awaiting confirmed breakout.`;
      let stopLoss = 0;
      let target = 0;

      // 1. Dynamic ATR Volatility Estimation (1.5% floor to give healthy breathing room outside intraday noise)
      const intradayRange = (high && low && high > low) ? (high - low) : (ltp * 0.018);
      const atr = parseFloat(Math.max(intradayRange * 0.85, ltp * 0.015).toFixed(2));

      // 2. Volume Expansion Confirmation Filter (Institutional footprint check)
      const benchmarkVol = stock.avgVolume || 180000;
      const volumeSurgeRatio = (volume && benchmarkVol) ? parseFloat((volume / benchmarkVol).toFixed(2)) : 1.0;
      const hasVolumeSurge = volumeSurgeRatio >= 1.20; // Must be at least 1.2x average volume

      // 3. Breakout Clearance Confirmation (+0.25% clearance beyond ORB boundaries to reject wick fakeouts)
      const isCleanBreakout = ltp > (orbHigh * 1.0025);
      const isCleanBreakdown = ltp < (orbLow * 0.9975);

      // 4. Sector Trend Alignment
      const secData = sectorMap[stock.sector || 'Equities'] || { totalPct: 0, count: 1 };
      const sectorAvgPChange = parseFloat((secData.totalPct / secData.count).toFixed(2));

      // STRATEGY 1: Opening Range Breakout (ORB) Long
      // Price breaks cleanly above 15-min High + Above VWAP + Above 20 EMA + Volume Expansion + Positive Momentum
      if (isCleanBreakout && ltp > vwap && ltp > ema20) {
        if (!hasVolumeSurge) {
          signal = 'NEUTRAL_HOLD';
          confidence = 0.65;
          rationale = `Breakout rejected: Volume surge (${volumeSurgeRatio}x) below 1.2x threshold. Awaiting institutional volume to avoid false breakout whipsaw.`;
        } else if (pChange < 0.35) {
          signal = 'NEUTRAL_HOLD';
          confidence = 0.65;
          rationale = `Breakout rejected: Insufficient momentum (+${pChange}% < +0.35%). Awaiting stronger buying pressure.`;
        } else if (sectorAvgPChange < -0.2) {
          signal = 'NEUTRAL_HOLD';
          confidence = 0.60;
          rationale = `Breakout rejected: Sector conflict (${stock.sector} is ${sectorAvgPChange}%). Do not buy against a falling sector.`;
        } else {
          signal = 'BUY_LONG';
          confidence = 0.90;
          // Institutional Stop Loss: 1.5 x ATR below entry (outside noise band)
          stopLoss = parseFloat((ltp - (1.5 * atr)).toFixed(2));
          const risk = ltp - stopLoss;
          target = parseFloat((ltp + (risk * 2.0)).toFixed(2)); // Strict 1:2 Risk:Reward
          rationale = `Confirmed Bullish Breakout above ₹${orbHigh} with ${volumeSurgeRatio}x volume expansion, VWAP support (₹${vwap}), and positive sector alignment (${stock.sector} ${sectorAvgPChange}%).`;
        }
      }
      // STRATEGY 2: Opening Range Breakdown (ORB) Short (Intraday MIS)
      // Price breaks cleanly below 15-min Low + Below VWAP + Below 20 EMA + Volume Expansion + Negative Drift
      else if (isCleanBreakdown && ltp < vwap && ltp < ema20) {
        if (!hasVolumeSurge) {
          signal = 'NEUTRAL_HOLD';
          confidence = 0.65;
          rationale = `Breakdown rejected: Volume surge (${volumeSurgeRatio}x) below 1.2x threshold. Awaiting institutional volume confirmation.`;
        } else if (pChange > -0.35) {
          signal = 'NEUTRAL_HOLD';
          confidence = 0.65;
          rationale = `Breakdown rejected: Insufficient selling pressure (${pChange}% > -0.35%). Awaiting confirmed weakness.`;
        } else if (sectorAvgPChange > 0.2) {
          signal = 'NEUTRAL_HOLD';
          confidence = 0.60;
          rationale = `Breakdown rejected: Sector conflict (${stock.sector} is +${sectorAvgPChange}%). Do not short against a rising sector.`;
        } else {
          signal = 'SELL_SHORT';
          confidence = 0.88;
          // Institutional Stop Loss: 1.5 x ATR above entry (outside noise band)
          stopLoss = parseFloat((ltp + (1.5 * atr)).toFixed(2));
          const risk = stopLoss - ltp;
          target = parseFloat((ltp - (risk * 2.0)).toFixed(2)); // Strict 1:2 Risk:Reward
          rationale = `Confirmed Bearish Breakdown below ₹${orbLow} with ${volumeSurgeRatio}x volume expansion, VWAP resistance (₹${vwap}), and sector weakness (${stock.sector} ${sectorAvgPChange}%).`;
        }
      }
      // STRATEGY 3: 20-EMA Pullback in High-Momentum Trend
      else if (pChange > 0.75 && Math.abs(ltp - ema20) / ltp < 0.0035 && ltp >= vwap && sectorAvgPChange >= 0) {
        signal = 'BUY_LONG';
        confidence = 0.84;
        stopLoss = parseFloat((ltp - (1.2 * atr)).toFixed(2));
        const risk = ltp - stopLoss;
        target = parseFloat((ltp + (risk * 2.0)).toFixed(2));
        rationale = `High-Momentum EMA Pullback: Price testing 20-EMA support (₹${ema20}) with strong +${pChange}% breadth.`;
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
        name: stock.name || stock.symbol,
        signal,
        action: signal === 'BUY_LONG' ? 'BUY' : (signal === 'SELL_SHORT' ? 'SELL' : 'HOLD'),
        ltp,
        open: stock.open || ltp,
        high: stock.high || ltp,
        low: stock.low || ltp,
        volume: stock.volume || 0,
        vwap,
        orbHigh,
        orbLow,
        ema20,
        atr,
        stopLoss,
        target,
        confidence: Math.round(confidence * 100) + '%',
        rationale,
        pChange: pChange !== undefined ? pChange : 0,
        sector: stock.sector || 'Equities',
        riskAllocation: {
          allocatedShares: signal !== 'NEUTRAL_HOLD' ? calculatedShares : Math.max(1, Math.floor(1000 / (atr || 10))),
          riskAmount: riskPerTrade,
          estimatedExposure: parseFloat(((signal !== 'NEUTRAL_HOLD' ? calculatedShares : Math.max(1, Math.floor(1000 / (atr || 10)))) * ltp).toFixed(2)),
          marginRequired: parseFloat((((signal !== 'NEUTRAL_HOLD' ? calculatedShares : Math.max(1, Math.floor(1000 / (atr || 10)))) * ltp) / 5).toFixed(2))
        },
        timestamp: new Date().toISOString()
      };

      evaluatedSignals.push(signalItem);
    }

    return evaluatedSignals;
  }
}

module.exports = new StockSignalEngine();
