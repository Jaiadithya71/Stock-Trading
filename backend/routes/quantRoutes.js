// ============================================================================
// FILE: backend/routes/quantRoutes.js
// Express API Routes for Quant Signals & Layer 4 OMS Adapter Integration
// Real-time market telemetry integration for dynamic spot price & stock breadth
// Persistent storage for user risk settings & weekly simulation audit logger
// Route order fixed & full trade closure logging (status, exitPrice, pnl, rationale)
// Includes POST /api/oms/mode and GET /api/paper/weekly-audit/download
// ============================================================================

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const PCRStorageService = require('../services/pcrStorageService');
const signalEngine = require('../services/signalEngine');
const weeklyAuditLogger = require('../services/weeklyAuditLogger');
const signalAuditLogger = require('../services/signalAuditLogger');
const { omsFactory } = require('../services/omsAdapter');


const pcrStorage = new PCRStorageService();
const SETTINGS_FILE_PATH = path.join(__dirname, '../data/risk_settings.json');

// Helper to load persisted risk settings
function getPersistedSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE_PATH)) {
      const raw = fs.readFileSync(SETTINGS_FILE_PATH, 'utf8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('⚠️ Could not load risk settings:', e.message);
  }
  return { capital: 1000, lots: 1, maxLoss: 5000 };
}

/**
 * GET /api/quant/signal
 * Returns real-time quantitative strategy signal & risk metrics via SignalEngine
 */
