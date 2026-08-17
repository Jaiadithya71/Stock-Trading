// ============================================================================
// FILE: backend/services/weeklyAuditLogger.js
// Automated Weekly Simulation Telemetry & Audit Logger
// Records signals, paper orders, stop-loss/target exits, and P&L for weekend review
// Dynamic Peak-to-Trough Max Drawdown % Calculation
// ============================================================================

const fs = require('fs');
const path = require('path');

const LOG_FILE_PATH = path.join(__dirname, '../data/weekly_simulation_log.json');

class WeeklyAuditLogger {
  constructor() {
    this.ensureLogFile();
  }

  ensureLogFile() {
    try {
      const dir = path.dirname(LOG_FILE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      if (!fs.existsSync(LOG_FILE_PATH)) {
        const initialData = {
          createdTimestamp: new Date().toISOString(),
          weeklySummary: {
            totalSignalsGenerated: 0,
            totalTradesExecuted: 0,
            winningTrades: 0,
            losingTrades: 0,
            winRatePct: 0,
            netRealizedPnL: 0.0,
            maxDrawdownPct: 0.0
          },
          dailyLogs: {},
          trades: []
        };
        fs.writeFileSync(LOG_FILE_PATH, JSON.stringify(initialData, null, 2), 'utf8');
      }
    } catch (e) {
      console.error('❌ Failed to initialize weekly simulation log file:', e.message);
    }
  }

  loadLog() {
    try {
      this.ensureLogFile();
      const raw = fs.readFileSync(LOG_FILE_PATH, 'utf8');
      return JSON.parse(raw);
    } catch (e) {
      console.error('❌ Failed to load weekly simulation log:', e.message);
      return { weeklySummary: {}, dailyLogs: {}, trades: [] };
    }
  }

  saveLog(data) {
    try {
      fs.writeFileSync(LOG_FILE_PATH, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
      console.error('❌ Failed to save weekly simulation log:', e.message);
    }
  }

  logTradeEvent(event) {
    const logData = this.loadLog();
    const now = new Date();
    const dateKey = now.toISOString().split('T')[0];

    const tradeEntry = {
      id: event.id || `TRADE-${Date.now()}`,
      timestamp: now.toISOString(),
      date: dateKey,
      symbol: event.symbol || 'BANKNIFTY',
      optionType: event.optionType || 'CE',
      strikePrice: event.strikePrice,
      entryPrice: event.entryPrice,
      exitPrice: event.exitPrice || null,
      quantity: event.quantity,
      pnl: event.pnl || 0.0,
      status: event.status || 'OPEN',
      rationale: event.rationale || 'Fib 0.618 Support + PCR Z-Score Confluence'
    };

    logData.trades.unshift(tradeEntry);

    // Update Daily Breakdown
    if (!logData.dailyLogs[dateKey]) {
      logData.dailyLogs[dateKey] = {
        date: dateKey,
        tradesCount: 0,
        dailyPnL: 0.0,
        wins: 0,
        losses: 0
      };
    }

    const dayLog = logData.dailyLogs[dateKey];
    dayLog.tradesCount += 1;
    if (event.status === 'CLOSED') {
      dayLog.dailyPnL += (event.pnl || 0.0);
      if (event.pnl > 0) dayLog.wins += 1;
      else if (event.pnl < 0) dayLog.losses += 1;
    }

    // Dynamic Max Drawdown % Calculation
    const closedTrades = logData.trades.filter(t => t.status === 'CLOSED');
    const wins = closedTrades.filter(t => t.pnl > 0).length;
    const losses = closedTrades.filter(t => t.pnl < 0).length;
    const totalPnL = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);

    let peakEquity = 100000;
    let currentEquity = 100000;
    let maxDD = 0.0;

    closedTrades.forEach(t => {
      currentEquity += (t.pnl || 0);
      if (currentEquity > peakEquity) peakEquity = currentEquity;
      const dd = ((peakEquity - currentEquity) / peakEquity) * 100;
      if (dd > maxDD) maxDD = dd;
    });

    logData.weeklySummary = {
      totalSignalsGenerated: logData.trades.length,
      totalTradesExecuted: closedTrades.length,
      winningTrades: wins,
      losingTrades: losses,
      winRatePct: closedTrades.length > 0 ? parseFloat(((wins / closedTrades.length) * 100).toFixed(1)) : 0.0,
      netRealizedPnL: parseFloat(totalPnL.toFixed(2)),
      maxDrawdownPct: parseFloat(maxDD.toFixed(1))
    };

    this.saveLog(logData);
    console.log(`📝 Weekly Simulation Log Updated: ${tradeEntry.id} (${event.status})`);
    return tradeEntry;
  }
}

module.exports = new WeeklyAuditLogger();
