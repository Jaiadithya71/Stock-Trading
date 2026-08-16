// backend/routes/statusRoute.js
// Add this to your routes to monitor system health
const express = require("express");
const router = express.Router();
const { requireAuth } = require("../middleware/authMiddleware");
const { getMarketStatus } = require("../utils/dateHelpers");

/**
 * Get system and market status
 * GET /api/status
 */
router.get("/status", (req, res) => {
  try {
    const marketStatus = getMarketStatus();
    
    res.json({
      success: true,
      server: {
        status: "running",
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
      },
      market: marketStatus,
      api: {
        version: "1.0.0",
        endpoints: [
          "POST /api/authenticate",
          "POST /api/banknifty-data",
          "POST /api/indices-data",
          "GET /api/status",
          "POST /api/cache-stats"
        ]
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * Get cache statistics
 * POST /api/cache-stats
 */
router.post("/cache-stats", requireAuth, (req, res) => {
  try {
    const dashboard = req.dashboard;
    
    if (dashboard && typeof dashboard.getCacheStats === 'function') {
      const stats = dashboard.getCacheStats();
      res.json({
        success: true,
        cache: stats
      });
    } else {
      res.json({
        success: false,
        message: "Cache stats not available"
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * Clear cache manually
 * POST /api/clear-cache
 */
router.post("/clear-cache", requireAuth, (req, res) => {
  try {
    const dashboard = req.dashboard;
    
    if (dashboard && typeof dashboard.clearCache === 'function') {
      dashboard.clearCache();
      res.json({
        success: true,
        message: "Cache cleared successfully"
      });
    } else {
      res.json({
        success: false,
        message: "Cache clear not available"
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;