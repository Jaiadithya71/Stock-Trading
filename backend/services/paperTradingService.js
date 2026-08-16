// ============================================================================
// FILE: backend/services/paperTradingService.js
// Simulated Paper Trading Execution Engine for Bank Nifty Options
// Logs virtual trade fills, stop-loss, profit targets, slippage, and cumulative P&L
// ============================================================================

class PaperTradingService {
  constructor(initialCapital = 100000) {
    this.initialCapital = initialCapital;
    this.currentBalance = initialCapital;
    this.positions = []; // Active open paper positions
    this.tradeHistory = []; // Closed paper trade log
    this.slippagePenalty = 0.0005; // 0.05% spread/slippage simulation
  }

  /**
   * Execute a simulated paper trade
   * @param {Object} order - { symbol, optionType ('CE'|'PE'), strikePrice, entryPrice, quantity, stopLossPrice, targetPrice }
   * @returns {Object} Executed trade confirmation
   */
  placePaperOrder(order) {
    const { symbol, optionType, strikePrice, entryPrice, quantity, stopLossPrice, targetPrice } = order;

    if (!entryPrice || !quantity || quantity <= 0) {
      throw new Error('Invalid paper order parameters');
    }

    // Apply slippage penalty (Simulating buying at ask / selling at bid)
    const executionPrice = entryPrice * (1 + this.slippagePenalty);
    const requiredMargin = executionPrice * quantity;

    if (requiredMargin > this.currentBalance) {
      throw new Error(`Insufficient virtual capital. Required: ₹${requiredMargin.toFixed(2)}, Available: ₹${this.currentBalance.toFixed(2)}`);
    }

    this.currentBalance -= requiredMargin;

    const paperTrade = {
      id: `PAPER-${Date.now()}`,
      symbol: symbol || 'BANKNIFTY',
      optionType,
      strikePrice,
      entryPrice: parseFloat(executionPrice.toFixed(2)),
      quantity,
      stopLossPrice: stopLossPrice || executionPrice * 0.85, // Default 15% SL
      targetPrice: targetPrice || executionPrice * 1.30,   // Default 30% Target
      status: 'OPEN',
      entryTimestamp: new Date().toISOString()
    };

    this.positions.push(paperTrade);
    console.log(`\n📝 [PAPER TRADING] Opened ${paperTrade.optionType} Position: ${paperTrade.symbol} Strike ${paperTrade.strikePrice} @ ₹${paperTrade.entryPrice} (Qty: ${paperTrade.quantity})`);

    return paperTrade;
  }

  /**
   * Check active open positions against current market price ticks
   * @param {number} currentLTP - Latest traded price of option
   * @returns {Array} List of closed positions triggered by SL/Target
   */
  updateMarketTick(currentLTP) {
    const closedPositions = [];

    this.positions = this.positions.filter(position => {
      let exitReason = null;

      // Check Stop-Loss
      if (currentLTP <= position.stopLossPrice) {
        exitReason = 'STOP_LOSS';
      }
      // Check Target Profit
      else if (currentLTP >= position.targetPrice) {
        exitReason = 'PROFIT_TARGET';
      }

      if (exitReason) {
        // Exit price with slippage penalty
        const exitPrice = currentLTP * (1 - this.slippagePenalty);
        const pnl = (exitPrice - position.entryPrice) * position.quantity;
        const returnPct = ((exitPrice - position.entryPrice) / position.entryPrice) * 100;

        this.currentBalance += (exitPrice * position.quantity);

        const closedTrade = {
          ...position,
          exitPrice: parseFloat(exitPrice.toFixed(2)),
          exitReason,
          pnl: parseFloat(pnl.toFixed(2)),
          returnPct: parseFloat(returnPct.toFixed(2)),
          status: 'CLOSED',
          exitTimestamp: new Date().toISOString()
        };

        this.tradeHistory.push(closedTrade);
        closedPositions.push(closedTrade);

        console.log(`\n🔴 [PAPER TRADING] Closed Position ${position.id}: Exit @ ₹${exitPrice.toFixed(2)} (${exitReason}) | P&L: ₹${pnl.toFixed(2)} (${returnPct.toFixed(2)}%)`);
        return false; // Remove from active positions
      }

      return true; // Keep in active positions
    });

    return closedPositions;
  }

  /**
   * Get current paper trading portfolio summary
   */
  getPortfolioSummary() {
    const totalPnL = this.tradeHistory.reduce((acc, t) => acc + t.pnl, 0);
    const winTrades = this.tradeHistory.filter(t => t.pnl > 0).length;
    const totalTrades = this.tradeHistory.length;
    const winRate = totalTrades > 0 ? (winTrades / totalTrades) * 100 : 0.0;

    return {
      initialCapital: this.initialCapital,
      currentBalance: parseFloat(this.currentBalance.toFixed(2)),
      activePositionsCount: this.positions.length,
      completedTradesCount: totalTrades,
      winRatePct: parseFloat(winRate.toFixed(2)),
      totalRealizedPnL: parseFloat(totalPnL.toFixed(2)),
      activePositions: this.positions,
      tradeHistory: this.tradeHistory
    };
  }
}

module.exports = PaperTradingService;
