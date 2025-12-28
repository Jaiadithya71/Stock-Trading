// backend/routes/dataRoutes.js - OPTIMIZED VERSION WITH PARALLEL FETCHING
const express = require("express");
const router = express.Router();
const { requireAuth } = require("../middleware/authMiddleware");
const { SYMBOL_TOKEN_MAP, INDICES_INSTRUMENTS, TIME_INTERVALS } = require("../config/constants");
const { isMarketOpen } = require("../utils/dateHelpers");

/**
 * Get Bank Nifty data with PARALLEL fetching
 * FIXED: Uses Promise.all instead of sequential loops
 */
router.post("/banknifty-data", requireAuth, async (req, res) => {
  const dashboard = req.dashboard;
  const fetchTime = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  
  console.log("\n========================================");
  console.log(`📊 FETCHING BANK NIFTY DATA at ${fetchTime}`);
  console.log(`🔄 Mode: PARALLEL (fast)`);
  console.log("========================================");
  
  const marketOpenNow = isMarketOpen();
  const preferredInterval = marketOpenNow ? "ONE_MINUTE" : "ONE_HOUR";
  
  console.log(`📊 Market Status: ${marketOpenNow ? '🟢 OPEN' : '🔴 CLOSED'}`);
  console.log(`⏱️  Using interval: ${preferredInterval}`);
  
  // PARALLEL FETCH: All banks at once
  const bankPromises = Object.entries(SYMBOL_TOKEN_MAP).map(async ([symbol, token]) => {
    try {
      const response = await dashboard.getCandleDataWithFallback("NSE", token, preferredInterval);
      
      if (response.status && response.data && response.data.length > 0) {
        const latestCandle = response.data[response.data.length - 1];
        const ltp = latestCandle[4];
        const volume = latestCandle[5];
        const changePercent = ((latestCandle[4] - latestCandle[1]) / latestCandle[1]) * 100;
        const status = dashboard.getStatus(symbol, latestCandle[4]);
        
        console.log(`   ✅ ${symbol}: ₹${ltp.toFixed(2)}`);
        
        return {
          bank: symbol,
          ltp: ltp.toFixed(2),
          volume,
          changePercent: changePercent.toFixed(2),
          status,
          interval: preferredInterval,
          timestamp: latestCandle[0],
          fetchedAt: new Date().toISOString()
        };
      } else {
        console.log(`   ❌ ${symbol}: No data`);
        return {
          bank: symbol,
          ltp: null,
          volume: null,
          changePercent: null,
          status: "No Data",
          interval: null,
          timestamp: null,
          fetchedAt: new Date().toISOString()
        };
      }
    } catch (error) {
      console.log(`   ⚠️  ${symbol}: ${error.message}`);
      return {
        bank: symbol,
        ltp: null,
        volume: null,
        changePercent: null,
        status: "Error",
        interval: null,
        timestamp: null,
        fetchedAt: new Date().toISOString(),
        error: error.message
      };
    }
  });
  
  // Wait for all banks (with timeout)
  const results = await Promise.race([
    Promise.all(bankPromises),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Batch fetch timeout')), 15000)
    )
  ]).catch(error => {
    console.error('❌ Batch fetch failed:', error.message);
    // Return partial results
    return Object.keys(SYMBOL_TOKEN_MAP).map(symbol => ({
      bank: symbol,
      ltp: null,
      volume: null,
      changePercent: null,
      status: "Timeout",
      interval: null,
      timestamp: null,
      fetchedAt: new Date().toISOString()
    }));
  });
  
  const successCount = results.filter(r => r.ltp !== null).length;
  console.log(`✅ COMPLETED: ${successCount}/${results.length} banks (${((successCount/results.length)*100).toFixed(1)}%)`);
  console.log("========================================\n");
  
  res.json({ 
    success: true, 
    data: results,
    meta: {
      totalBanks: results.length,
      banksWithData: successCount,
      successRate: ((successCount/results.length)*100).toFixed(1) + '%',
      fetchedAt: new Date().toISOString(),
      marketStatus: marketOpenNow ? 'OPEN' : 'CLOSED',
      intervalUsed: preferredInterval
    }
  });
});

