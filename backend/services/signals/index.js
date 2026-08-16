// ============================================================================
// FILE: backend/services/signals/index.js
// Signals Package Exporter
// ============================================================================

const signalEngine = require('./SignalEngine');
const PCRStrategy = require('./strategies/PCRStrategy');
const FibonacciStrategy = require('./strategies/FibonacciStrategy');
const BreadthStrategy = require('./strategies/BreadthStrategy');

module.exports = {
    signalEngine,
    PCRStrategy,
    FibonacciStrategy,
    BreadthStrategy
};
