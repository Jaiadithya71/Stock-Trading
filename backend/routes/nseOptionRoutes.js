// backend/routes/nseOptionRoutes.js - COMPLETE WITH INSTRUMENT FETCHER
const express = require("express");
const router = express.Router();
const NSEApiFetcher = require("../services/nseApiFetcher");
const InstrumentFetcher = require("../services/instrumentFetcher");

// Create singleton instances
const nseApiFetcher = new NSEApiFetcher();
const instrumentFetcher = new InstrumentFetcher();

/**
 * GET available symbols
 * GET /api/nse-symbols
 */
router.get("/nse-symbols", (req, res) => {
  try {
    const symbols = nseApiFetcher.getAvailableSymbols();
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
 * GET /api/nse-expiry-dates?symbol=BANKNIFTY
 */
router.get("/nse-expiry-dates", async (req, res) => {
  try {
    const { symbol = 'BANKNIFTY' } = req.query;
    
    console.log(`\n📅 Fetching expiry dates for ${symbol}...`);
    
    const expiryDates = await instrumentFetcher.getExpiryDates(symbol);
    
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
    console.error("❌ Error fetching expiry dates:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * GET option chain data from NSE
 * GET /api/nse-option-chain?symbol=BANKNIFTY&expiry=30-Dec-2025
 */
router.get("/nse-option-chain", async (req, res) => {
  try {
    const { symbol = 'BANKNIFTY', expiry } = req.query;
    
    console.log(`\n📊 NSE Option Chain Request:`);
    console.log(`   Symbol: ${symbol}`);
    console.log(`   Expiry: ${expiry || 'not specified'}`);
    
    // If no expiry specified, get the nearest one
    let selectedExpiry = expiry;
    let allExpiryDates = [];
    
    if (!selectedExpiry) {
      console.log('⚠️  No expiry specified, fetching expiry dates...');
      allExpiryDates = await instrumentFetcher.getExpiryDates(symbol);
      
      if (allExpiryDates.length === 0) {
        return res.status(500).json({
          success: false,
          message: "No expiry dates available for this symbol"
        });
      }
      
      selectedExpiry = allExpiryDates[0];
      console.log(`✅ Using nearest expiry: ${selectedExpiry}`);
    } else {
      // Still fetch all expiries for the dropdown
      allExpiryDates = await instrumentFetcher.getExpiryDates(symbol);
    }
    
    // Fetch option chain from NSE
    const optionChain = await nseApiFetcher.getOptionChain(symbol, selectedExpiry);
    
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
    
    console.log(`✅ Option chain processed successfully`);
    console.log(`   Strikes: ${strikesArray.length}`);
    console.log(`   Expiry Dates: ${allExpiryDates.length}`);
    console.log(`   Selected Expiry: ${selectedExpiry}`);
    
    res.json({
      success: true,
      data: {
        symbol: optionChain.symbol,
        displayName: symbol,
        spotPrice: optionChain.underlyingValue,
        timestamp: optionChain.timestamp,
        expiryDates: allExpiryDates,
        selectedExpiry: selectedExpiry,
        optionChain: strikesArray,
        atmStrike,
        dataSource: 'NSE'
      }
    });
    
  } catch (error) {
    console.error("❌ Error in NSE option chain route:", error);
    console.error("Stack trace:", error.stack);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * Clear instruments cache
 * POST /api/nse-clear-cache
 */
router.post("/nse-clear-cache", (req, res) => {
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

module.exports = router;
