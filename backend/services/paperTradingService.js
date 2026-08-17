// ============================================================================
// FILE: backend/services/paperTradingService.js
// Simulated Paper Trading Execution Engine for Bank Nifty Options
// Persistent Portfolio Memory (Restores account balance & positions from disk)
// ============================================================================

const fs = require('fs');
const path = require('path');

const PAPER_STATE_FILE = path.join(__dirname, '../data/paper_portfolio_state.json');

class PaperTradingService {
  constructor(initialCapital = 100000) {
    this.initialCapital = initialCapital;
    this.currentBalance = initialCapital;
    this.positions = []; // Active open paper positions
    this.tradeHistory = []; // Closed paper trade log
    this.slippagePenalty = 0.0005; // 0.05% spread/slippage simulation
    
    this.loadPersistedState();
  }

  loadPersistedState() {
    try {
      const dir = path.dirname(PAPER_STATE_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      if (fs.existsSync(PAPER_STATE_FILE)) {
        const raw = fs.readFileSync(PAPER_STATE_FILE, 'utf8');
        const state = JSON.parse(raw);
        this.initialCapital = state.initialCapital || this.initialCapital;
        this.currentBalance = state.currentBalance !== undefined ? state.currentBalance : this.initialCapital;
        this.positions = state.positions || [];
        this.tradeHistory = state.tradeHistory || [];
        console.log(`✅ Loaded persisted Paper Trading State: Balance ₹${this.currentBalance.toLocaleString('en-IN')}, Open Positions: ${this.positions.length}`);
      }
    } catch (e) {
      console.warn('⚠️ Could not load paper portfolio state:', e.message);
    }
  }

  savePersistedState() {
    try {
      const state = {
        initialCapital: this.initialCapital,
        currentBalance: this.currentBalance,
        positions: this.positions,
        tradeHistory: this.tradeHistory,
        lastUpdated: new Date().toISOString()
      };
      fs.writeFileSync(PAPER_STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
    } catch (e) {
      console.error('❌ Failed to save paper portfolio state:', e.message);
    }
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
      stopLossPrice: stopLossPrice || executionPrice * 0.85,
      targetPrice: targetPrice || executionPrice * 1.30,
      status: 'OPEN',
      entryTimestamp: new Date().toISOString()
    };

    this.positions.push(paperTrade);
    this.savePersistedState();

    console.log(`📝 [PaperTrading] Placed order: ${paperTrade.id} - ${paperTrade.symbol} ${paperTrade.strikePrice} ${paperTrade.optionType} @ ₹${paperTrade.entryPrice}`);
    return paperTrade;
  }

  /**
   * Close a paper position and calculate P&L
   */
  closePaperPosition(positionId, exitPrice) {
    const posIndex = this.positions.findIndex(p => p.id === positionId);
    if (posIndex === -1) {
      throw new Error(`Paper position ${positionId} not found`);
    }

    const pos = this.positions[posIndex];
    const grossReturn = exitPrice * pos.quantity;
    const netReturn = grossReturn * (1 - this.slippagePenalty);
    const costBasis = pos.entryPrice * pos.quantity;
    const pnl = netReturn - costBasis;

    this.currentBalance += netReturn;

    pos.status = 'CLOSED';
    pos.exitPrice = parseFloat(exitPrice.toFixed(2));
    pos.exitTimestamp = new Date().toISOString();
    pos.pnl = parseFloat(pnl.toFixed(2));

    this.positions.splice(posIndex, 1);
    this.tradeHistory.push(pos);
    this.savePersistedState();

    console.log(`📉 [PaperTrading] Closed position ${pos.id} P&L: ₹${pos.pnl}`);
    return pos;
  }

  /**
   * Get complete portfolio summary
   */
  getPortfolioSummary() {
    const totalRealizedPnL = this.tradeHistory.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const winningTrades = this.tradeHistory.filter(t => t.pnl > 0).length;
    const totalCompleted = this.tradeHistory.length;
    const winRatePct = totalCompleted > 0 ? (winningTrades / totalCompleted) * 100 : 0;

    return {
      initialCapital: this.initialCapital,
      currentBalance: parseFloat(this.currentBalance.toFixed(2)),
      activePositionsCount: this.positions.length,
      completedTradesCount: totalCompleted,
      winRatePct: parseFloat(winRatePct.toFixed(1)),
      totalRealizedPnL: parseFloat(totalRealizedPnL.toFixed(2)),
      activePositions: this.positions,
      tradeHistory: this.tradeHistory
    };
  }
}

module.exports = PaperTradingService;
