// backend/routes/dataRoutes.js - UPDATED WITH LTP INTERVAL TRACKING
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
  
  console.log(`📊 Market Status: ${marketOpenNow ? 'OPEN' : 'CLOSED'}`);
  console.log(`📈 Preferred Interval: ${preferredInterval}`);
  console.log("========================================\n");
  
  // PARALLEL FETCH: All symbols at once
  const symbolPromises = Object.entries(SYMBOL_TOKEN_MAP).map(async ([symbol, token]) => {
    console.log(`   Fetching ${symbol}...`);
    
    try {
      const response = await dashboard.getCandleDataWithFallback("NSE", token, preferredInterval);
      
      if (response.status && response.data && response.data.length > 0) {
        const latestCandle = response.data[response.data.length - 1];
        
        const stockData = {
          ltp: latestCandle[4].toFixed(2),
          change: (latestCandle[4] - latestCandle[1]).toFixed(2),
          changePercent: (((latestCandle[4] - latestCandle[1]) / latestCandle[1]) * 100).toFixed(2),
          volume: latestCandle[5],
          timestamp: latestCandle[0]
        };
        
        console.log(`   ✅ ${symbol}: ₹${stockData.ltp} (${stockData.changePercent > 0 ? '+' : ''}${stockData.changePercent}%)`);
        return { symbol, data: stockData };
      }
    } catch (error) {
      console.log(`   ❌ ${symbol}: Failed`);
    }
    
    return { symbol, data: null };
  });
  
  const results = await Promise.all(symbolPromises);
  
  // Convert to object
  const bankNiftyData = {};
  results.forEach(({ symbol, data }) => {
    bankNiftyData[symbol] = data;
  });
  
  console.log("\n========================================");
  console.log(`✅ COMPLETED: Fetched ${results.length} symbols`);
  console.log("========================================\n");
  
  res.json({ 
    success: true, 
    data: bankNiftyData,
    meta: {
      fetchedAt: new Date().toISOString(),
      marketStatus: marketOpenNow ? 'OPEN' : 'CLOSED',
      intervalUsed: preferredInterval
    }
  });
});

/**
 * Get indices data with PARALLEL fetching and LTP interval tracking
 * UPDATED: Returns LTP values for each time interval with comparison logic
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
    const indexResults = { 
      ltp: null, 
      ltpInterval: null, 
      ltpTimestamp: null,
      intervals: {} // Store LTP for each interval
    };
    
    // Get current LTP with smart fallback
    const ltpInterval = marketOpenNow ? "ONE_MINUTE" : "ONE_HOUR";
    const ltpResponse = await dashboard.getCandleDataWithFallback(info.exchange, info.token, ltpInterval);
    
    if (ltpResponse.status && ltpResponse.data && ltpResponse.data.length > 0) {
      const latestCandle = ltpResponse.data[ltpResponse.data.length - 1];
      indexResults.ltp = parseFloat(latestCandle[4].toFixed(2));
      indexResults.ltpInterval = ltpInterval;
      indexResults.ltpTimestamp = latestCandle[0];
      console.log(`   Current LTP: ₹${indexResults.ltp} [${ltpInterval}]`);
    } else {
      console.log(`   Current LTP: No data`);
    }
    
    // Get LTP for each time interval
    const essentialIntervals = marketOpenNow 
      ? ["ONE_MINUTE", "THREE_MINUTE", "FIVE_MINUTE", "FIFTEEN_MINUTE", "THIRTY_MINUTE", "ONE_HOUR"]
      : ["FIFTEEN_MINUTE", "THIRTY_MINUTE", "ONE_HOUR"];
    
    // Fetch all intervals in parallel
    const intervalPromises = essentialIntervals.map(async (interval) => {
      const response = await dashboard.getCandleData(info.exchange, info.token, interval);
      
      if (response.status && response.data && response.data.length > 0) {
        const candle = response.data[response.data.length - 1];
        const intervalLTP = parseFloat(candle[4].toFixed(2));
        
        // Calculate change and direction
        let change = null;
        let changePercent = null;
        let direction = 'neutral';
        
        if (indexResults.ltp !== null) {
          change = (indexResults.ltp - intervalLTP).toFixed(2);
          changePercent = (((indexResults.ltp - intervalLTP) / intervalLTP) * 100).toFixed(2);
          
          // Determine direction
          if (indexResults.ltp > intervalLTP) {
            direction = 'up'; // Price has gone UP since then
          } else if (indexResults.ltp < intervalLTP) {
            direction = 'down'; // Price has gone DOWN since then
          }
        }
        
        return { 
          interval, 
          ltp: intervalLTP,
          change: change,
          changePercent: changePercent,
          direction: direction,
          timestamp: candle[0] 
        };
      }
      return { 
        interval, 
        ltp: null,
        change: null,
        changePercent: null,
        direction: 'neutral',
        timestamp: null 
      };
    });
    
    const intervalsData = await Promise.all(intervalPromises);
    
    // Map intervals to result
    intervalsData.forEach(({ interval, ltp, change, changePercent, direction, timestamp }) => {
      indexResults.intervals[interval] = {
        ltp: ltp,
        change: change,
        changePercent: changePercent,
        direction: direction,
        timestamp: timestamp
      };
      
      if (ltp !== null) {
        console.log(`   ${interval}: ₹${ltp} (${direction === 'up' ? '↑' : direction === 'down' ? '↓' : '→'} ${change || '0.00'})`);
      }
    });
    
    // Fill missing intervals with null data
    TIME_INTERVALS.forEach(interval => {
      if (!indexResults.intervals[interval]) {
        indexResults.intervals[interval] = {
          ltp: null,
          change: null,
          changePercent: null,
          direction: 'neutral',
          timestamp: null
        };
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
  console.log(`✅ COMPLETED: Fetched indices data with interval tracking`);
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