router.get('/quant/signal', async (req, res) => {
  try {
    const historicalData = await pcrStorage.loadData();
    const snapshots = historicalData.snapshots || [];

    let liveSpotPrice = 57491.10;
    let stockList = [
      { symbol: 'HDFCBANK', pChange: 0.28 },
      { symbol: 'ICICIBANK', pChange: 0.73 },
      { symbol: 'KOTAKBANK', pChange: -0.32 },
      { symbol: 'AXISBANK', pChange: -0.36 },
      { symbol: 'SBIN', pChange: -1.41 }
    ];

    if (snapshots.length > 0) {
      const lastSnap = snapshots[snapshots.length - 1];
      if (lastSnap && lastSnap.spotPrice) {
        liveSpotPrice = parseFloat(lastSnap.spotPrice);
      }

      if (lastSnap && lastSnap.stockBreadth && Array.isArray(lastSnap.stockBreadth)) {
        stockList = lastSnap.stockBreadth.map(stk => ({
          symbol: stk.symbol,
          pChange: parseFloat(stk.pChange || stk.change || 0.0)
        }));
      } else if (snapshots.length > 1) {
        const prevSnap = snapshots[snapshots.length - 2];
        const spotDelta = ((lastSnap.spotPrice - prevSnap.spotPrice) / prevSnap.spotPrice) * 100;
        
        stockList = [
          { symbol: 'HDFCBANK', pChange: parseFloat((spotDelta * 1.05).toFixed(2)) },
          { symbol: 'ICICIBANK', pChange: parseFloat((spotDelta * 1.12).toFixed(2)) },
          { symbol: 'KOTAKBANK', pChange: parseFloat((spotDelta * 0.92).toFixed(2)) },
          { symbol: 'AXISBANK', pChange: parseFloat((spotDelta * 0.88).toFixed(2)) },
          { symbol: 'SBIN', pChange: parseFloat((spotDelta * 0.95).toFixed(2)) }
        ];
      }
    }

    const savedSettings = getPersistedSettings();
    const userCapital = parseFloat(savedSettings.capital) || 1000;

    const signalPayload = signalEngine.evaluateSignal(
      { spotPrice: liveSpotPrice },
      snapshots,
      stockList,
      userCapital
    );

    // Note: Signal telemetry is recorded strictly by the autonomous 60s signalScheduler during live market hours
    res.json({
      success: true,
      data: signalPayload
    });
  } catch (error) {
    console.error('❌ Error generating quant signal:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/quant/signal-audit
 * Returns minute-by-minute signal telemetry log for single day or multi-day range ('today', '7d', 'all')
 */
router.get('/quant/signal-audit', async (req, res) => {
  try {
    const range = (req.query.range || 'today').toLowerCase();
    const dateKey = req.query.date || null;
    const auditEntries = signalAuditLogger.getRangeAuditLog(range, dateKey);
    res.json({
      success: true,
      range,
      date: dateKey || (range === 'today' ? new Date().toISOString().split('T')[0] : 'multi-day'),
      totalEntries: auditEntries.length,
      data: auditEntries
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/quant/signal-audit/download
 * Exports full 375-minute daily or multi-day (7-day / 30-day / all) signal telemetry as CSV or JSON
 */
router.get('/quant/signal-audit/download', async (req, res) => {
  try {
    const range = (req.query.range || (req.query.date ? 'custom' : '7d')).toLowerCase();
    const dateKey = req.query.date || null;
    const format = (req.query.format || 'csv').toLowerCase();
    const auditEntries = signalAuditLogger.getRangeAuditLog(range, dateKey);

    const filenameBase = dateKey 
      ? `signal_telemetry_${dateKey}` 
      : range === '7d' 
        ? `signal_telemetry_7days_weekly` 
        : range === 'all' || range === '30d' 
          ? `signal_telemetry_all_history_30d` 
          : `signal_telemetry_today`;

    if (format === 'csv') {
      let csv = 'Date,Timestamp (IST),Spot Price,ATM Strike,Raw PCR,PCR Z-Score,Advancing Wt %,Declining Wt %,Signal,Confidence,Rationale\n';
      auditEntries.forEach(e => {
        const entryDate = e.date || (e.timestamp ? new Date(e.timestamp).toISOString().split('T')[0] : '');
        csv += `"${entryDate}","${e.timeIST || ''}",${e.spotPrice || 0},${e.atmStrike || 0},${e.rawPcr || 0},${e.pcrZScore || 0},${e.advancingWeight || 0},${e.decliningWeight || 0},"${e.signal || ''}","${e.confidenceScore || ''}","${(e.signalRationale || '').replace(/"/g, '""')}"\n`;
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}.csv"`);
      return res.send(csv);
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}.json"`);
    res.send(JSON.stringify(auditEntries, null, 2));
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});


/**
 * POST /api/paper/trade
 * Places order via Layer 4 OMSAdapter and logs event in weekly simulation logger
 */
router.post('/paper/trade', async (req, res) => {
  try {
    const orderParams = req.body;
    const omsAdapter = omsFactory.getAdapter();
    const tradeResult = await omsAdapter.executeOrder(orderParams);
    
    // Trigger 15-minute cooldown & increment daily trade counter in SignalEngine
    signalEngine.recordTradeExecuted();

    weeklyAuditLogger.logTradeEvent({
      id: tradeResult.orderId || tradeResult.id || `PAPER-${Date.now()}`,
      symbol: orderParams.symbol || `BANKNIFTY ${orderParams.strikePrice || 57500} ${orderParams.optionType || 'CE'}`,
      optionType: orderParams.optionType || 'CE',
      strikePrice: orderParams.strikePrice || 57500,
      entryPrice: tradeResult.entryPrice || orderParams.entryPrice || 280,
      exitPrice: tradeResult.exitPrice || null,
      quantity: orderParams.quantity || 15,
      pnl: tradeResult.pnl !== undefined ? tradeResult.pnl : 0.0,
      status: tradeResult.status || 'CLOSED',
      rationale: orderParams.rationale || tradeResult.rationale || 'Fib 0.618 Support + PCR Z-Score Confluence'
    });

    res.json({
      success: true,
      message: 'Simulated Paper Trade Executed Successfully',
      trade: tradeResult
    });
  } catch (error) {
    console.error('❌ Paper trade execution failed:', error.message);
    res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/oms/mode
 * Toggles OMS adapter mode (PAPER vs LIVE)
 */
router.post('/oms/mode', async (req, res) => {
  try {
    const { mode } = req.body;
    if (!['PAPER', 'LIVE'].includes(mode)) {
      return res.status(400).json({ success: false, message: 'Invalid OMS mode. Use PAPER or LIVE.' });
    }
    omsFactory.setMode(mode);
    console.log(`✅ OMS Mode updated to: ${mode}`);
    res.json({ success: true, mode });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/paper/summary
 * Returns portfolio summary from Layer 4 OMSAdapter merged with Weekly Audit Logger
 */
router.get('/paper/summary', async (req, res) => {
  try {
    const omsAdapter = omsFactory.getAdapter();
    const summary = await omsAdapter.getPositions();
    const auditLog = weeklyAuditLogger.loadLog();
    const auditSummary = auditLog.weeklySummary || {};

    const mergedSummary = {
      initialCapital: summary.initialCapital || 100000,
      currentBalance: auditSummary.netRealizedPnL !== undefined ? (100000 + auditSummary.netRealizedPnL) : (summary.currentBalance || 100000),
      activePositionsCount: summary.activePositionsCount || 0,
      completedTradesCount: auditSummary.totalTradesExecuted || 0,
      winRatePct: auditSummary.winRatePct !== undefined ? auditSummary.winRatePct : (summary.winRatePct || 0.0),
      totalRealizedPnL: auditSummary.netRealizedPnL !== undefined ? auditSummary.netRealizedPnL : (summary.totalRealizedPnL || 0.0),
      activePositions: summary.activePositions || [],
      tradeHistory: auditLog.trades || []
    };

    res.json({
      success: true,
      data: mergedSummary
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/paper/weekly-audit/download
 * Export weekly audit report in CSV or JSON format (MUST BE BEFORE /api/paper/weekly-audit)
 */
router.get('/paper/weekly-audit/download', async (req, res) => {
  try {
    const format = (req.query.format || 'json').toLowerCase();
    const log = weeklyAuditLogger.loadLog();

    if (format === 'csv') {
      let csv = 'Timestamp (IST),Order ID,Contract,Option Type,Strike Price,Entry Price,Exit Price,PNL,Status,Rationale\n';
      const trades = log.trades || [];
      trades.forEach(t => {
        const istDate = new Date(t.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
        csv += `"${istDate}","${t.id}","${t.symbol}","${t.optionType}","${t.strikePrice}","${t.entryPrice}","${t.exitPrice || ''}","${t.pnl || 0}","${t.status}","${(t.rationale || '').replace(/"/g, '""')}"\n`;
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="weekly_audit_report.csv"');
      return res.send(csv);
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="weekly_audit_report.json"');
    res.send(JSON.stringify(log, null, 2));
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/paper/weekly-audit
 * Returns complete 7-day simulation audit log for weekend review
 */
router.get('/paper/weekly-audit', async (req, res) => {
  try {
    const log = weeklyAuditLogger.loadLog();
    res.json({
      success: true,
      data: log
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/quant/settings
 * Saves risk settings & capital allocation preferences to disk
 */
router.post('/quant/settings', async (req, res) => {
  try {
    const settings = req.body;
    fs.mkdirSync(path.dirname(SETTINGS_FILE_PATH), { recursive: true });
    fs.writeFileSync(SETTINGS_FILE_PATH, JSON.stringify(settings, null, 2), 'utf8');
    console.log('✅ Risk settings persisted to disk:', settings);
    res.json({
      success: true,
      message: 'Risk settings saved successfully',
      settings
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
