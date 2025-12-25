// backend/routes/currencyRoutes.js
const express = require("express");
const router = express.Router();
const { requireAuth } = require("../middleware/authMiddleware");
const currencyService = require("../services/currencyService");

/**
 * Get all currency rates
 * POST /api/currency-rates
 */
router.post("/currency-rates", requireAuth, async (req, res) => {
  try {
    console.log("\n💱 Fetching currency rates...");
    
    const result = await currencyService.fetchCurrencyRates();
    
    if (result.success) {
      const cacheStatus = result.cached ? "(cached)" : "(fresh)";
      const staleStatus = result.stale ? " - STALE" : "";
      console.log(`✅ Currency rates returned ${cacheStatus}${staleStatus}`);
      
      res.json({
        success: true,
        ...result.data,
        meta: {
          cached: result.cached || false,
          stale: result.stale || false,
          error: result.error || null
        }
      });
    } else {
      console.log(`❌ Failed to fetch currency rates: ${result.error}`);
      res.status(500).json({
        success: false,
        message: result.error || "Failed to fetch currency rates"
      });
    }
  } catch (error) {
    console.error("❌ Error in currency-rates route:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * Get specific currency rate
 * POST /api/currency-rate/:code
 */
router.post("/currency-rate/:code", requireAuth, async (req, res) => {
  try {
    const { code } = req.params;
    console.log(`\n💱 Fetching rate for ${code}...`);
    
    const result = await currencyService.getCurrencyRate(code);
    
    if (result.success) {
      console.log(`✅ Rate for ${code} returned`);
      res.json(result);
    } else {
      res.status(404).json(result);
    }
  } catch (error) {
    console.error(`❌ Error fetching ${req.params.code}:`, error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * Clear currency cache
 * POST /api/currency-clear-cache
 */
router.post("/currency-clear-cache", requireAuth, (req, res) => {
  try {
    currencyService.clearCache();
    res.json({
      success: true,
      message: "Currency cache cleared"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * Get currency cache stats
 * POST /api/currency-cache-stats
 */
router.post("/currency-cache-stats", requireAuth, (req, res) => {
  try {
    const stats = currencyService.getCacheStats();
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;