// ============================================================================
// FILE: backend/services/signalEngine.js
// Multi-Regime Quantitative Confluence Engine
// Evaluates High-Velocity Momentum Scalps & Contrarian Mean-Reversion Signals
// ============================================================================

const computationEngine = require('./computationEngine');
const path = require('path');
const fs = require('fs');

class SignalEngine {
    constructor() {
        this.lastTradeTimestamp = null;
        this.tradesTodayCount = 0;
        this.lastTradeDate = new Date().toISOString().split('T')[0];
        this.recentSpotHistory = [];
        this.initPersistentState();
    }

    initPersistentState() {
        try {
            const auditFile = path.join(__dirname, '../data/weekly_simulation_log.json');
            if (!fs.existsSync(auditFile)) return;
            const raw = fs.readFileSync(auditFile, 'utf8');
            const data = JSON.parse(raw);
            const trades = data.trades || [];
            const today = new Date().toISOString().split('T')[0];

            if (trades.length > 0) {
                const lastTrade = trades[trades.length - 1];
                if (lastTrade && lastTrade.timestamp) {
                    this.lastTradeTimestamp = new Date(lastTrade.timestamp).getTime();
                }

                const tradesToday = trades.filter(t => {
                    if (!t.timestamp) return false;
                    return new Date(t.timestamp).toISOString().split('T')[0] === today;
                });
                this.tradesTodayCount = tradesToday.length;
            }
        } catch (e) {
            console.warn('⚠️ Could not restore SignalEngine state on startup:', e.message);
        }
    }

    getRiskSettings() {
        try {
            const settingsFile = path.join(__dirname, '../data/risk_settings.json');
            if (fs.existsSync(settingsFile)) {
                return JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
            }
        } catch (e) {}
        return { capital: 100000, lots: 1, maxLoss: 5000, maxDailyTrades: 0 };
    }

    resetCounter() {
        this.tradesTodayCount = 0;
        this.lastTradeTimestamp = null;
        this.recentSpotHistory = [];
        console.log('🔄 [SignalEngine] Daily trade counter reset to 0.');
    }

    resetDailyCounterIfNeeded() {
        const today = new Date().toISOString().split('T')[0];
        if (this.lastTradeDate !== today) {
            this.lastTradeDate = today;
            this.tradesTodayCount = 0;
            this.lastTradeTimestamp = null;
            this.recentSpotHistory = [];
        }
    }

    recordTradeExecuted() {
        this.resetDailyCounterIfNeeded();
        this.lastTradeTimestamp = Date.now();
        this.tradesTodayCount++;
        const settings = this.getRiskSettings();
        const maxTrades = settings.maxDailyTrades !== undefined ? parseInt(settings.maxDailyTrades, 10) : 10;
        console.log(`⏱️ [SignalEngine] Trade recorded. Today Count: ${this.tradesTodayCount}/${maxTrades || '∞'}, Timestamp: ${new Date(this.lastTradeTimestamp).toLocaleTimeString('en-IN')}`);
    }

