// ============================================================================
// FILE: backend/routes/optionRoutes.js - CREATE THIS NEW FILE
// LOCATION: backend/routes/optionRoutes.js
// ============================================================================

const express = require("express");
const router = express.Router();
const { requireAuth } = require("../middleware/authMiddleware");
const OptionService = require("../services/optionService");

/**
 * GET available expiry dates for a symbol
 * POST /api/option-expiries
 */
router.post("/option-expiries", requireAuth, async (req, res) => {
  try {
    const { symbol } = req.body;
    
    if (!symbol) {
      return res.status(400).json({
        success: false,
        message: "Symbol is required"
      });
    }

    console.log(`\n📅 Fetching expiry dates for ${symbol}...`);
    
    const dashboard = req.dashboard;
    const optionService = new OptionService(dashboard.smart_api);
    
    const expiries = await optionService.getExpiryDates(symbol);
    
    console.log(`✅ Found ${expiries.length} expiry dates`);
    
    res.json({
      success: true,
      data: {
        symbol,
        expiries,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error("❌ Error fetching expiry dates:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * GET complete option chain
 * POST /api/option-chain
 */
router.post("/option-chain", requireAuth, async (req, res) => {
  try {
    const { symbol, expiryDate } = req.body;
    
    if (!symbol || !expiryDate) {
      return res.status(400).json({
        success: false,
        message: "Symbol and expiryDate are required"
      });
    }

    console.log(`\n📊 Fetching option chain for ${symbol} - ${expiryDate}...`);
    
    const dashboard = req.dashboard;
    const optionService = new OptionService(dashboard.smart_api);
    
    const optionChain = await optionService.getOptionChain(symbol, expiryDate);
    
    console.log(`✅ Option chain fetched: ${optionChain.optionChain.length} strikes`);
    
    res.json({
      success: true,
      data: optionChain
    });
    
  } catch (error) {
    console.error("❌ Error fetching option chain:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * GET spot price for a symbol
 * POST /api/option-spot-price
 */
router.post("/option-spot-price", requireAuth, async (req, res) => {
  try {
    const { symbol } = req.body;
    
    if (!symbol) {
      return res.status(400).json({
        success: false,
        message: "Symbol is required"
      });
    }

    const dashboard = req.dashboard;
    const optionService = new OptionService(dashboard.smart_api);
    
    const spotPrice = await optionService.getSpotPrice(symbol);
    
    res.json({
      success: true,
      data: {
        symbol,
        spotPrice,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error("❌ Error fetching spot price:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * Clear option chain cache
 * POST /api/option-clear-cache
 */
router.post("/option-clear-cache", requireAuth, (req, res) => {
  try {
    const dashboard = req.dashboard;
    const optionService = new OptionService(dashboard.smart_api);
    
    optionService.clearCache();
    
    res.json({
      success: true,
      message: "Option chain cache cleared"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;