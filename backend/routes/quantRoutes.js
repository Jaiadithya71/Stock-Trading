// ============================================================================
// FILE: backend/routes/quantRoutes.js
// Express API Routes for Quant Signals & Layer 4 OMS Adapter Integration
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
      { spotPrice: 57491.10 },
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
      message: 'Order executed successfully via OMSAdapter',
      data: tradeResult
    });
  } catch (error) {
    console.error('❌ Error executing order:', error.message);
    res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/paper/summary
 * Returns portfolio summary via Layer 4 OMSAdapter
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
 * POST /api/oms/mode
 * Toggles active OMS execution mode (PAPER_SIMULATION vs LIVE_SMARTAPI)
 */
router.post('/oms/mode', (req, res) => {
  try {
    const { mode } = req.body;
    omsFactory.setMode(mode);
    res.json({
      success: true,
      activeMode: omsFactory.activeMode
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

module.exports = router;
