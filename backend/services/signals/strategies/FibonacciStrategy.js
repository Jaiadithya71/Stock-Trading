// ============================================================================
// FILE: backend/services/signals/strategies/FibonacciStrategy.js
// Algo 2: Fibonacci Retracements & CPR Level Confluence Strategy
// ============================================================================

class FibonacciStrategy {
    evaluate(spotPrice, techLevels) {
        const fib0618 = techLevels?.fibonacci?.fib0618 || (spotPrice * 0.985);
        const nearFibGolden = Math.abs(spotPrice - fib0618) / spotPrice < 0.01;

        if (nearFibGolden) {
            return { signal: 'BUY_CALL_CE', score: 0.88, rationale: `Price (₹${spotPrice}) touched 0.618 Fib Golden Support (₹${fib0618})` };
        }
        return { signal: 'NEUTRAL_HOLD', score: 0.50, rationale: `Price consolidating around CPR Pivot (₹${techLevels?.cpr?.pivot})` };
    }
}

module.exports = new FibonacciStrategy();
