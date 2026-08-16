// ============================================================================
// FILE: backend/services/oms/PaperTradingOMS.js
// Simulated Paper Trading OMS Execution Driver
// ============================================================================

const OMSAdapter = require('./OMSAdapter');
const PaperTradingService = require('../paperTradingService');

const paperTradingInstance = new PaperTradingService(100000);

class PaperTradingOMS extends OMSAdapter {
    async executeOrder(orderSpec) {
        const symbol = orderSpec.symbol || 'BANKNIFTY 57500 CE';
        const entryPrice = orderSpec.price || 280;
        const lots = orderSpec.lots || 1;
        const quantity = orderSpec.quantity || (lots * 15);
        const transactionType = orderSpec.transactionType || 'BUY';

        console.log(`🧪 [PaperTradingOMS] Executing simulated ${transactionType} ${lots} lot(s) (${quantity} qty) ${symbol} @ ₹${entryPrice}`);
        const result = paperTradingInstance.placePaperOrder({
            symbol,
            optionType: symbol.includes('PE') ? 'PE' : 'CE',
            strikePrice: orderSpec.strikePrice || 57500,
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

module.exports = PaperTradingOMS;
