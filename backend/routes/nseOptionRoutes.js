// backend/routes/nseOptionRoutes.js - NON-BLOCKING VERSION
const express = require("express");
const router = express.Router();
const NSEApiFetcher = require("../services/nseApiFetcher");
const InstrumentFetcher = require("../services/instrumentFetcher");

// Create singleton instances
const nseApiFetcher = new NSEApiFetcher();
const instrumentFetcher = new InstrumentFetcher();

// Cache for option chain data (prevents repeated NSE calls)
const optionChainCache = new Map();
const CACHE_DURATION = 60000; // 1 minute cache

/**
 * GET available symbols
 */
router.get("/nse-symbols", (req, res) => {
  try {
    const symbols = ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY'];
    res.json({
      success: true,
      data: symbols
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * GET expiry dates for a symbol from Angel One instruments
 */
router.get("/nse-expiry-dates", async (req, res) => {
  try {
    const { symbol = 'BANKNIFTY' } = req.query;
    
    console.log(`\n📅 Fetching expiry dates for ${symbol}...`);
    
    // Set timeout for this operation
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Expiry fetch timeout')), 5000)
    );
    
    const fetchPromise = instrumentFetcher.getExpiryDates(symbol);
    
    const expiryDates = await Promise.race([fetchPromise, timeoutPromise]);
    
    console.log(`✅ Returning ${expiryDates.length} expiry dates`);
    
    res.json({
      success: true,
      data: {
        symbol,
        expiryDates: expiryDates,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error("❌ Error fetching expiry dates:", error.message);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * GET option chain data from NSE
 * NON-BLOCKING: Uses proper async/await with timeout
 */
router.get("/nse-option-chain", async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { symbol = 'BANKNIFTY', expiry } = req.query;
    
    console.log(`\n📊 NSE Option Chain Request:`);
    console.log(`   Symbol: ${symbol}`);
    console.log(`   Expiry: ${expiry || 'not specified'}`);
    
    // Check cache first
    const cacheKey = `${symbol}_${expiry}`;
    const cached = optionChainCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log(`✅ Returning cached option chain (${Date.now() - startTime}ms)`);
      return res.json({
        success: true,
        data: {
          ...cached.data,
          cached: true
        }
      });
    }
    
    // Get expiry if not specified
    let selectedExpiry = expiry;
    let allExpiryDates = [];
    
    if (!selectedExpiry) {
      console.log('⚠️  No expiry specified, fetching expiry dates...');
      
      // Fetch expiries with timeout
      const expiryPromise = instrumentFetcher.getExpiryDates(symbol);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Expiry fetch timeout')), 5000)
      );
      
      allExpiryDates = await Promise.race([expiryPromise, timeoutPromise]);
      
      if (allExpiryDates.length === 0) {
        return res.status(500).json({
          success: false,
          message: "No expiry dates available for this symbol"
        });
      }
      
      selectedExpiry = allExpiryDates[0];
      console.log(`✅ Using nearest expiry: ${selectedExpiry}`);
    } else {
      // Still fetch all expiries for dropdown
      allExpiryDates = await instrumentFetcher.getExpiryDates(symbol)
        .catch(() => [selectedExpiry]); // Fallback to just the selected expiry
    }
    
    // Fetch option chain from NSE with timeout
    console.log(`⏳ Fetching option chain (timeout: 20s)...`);
    
    const fetchPromise = nseApiFetcher.getOptionChain(symbol, selectedExpiry);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Option chain fetch timeout (20s)')), 20000)
    );
    
    const optionChain = await Promise.race([fetchPromise, timeoutPromise]);
    
    if (!optionChain) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch option chain from NSE"
      });
    }
    
    // Calculate ATM strike
    const atmStrike = Math.round(optionChain.underlyingValue / 100) * 100;
    
    // Convert strikes object to array and sort
    const strikesArray = Object.keys(optionChain.strikes)
      .map(Number)
      .sort((a, b) => a - b)
      .map(strike => ({
        strike,
        isATM: strike === atmStrike,
        call: optionChain.strikes[strike].CE || null,
        put: optionChain.strikes[strike].PE || null
      }));
    
    const responseData = {
      symbol: optionChain.symbol,
      displayName: symbol,
      spotPrice: optionChain.underlyingValue,
      timestamp: optionChain.timestamp,
      expiryDates: allExpiryDates,
      selectedExpiry: selectedExpiry,
      optionChain: strikesArray,
      atmStrike,
      dataSource: 'NSE',
      fetchTime: Date.now() - startTime
    };
    
    // Cache the result
    optionChainCache.set(cacheKey, {
      data: responseData,
      timestamp: Date.now()
    });
    
    console.log(`✅ Option chain processed successfully (${Date.now() - startTime}ms)`);
    console.log(`   Strikes: ${strikesArray.length}`);
    console.log(`   Expiry Dates: ${allExpiryDates.length}`);
    console.log(`   Selected Expiry: ${selectedExpiry}`);
    
    res.json({
      success: true,
      data: responseData
    });
    
  } catch (error) {
    const elapsed = Date.now() - startTime;
    
    if (error.message.includes('timeout')) {
      console.error(`⏱️  Option chain request timed out after ${elapsed}ms`);
      return res.status(504).json({
        success: false,
        message: "Request timed out. NSE server is slow or unresponsive.",
        timeout: true,
        elapsed
      });
    }
    
    console.error("❌ Error in NSE option chain route:", error.message);
    console.error("Stack trace:", error.stack);
    res.status(500).json({
      success: false,
      message: error.message,
      elapsed
    });
  }
});

/**
 * Clear option chain cache
 */
router.post("/nse-clear-cache", (req, res) => {
  try {
    const size = optionChainCache.size;
    optionChainCache.clear();
    nseApiFetcher.clearSession();
    
    res.json({
      success: true,
      message: `Cache cleared (${size} entries removed)`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * Clear instruments cache
 */
router.post("/nse-clear-instruments-cache", (req, res) => {
  try {
    instrumentFetcher.clearCache();
    res.json({
      success: true,
      message: "Instruments cache cleared"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Clean up cache periodically (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  
  for (const [key, value] of optionChainCache.entries()) {
    if (now - value.timestamp > CACHE_DURATION) {
      optionChainCache.delete(key);
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    console.log(`🗑️  Cleaned ${cleaned} expired option chain cache entries`);
  }
}, 5 * 60 * 1000);

module.exports = router;