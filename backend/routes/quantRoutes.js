// ============================================================================
// FILE: backend/routes/quantRoutes.js
// Express API Routes for Quant Signals & Layer 4 OMS Adapter Integration
// Real-time market telemetry integration for dynamic spot price & stock breadth
// Persistent storage for user risk settings & weekly simulation audit logger
// Includes CSV & JSON export functionality for weekend performance reviews
// ============================================================================

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const PCRStorageService = require('../services/pcrStorageService');
const signalEngine = require('../services/signalEngine');
const weeklyAuditLogger = require('../services/weeklyAuditLogger');
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
 * POST /api/paper/trade
 * Places order via Layer 4 OMSAdapter and logs event in weekly simulation logger
 */
router.post('/paper/trade', async (req, res) => {
  try {
    const orderParams = req.body;
    const omsAdapter = omsFactory.getAdapter();
    const tradeResult = await omsAdapter.executeOrder(orderParams);
    
    weeklyAuditLogger.logTradeEvent({
      id: tradeResult.orderId || tradeResult.id || `PAPER-${Date.now()}`,
      symbol: orderParams.symbol || 'BANKNIFTY 57500 CE',
      optionType: orderParams.optionType || 'CE',
      strikePrice: orderParams.strikePrice || 57500,
      entryPrice: orderParams.entryPrice || 280,
      quantity: orderParams.quantity || 15,
      status: 'OPEN'
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
 * GET /api/paper/summary
 * Returns portfolio summary from Layer 4 OMSAdapter
 */
router.get('/paper/summary', async (req, res) => {
  try {
    const omsAdapter = omsFactory.getAdapter();
    const summary = await omsAdapter.getPositions();
    
    res.json({
      success: true,
      data: summary
    });
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
 * GET /api/paper/weekly-audit/download
 * Exports weekly audit log as downloadable CSV or JSON file attachment
 */
router.get('/paper/weekly-audit/download', async (req, res) => {
  try {
    const format = (req.query.format || 'csv').toLowerCase();
    const log = weeklyAuditLogger.loadLog();
    const trades = log.trades || [];

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="BankNifty_Weekly_Audit_Report.json"');
      return res.send(JSON.stringify(log, null, 2));
    }

    // Default CSV Export
    let csv = 'Timestamp,Order_ID,Symbol,Option_Type,Strike_Price,Entry_Price,Quantity,Status\n';
    trades.forEach(t => {
      csv += `"${t.timestamp || ''}","${t.id || ''}","${t.symbol || ''}","${t.optionType || ''}",${t.strikePrice || 0},${t.entryPrice || 0},${t.quantity || 0},"${t.status || 'OPEN'}"\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="BankNifty_Weekly_Audit_Report.csv"');
    return res.send(csv);
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
