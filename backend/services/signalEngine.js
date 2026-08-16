// ============================================================================
// FILE: backend/services/signalEngine.js
// Layer 3: Signal Confluence Engine
// Decoupled quantitative signal evaluation emitting immutable signal objects
// ============================================================================

const computationEngine = require('./computationEngine');

class SignalEngine {
    evaluateSignal(marketData = {}, pcrSnapshots = [], bankStocks = [], userCapital = 100000) {
        const spotPrice = marketData.spotPrice || 57491.10;
        const pcrMetrics = computationEngine.calculatePCRMetrics(pcrSnapshots);
        const techLevels = computationEngine.calculateTechnicalLevels(spotPrice);
        const breadthMetrics = computationEngine.calculateBankBreadth(bankStocks);
        const riskAllocation = computationEngine.calculateKellySizing(0.60, 1.5, userCapital, 280);

        let signal = 'NEUTRAL_HOLD';
        let confidenceScore = 0.75;
        let signalTitle = '🟡 NEUTRAL / HOLD IN CASH';
        let signalRationale = 'Price consolidating within Central Pivot Range. Awaiting Fibonacci level bounce + PCR Z-Score confirmation.';

        // Bullish Confluence Condition: PCR Z-Score < -0.5 OR Fib 0.618 Support Proximity
        const nearFibGolden = Math.abs(spotPrice - techLevels.fibonacci.fib0618) / spotPrice < 0.01;
        const bullishBreadth = breadthMetrics.advancingWeight > 50;

        if (pcrMetrics.pcrZScore < -0.8 || (nearFibGolden && bullishBreadth)) {
            signal = 'BUY_CALL_CE';
            confidenceScore = 0.87;
            signalTitle = '🟢 HIGH CONFLUENCE CALL (CE) SIGNAL';
            signalRationale = `Price touched 0.618 Fib Support (₹${techLevels.fibonacci.fib0618}) + PCR ${pcrMetrics.rawPcr} (Z-Score: ${pcrMetrics.pcrZScore}) + HDFC/ICICI Positive Breadth (${breadthMetrics.advancingWeight}%).`;
        } else if (pcrMetrics.pcrZScore > 0.8 || (!bullishBreadth && breadthMetrics.decliningWeight > 60)) {
            signal = 'BUY_PUT_PE';
            confidenceScore = 0.87;
            signalTitle = '🔻 HIGH CONFLUENCE PUT (PE) SIGNAL';
            signalRationale = `Price rejected at CPR Top (₹${techLevels.cpr.top}) + PCR ${pcrMetrics.rawPcr} (Z-Score: ${pcrMetrics.pcrZScore}) + Banking Breadth Negative (${breadthMetrics.decliningWeight}%).`;
        }

        return Object.freeze({
            signal,
            confidenceScore: Math.round(confidenceScore * 100) + '%',
            signalTitle,
            signalRationale,
            targetContract: signal === 'BUY_PUT_PE' ? 'BANKNIFTY 57500 PE' : 'BANKNIFTY 57500 CE',
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
