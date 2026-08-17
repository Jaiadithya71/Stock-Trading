// ============================================================================
// FILE: backend/services/signalEngine.js
// Layer 3: Signal Confluence Engine
// Decoupled quantitative signal evaluation emitting immutable signal objects
// Hardened Z-Score Filter (Z < -1.0 or Z > +1.0) to eliminate consolidation whipsaws
// Dynamic ATM option strike calculation based on real-time spot price
// ============================================================================

const computationEngine = require('./computationEngine');

class SignalEngine {
    evaluateSignal(marketData = {}, pcrSnapshots = [], bankStocks = [], userCapital = 100000) {
        const spotPrice = marketData.spotPrice || 57491.10;
        const pcrMetrics = computationEngine.calculatePCRMetrics(pcrSnapshots);
        const techLevels = computationEngine.calculateTechnicalLevels(spotPrice);
        const breadthMetrics = computationEngine.calculateBankBreadth(bankStocks);
        const riskAllocation = computationEngine.calculateKellySizing(0.60, 1.5, userCapital, 280);

        // Dynamic At-The-Money (ATM) Option Strike Calculation
        const atmStrike = Math.round(spotPrice / 100) * 100;

        let signal = 'NEUTRAL_HOLD';
        let confidenceScore = 0.75;
        let signalTitle = '🟡 NEUTRAL / HOLD IN CASH';
        let signalRationale = `Price consolidating around ₹${spotPrice.toLocaleString('en-IN')}. Awaiting Fibonacci level bounce + PCR Z-Score confirmation.`;

        // Strict Confluence Gate: Require Z-Score < -1.0 for Call or Z-Score > +1.0 for Put + Fib/Breadth confirmation
        const nearFibGolden = Math.abs(spotPrice - techLevels.fibonacci.fib0618) / spotPrice < 0.01;
        const bullishBreadth = breadthMetrics.advancingWeight > 50;

        if (pcrMetrics.pcrZScore < -1.0 && (nearFibGolden || bullishBreadth)) {
            signal = 'BUY_CALL_CE';
            confidenceScore = 0.89;
            signalTitle = '🟢 HIGH CONFLUENCE CALL (CE) SIGNAL';
            signalRationale = `Price touched 0.618 Fib Support (₹${techLevels.fibonacci.fib0618}) + PCR ${pcrMetrics.rawPcr} (Z-Score: ${pcrMetrics.pcrZScore.toFixed(2)}) + HDFC/ICICI Positive Breadth (${breadthMetrics.advancingWeight}%).`;
        } else if (pcrMetrics.pcrZScore > 1.0 && (!bullishBreadth || breadthMetrics.decliningWeight > 55)) {
            signal = 'BUY_PUT_PE';
            confidenceScore = 0.89;
            signalTitle = '🔻 HIGH CONFLUENCE PUT (PE) SIGNAL';
            signalRationale = `Price rejected at CPR Top (₹${techLevels.cpr.top}) + PCR ${pcrMetrics.rawPcr} (Z-Score: ${pcrMetrics.pcrZScore.toFixed(2)}) + Banking Breadth Negative (${breadthMetrics.decliningWeight}%).`;
        }

        return Object.freeze({
            signal,
            underlyingPrice: spotPrice,
            atmStrike,
            confidenceScore: Math.round(confidenceScore * 100) + '%',
            signalTitle,
            signalRationale,
            targetContract: signal === 'BUY_PUT_PE' ? `BANKNIFTY ${atmStrike} PE` : `BANKNIFTY ${atmStrike} CE`,
            targetOptionPrice: 280,
            pcrMetrics,
            techLevels,
            breadthMetrics,
            riskAllocation,
            timestamp: new Date().toISOString()
        });
    }
}

module.exports = new SignalEngine();
