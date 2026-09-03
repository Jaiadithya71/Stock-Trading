// ============================================================================
// FILE: backend/services/stockExecutionEngine.js
// Autonomous End-to-End Stock Trading & Daily P&L Archival Engine
// Lifecycle: Signal Detection -> Order Placing -> Target/SL Exit -> 3:15 PM Square-Off -> 3:30 PM EOD P&L Storage
// ============================================================================

const fs = require('fs');
const path = require('path');
const stockMarketDataProvider = require('./stockMarketDataProvider');
const stockSignalEngine = require('./stockSignalEngine');
const PaperTradingService = require('./paperTradingService');
const weeklyAuditLogger = require('./weeklyAuditLogger');
const signalAuditLogger = require('./signalAuditLogger');
const marketCalendar = require('../utils/marketCalendar');

const paperTrading = new PaperTradingService();
const DATA_DIR = path.join(__dirname, '../data');
const SETTINGS_FILE = path.join(DATA_DIR, 'risk_settings.json');
const DAILY_LEDGER_FILE = path.join(DATA_DIR, 'daily_pnl_ledger.json');

class StockExecutionEngine {
  constructor() {
    this.isRunning = false;
    this.intervalId = null;
    this.autoExecutionEnabled = true;
    this.lastSettledDate = null;
    this.tradesToday = [];
  }

  getRiskSettings() {
    try {
      if (fs.existsSync(SETTINGS_FILE)) {
        return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
      }
    } catch (e) {}
    return { tradingMode: 'PAPER_TRADING', capital: 100000, riskPerTradePct: 1.0, maxDailyLoss: 5000, maxOpenPositions: 3, killSwitchActive: false };
  }

  getISTTime() {
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const ist = new Date(utc + (3600000 * 5.5));
    const hours = ist.getHours();
    const minutes = ist.getMinutes();
    return {
      hours,
      minutes,
      timeInMinutes: hours * 60 + minutes,
      dateString: ist.toISOString().split('T')[0],
      timeString: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
    };
  }

