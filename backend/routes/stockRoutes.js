// ============================================================================
// FILE: backend/routes/stockRoutes.js
// Stock Universe Quotes, Signals, Autonomous Execution & Daily P&L Archive Endpoints
// ============================================================================

const express = require('express');
const router = express.Router();
const stockMarketDataProvider = require('../services/stockMarketDataProvider');
const stockSignalEngine = require('../services/stockSignalEngine');
const stockExecutionEngine = require('../services/stockExecutionEngine');

router.get('/quotes', async (req, res) => {
  try {
    const snapshot = await stockMarketDataProvider.getQuotes(null);
    res.json({ success: true, ...snapshot });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/signals', async (req, res) => {
  try {
    const snapshot = await stockMarketDataProvider.getQuotes(null);
    const signals = stockSignalEngine.evaluateUniverse(snapshot.stocks || []);
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      source: snapshot.source,
      isMarketOpen: snapshot.isMarketOpen,
      marketStatus: snapshot.marketStatus,
      marketNotice: snapshot.marketNotice,
      signals
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Autonomous Execution Engine Status & Controls
router.get('/execution-status', (req, res) => {
  const ist = stockExecutionEngine.getISTTime();
  res.json({
    success: true,
    autoExecutionEnabled: stockExecutionEngine.autoExecutionEnabled,
    currentTimeIST: ist.timeString,
    currentDateIST: ist.dateString,
    activePositionsCount: require('../services/paperTradingService').positions?.length || 0,
    tradesExecutedTodayCount: stockExecutionEngine.tradesToday.length,
    todayTrades: stockExecutionEngine.tradesToday
  });
});

router.post('/toggle-auto-execution', (req, res) => {
  const enabled = req.body.enabled !== undefined ? req.body.enabled : !stockExecutionEngine.autoExecutionEnabled;
  stockExecutionEngine.autoExecutionEnabled = enabled;
  console.log(`🤖 [StockEngine] Auto-Execution set to: ${enabled ? 'ENABLED' : 'DISABLED'}`);
  res.json({ success: true, autoExecutionEnabled: enabled });
});

// Trigger End-of-Day P&L Archive & Settlement
router.post('/eod-settlement', async (req, res) => {
  try {
    const ist = stockExecutionEngine.getISTTime();
    const archive = await stockExecutionEngine.settleAndArchiveDailyPnL(ist.dateString, null);
    res.json({ success: true, message: `EOD P&L Archived for ${ist.dateString}`, archive });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Fetch historical daily P&L ledger
router.get('/daily-ledger', (req, res) => {
  try {
    const ledger = stockExecutionEngine.getDailyLedger();
    res.json({ success: true, ledger });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Download complete P&L ledger & daily archives as a JSON backup package
router.get('/download-pnl-data', (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const dataDir = path.join(__dirname, '../data');
    const files = fs.readdirSync(dataDir).filter(f => f.startsWith('daily_pnl_') || f.startsWith('paper_portfolio_') || f.startsWith('stock_signal_audit_'));

    const backupBundle = {
      exportTimestamp: new Date().toISOString(),
      environment: process.env.RENDER ? 'RENDER_CLOUD' : 'LOCAL',
      data: {}
    };

    files.forEach(file => {
      try {
        const content = JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8'));
        backupBundle.data[file] = content;
      } catch (e) {}
    });

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="algo_pnl_backup_${new Date().toISOString().split('T')[0]}.json"`);
    res.send(JSON.stringify(backupBundle, null, 2));
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Export completed stock trades to CSV
router.get('/export-trades-csv', (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const dataDir = path.join(__dirname, '../data');
    
    // Gather trades from paper_portfolio_state and daily archives
    let allTrades = [];
    
    // 1. Check current state
    const stateFile = path.join(dataDir, 'paper_portfolio_state.json');
    if (fs.existsSync(stateFile)) {
      try {
        const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
        if (state.tradeHistory) allTrades.push(...state.tradeHistory);
      } catch (e) {}
    }

    // 2. Check archives
    const archiveFiles = fs.readdirSync(dataDir).filter(f => f.startsWith('daily_pnl_archive_') || f.startsWith('paper_archive_'));
    archiveFiles.forEach(f => {
      try {
        const content = JSON.parse(fs.readFileSync(path.join(dataDir, f), 'utf8'));
        const list = content.trades || content.tradeHistory || [];
        allTrades.push(...list);
      } catch (e) {}
    });

    // Deduplicate by ID
    const seen = new Set();
    allTrades = allTrades.filter(t => {
      if (!t.id || seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });

    let csv = 'Timestamp (IST),Order ID,Symbol,Side,Quantity,Entry Price,Target Price,Stop Loss,Exit Price,Realized P&L,Return %,Exit Reason,Rationale\n';
    allTrades.forEach(t => {
      const rawTime = t.exitTimestamp || t.timestamp || t.entryTimestamp;
      const istTime = rawTime ? new Date(rawTime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '-';
      const side = t.action || t.side || 'BUY';
      const pnlPct = t.pnlPct !== undefined ? t.pnlPct : (t.entryPrice && t.exitPrice ? (((t.exitPrice - t.entryPrice) / t.entryPrice) * (side === 'SELL' ? -100 : 100)).toFixed(2) : 0);
      const reason = (t.exitReason || '-').replace(/"/g, '""');
      const rationale = (t.rationale || '').replace(/"/g, '""');

      csv += `"${istTime}","${t.id || ''}","${t.symbol || ''}","${side}",${t.quantity || 0},${t.entryPrice || 0},${t.target || ''},${t.stopLoss || ''},${t.exitPrice || ''},${t.pnl || 0},"${pnlPct}%","${reason}","${rationale}"\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="stocks_trades_audit_${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csv);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;