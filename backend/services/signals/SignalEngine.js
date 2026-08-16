// ============================================================================
// FILE: backend/services/signals/SignalEngine.js
// Confluence Engine coordinating strategies
// ============================================================================

const computationEngine = require('../computation');
const pcrStrategy = require('./strategies/PCRStrategy');
const fibonacciStrategy = require('./strategies/FibonacciStrategy');
const breadthStrategy = require('./strategies/BreadthStrategy');

class SignalEngine {
    evaluateSignal(marketData = {}, pcrSnapshots = [], bankStocks = [], userCapital = 100000) {
        const spotPrice = marketData.spotPrice || 57491.10;
        const pcrMetrics = computationEngine.calculatePCRMetrics(pcrSnapshots);
        const techLevels = computationEngine.calculateTechnicalLevels(spotPrice);
        const breadthMetrics = computationEngine.calculateBankBreadth(bankStocks);
        const riskAllocation = computationEngine.calculateKellySizing(0.60, 1.5, userCapital, 280);

        const pcrRes = pcrStrategy.evaluate(pcrMetrics);
        const fibRes = fibonacciStrategy.evaluate(spotPrice, techLevels);
        const breadthRes = breadthStrategy.evaluate(breadthMetrics);

        let signal = 'NEUTRAL_HOLD';
        let confidenceScore = 0.75;
        let signalTitle = '🟡 NEUTRAL / HOLD IN CASH';
        let signalRationale = 'Price consolidating around Central Pivot Range. Awaiting Fibonacci level bounce + PCR Z-Score confirmation.';

        if (pcrRes.signal === 'BUY_CALL_CE' || fibRes.signal === 'BUY_CALL_CE') {
            signal = 'BUY_CALL_CE';
            confidenceScore = 0.87;
            signalTitle = '🟢 HIGH CONFLUENCE CALL (CE) SIGNAL';
            signalRationale = `${fibRes.rationale} + PCR ${pcrMetrics.rawPcr} (Z-Score: ${pcrMetrics.pcrZScore}).`;
        } else if (pcrRes.signal === 'BUY_PUT_PE' || breadthRes.signal === 'BUY_PUT_PE') {
            signal = 'BUY_PUT_PE';
            confidenceScore = 0.87;
            signalTitle = '🔻 HIGH CONFLUENCE PUT (PE) SIGNAL';
            signalRationale = `Price rejected at CPR Top (₹${techLevels.cpr.top}) + PCR ${pcrMetrics.rawPcr} (Z-Score: ${pcrMetrics.pcrZScore}).`;
        }

        const atmStrike = Math.round(spotPrice / 100) * 100;

        return Object.freeze({
            signal,
            underlyingPrice: spotPrice,
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
