// ============================================================================
// FILE: backend/services/computation/pcrCalculator.js
// Rolling 30-Day Put-Call Ratio (PCR) Z-Score Calculator
// ============================================================================

class PCRCalculator {
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
}

module.exports = new PCRCalculator();