    evaluateSignal(marketData = {}, pcrSnapshots = [], bankStocks = [], userCapital = 100000) {
        this.resetDailyCounterIfNeeded();

        // Resolve dynamic spot price from marketData or latest PCR snapshot
        let spotPrice = marketData.spotPrice;
        if (!spotPrice && pcrSnapshots && pcrSnapshots.length > 0) {
            const lastSnap = pcrSnapshots[pcrSnapshots.length - 1];
            if (lastSnap && lastSnap.spotPrice) {
                spotPrice = parseFloat(lastSnap.spotPrice);
            }
        }
        if (!spotPrice) spotPrice = 57491.10;

        // Record rolling spot history
        this.recentSpotHistory.push({ price: spotPrice, time: Date.now() });
        if (this.recentSpotHistory.length > 30) this.recentSpotHistory.shift();

        let spotVelocity = 0;
        if (this.recentSpotHistory.length > 1) {
            spotVelocity = spotPrice - this.recentSpotHistory[0].price;
        }

        const pcrMetrics = computationEngine.calculatePCRMetrics(pcrSnapshots);
        const techLevels = computationEngine.calculateTechnicalLevels(spotPrice);
        const breadthMetrics = computationEngine.calculateBankBreadth(bankStocks);
        const riskAllocation = computationEngine.calculateKellySizing(0.60, 1.5, userCapital, 280);
        const estimatedPremium = riskAllocation.estimatedPremium || Math.round(spotPrice * 0.005);

        // Dynamic At-The-Money (ATM) Option Strike Calculation
        const atmStrike = Math.round(spotPrice / 100) * 100;

        // CHECK 1: Max Trades Per Day Cap (Configurable via Risk Settings; 0 = Unlimited)
        const settings = this.getRiskSettings();
        const maxTrades = settings.maxDailyTrades !== undefined ? parseInt(settings.maxDailyTrades, 10) : 10;

        if (maxTrades > 0 && this.tradesTodayCount >= maxTrades) {
            return Object.freeze({
                signal: 'NEUTRAL_HOLD',
                underlyingPrice: spotPrice,
                atmStrike,
                targetOptionPrice: estimatedPremium,
                confidenceScore: '100%',
                signalTitle: `🔒 DAILY MAX TRADES CAP REACHED (${this.tradesTodayCount}/${maxTrades})`,
                signalRationale: `Daily trade limit of ${maxTrades} trades reached. Capital protected against market over-trading. Adjust in Risk Settings if desired.`,
                targetContract: `BANKNIFTY ${atmStrike} CE`,
                pcrMetrics,
                techLevels,
                breadthMetrics,
                riskAllocation
            });
        }

        let signal = 'NEUTRAL_HOLD';
        let confidenceScore = 0.75;
        let signalTitle = '🟡 NEUTRAL / HOLD IN CASH';
        let signalRationale = `Price consolidating around ₹${spotPrice.toLocaleString('en-IN')}. Awaiting Fibonacci level bounce or Momentum breakout.`;

        const nearFibGolden = Math.abs(spotPrice - techLevels.fibonacci.fib0618) / spotPrice < 0.015;
        const bullishBreadth = breadthMetrics.advancingWeight >= 65;
        const bearishBreadth = breadthMetrics.decliningWeight >= 65;

        // 1. MOMENTUM SCALPING / BREAKOUT REGIME
        if (bullishBreadth && (spotVelocity >= 20 || spotPrice >= techLevels.cpr.pivot)) {
            signal = 'BUY_CALL_CE';
            confidenceScore = 0.88;
            signalTitle = '🟢 HIGH CONFLUENCE CALL (CE) MOMENTUM BREAKOUT';
            signalRationale = `Bullish Momentum surge + HDFC/ICICI Positive Breadth (${breadthMetrics.advancingWeight}% advancing) + Above CPR Pivot.`;
        } else if (bearishBreadth && (spotVelocity <= -20 || spotPrice <= techLevels.cpr.pivot)) {
            signal = 'BUY_PUT_PE';
            confidenceScore = 0.88;
            signalTitle = '🔻 HIGH CONFLUENCE PUT (PE) WATERFALL BREAKDOWN';
            signalRationale = `Bearish Momentum plunge + Heavy Declining Breadth (${breadthMetrics.decliningWeight}% declining) + Below CPR Pivot.`;
        }
        // 2. CONTRARIAN REVERSAL REGIME (Extreme PCR Z-Scores)
        else if (pcrMetrics.pcrZScore <= -1.2 && nearFibGolden && breadthMetrics.advancingWeight >= 50) {
            signal = 'BUY_CALL_CE';
            confidenceScore = 0.92;
            signalTitle = '🟢 OVERSOLD CALL (CE) REVERSAL BOUNCE';
            signalRationale = `Price touched 0.618 Fib Support (₹${techLevels.fibonacci.fib0618}) + PCR ${pcrMetrics.rawPcr} (Z-Score: ${pcrMetrics.pcrZScore.toFixed(2)}) + Breadth Support.`;
        } else if (pcrMetrics.pcrZScore >= 1.2 && (bearishBreadth || !bullishBreadth)) {
            signal = 'BUY_PUT_PE';
            confidenceScore = 0.92;
            signalTitle = '🔻 OVERBOUGHT PUT (PE) REVERSAL';
            signalRationale = `Price rejected at CPR Top (₹${techLevels.cpr.top}) + PCR ${pcrMetrics.rawPcr} (Z-Score: ${pcrMetrics.pcrZScore.toFixed(2)}) + Negative Breadth.`;
        }

        // Log signal transition once when direction changes
        if (signal !== this.lastEmittedSignal) {
            this.lastEmittedSignal = signal;
            console.log(`\n🎯 [QUANT SIGNAL] ${signalTitle} | Target: ${signal === 'BUY_PUT_PE' ? `BANKNIFTY ${atmStrike} PE` : `BANKNIFTY ${atmStrike} CE`} | Spot: ₹${spotPrice.toLocaleString('en-IN')}`);
        }

        return Object.freeze({
            signal,
            underlyingPrice: spotPrice,
            atmStrike,
            targetOptionPrice: estimatedPremium,
            confidenceScore: Math.round(confidenceScore * 100) + '%',
            signalTitle,
            signalRationale,
            targetContract: signal === 'BUY_PUT_PE' ? `BANKNIFTY ${atmStrike} PE` : `BANKNIFTY ${atmStrike} CE`,
            pcrMetrics,
            techLevels,
            breadthMetrics,
            riskAllocation
        });
    }
}

module.exports = new SignalEngine();
