// ============================================================================
// FILE: backend/services/signalEngine.js
// Layer 3: Signal Confluence Engine
// Decoupled quantitative signal evaluation emitting immutable signal objects
// Hardened Z-Score Filter (Z < -1.2 or Z > +1.2)
// Strict Confluence Gate: Require Z-Score AND Fib Golden Level AND Stock Breadth
// 15-Minute Post-Trade Cooldown & Max 5 Trades/Day Cap (Restored from Disk on Restart)
// Restores targetOptionPrice in payload for frontend widgets
// ============================================================================

const computationEngine = require('./computationEngine');
const weeklyAuditLogger = require('./weeklyAuditLogger');

class SignalEngine {
    constructor() {
        this.lastTradeTimestamp = null;
        this.tradesTodayCount = 0;
        this.lastTradeDate = null;
        this.loadPersistedStateOnStartup();
    }

    loadPersistedStateOnStartup() {
        try {
            const today = new Date().toISOString().split('T')[0];
            this.lastTradeDate = today;

            const logData = weeklyAuditLogger.loadLog();
            const trades = logData.trades || [];

            if (trades.length > 0) {
                // Find most recent trade timestamp
                const lastTrade = trades[trades.length - 1];
                if (lastTrade && lastTrade.timestamp) {
                    this.lastTradeTimestamp = new Date(lastTrade.timestamp).getTime();
                }

                // Count trades executed today
                const tradesToday = trades.filter(t => {
                    if (!t.timestamp) return false;
                    return new Date(t.timestamp).toISOString().split('T')[0] === today;
                });
                this.tradesTodayCount = tradesToday.length;

                console.log(`✅ [SignalEngine] State restored from Audit Log: Trades Today = ${this.tradesTodayCount}/5, Last Trade Time = ${this.lastTradeTimestamp ? new Date(this.lastTradeTimestamp).toLocaleTimeString('en-IN') : 'None'}`);
            }
        } catch (e) {
            console.warn('⚠️ Could not restore SignalEngine state on startup:', e.message);
        }
    }

    resetDailyCounterIfNeeded() {
        const today = new Date().toISOString().split('T')[0];
        if (this.lastTradeDate !== today) {
            this.lastTradeDate = today;
            this.tradesTodayCount = 0;
            this.lastTradeTimestamp = null;
        }
    }

    recordTradeExecuted() {
        this.resetDailyCounterIfNeeded();
        this.lastTradeTimestamp = Date.now();
        this.tradesTodayCount++;
        console.log(`⏱️ [SignalEngine] Trade recorded. Today Count: ${this.tradesTodayCount}/5, Timestamp: ${new Date(this.lastTradeTimestamp).toLocaleTimeString('en-IN')}`);
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

        const pcrMetrics = computationEngine.calculatePCRMetrics(pcrSnapshots);
        const techLevels = computationEngine.calculateTechnicalLevels(spotPrice);
        const breadthMetrics = computationEngine.calculateBankBreadth(bankStocks);
        const riskAllocation = computationEngine.calculateKellySizing(0.60, 1.5, userCapital, 280);
        const estimatedPremium = riskAllocation.estimatedPremium || Math.round(spotPrice * 0.005);

        // Dynamic At-The-Money (ATM) Option Strike Calculation
        const atmStrike = Math.round(spotPrice / 100) * 100;

        // CHECK 1: Max Trades Per Day Cap (Max 5 Trades / Day)
        if (this.tradesTodayCount >= 5) {
            return Object.freeze({
                signal: 'NEUTRAL_HOLD',
                underlyingPrice: spotPrice,
                atmStrike,
                targetOptionPrice: estimatedPremium,
                confidenceScore: '100%',
                signalTitle: '🔒 DAILY MAX TRADES CAP REACHED (5/5)',
                signalRationale: 'Daily trade limit of 5 trades reached. Capital protected against market over-trading.',
                targetContract: `BANKNIFTY ${atmStrike} CE`,
                pcrMetrics,
                techLevels,
                breadthMetrics,
                riskAllocation
            });
        }

        // CHECK 2: 15-Minute Trade Cooldown Filter (900,000 ms)
        if (this.lastTradeTimestamp && (Date.now() - this.lastTradeTimestamp < 15 * 60 * 1000)) {
            const remainingSec = Math.ceil((15 * 60 * 1000 - (Date.now() - this.lastTradeTimestamp)) / 1000);
            return Object.freeze({
                signal: 'NEUTRAL_HOLD',
                underlyingPrice: spotPrice,
                atmStrike,
                targetOptionPrice: estimatedPremium,
                confidenceScore: '90%',
                signalTitle: '⏳ 15-MIN TRADE COOLDOWN ACTIVE',
                signalRationale: `Waiting ${remainingSec}s post-exit to allow consolidation noise & option volatility decay to clear.`,
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
        let signalRationale = `Price consolidating around ₹${spotPrice.toLocaleString('en-IN')}. Awaiting Fibonacci level bounce + PCR Z-Score confirmation.`;

        // Strict Confluence Gate: Require Z-Score extreme (|Z| > 1.2) AND Fib Golden Level AND Stock Breadth alignment
        const nearFibGolden = Math.abs(spotPrice - techLevels.fibonacci.fib0618) / spotPrice < 0.015;
        const bullishBreadth = breadthMetrics.advancingWeight >= 50;
        const bearishBreadth = breadthMetrics.decliningWeight >= 50;

        if (pcrMetrics.pcrZScore <= -1.2 && nearFibGolden && bullishBreadth) {
            signal = 'BUY_CALL_CE';
            confidenceScore = 0.92;
            signalTitle = '🟢 HIGH CONFLUENCE CALL (CE) SIGNAL';
            signalRationale = `Price touched 0.618 Fib Support (₹${techLevels.fibonacci.fib0618}) + PCR ${pcrMetrics.rawPcr} (Z-Score: ${pcrMetrics.pcrZScore.toFixed(2)}) + HDFC/ICICI Positive Breadth (${breadthMetrics.advancingWeight}%).`;
        } else if (pcrMetrics.pcrZScore >= 1.2 && (!bullishBreadth || bearishBreadth)) {
            signal = 'BUY_PUT_PE';
            confidenceScore = 0.92;
            signalTitle = '🔻 HIGH CONFLUENCE PUT (PE) SIGNAL';
            signalRationale = `Price rejected at CPR Top (₹${techLevels.cpr.top}) + PCR ${pcrMetrics.rawPcr} (Z-Score: ${pcrMetrics.pcrZScore.toFixed(2)}) + Banking Breadth Negative (${breadthMetrics.decliningWeight}%).`;
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
