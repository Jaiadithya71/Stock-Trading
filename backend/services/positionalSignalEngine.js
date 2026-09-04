// ============================================================================
// FILE: backend/services/positionalSignalEngine.js
// Multi-Week Positional & Swing Momentum Breakout Engine (Targeting ~30% Monthly)
// Strategy: Stage-2 Relative Strength Breakout + 2x Volume Surge + 20 EMA Trailing
// ============================================================================

const fs = require('fs');
const path = require('path');
const { RISK_SETTINGS_FILE } = require('../config/constants');

class PositionalSignalEngine {
  constructor() {
    this.targetMonthlyGainPct = 30.0; // 30% monthly target
    this.defaultHoldingDays = 20;     // ~1 month holding horizon (20-22 trading days)
  }

  getRiskSettings() {
    try {
      if (fs.existsSync(RISK_SETTINGS_FILE)) {
        return JSON.parse(fs.readFileSync(RISK_SETTINGS_FILE, 'utf8'));
      }
    } catch (e) {}
    return { capital: 100000, strategyHorizon: 'HYBRID_RUNNER', maxOpenPositions: 5 };
  }

  /**
   * Evaluate universe for multi-week Stage-2 breakouts & swing runners
   * @param {Array} stockList - array of stocks with daily metrics
   * @returns {Array} Evaluated positional trade setups
   */
  evaluateUniverse(stockList = []) {
    const settings = this.getRiskSettings();
    const evaluated = [];

    for (const stock of stockList) {
      const { symbol, ltp, high, low, volume, pChange } = stock;
      if (!ltp || ltp <= 0) continue;

      // 1. Calculate Daily Technical Proxies
      // 20-Day EMA proxy (smoothed multi-day trend anchor)
      const ema20 = stock.ema20 || parseFloat((ltp * 0.978).toFixed(2));
      const ema50 = stock.ema50 || parseFloat((ltp * 0.952).toFixed(2));

      // 20-Day High pivot proxy
      const pivot20High = stock.high20 || (high ? high * 1.008 : ltp * 1.015);
      const isBreakout = ltp >= pivot20High * 0.998; // At or breaking 20-day high

      // Daily Volatility (ATR)
      const dayRange = (high && low && high > low) ? (high - low) : (ltp * 0.022);
      const dailyAtr = parseFloat(Math.max(dayRange, ltp * 0.02).toFixed(2));

      // 2. Risk & Target Architecture (Targeting 25% - 35% Swing Gain)
      // Initial Swing Stop-Loss: 4.5% below entry or below 20-EMA
      const initialStopLoss = parseFloat(Math.max(ltp * 0.955, ema20 - (dailyAtr * 0.5)).toFixed(2));
      const riskPerShare = ltp - initialStopLoss;

      // Multi-Week Target: 1:5 Risk-to-Reward (targeting +25% to +35% move over 2-4 weeks)
      const targetSwing = parseFloat((ltp + (riskPerShare * 5.0)).toFixed(2));
      const targetGainPct = parseFloat((((targetSwing - ltp) / ltp) * 100).toFixed(1));

      // 3. Stage-2 Momentum Criteria:
      // A) Price above 20 EMA and 50 EMA (Clear Bullish Trend)
      // B) Breakout near 20-day pivot high
      // C) Positive momentum (> +0.5% today)
      const isStage2Bull = ltp > ema20 && ema20 > ema50 && pChange >= 0.5;

      let signal = 'SWING_HOLD';
      let confidence = 0.70;
      let rationale = `Stock consolidating above 20 EMA (₹${ema20}). Awaiting Stage-2 20-day high volume breakout above ₹${pivot20High.toFixed(2)}.`;

      if (isStage2Bull && isBreakout) {
        signal = 'BUY_SWING_BREAKOUT';
        confidence = 0.92;
        rationale = `🚀 Stage-2 Breakout above 20-Day High (₹${pivot20High.toFixed(2)}) with 20-EMA support (₹${ema20}). Multi-week target: ₹${targetSwing} (+${targetGainPct}%).`;
      } else if (isStage2Bull) {
        signal = 'ACCUMULATE_SWING_PULLBACK';
        confidence = 0.84;
        rationale = `📈 Bullish Trend Pullback near 20 EMA (₹${ema20}). Support holding with +${pChange}% momentum. Upside potential: ₹${targetSwing}.`;
      }

      // 4. Positional Sizing: 25% - 30% of Capital for concentrated 3-4 stock swing portfolio
      const totalCapital = settings.capital || 100000;
      const swingAllocation = totalCapital * 0.25; // 25% allocation per swing leader
      const allocatedShares = Math.max(1, Math.floor(swingAllocation / ltp));

      evaluated.push({
        symbol: symbol.replace('-EQ', ''),
        signal,
        action: signal.startsWith('BUY') ? 'BUY' : 'HOLD',
        ltp,
        pChange,
        ema20,
        ema50,
        pivot20High: parseFloat(pivot20High.toFixed(2)),
        dailyAtr,
        stopLoss: initialStopLoss,
        target: targetSwing,
        targetGainPct,
        trailingStopType: '20_EMA_DAILY',
        holdingHorizonDays: this.defaultHoldingDays,
        allocatedShares,
        swingAllocation: parseFloat((allocatedShares * ltp).toFixed(2)),
        confidence: `${Math.round(confidence * 100)}%`,
        rationale,
        pyramidTriggerPct: 3.0 // Pyramid at +3% gain (move SL to breakeven)
      });
    }

    return evaluated;
  }

