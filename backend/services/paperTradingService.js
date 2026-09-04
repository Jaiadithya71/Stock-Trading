// ============================================================================
// FILE: backend/services/paperTradingService.js
// Dual-Market Simulated Paper Execution Engine (Cash Equities & F&O Options)
// Persistent Portfolio Memory & Realistic 0.05% Slippage Simulation
// ============================================================================

const fs = require('fs');
const path = require('path');

const PAPER_STATE_FILE = path.join(__dirname, '../data/paper_portfolio_state.json');

class PaperTradingService {
  constructor(initialCapital = 100000) {
    this.initialCapital = initialCapital;
    this.currentBalance = initialCapital;
    this.positions = [];     // Active open paper positions
    this.tradeHistory = [];   // Closed trade ledger
    this.slippagePenalty = 0.0005; // 0.05% spread/slippage simulation
    this.intradayLeverage = 5;     // 5x SEBI MIS Intraday Margin for Stocks

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
      }
    } catch (e) {
      console.warn('⚠️ Could not load paper portfolio state:', e.message);
    }
  }

  savePersistedState() {
    try {
      const state = {
        initialCapital: this.initialCapital,
        currentBalance: parseFloat(this.currentBalance.toFixed(2)),
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
   * Execute a simulated paper order (Equities or Options)
   */
  placePaperOrder(order) {
    const { 
      symbol, 
      action = 'BUY', 
      optionType, 
      strikePrice, 
      entryPrice, 
      quantity, 
      stopLoss, 
      stopLossPrice, 
      target, 
      targetPrice, 
      rationale 
    } = order;

    if (!entryPrice || !quantity || quantity <= 0) {
      throw new Error(`Invalid paper order parameters for ${symbol}`);
    }

    const isOption = !!optionType;
    const isShort = action.toUpperCase() === 'SELL';
    const effectivePrice = isShort 
      ? entryPrice * (1 - this.slippagePenalty) 
      : entryPrice * (1 + this.slippagePenalty);

    const totalTradeValue = effectivePrice * quantity;
    const requiredMargin = isOption ? totalTradeValue : (totalTradeValue / this.intradayLeverage); // 5x MIS for stocks

    if (requiredMargin > this.currentBalance) {
      throw new Error(`Insufficient virtual capital. Required Margin: ₹${requiredMargin.toFixed(2)}, Available: ₹${this.currentBalance.toFixed(2)}`);
    }

    this.currentBalance -= requiredMargin;

    const paperTrade = {
      id: `PAPER-${symbol}-${Date.now()}`,
      symbol: symbol ? symbol.toUpperCase() : 'BANKNIFTY',
      action: action.toUpperCase(),
      optionType: optionType || null,
      strikePrice: strikePrice || null,
      assetType: isOption ? 'OPTIONS' : 'EQUITY_CASH',
      entryPrice: parseFloat(effectivePrice.toFixed(2)),
      quantity: parseInt(quantity, 10),
      totalValue: parseFloat(totalTradeValue.toFixed(2)),
      marginBlocked: parseFloat(requiredMargin.toFixed(2)),
      stopLoss: stopLoss ? parseFloat(stopLoss.toFixed(2)) : (stopLossPrice ? parseFloat(stopLossPrice.toFixed(2)) : (isShort ? effectivePrice * 1.01 : effectivePrice * 0.99)),
      target: target ? parseFloat(target.toFixed(2)) : (targetPrice ? parseFloat(targetPrice.toFixed(2)) : (isShort ? effectivePrice * 0.985 : effectivePrice * 1.015)),
      status: 'OPEN',
      rationale: rationale || 'Quantitative Confluence Signal',
      entryTimestamp: new Date().toISOString()
    };

    this.positions.push(paperTrade);
    this.savePersistedState();

    console.log(`📝 [PaperTrading] Executed: ${paperTrade.id} - ${paperTrade.action} ${quantity} ${paperTrade.symbol} @ ₹${paperTrade.entryPrice} (Margin: ₹${paperTrade.marginBlocked})`);
    return paperTrade;
  }

  /**
   * Monitor and auto-exit open positions on Target or Stop-Loss hits
   */
  evaluateOpenPositions(priceMap = {}) {
    const closed = [];
    const openPositions = [...this.positions];

    for (const pos of openPositions) {
      const cleanSymbol = pos.symbol.replace('-EQ', '');
      const currentPrice = priceMap[cleanSymbol] || priceMap[pos.symbol] || pos.entryPrice;
      const isBuy = pos.action === 'BUY';

      // Real-time floating unrealized P&L computation
      const pnlPct = isBuy
        ? ((currentPrice - pos.entryPrice) / pos.entryPrice) * 100
        : ((pos.entryPrice - currentPrice) / pos.entryPrice) * 100;
      const unrealizedPnL = isBuy
        ? (currentPrice - pos.entryPrice) * pos.quantity
        : (pos.entryPrice - currentPrice) * pos.quantity;

      pos.currentPrice = currentPrice;
      pos.unrealizedPnL = parseFloat(unrealizedPnL.toFixed(2));
      pos.unrealizedPnLPct = parseFloat(pnlPct.toFixed(2));

      // 1. DYNAMIC TRAILING STOP & BREAKEVEN MECHANISM
      // Stage 1: If profit reaches +0.8%, ratchet Stop-Loss to Breakeven (Entry Price)
      if (pnlPct >= 0.8) {
        if (isBuy && pos.stopLoss < pos.entryPrice) {
          pos.stopLoss = pos.entryPrice;
          pos.trailingStatus = 'BREAKEVEN_LOCKED';
          console.log(`🛡️ [PaperTrading] Breakeven Locked for ${pos.symbol} @ ₹${pos.entryPrice}`);
        } else if (!isBuy && pos.stopLoss > pos.entryPrice) {
          pos.stopLoss = pos.entryPrice;
          pos.trailingStatus = 'BREAKEVEN_LOCKED';
          console.log(`🛡️ [PaperTrading] Breakeven Locked for ${pos.symbol} @ ₹${pos.entryPrice}`);
        }
      }

      // Stage 2: If profit reaches +1.4%, trail Stop-Loss aggressively to lock in +0.6% gain
      if (pnlPct >= 1.4) {
        if (isBuy) {
          const trailedSl = parseFloat((pos.entryPrice * 1.006).toFixed(2));
          if (pos.stopLoss < trailedSl) {
            pos.stopLoss = trailedSl;
            pos.trailingStatus = 'PROFIT_TRAILED';
          }
        } else {
          const trailedSl = parseFloat((pos.entryPrice * 0.994).toFixed(2));
          if (pos.stopLoss > trailedSl) {
            pos.stopLoss = trailedSl;
            pos.trailingStatus = 'PROFIT_TRAILED';
          }
        }
      }

      let shouldExit = false;
      let exitPrice = currentPrice;
      let exitReason = '';

      if (pos.action === 'BUY') {
        if (currentPrice >= pos.target) {
          shouldExit = true;
          exitPrice = pos.target;
          exitReason = 'TARGET_HIT';
        } else if (currentPrice <= pos.stopLoss) {
          shouldExit = true;
          exitPrice = pos.stopLoss;
          exitReason = pos.trailingStatus ? `${pos.trailingStatus}_HIT` : 'STOP_LOSS_HIT';
        }
      } else if (pos.action === 'SELL') {
        if (currentPrice <= pos.target) {
          shouldExit = true;
          exitPrice = pos.target;
          exitReason = 'TARGET_HIT';
        } else if (currentPrice >= pos.stopLoss) {
          shouldExit = true;
          exitPrice = pos.stopLoss;
          exitReason = pos.trailingStatus ? `${pos.trailingStatus}_HIT` : 'STOP_LOSS_HIT';
        }
      }

      if (shouldExit) {
        const closedTrade = this.closePosition(pos.id, exitPrice, exitReason);
        closed.push(closedTrade);
      }
    }

    return closed;
  }

  /**
   * Close a specific position
   */
  closePosition(orderId, marketExitPrice, exitReason = 'MANUAL_EXIT') {
    const posIndex = this.positions.findIndex(p => p.id === orderId);
    if (posIndex === -1) {
      throw new Error(`Position ${orderId} not found`);
    }

    const pos = this.positions[posIndex];
    const isShort = pos.action === 'SELL';
    const effectiveExit = isShort
      ? marketExitPrice * (1 + this.slippagePenalty)
      : marketExitPrice * (1 - this.slippagePenalty);

    let pnl = 0;
    if (isShort) {
      pnl = (pos.entryPrice - effectiveExit) * pos.quantity;
    } else {
      pnl = (effectiveExit - pos.entryPrice) * pos.quantity;
    }

    // Release margin and add realized P&L
    this.currentBalance += (pos.marginBlocked + pnl);

    const closedRecord = {
      ...pos,
      exitPrice: parseFloat(effectiveExit.toFixed(2)),
      pnl: parseFloat(pnl.toFixed(2)),
      pnlPct: parseFloat(((pnl / (pos.entryPrice * pos.quantity)) * 100).toFixed(2)),
      status: 'CLOSED',
      exitReason,
      exitTimestamp: new Date().toISOString()
    };

    this.positions.splice(posIndex, 1);
    this.tradeHistory.unshift(closedRecord);
    this.savePersistedState();

    console.log(`🏁 [PaperTrading] Closed: ${pos.symbol} P&L: ₹${closedRecord.pnl} (${closedRecord.pnlPct}%) Reason: ${exitReason}`);
    return closedRecord;
  }

  /**
   * End-of-Day 3:15 PM Square-Off Rule: Force-close all remaining open positions
   */
  squareOffAllPositions(priceMap = {}, reason = 'EOD_MIS_SQUARE_OFF_3_15_PM') {
    const closedList = [];
    const openIds = this.positions.map(p => p.id);

    for (const id of openIds) {
      const pos = this.positions.find(p => p.id === id);
      if (!pos) continue;
      const cleanSymbol = pos.symbol.replace('-EQ', '');
      const price = priceMap[cleanSymbol] || priceMap[pos.symbol] || pos.entryPrice;
      const closed = this.closePosition(id, price, reason);
      closedList.push(closed);
    }

    return closedList;
  }

  getPortfolioSummary() {
    const totalRealizedPnL = this.tradeHistory.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const winningTrades = this.tradeHistory.filter(t => t.pnl > 0).length;
    const losingTrades = this.tradeHistory.filter(t => t.pnl < 0).length;
    const totalCompleted = this.tradeHistory.length;
    const winRatePct = totalCompleted > 0 ? (winningTrades / totalCompleted) * 100 : 0;

    const totalUnrealizedPnL = this.positions.reduce((sum, p) => sum + (p.unrealizedPnL || 0), 0);
    const netTotalPnL = parseFloat((totalRealizedPnL + totalUnrealizedPnL).toFixed(2));
    const totalMarginUsed = this.positions.reduce((sum, p) => sum + (p.marginBlocked || 0), 0);

    return {
      initialCapital: this.initialCapital,
      currentBalance: parseFloat(this.currentBalance.toFixed(2)),
      activePositionsCount: this.positions.length,
      completedTradesCount: totalCompleted,
      winningTradesCount: winningTrades,
      losingTradesCount: losingTrades,
      winRatePct: parseFloat(winRatePct.toFixed(1)),
      totalRealizedPnL: parseFloat(totalRealizedPnL.toFixed(2)),
      totalUnrealizedPnL: parseFloat(totalUnrealizedPnL.toFixed(2)),
      netTotalPnL: netTotalPnL,
      totalMarginUsed: parseFloat(totalMarginUsed.toFixed(2)),
      activePositions: this.positions,
      positions: this.positions,
      tradeHistory: this.tradeHistory.slice(0, 50)
    };
  }

  resetCapital(amount = 100000) {
    const timestamp = new Date().toISOString();
    const dateStr = timestamp.split('T')[0];
    const dataDir = path.dirname(PAPER_STATE_FILE);
    const archivePath = path.join(dataDir, `paper_archive_${dateStr}_${Date.now()}.json`);

    const archiveData = {
      archiveTimestamp: timestamp,
      previousBalance: this.currentBalance,
      netRealizedPnL: this.tradeHistory.reduce((sum, t) => sum + (t.pnl || 0), 0),
      totalTrades: this.tradeHistory.length,
      positionsClosed: this.positions,
      tradeHistory: this.tradeHistory
    };

    try {
      fs.writeFileSync(archivePath, JSON.stringify(archiveData, null, 2), 'utf8');
      console.log(`💾 [PaperTrading] Prior trading session safely archived to: ${archivePath}`);
    } catch (e) {
      console.warn('⚠️ Could not save paper archive file:', e.message);
    }

    this.initialCapital = amount;
    this.currentBalance = amount;
    this.positions = [];
    this.tradeHistory = [];
    this.savePersistedState();

    return archiveData;
  }
}

module.exports = PaperTradingService;