/**
 * Get indices data with PARALLEL fetching and smart intervals
 * FIXED: Skips unnecessary fallback attempts
 */
router.post("/indices-data", requireAuth, async (req, res) => {
  const dashboard = req.dashboard;
  const fetchTime = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  
  console.log("\n========================================");
  console.log(`📈 FETCHING INDICES DATA at ${fetchTime}`);
  console.log("========================================");
  
  const marketOpenNow = isMarketOpen();
  const results = {};
  
  // PARALLEL FETCH: All indices at once
  const indicesPromises = Object.entries(INDICES_INSTRUMENTS).map(async ([symbol, info]) => {
    console.log(`\n📊 Fetching ${symbol}...`);
    const indexResults = { ltp: null, ltpInterval: null, ltpTimestamp: null };
    
    // Get LTP with smart fallback
    const ltpInterval = marketOpenNow ? "ONE_MINUTE" : "ONE_HOUR";
    const ltpResponse = await dashboard.getCandleDataWithFallback(info.exchange, info.token, ltpInterval);
    
    if (ltpResponse.status && ltpResponse.data && ltpResponse.data.length > 0) {
      const latestCandle = ltpResponse.data[ltpResponse.data.length - 1];
      indexResults.ltp = latestCandle[4].toFixed(2);
      indexResults.ltpInterval = ltpInterval;
      indexResults.ltpTimestamp = latestCandle[0];
      console.log(`   LTP: ₹${indexResults.ltp} [${ltpInterval}]`);
    } else {
      console.log(`   LTP: No data`);
    }
    
    // Get sentiment for ONLY essential intervals (not all 6!)
    const essentialIntervals = marketOpenNow 
      ? ["ONE_MINUTE", "FIVE_MINUTE", "FIFTEEN_MINUTE", "ONE_HOUR"]
      : ["FIFTEEN_MINUTE", "ONE_HOUR"];
    
    // Fetch sentiments in parallel
    const sentimentPromises = essentialIntervals.map(async (interval) => {
      const response = await dashboard.getCandleData(info.exchange, info.token, interval);
      
      if (response.status && response.data && response.data.length > 0) {
        const candle = response.data[response.data.length - 1];
        const sentiment = dashboard.getSentiment(symbol + "_" + interval, candle[4]);
        return { interval, sentiment, timestamp: candle[0] };
      }
      return { interval, sentiment: "Neutral", timestamp: null };
    });
    
    const sentiments = await Promise.all(sentimentPromises);
    
    // Map sentiments to result
    sentiments.forEach(({ interval, sentiment, timestamp }) => {
      indexResults[interval] = sentiment;
      indexResults[interval + '_timestamp'] = timestamp;
    });
    
    // Fill missing intervals with "Neutral"
    TIME_INTERVALS.forEach(interval => {
      if (!indexResults[interval]) {
        indexResults[interval] = "Neutral";
        indexResults[interval + '_timestamp'] = null;
      }
    });
    
    indexResults.fetchedAt = new Date().toISOString();
    
    return { symbol, data: indexResults };
  });
  
  // Wait for all indices
  const indicesData = await Promise.all(indicesPromises);
  
  // Convert to object format
  indicesData.forEach(({ symbol, data }) => {
    results[symbol] = data;
  });
  
  console.log("\n========================================");
  console.log(`✅ COMPLETED: Fetched indices data`);
  console.log("========================================\n");
  
  res.json({ 
    success: true, 
    data: results,
    meta: {
      fetchedAt: new Date().toISOString(),
      marketStatus: marketOpenNow ? 'OPEN' : 'CLOSED'
    }
  });
});

module.exports = router;