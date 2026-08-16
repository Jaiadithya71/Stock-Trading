// ============================================================================
// FILE: backend/services/computation/riskCalculator.js
// Kelly Capital Allocation & Cornish-Fisher VaR Calculator
// ============================================================================

const riskEngine = require('../../utils/riskEngine');

class RiskCalculator {
    calculateKellySizing(winRate = 0.60, winLossRatio = 1.5, accountCapital = 100000, optionPrice = 280) {
        const kellyFraction = riskEngine.calculateFractionalKelly(winRate, winLossRatio, 0.25);
        const recommendedCapital = accountCapital * kellyFraction;
        const contractSize = 15;
        const lotCost = optionPrice * contractSize;
        const recommendedLotSize = Math.max(1, Math.floor(recommendedCapital / lotCost));

        return {
            kellyFraction: Number(kellyFraction.toFixed(4)),
            recommendedCapital: Number(recommendedCapital.toFixed(2)),
            recommendedLotSize
        };
    }
}

module.exports = new RiskCalculator();