  /**
   * Main 60-second autonomous evaluation and execution cycle
   */
  async runCycle(smartApiInstance = null) {
    try {
      const ist = this.getISTTime();
      const settings = this.getRiskSettings();

      // Check Kill Switch
      if (settings.killSwitchActive) {
        console.log('🚨 [StockEngine] Kill Switch Active: Skipping cycle.');
        return;
      }

      // 1. Fetch live or simulated quotes
      const snapshot = await stockMarketDataProvider.getQuotes(smartApiInstance);
      const stockList = snapshot.stocks || [];
      const priceMap = {};
      stockList.forEach(s => { priceMap[s.symbol] = s.ltp; });

      // 2. STAGE 2 IN-FLIGHT POSITION MONITORING: Check Stop-Loss & Target Exits
      const closedExits = paperTrading.evaluateOpenPositions(priceMap);
      for (const trade of closedExits) {
        this.tradesToday.push(trade);
        weeklyAuditLogger.logTradeEvent({
          id: trade.id,
          symbol: trade.symbol,
          action: trade.action,
          entryPrice: trade.entryPrice,
          exitPrice: trade.exitPrice,
          quantity: trade.quantity,
          pnl: trade.pnl,
          status: 'CLOSED',
          rationale: `Automated Exit: ${trade.exitReason}`
        });
        console.log(`🎯 [StockEngine] Position Auto-Closed: ${trade.symbol} P&L: ₹${trade.pnl} (${trade.exitReason})`);
      }

      // 3. 3:15 PM EOD INTRADAY MIS SQUARE-OFF RULE
      // Between 3:15 PM (915 min) and 3:29 PM (929 min), force-close all remaining open positions
      if (ist.timeInMinutes >= 915 && ist.timeInMinutes < 930) {
        if (paperTrading.positions.length > 0) {
          console.log('⏰ [StockEngine] 3:15 PM IST Reached: Auto squaring off all remaining intraday positions...');
          const eodExits = paperTrading.squareOffAllPositions(priceMap, 'EOD_MIS_SQUARE_OFF_3_15_PM');
          eodExits.forEach(t => {
            this.tradesToday.push(t);
            weeklyAuditLogger.logTradeEvent(t);
          });
        }
      }

      // 4. 3:30 PM END-OF-DAY P&L FETCHING & STORAGE
      if (ist.timeInMinutes >= 930 && this.lastSettledDate !== ist.dateString) {
        await this.settleAndArchiveDailyPnL(ist.dateString, smartApiInstance);
        this.lastSettledDate = ist.dateString;
        return;
      }

      // 5. SIGNAL IDENTIFICATION & AUTONOMOUS ORDER PLACEMENT
      // Only enter new trades before 3:00 PM (900 min)
      if (this.autoExecutionEnabled && ist.timeInMinutes < 900) {
        // Daily Loss Limit Check
        const todayPnL = this.tradesToday.reduce((acc, t) => acc + (t.pnl || 0), 0);
        if (todayPnL <= -(settings.maxDailyLoss || 5000)) {
          console.warn(`🛑 [StockEngine] Daily Loss Limit Reached (₹${todayPnL} <= -₹${settings.maxDailyLoss}). Halting new trades today.`);
          return;
        }

        const signals = stockSignalEngine.evaluateUniverse(stockList);
        signalAuditLogger.logMinuteSignals(signals);

        const actionable = signals.filter(s => s.signal === 'BUY_LONG' || s.signal === 'SELL_SHORT');
        const openSymbols = new Set(paperTrading.positions.map(p => p.symbol.replace('-EQ', '')));

        for (const sig of actionable) {
          if (paperTrading.positions.length >= (settings.maxOpenPositions || 3)) {
            break;
          }
          if (openSymbols.has(sig.symbol)) {
            continue; // Avoid duplicate position in same stock
          }

          console.log(`🚀 [StockEngine] Actionable Signal Detected: ${sig.signal} on ${sig.symbol} @ ₹${sig.ltp}`);

          const orderSpec = {
            symbol: sig.symbol,
            action: sig.action,
            entryPrice: sig.ltp,
            quantity: sig.riskAllocation.allocatedShares,
            stopLoss: sig.stopLoss,
            target: sig.target,
            rationale: sig.rationale
          };

          // Route order based on mode
          if (settings.tradingMode === 'LIVE_BROKER' && smartApiInstance) {
            try {
              const LiveBrokerOMS = require('./oms/LiveBrokerOMS');
              const liveOms = new LiveBrokerOMS();
              const liveRes = await liveOms.executeOrder({
                ...orderSpec,
                token: sig.token
              }, smartApiInstance);
              console.log(`✅ [StockEngine] Live Order Placed via SmartAPI:`, liveRes.orderId);
            } catch (liveErr) {
              console.error(`❌ [StockEngine] Live Order Placement Failed:`, liveErr.message);
            }
          } else {
            // Stage 2: Paper Trading OMS
            const paperOrder = paperTrading.placePaperOrder(orderSpec);
            openSymbols.add(sig.symbol);

            weeklyAuditLogger.logTradeEvent({
              id: paperOrder.id,
              symbol: sig.symbol,
              action: sig.action,
              entryPrice: paperOrder.entryPrice,
              exitPrice: null,
              quantity: paperOrder.quantity,
              pnl: 0.0,
              status: 'OPEN',
              rationale: sig.rationale
            });
          }
        }
      }

      console.log(`⏱️ [StockEngine ${ist.timeString} IST] Active Positions: ${paperTrading.positions.length} | Today Closed: ${this.tradesToday.length}`);
    } catch (err) {
      console.error('❌ [StockEngine] Cycle error:', err.message);
    }
  }

