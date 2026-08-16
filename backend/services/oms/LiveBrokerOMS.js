// ============================================================================
// FILE: backend/services/oms/LiveBrokerOMS.js
// Live Angel One SmartAPI Order Execution Driver
// ============================================================================

const OMSAdapter = require('./OMSAdapter');
const orderService = require('../orderService');

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

module.exports = LiveBrokerOMS;
