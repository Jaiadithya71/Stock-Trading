// ============================================================================
// FILE: backend/services/computationEngine.js
// Layer 2: Computation & Metric Engine
// Centralized mathematical metric computation pipeline
// ============================================================================

const riskEngine = require('../utils/riskEngine');

class ComputationEngine {
    calculatePCRMetrics(snapshots = []) {
        if (!snapshots || snapshots.length === 0) {
            return { rawPcr: 0.78, pcrZScore: -1.0, sentiment: 'NEUTRAL' };
        }

        const latestPcr = snapshots[0].pcr || 0.78;
        const pcrValues = snapshots.map(s => s.pcr).filter(v => typeof v === 'number' && !isNaN(v));
        
        if (pcrValues.length < 2) {
            return { rawPcr: latestPcr, pcrZScore: 0, sentiment: 'NEUTRAL' };
        }

        const sum = pcrValues.reduce((a, b) => a + b, 0);
        const mean = sum / pcrValues.length;
        const variance = pcrValues.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / pcrValues.length;
        const stdDev = Math.sqrt(variance) || 0.01;

        const pcrZScore = (latestPcr - mean) / stdDev;
        
        let sentiment = 'NEUTRAL';
        if (pcrZScore < -1.2) sentiment = 'BULLISH_OVERSOLD';
        else if (pcrZScore > 1.2) sentiment = 'BEARISH_OVERBOUGHT';

        return {
            rawPcr: Number(latestPcr.toFixed(2)),
            mean: Number(mean.toFixed(2)),
            stdDev: Number(stdDev.toFixed(4)),
            pcrZScore: Number(pcrZScore.toFixed(2)),
            sentiment
        };
    }

    calculateTechnicalLevels(spotPrice = 57491.10, high = 57800, low = 57200, close = 57491.10) {
        const cprPivot = (high + low + close) / 3;
        const bc = (high + low) / 2;
        const tc = (cprPivot - bc) + cprPivot;

        const range = high - low;
        const fib0382 = high - (range * 0.382);
        const fib0500 = high - (range * 0.500);
        const fib0618 = high - (range * 0.618);

        return {
            spotPrice: Number(spotPrice.toFixed(2)),
            cpr: {
                pivot: Number(cprPivot.toFixed(2)),
                top: Number(tc.toFixed(2)),
                bottom: Number(bc.toFixed(2))
            },
            fibonacci: {
                fib0382: Number(fib0382.toFixed(2)),
                fib0500: Number(fib0500.toFixed(2)),
                fib0618: Number(fib0618.toFixed(2))
            }
        };
    }

    calculateBankBreadth(bankStocks = []) {
        const weights = {
            'HDFCBANK': 0.285,
            'ICICIBANK': 0.231,
            'KOTAKBANK': 0.118,
            'AXISBANK': 0.112,
            'SBIN': 0.104
        };

        let totalAdvancingWeight = 0;
        let totalDecliningWeight = 0;

        bankStocks.forEach(stock => {
            const w = weights[stock.symbol] || 0.03;
            if (stock.pChange > 0) {
                totalAdvancingWeight += w * 100;
            } else {
                totalDecliningWeight += w * 100;
            }
        });

        const weightedBreadthScore = (totalAdvancingWeight - totalDecliningWeight) / 100;

        return {
            advancingWeight: Number(totalAdvancingWeight.toFixed(1)),
            decliningWeight: Number(totalDecliningWeight.toFixed(1)),
            weightedBreadthScore: Number(weightedBreadthScore.toFixed(2))
        };
    }

    calculateKellySizing(winRate = 0.60, winLossRatio = 1.5, accountCapital = 100000, optionPrice = 280) {
        const kellyFraction = riskEngine.calculateFractionalKelly(winRate, winLossRatio, 0.25); // Quarter-Kelly
        const recommendedCapital = accountCapital * kellyFraction;
        const contractSize = 15; // Bank Nifty lot size
        const lotCost = optionPrice * contractSize;
        const recommendedLotSize = Math.max(1, Math.floor(recommendedCapital / lotCost));

        return {
            kellyFraction: Number(kellyFraction.toFixed(4)),
            recommendedCapital: Number(recommendedCapital.toFixed(2)),
            recommendedLotSize
        };
    }
}

module.exports = new ComputationEngine();
