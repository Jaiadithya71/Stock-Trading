// ============================================================================
// FILE: backend/services/computation/breadthCalculator.js
// Weighted Bank Stock Constituent Momentum Calculator
// ============================================================================

class BreadthCalculator {
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
}

module.exports = new BreadthCalculator();
