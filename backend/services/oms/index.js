// ============================================================================
// FILE: backend/services/oms/index.js
// Package Exporter & OMS Factory Singleton
// ============================================================================

const OMSAdapter = require('./OMSAdapter');
const PaperTradingOMS = require('./PaperTradingOMS');
const LiveBrokerOMS = require('./LiveBrokerOMS');

class OMSFactory {
    constructor() {
        this.paperOMS = new PaperTradingOMS();
        this.liveOMS = new LiveBrokerOMS();
        this.activeMode = 'PAPER_SIMULATION';
    }

    setMode(mode) {
        if (mode === 'LIVE_SMARTAPI' || mode === 'PAPER_SIMULATION') {
            this.activeMode = mode;
            console.log(`🔄 OMS Factory Mode switched to: ${this.activeMode}`);
        }
    }

    getAdapter() {
        if (this.activeMode === 'LIVE_SMARTAPI') {
            return this.liveOMS;
        }
        return this.paperOMS;
    }
}

const omsFactoryInstance = new OMSFactory();

module.exports = {
    OMSAdapter,
    PaperTradingOMS,
    LiveBrokerOMS,
    omsFactory: omsFactoryInstance
};
