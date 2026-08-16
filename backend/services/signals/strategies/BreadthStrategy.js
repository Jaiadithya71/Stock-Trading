// ============================================================================
// FILE: backend/services/signals/strategies/BreadthStrategy.js
// Algo 3: Bank Stock Constituent Weighted Breadth Strategy
// ============================================================================

class BreadthStrategy {
    evaluate(breadthMetrics) {
        const advancing = breadthMetrics?.advancingWeight || 0;
        const declining = breadthMetrics?.decliningWeight || 0;

        if (advancing > 60) {
            return { signal: 'BUY_CALL_CE', score: 0.82, rationale: `Banking Stock Capital Advancing (${advancing}%)` };
        } else if (declining > 60) {
            return { signal: 'BUY_PUT_PE', score: 0.82, rationale: `Banking Stock Capital Declining (${declining}%)` };
        }
        return { signal: 'NEUTRAL_HOLD', score: 0.50, rationale: `Banking Breadth Mixed (Adv: ${advancing}%, Dec: ${declining}%)` };
    }
}

module.exports = new BreadthStrategy();
