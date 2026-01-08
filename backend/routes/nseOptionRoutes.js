// backend/routes/nseOptionRoutes.js - NSE Option Chain Routes with SmartAPI Expiry Dates
const express = require("express");
const router = express.Router();
const NSEApiFetcher = require("../services/nseApiFetcher");
const InstrumentFetcher = require("../services/instrumentFetcher");

// Create shared instances
const nseFetcher = new NSEApiFetcher();
const instrumentFetcher = new InstrumentFetcher();

// Cache for expiry dates (to avoid repeated API calls)
const expiryCache = {
  data: {},
  lastFetched: null,
  CACHE_DURATION: 60 * 60 * 1000 // 1 hour cache
};

// Supported indices
const SUPPORTED_INDICES = [
  { symbol: "BANKNIFTY", name: "Bank Nifty", nseSymbol: "BANKNIFTY" },
  { symbol: "NIFTY", name: "Nifty 50", nseSymbol: "NIFTY" },
  { symbol: "FINNIFTY", name: "Fin Nifty", nseSymbol: "FINNIFTY" },
  { symbol: "MIDCPNIFTY", name: "Midcap Nifty", nseSymbol: "MIDCPNIFTY" }
];

/**
 * Get available symbols for option chain
 */
router.get("/nse-symbols", (req, res) => {
  res.json({
    success: true,
    data: SUPPORTED_INDICES.map(i => ({
      symbol: i.symbol,
      name: i.name
    }))
  });
});

/**
 * Get expiry dates for a symbol from Angel One's OpenAPIScripMaster
 */
router.get("/nse-expiry-dates", async (req, res) => {
  const { symbol } = req.query;
  const targetSymbol = symbol || "BANKNIFTY";

  console.log(`\n📅 Fetching expiry dates for ${targetSymbol} from SmartAPI...`);

  try {
    // Check cache first
    const now = Date.now();
    if (expiryCache.data[targetSymbol] &&
        expiryCache.lastFetched &&
        (now - expiryCache.lastFetched) < expiryCache.CACHE_DURATION) {
      console.log(`✅ Using cached expiry dates for ${targetSymbol}`);
      return res.json({
        success: true,
        symbol: targetSymbol,
        data: expiryCache.data[targetSymbol],
        source: "cache"
      });
    }

    // Fetch from Angel One's OpenAPIScripMaster
    const expiryDates = await instrumentFetcher.getExpiryDates(targetSymbol);

    if (expiryDates && expiryDates.length > 0) {
      // Update cache
      expiryCache.data[targetSymbol] = expiryDates;
      expiryCache.lastFetched = now;

      console.log(`✅ Found ${expiryDates.length} expiry dates for ${targetSymbol}`);
      console.log(`   First 5: ${expiryDates.slice(0, 5).join(", ")}`);

      res.json({
        success: true,
        symbol: targetSymbol,
        data: expiryDates,
        source: "smartapi"
      });
    } else {
      throw new Error("No expiry dates found");
    }
  } catch (error) {
    console.error(`❌ Error fetching expiry dates: ${error.message}`);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * Get all expiry dates for all supported indices
 */
router.get("/nse-all-expiries", async (req, res) => {
  console.log(`\n📅 Fetching expiry dates for ALL indices...`);

  try {
    const allExpiries = {};

    for (const index of SUPPORTED_INDICES) {
      try {
        const expiries = await instrumentFetcher.getExpiryDates(index.symbol);
        allExpiries[index.symbol] = {
          name: index.name,
          expiries: expiries || []
        };
        console.log(`   ✅ ${index.symbol}: ${expiries?.length || 0} expiries`);
      } catch (err) {
        console.log(`   ❌ ${index.symbol}: Failed`);
        allExpiries[index.symbol] = {
          name: index.name,
          expiries: [],
          error: err.message
        };
      }
    }

    res.json({
      success: true,
      data: allExpiries
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * Get option chain data from NSE
 */
router.get("/nse-option-chain", async (req, res) => {
  const { symbol, expiry } = req.query;
  const targetSymbol = symbol || "BANKNIFTY";

  console.log("\n========================================");
  console.log(`📊 NSE OPTION CHAIN REQUEST`);
  console.log(`   Symbol: ${targetSymbol}`);
  console.log(`   Expiry: ${expiry || 'Not specified'}`);
  console.log("========================================");

  try {
    // Get expiry dates from SmartAPI if not provided
    let targetExpiry = expiry;
    let expiryDates = [];

    if (!targetExpiry) {
      console.log(`   Fetching expiry dates from SmartAPI...`);
      expiryDates = await instrumentFetcher.getExpiryDates(targetSymbol);

      if (expiryDates && expiryDates.length > 0) {
        targetExpiry = expiryDates[0]; // Use nearest expiry
        console.log(`   Using nearest expiry: ${targetExpiry}`);
      } else {
        throw new Error("No expiry dates available");
      }
    } else {
      // Still fetch expiry dates for the dropdown
      expiryDates = await instrumentFetcher.getExpiryDates(targetSymbol);
    }

    // Fetch option chain from NSE
    console.log(`   Fetching option chain from NSE...`);
    const optionChain = await nseFetcher.getOptionChain(targetSymbol, targetExpiry);

    if (!optionChain) {
      throw new Error("Failed to fetch option chain from NSE");
    }

    // Format response
    const response = {
      success: true,
      data: {
        symbol: targetSymbol,
        expiry: targetExpiry,
        underlyingValue: optionChain.underlyingValue,
        timestamp: optionChain.timestamp,
        expiryDates: expiryDates,
        strikes: optionChain.strikes,
        strikeCount: Object.keys(optionChain.strikes).length
      }
    };

    console.log(`✅ Returning ${response.data.strikeCount} strikes`);
    console.log(`   Underlying: ₹${optionChain.underlyingValue}`);
    console.log("========================================\n");

    res.json(response);

  } catch (error) {
    console.error(`❌ NSE Option Chain Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch option chain"
    });
  }
});

/**
 * Refresh instruments cache (force download from Angel One)
 */
router.post("/nse-refresh-instruments", async (req, res) => {
  console.log("🔄 Refreshing instruments cache...");

  try {
    // Clear cache
    instrumentFetcher.clearCache();
    expiryCache.data = {};
    expiryCache.lastFetched = null;

    // Download fresh instruments
    await instrumentFetcher.downloadInstruments();

    res.json({
      success: true,
      message: "Instruments cache refreshed"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * Clear all caches
 */
router.post("/nse-clear-cache", (req, res) => {
  nseFetcher.clearSession();
  instrumentFetcher.clearCache();
  expiryCache.data = {};
  expiryCache.lastFetched = null;

  console.log("🗑️  All NSE caches cleared");

  res.json({
    success: true,
    message: "All caches cleared"
  });
});

/**
 * Get cache status
 */
router.get("/nse-cache-status", (req, res) => {
  const instrumentsCacheValid = instrumentFetcher.isCacheValid();
  const expiryCacheAge = expiryCache.lastFetched
    ? Math.round((Date.now() - expiryCache.lastFetched) / 1000 / 60)
    : null;

  res.json({
    success: true,
    data: {
      instrumentsCache: {
        valid: instrumentsCacheValid,
        file: instrumentFetcher.instrumentsFile
      },
      expiryCache: {
        symbols: Object.keys(expiryCache.data),
        ageMinutes: expiryCacheAge,
        maxAgeMinutes: expiryCache.CACHE_DURATION / 1000 / 60
      },
      nseSession: {
        initialized: nseFetcher.sessionInitialized,
        hasCookies: !!nseFetcher.cookies
      }
    }
  });
});

module.exports = router;
