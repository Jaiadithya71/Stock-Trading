// ============================================================================
// FILE: backend/services/computation/index.js
// Computation Package Exporter
// ============================================================================

const computationEngine = require('./ComputationEngine');
const pcrCalculator = require('./pcrCalculator');
const technicalCalculator = require('./technicalCalculator');
const breadthCalculator = require('./breadthCalculator');
const riskCalculator = require('./riskCalculator');

module.exports = {
    computationEngine,
    pcrCalculator,
    technicalCalculator,
    breadthCalculator,
    riskCalculator
};
