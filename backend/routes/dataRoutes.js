// backend/routes/dataRoutes.js - ENHANCED VERSION WITH TIMESTAMPS
const express = require("express");
const router = express.Router();
const { requireAuth } = require("../middleware/authMiddleware");
const { SYMBOL_TOKEN_MAP, INDICES_INSTRUMENTS, TIME_INTERVALS } = require("../config/constants");

/**
 * Get Bank Nifty data with intelligent fallbacks and timestamps
 */
router.post("/banknifty-data", requireAuth, async (req, res) => {
  const dashboard = req.dashboard;
  const results = [];
  const fetchTime = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  
  console.log("\n========================================");
  console.log(`📊 FETCHING BANK NIFTY DATA at ${fetchTime}`);
  console.log("========================================");
  
  const fallbackIntervals = ["ONE_MINUTE", "FIVE_MINUTE", "FIFTEEN_MINUTE", "ONE_HOUR"];
  
  for (const [symbol, token] of Object.entries(SYMBOL_TOKEN_MAP)) {
    console.log(`\n🏦 Fetching ${symbol} (Token: ${token})...`);
    
    let successfulData = null;
    let usedInterval = null;
    let dataTimestamp = null;
    
    for (const interval of fallbackIntervals) {
      const response = await dashboard.getCandleData("NSE", token, interval);
      
      if (response.status && response.data && response.data.length > 0) {
        successfulData = response.data[response.data.length - 1];
        usedInterval = interval;
        dataTimestamp = successfulData[0]; // Candle timestamp
        break;
      }
      
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    if (successfulData) {
      const ltp = successfulData[4];
      const volume = successfulData[5];
      const changePercent = ((successfulData[4] - successfulData[1]) / successfulData[1]) * 100;
      const status = dashboard.getStatus(symbol, successfulData[4]);
      
      console.log(`   ✅ ${symbol}: LTP=₹${ltp.toFixed(2)}, Volume=${volume}, Change=${changePercent.toFixed(2)}%, Status=${status} [${usedInterval}]`);
      
      results.push({
        bank: symbol,
        ltp: ltp.toFixed(2),
        volume,
        changePercent: changePercent.toFixed(2),
        status,
        interval: usedInterval,
        timestamp: dataTimestamp, // Add data timestamp
        fetchedAt: new Date().toISOString() // Add fetch timestamp
      });
    } else {
      console.log(`   ❌ ${symbol}: No data available (tried all intervals)`);
      results.push({
        bank: symbol,
        ltp: null,
        volume: null,
        changePercent: null,
        status: "No Data",
        interval: null,
        timestamp: null,
        fetchedAt: new Date().toISOString()
      });
    }
  }
  
  console.log("\n========================================");
  const successCount = results.filter(r => r.ltp !== null).length;
  console.log(`✅ COMPLETED: ${successCount}/${results.length} banks have data (${((successCount/results.length)*100).toFixed(1)}%)`);
  console.log("========================================\n");
  
  res.json({ 
    success: true, 
    data: results,
    meta: {
      totalBanks: results.length,
      banksWithData: successCount,
      successRate: ((successCount/results.length)*100).toFixed(1) + '%',
      fetchedAt: new Date().toISOString()
    }
  });
});

/**
 * Get indices data with timestamps
 */
router.post("/indices-data", requireAuth, async (req, res) => {
  const dashboard = req.dashboard;
  const results = {};
  const fetchTime = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  
  console.log("\n========================================");
  console.log(`📈 FETCHING INDICES DATA at ${fetchTime}`);
  console.log("========================================");
  
  for (const [symbol, info] of Object.entries(INDICES_INSTRUMENTS)) {
    console.log(`\n📊 Fetching ${symbol} (Token: ${info.token})...`);
    results[symbol] = {};
    
    // Get LTP with fallback strategy
    let ltpFound = false;
    let ltpTimestamp = null;
    const ltpFallbacks = ["ONE_MINUTE", "FIVE_MINUTE", "FIFTEEN_MINUTE"];
    
    for (const interval of ltpFallbacks) {
      const ltpResponse = await dashboard.getCandleData(info.exchange, info.token, interval);
      
      if (ltpResponse.status && ltpResponse.data && ltpResponse.data.length > 0) {
        const latestCandle = ltpResponse.data[ltpResponse.data.length - 1];
        results[symbol].ltp = latestCandle[4].toFixed(2);
        results[symbol].ltpInterval = interval;
        results[symbol].ltpTimestamp = latestCandle[0]; // Add timestamp
        console.log(`   LTP: ₹${results[symbol].ltp} [${interval}] at ${latestCandle[0]}`);
        ltpFound = true;
        break;
      }
      
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    if (!ltpFound) {
      results[symbol].ltp = null;
      results[symbol].ltpInterval = null;
      results[symbol].ltpTimestamp = null;
      console.log(`   LTP: No data`);
    }
    
    // Get sentiment for each time interval
    for (const interval of TIME_INTERVALS) {
      let response = await dashboard.getCandleData(info.exchange, info.token, interval);
      
      if (!response.status || !response.data || response.data.length === 0) {
        const fallback = getFallbackInterval(interval);
        if (fallback) {
          console.log(`   ⚠️  ${interval}: No data, trying ${fallback}...`);
          response = await dashboard.getCandleData(info.exchange, info.token, fallback);
        }
      }
      
      if (response.status && response.data && response.data.length > 0) {
        const candle = response.data[response.data.length - 1];
        const sentiment = dashboard.getSentiment(symbol + "_" + interval, candle[4]);
        results[symbol][interval] = sentiment;
        results[symbol][interval + '_timestamp'] = candle[0]; // Add timestamp for each interval
        console.log(`   ${interval}: ${sentiment} at ${candle[0]}`);
      } else {
        results[symbol][interval] = "Neutral";
        results[symbol][interval + '_timestamp'] = null;
        console.log(`   ${interval}: Neutral (no data, using default)`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    // Add overall fetch timestamp
    results[symbol].fetchedAt = new Date().toISOString();
  }
  
  console.log("\n========================================");
  console.log(`✅ COMPLETED: Fetched indices data`);
  console.log("========================================\n");
  
  res.json({ 
    success: true, 
    data: results,
    meta: {
      fetchedAt: new Date().toISOString()
    }
  });
});

/**
 * Get fallback interval for a given interval
 */
function getFallbackInterval(interval) {
  const fallbackMap = {
    "ONE_MINUTE": "FIVE_MINUTE",
    "THREE_MINUTE": "FIVE_MINUTE",
    "FIVE_MINUTE": "FIFTEEN_MINUTE",
    "FIFTEEN_MINUTE": "ONE_HOUR",
    "THIRTY_MINUTE": "ONE_HOUR",
    "ONE_HOUR": "FIFTEEN_MINUTE"
  };
  return fallbackMap[interval] || null;
}

module.exports = router;