  /**
   * End-of-Day P&L Fetching, Reconciling & Storing
   */
  async settleAndArchiveDailyPnL(dateString, smartApiInstance = null) {
    console.log(`\n📦 =========================================================`);
    console.log(`📦 [EOD SETTLEMENT] Archiving Daily P&L for ${dateString}...`);
    console.log(`=========================================================`);

    let brokerPositions = [];
    if (smartApiInstance && typeof smartApiInstance.getPosition === 'function') {
      try {
        const res = await smartApiInstance.getPosition();
        brokerPositions = res.data || [];
        console.log(`📡 [EOD Settlement] Fetched ${brokerPositions.length} broker positions from Angel One.`);
      } catch (e) {
        console.warn('⚠️ [EOD Settlement] Could not fetch live broker positions:', e.message);
      }
    }

    const closedToday = this.tradesToday;
    const wins = closedToday.filter(t => t.pnl > 0).length;
    const losses = closedToday.filter(t => t.pnl < 0).length;
    const grossProfit = closedToday.filter(t => t.pnl > 0).reduce((acc, t) => acc + t.pnl, 0);
    const grossLoss = Math.abs(closedToday.filter(t => t.pnl < 0).reduce((acc, t) => acc + t.pnl, 0));
    const netPnL = grossProfit - grossLoss;
    const winRate = closedToday.length > 0 ? (wins / closedToday.length) * 100 : 0;

    const dailyArchive = {
      date: dateString,
      timestamp: new Date().toISOString(),
      summary: {
        totalTrades: closedToday.length,
        winningTrades: wins,
        losingTrades: losses,
        winRatePct: parseFloat(winRate.toFixed(1)),
        grossProfit: parseFloat(grossProfit.toFixed(2)),
        grossLoss: parseFloat(grossLoss.toFixed(2)),
        netRealizedPnL: parseFloat(netPnL.toFixed(2)),
        endingPortfolioBalance: paperTrading.currentBalance
      },
      brokerLivePositions: brokerPositions,
      trades: closedToday
    };

    // 1. Save specific daily file: daily_pnl_archive_YYYY-MM-DD.json
    const archivePath = path.join(DATA_DIR, `daily_pnl_archive_${dateString}.json`);
    fs.writeFileSync(archivePath, JSON.stringify(dailyArchive, null, 2), 'utf8');

    // 2. Append to master ledger: daily_pnl_ledger.json
    let ledger = [];
    if (fs.existsSync(DAILY_LEDGER_FILE)) {
      try {
        ledger = JSON.parse(fs.readFileSync(DAILY_LEDGER_FILE, 'utf8'));
      } catch (e) { ledger = []; }
    }

    // Replace or add today's entry
    ledger = ledger.filter(entry => entry.date !== dateString);
    ledger.unshift({
      date: dateString,
      netRealizedPnL: dailyArchive.summary.netRealizedPnL,
      winRatePct: dailyArchive.summary.winRatePct,
      totalTrades: dailyArchive.summary.totalTrades,
      endingBalance: dailyArchive.summary.endingPortfolioBalance
    });

    fs.writeFileSync(DAILY_LEDGER_FILE, JSON.stringify(ledger, null, 2), 'utf8');

    console.log(`✅ [EOD Settlement] Successfully archived: Net P&L: ₹${netPnL.toFixed(2)} | Win Rate: ${winRate.toFixed(1)}%`);
    console.log(`💾 Saved to: ${archivePath}`);

    // Reset daily trade ledger for next session
    this.tradesToday = [];
    return dailyArchive;
  }

  getDailyLedger() {
    if (fs.existsSync(DAILY_LEDGER_FILE)) {
      try {
        return JSON.parse(fs.readFileSync(DAILY_LEDGER_FILE, 'utf8'));
      } catch (e) {}
    }
    return [];
  }

  start(smartApiInstance = null) {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('🚀 [StockExecutionEngine] Full End-to-End Autonomous Trading Engine started');

    // Run first cycle immediately
    this.runCycle(smartApiInstance);

    this.intervalId = setInterval(() => {
      this.runCycle(smartApiInstance);
    }, 60000);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('🛑 [StockExecutionEngine] Autonomous Engine stopped');
  }
}

module.exports = new StockExecutionEngine();