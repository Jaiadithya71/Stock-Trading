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

module.exports = router;