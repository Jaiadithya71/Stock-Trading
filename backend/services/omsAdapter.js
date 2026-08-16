// ============================================================================
// FILE: backend/services/omsAdapter.js
// Layer 4: Order Management System (OMS) Adapter Pattern
// Abstract OMS interface unifying Paper Simulation OMS & Live SmartAPI Execution
// ============================================================================

const PaperTradingService = require('./paperTradingService');
const orderService = require('./orderService');

const paperTradingInstance = new PaperTradingService(100000); // Singleton Paper Trading Instance

class OMSAdapter {
    async executeOrder(orderSpec) {
        throw new Error('executeOrder() must be implemented by subclass');
    }

    async getPositions() {
        throw new Error('getPositions() must be implemented by subclass');
    }

    async cancelOrder(orderId) {
        throw new Error('cancelOrder() must be implemented by subclass');
    }
}

class PaperTradingOMS extends OMSAdapter {
    async executeOrder(orderSpec) {
        const symbol = orderSpec.symbol || 'BANKNIFTY 57500 CE';
        const entryPrice = orderSpec.price || 280;
        const lots = orderSpec.lots || 1;
        const quantity = lots * 15;
        const transactionType = orderSpec.transactionType || 'BUY';

        console.log(`🧪 [PaperTradingOMS] Executing simulated ${transactionType} ${lots} lot(s) (${quantity} qty) ${symbol} @ ₹${entryPrice}`);
        const result = paperTradingInstance.placePaperOrder({
            symbol,
            optionType: symbol.includes('PE') ? 'PE' : 'CE',
            strikePrice: 57500,
            entryPrice,
            quantity,
            stopLossPrice: entryPrice * 0.85,
            targetPrice: entryPrice * 1.30
        });

        return {
            success: true,
            mode: 'PAPER_SIMULATION',
            orderId: result.id,
            details: result
        };
    }

    async getPositions() {
        return paperTradingInstance.getPortfolioSummary();
    }

    async cancelOrder(orderId) {
        return { success: true, message: `Paper order ${orderId} cancelled` };
    }
}

class LiveBrokerOMS extends OMSAdapter {
    async executeOrder(orderSpec) {
        console.log(`🔒 [LiveBrokerOMS] Executing live broker trade via SmartAPI`);
        const result = await orderService.placeOrder(orderSpec);
        return {
            success: true,
            mode: 'LIVE_SMARTAPI',
            details: result
        };
    }

    async getPositions() {
        return await orderService.getOrderBook();
    }

    async cancelOrder(orderId) {
        return await orderService.cancelOrder(orderId);
    }
}

class OMSFactory {
    constructor() {
        this.paperOMS = new PaperTradingOMS();
        this.liveOMS = new LiveBrokerOMS();
        this.activeMode = 'PAPER_SIMULATION'; // Default mode
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
