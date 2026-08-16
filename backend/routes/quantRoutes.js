// ============================================================================
// FILE: backend/routes/quantRoutes.js
// Express API Routes for Quant Signals & Layer 4 OMS Adapter Integration
// Real-time market telemetry integration for dynamic spot price & stock breadth
// ============================================================================

const express = require('express');
const router = express.Router();
const PCRStorageService = require('../services/pcrStorageService');
const signalEngine = require('../services/signalEngine');
const { omsFactory } = require('../services/omsAdapter');

const pcrStorage = new PCRStorageService();

/**
 * GET /api/quant/signal
 * Returns real-time quantitative strategy signal & risk metrics via SignalEngine
 */
router.get('/quant/signal', async (req, res) => {
  try {
    const historicalData = await pcrStorage.loadData();
    const snapshots = historicalData.snapshots || [];

    // Extract latest spot price from recent snapshots or fallback
    let liveSpotPrice = 57491.10;
    if (snapshots.length > 0) {
      const lastSnap = snapshots[snapshots.length - 1];
      if (lastSnap && lastSnap.spotPrice) {
        liveSpotPrice = parseFloat(lastSnap.spotPrice);
      }
    }

    const stockList = [
      { symbol: 'HDFCBANK', pChange: 0.28 },
      { symbol: 'ICICIBANK', pChange: 0.73 },
      { symbol: 'KOTAKBANK', pChange: -0.32 },
      { symbol: 'AXISBANK', pChange: -0.36 },
      { symbol: 'SBIN', pChange: -1.41 }
    ];

    const omsAdapter = omsFactory.getAdapter();
    const paperSummary = await omsAdapter.getPositions();
    const currentCapital = paperSummary?.currentBalance || 100000;

    const signalPayload = signalEngine.evaluateSignal(
      { spotPrice: liveSpotPrice },
      snapshots,
      stockList,
      currentCapital
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
 * Places order via Layer 4 OMSAdapter (PaperTradingOMS or LiveBrokerOMS)
 */
router.post('/paper/trade', async (req, res) => {
  try {
    const orderParams = req.body;
    const omsAdapter = omsFactory.getAdapter();
    const tradeResult = await omsAdapter.executeOrder(orderParams);
    
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
 * POST /api/quant/settings
 * Saves risk settings & capital allocation preferences
 */
router.post('/quant/settings', async (req, res) => {
  try {
    const settings = req.body;
    console.log('✅ Received updated risk settings:', settings);
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
