// backend/routes/pcrRoutes.js
const express = require("express");
const router = express.Router();
const { requireAuth } = require("../middleware/authMiddleware");
const PCRStorageService = require("../services/pcrStorageService");

// Create singleton instance
const pcrStorage = new PCRStorageService();

/**
 * Get historical PCR data with multiple time intervals
 * POST /api/pcr-historical
 */
router.post("/pcr-historical", requireAuth, async (req, res) => {
  try {
    const { symbol = 'BANKNIFTY' } = req.body;
    
    console.log(`\n📊 Fetching historical PCR for ${symbol}...`);
    
    // Get historical data for intervals: 1min, 3min, 5min, 15min
    const historicalData = await pcrStorage.getHistoricalPCR(symbol, [1, 3, 5, 15]);
    
    if (!historicalData) {
      return res.json({
        success: false,
        message: "No PCR data available. Background collector may not be running.",
        data: null
      });
    }
    
    console.log(`✅ Returning PCR data with ${Object.keys(historicalData.intervals).length} intervals`);
    
    res.json({
      success: true,
      data: historicalData
    });
    
  } catch (error) {
    console.error("❌ Error fetching historical PCR:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * Get current PCR snapshot
 * POST /api/pcr-current
 */
router.post("/pcr-current", requireAuth, async (req, res) => {
  try {
    const { symbol = 'BANKNIFTY' } = req.body;
    
    console.log(`\n📊 Fetching current PCR for ${symbol}...`);
    
    const currentSnapshot = await pcrStorage.getLatestSnapshot(symbol);
    
    if (!currentSnapshot) {
      return res.json({
        success: false,
        message: "No current PCR data available",
        data: null
      });
    }
    
    console.log(`✅ Returning current PCR: ${currentSnapshot.pcr}`);
    
    res.json({
      success: true,
      data: currentSnapshot
    });
    
  } catch (error) {
    console.error("❌ Error fetching current PCR:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * Get PCR statistics
 * POST /api/pcr-stats
 */
router.post("/pcr-stats", requireAuth, async (req, res) => {
  try {
    const stats = await pcrStorage.getStats();
    
    res.json({
      success: true,
      data: stats
    });
    
  } catch (error) {
    console.error("❌ Error fetching PCR stats:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * Clear PCR data
 * POST /api/pcr-clear
 */
router.post("/pcr-clear", requireAuth, async (req, res) => {
  try {
    const { symbol } = req.body;
    
    if (symbol) {
      await pcrStorage.clearSymbolData(symbol);
    } else {
      await pcrStorage.clearAllData();
    }
    
    res.json({
      success: true,
      message: symbol ? `PCR data cleared for ${symbol}` : "All PCR data cleared"
    });
    
  } catch (error) {
    console.error("❌ Error clearing PCR data:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;