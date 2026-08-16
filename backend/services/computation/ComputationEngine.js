// ============================================================================
// FILE: backend/services/computation/ComputationEngine.js
// Central Computation Pipeline Coordinator
// ============================================================================

const pcrCalculator = require('./pcrCalculator');
const technicalCalculator = require('./technicalCalculator');
const breadthCalculator = require('./breadthCalculator');
const riskCalculator = require('./riskCalculator');

class ComputationEngine {
    calculatePCRMetrics(snapshots) {
        return pcrCalculator.calculatePCRMetrics(snapshots);
    }

    calculateTechnicalLevels(spotPrice, high, low, close) {
        return technicalCalculator.calculateTechnicalLevels(spotPrice, high, low, close);
    }

    calculateBankBreadth(bankStocks) {
        return breadthCalculator.calculateBankBreadth(bankStocks);
    }

    calculateKellySizing(winRate, winLossRatio, accountCapital, optionPrice) {
        return riskCalculator.calculateKellySizing(winRate, winLossRatio, accountCapital, optionPrice);
    }
}

module.exports = new ComputationEngine();
