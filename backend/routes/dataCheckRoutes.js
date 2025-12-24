// backend/routes/dataCheckRoutes.js
const express = require("express");
const router = express.Router();
const { requireAuth } = require("../middleware/authMiddleware");
const { 
  checkDataAvailability, 
  checkSpecificData,
  generateAvailabilityMatrix,
  analyzeBestIntervals 
} = require("../utils/dataChecker");
const { SYMBOL_TOKEN_MAP, INDICES_INSTRUMENTS } = require("../config/constants");

/**
 * Check data availability for all symbols and intervals
 * POST /api/check-data-availability
 */
router.post("/check-data-availability", requireAuth, async (req, res) => {
  try {
    const dashboard = req.dashboard;
    
    console.log("\n🔍 Starting comprehensive data availability check...\n");
    
    // Run the comprehensive check
    const results = await checkDataAvailability(dashboard);
    
    // Generate the matrix view
    generateAvailabilityMatrix(results);
    
    // Analyze best intervals
    const intervalAnalysis = analyzeBestIntervals(results);
    
    res.json({ 
      success: true, 
      data: results,
      intervalAnalysis,
      message: "Data availability check completed. Check server logs for detailed output."
    });
  } catch (error) {
    console.error("❌ Error checking data availability:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

/**
 * Check specific symbol data
 * POST /api/check-specific-data
 * Body: { symbol: "HDFCBANK", interval: "ONE_MINUTE" }
 */
router.post("/check-specific-data", requireAuth, async (req, res) => {
  try {
    const dashboard = req.dashboard;
    const { symbol, interval } = req.body;
    
    if (!symbol || !interval) {
      return res.status(400).json({
        success: false,
        message: "Symbol and interval are required"
      });
    }
    
    // Check if it's a bank or index
    let exchange, token;
    
    if (SYMBOL_TOKEN_MAP[symbol]) {
      exchange = "NSE";
      token = SYMBOL_TOKEN_MAP[symbol];
    } else if (INDICES_INSTRUMENTS[symbol]) {
      exchange = INDICES_INSTRUMENTS[symbol].exchange;
      token = INDICES_INSTRUMENTS[symbol].token;
    } else {
      return res.status(404).json({
        success: false,
        message: "Symbol not found"
      });
    }
    
    await checkSpecificData(dashboard, exchange, token, symbol, interval);
    
    // Get the actual data to return
    const response = await dashboard.getCandleData(exchange, token, interval);
    
    res.json({
      success: true,
      data: response,
      message: "Check server logs for detailed output"
    });
  } catch (error) {
    console.error("❌ Error checking specific data:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

/**
 * Quick health check - tests one symbol per interval
 * POST /api/quick-data-check
 */
router.post("/quick-data-check", requireAuth, async (req, res) => {
  try {
    const dashboard = req.dashboard;
    const testSymbol = "HDFCBANK";
    const testToken = SYMBOL_TOKEN_MAP[testSymbol];
    
    console.log("\n⚡ QUICK DATA CHECK");
    console.log("=".repeat(60));
    console.log(`Testing ${testSymbol} across all intervals\n`);
    
    const results = {};
    
    for (const interval of ["ONE_MINUTE", "THREE_MINUTE", "FIVE_MINUTE", "FIFTEEN_MINUTE", "THIRTY_MINUTE", "ONE_HOUR"]) {
      const response = await dashboard.getCandleData("NSE", testToken, interval);
      
      if (response.status && response.data && response.data.length > 0) {
        results[interval] = {
          status: "✅ SUCCESS",
          candleCount: response.data.length,
          latestPrice: response.data[response.data.length - 1][4].toFixed(2)
        };
        console.log(`✅ ${interval.padEnd(20)} - ${response.data.length} candles - LTP: ₹${results[interval].latestPrice}`);
      } else {
        results[interval] = {
          status: "❌ NO DATA",
          candleCount: 0,
          latestPrice: null
        };
        console.log(`❌ ${interval.padEnd(20)} - NO DATA`);
      }
    }
    
    console.log("=".repeat(60) + "\n");
    
    res.json({
      success: true,
      data: results,
      testSymbol
    });
  } catch (error) {
    console.error("❌ Error in quick data check:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

module.exports = router;