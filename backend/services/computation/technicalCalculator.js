// ============================================================================
// FILE: backend/services/computation/technicalCalculator.js
// Technical Fibonacci Retracements & Central Pivot Range (CPR) Calculator
// ============================================================================

class TechnicalCalculator {
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
}

module.exports = new TechnicalCalculator();
