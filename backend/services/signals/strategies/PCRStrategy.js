// ============================================================================
// FILE: backend/services/signals/strategies/PCRStrategy.js
// Algo 1: Put-Call Ratio (PCR) 30-Day Rolling Z-Score Strategy
// ============================================================================

class PCRStrategy {
    evaluate(pcrMetrics) {
        const pcrZ = pcrMetrics?.pcrZScore || 0;
        if (pcrZ < -1.2) {
            return { signal: 'BUY_CALL_CE', score: 0.85, rationale: `PCR Oversold Z-Score (${pcrZ})` };
        } else if (pcrZ > 1.2) {
            return { signal: 'BUY_PUT_PE', score: 0.85, rationale: `PCR Overbought Z-Score (${pcrZ})` };
        }
        return { signal: 'NEUTRAL_HOLD', score: 0.50, rationale: `PCR Z-Score (${pcrZ}) in Fair Value Zone` };
    }
}

module.exports = new PCRStrategy();
