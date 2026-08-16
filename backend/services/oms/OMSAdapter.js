// ============================================================================
// FILE: backend/services/oms/OMSAdapter.js
// Abstract Order Management System (OMS) Base Class
// ============================================================================

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

module.exports = OMSAdapter;