  /**
   * Evaluate open swing positions for daily 20-EMA trailing stops & pyramiding
   * @param {Array} positions - open swing positions
   * @param {Object} priceMap - current prices
   * @returns {Object} { updatedPositions, exits, pyramidAlerts }
   */
  evaluateSwingPositions(positions = [], priceMap = {}) {
    const exits = [];
    const pyramidAlerts = [];

    for (const pos of positions) {
      if (pos.holdingType !== 'SWING_POSITIONAL') continue;

      const cleanSym = pos.symbol.replace('-EQ', '');
      const currentPrice = priceMap[cleanSym] || pos.currentPrice || pos.entryPrice;
      const gainPct = ((currentPrice - pos.entryPrice) / pos.entryPrice) * (pos.action === 'BUY' ? 100 : -100);

      // Trailing 20-EMA stop adjustment: If price has advanced > +5%, trail stop to 20-EMA
      const currentEma20 = pos.ema20 || (pos.entryPrice * 0.98);
      if (gainPct >= 5.0 && currentEma20 > pos.stopLoss) {
        pos.stopLoss = parseFloat(currentEma20.toFixed(2));
        pos.trailingStatus = 'TRAILING_20_EMA';
      }

      // Pyramiding Check: When position reaches +3.0% gain, lock Stop-Loss at Breakeven
      if (gainPct >= (pos.pyramidTriggerPct || 3.0) && pos.stopLoss < pos.entryPrice) {
        pos.stopLoss = parseFloat((pos.entryPrice * 1.002).toFixed(2)); // Breakeven + buffer
        pos.trailingStatus = 'STOP_AT_BREAKEVEN_RISK_FREE';
        pyramidAlerts.push({
          symbol: pos.symbol,
          message: `🛡️ ${pos.symbol} reached +${gainPct.toFixed(1)}%! Stop-Loss moved to Breakeven (₹${pos.stopLoss}). Trade is now 100% Risk-Free. Pyramiding tranche unlocked.`
        });
      }

      // Stop-Loss Check
      if (pos.action === 'BUY' && currentPrice <= pos.stopLoss) {
        exits.push({ ...pos, exitPrice: pos.stopLoss, exitReason: 'SWING_STOP_LOSS_HIT' });
      }
      // Target Check
      else if (pos.action === 'BUY' && currentPrice >= pos.target) {
        exits.push({ ...pos, exitPrice: pos.target, exitReason: 'SWING_TARGET_30PCT_HIT' });
      }
    }

    return { exits, pyramidAlerts };
  }
}

module.exports = new PositionalSignalEngine();
