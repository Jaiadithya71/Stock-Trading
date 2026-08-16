// ============================================================================
// FILE: backend/services/orderService.js
// Angel One SmartAPI Live Order Execution Service Wrapper
// Wraps placeOrder, modifyOrder, cancelOrder, getOrderBook, getPosition, getRMS
// ============================================================================

class OrderService {
  /**
   * @param {Object} smartAPI - Authenticated Angel One SmartAPI instance
   */
  constructor(smartAPI) {
    if (!smartAPI) {
      throw new Error('OrderService requires an authenticated SmartAPI instance');
    }
    this.smartAPI = smartAPI;
  }

  /**
   * Places a live order on Angel One
   * @param {Object} orderParams - Order payload
   * @returns {Promise<Object>} API response with Order ID
   */
  async placeOrder(orderParams) {
    const payload = {
      variety: orderParams.variety || 'NORMAL',
      tradingsymbol: orderParams.tradingsymbol,
      symboltoken: orderParams.symboltoken,
      transactiontype: orderParams.transactiontype, // BUY or SELL
      exchange: orderParams.exchange || 'NFO', // NFO for Bank Nifty options, NSE for equity
      ordertype: orderParams.ordertype || 'MARKET', // LIMIT or MARKET
      producttype: orderParams.producttype || 'INTRADAY', // CARRYFORWARD, INTRADAY, DELIVERY
      duration: orderParams.duration || 'DAY',
      price: orderParams.price ? orderParams.price.toString() : '0',
      quantity: orderParams.quantity.toString()
    };

    console.log(`\n🚀 [SMARTAPI] Placing ${payload.transactiontype} Order for ${payload.tradingsymbol}...`);
    try {
      const response = await this.smartAPI.placeOrder(payload);
      console.log(`✅ [SMARTAPI] Order Placed. Response:`, response);
      return response;
    } catch (error) {
      console.error(`❌ [SMARTAPI] Error placing order:`, error.message);
      throw error;
    }
  }

  /**
   * Modifies an existing order
   * @param {Object} modifyParams - Modification payload
   */
  async modifyOrder(modifyParams) {
    const payload = {
      orderid: modifyParams.orderid,
      variety: modifyParams.variety || 'NORMAL',
      tradingsymbol: modifyParams.tradingsymbol,
      symboltoken: modifyParams.symboltoken,
      transactiontype: modifyParams.transactiontype,
      exchange: modifyParams.exchange || 'NFO',
      ordertype: modifyParams.ordertype || 'LIMIT',
      producttype: modifyParams.producttype || 'INTRADAY',
      duration: modifyParams.duration || 'DAY',
      price: modifyParams.price.toString(),
      quantity: modifyParams.quantity.toString()
    };

    try {
      const response = await this.smartAPI.modifyOrder(payload);
      return response;
    } catch (error) {
      console.error(`❌ [SMARTAPI] Error modifying order ${modifyParams.orderid}:`, error.message);
      throw error;
    }
  }

  /**
   * Cancels an open order
   * @param {string} orderId - Order ID to cancel
   * @param {string} variety - Order variety (default NORMAL)
   */
  async cancelOrder(orderId, variety = 'NORMAL') {
    try {
      const response = await this.smartAPI.cancelOrder({ orderid: orderId, variety });
      return response;
    } catch (error) {
      console.error(`❌ [SMARTAPI] Error cancelling order ${orderId}:`, error.message);
      throw error;
    }
  }

  /**
   * Gets current user Order Book
   */
  async getOrderBook() {
    try {
      const response = await this.smartAPI.getOrderBook();
      return response;
    } catch (error) {
      console.error(`❌ [SMARTAPI] Error fetching order book:`, error.message);
      throw error;
    }
  }

  /**
   * Gets current open and closed positions
   */
  async getPositions() {
    try {
      const response = await this.smartAPI.getPosition();
      return response;
    } catch (error) {
      console.error(`❌ [SMARTAPI] Error fetching positions:`, error.message);
      throw error;
    }
  }

  /**
   * Gets user RMS limits and available margin funds
   */
  async getRMSLimits() {
    try {
      const response = await this.smartAPI.getRMS();
      return response;
    } catch (error) {
      console.error(`❌ [SMARTAPI] Error fetching RMS margin:`, error.message);
      throw error;
    }
  }
}

module.exports = OrderService;
