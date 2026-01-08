// backend/routes/dataRoutes.js - OPTIMIZED VERSION WITH PARALLEL FETCHING
const express = require("express");
const router = express.Router();
const { requireAuth } = require("../middleware/authMiddleware");
const { SYMBOL_TOKEN_MAP, INDICES_INSTRUMENTS, TIME_INTERVALS } = require("../config/constants");
const { isMarketOpen } = require("../utils/dateHelpers");

/**
 * Get Bank Nifty data using REAL-TIME marketData API
 * Falls back to candle data if marketData fails
 */
router.post("/banknifty-data", requireAuth, async (req, res) => {
  const dashboard = req.dashboard;
  const fetchTime = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  console.log("\n========================================");
  console.log(`📊 FETCHING BANK NIFTY DATA at ${fetchTime}`);
  console.log("========================================");

  const marketOpenNow = isMarketOpen();
  console.log(`📊 Market Status: ${marketOpenNow ? '🟢 OPEN' : '🔴 CLOSED'}`);

  // Get all bank tokens
  const tokens = Object.values(SYMBOL_TOKEN_MAP);
  const symbolByToken = {};
  Object.entries(SYMBOL_TOKEN_MAP).forEach(([symbol, token]) => {
    symbolByToken[token] = symbol;
  });

  let results = [];
  let dataSource = 'marketData';

  // STEP 1: Try real-time marketData API first
  console.log(`🔄 Fetching real-time LTP using marketData API...`);
  const ltpResponse = await dashboard.getLTPData("NSE", tokens, "FULL");

  if (ltpResponse.success && ltpResponse.data) {
    console.log(`✅ marketData API returned data`);

    // Process marketData response
    results = Object.entries(SYMBOL_TOKEN_MAP).map(([symbol, token]) => {
      const data = ltpResponse.data[token];

      if (data && data.ltp !== undefined) {
        const changePercent = data.changePercent ||
          (data.open ? ((data.ltp - data.open) / data.open) * 100 : 0);

        // Calculate status based on day's open vs current LTP
        let status = "Neutral";
        if (data.open && data.ltp > data.open) {
          status = "Buying";
        } else if (data.open && data.ltp < data.open) {
          status = "Selling";
        }

        console.log(`   ✅ ${symbol}: ₹${data.ltp.toFixed(2)} (${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%) [${status}]`);

        return {
          bank: symbol,
          ltp: data.ltp.toFixed(2),
          open: data.open?.toFixed(2) || null,
          high: data.high?.toFixed(2) || null,
          low: data.low?.toFixed(2) || null,
          close: data.close?.toFixed(2) || null,
          volume: data.volume,
          changePercent: changePercent.toFixed(2),
          change: data.change?.toFixed(2) || null,
          status,
          dataSource: 'realtime',
          exchFeedTime: data.exchFeedTime,
          fetchedAt: new Date().toISOString()
        };
      } else {
        console.log(`   ❌ ${symbol}: No data from marketData`);
        return {
          bank: symbol,
          ltp: null,
          status: "No Data",
          dataSource: 'none',
          fetchedAt: new Date().toISOString()
        };
      }
    });
  } else {
    // STEP 2: Fallback to candle data if marketData fails
    console.log(`⚠️  marketData API failed, falling back to candle data...`);
    dataSource = 'candle';
    const preferredInterval = marketOpenNow ? "ONE_MINUTE" : "ONE_HOUR";

    const bankPromises = Object.entries(SYMBOL_TOKEN_MAP).map(async ([symbol, token]) => {
      try {
        const response = await dashboard.getCandleDataWithFallback("NSE", token, preferredInterval);

        if (response.status && response.data && response.data.length > 0) {
          const latestCandle = response.data[response.data.length - 1];
          const ltp = latestCandle[4];
          const open = latestCandle[1];
          const volume = latestCandle[5];
          const changePercent = ((ltp - open) / open) * 100;

          // Calculate status based on open vs LTP
          let status = "Neutral";
          if (ltp > open) {
            status = "Buying";
          } else if (ltp < open) {
            status = "Selling";
          }

          console.log(`   ✅ ${symbol}: ₹${ltp.toFixed(2)} (candle) [${status}]`);

          return {
            bank: symbol,
            ltp: ltp.toFixed(2),
            open: open?.toFixed(2),
            high: latestCandle[2]?.toFixed(2),
            low: latestCandle[3]?.toFixed(2),
            close: latestCandle[4]?.toFixed(2),
            volume,
            changePercent: changePercent.toFixed(2),
            status,
            dataSource: 'candle',
            interval: preferredInterval,
            timestamp: latestCandle[0],
            fetchedAt: new Date().toISOString()
          };
        } else {
          return {
            bank: symbol,
            ltp: null,
            status: "No Data",
            dataSource: 'none',
            fetchedAt: new Date().toISOString()
          };
        }
      } catch (error) {
        console.log(`   ⚠️  ${symbol}: ${error.message}`);
        return {
          bank: symbol,
          ltp: null,
          status: "Error",
          dataSource: 'none',
          error: error.message,
          fetchedAt: new Date().toISOString()
        };
      }
    });

    results = await Promise.race([
      Promise.all(bankPromises),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Batch fetch timeout')), 15000)
      )
    ]).catch(error => {
      console.error('❌ Batch fetch failed:', error.message);
      return Object.keys(SYMBOL_TOKEN_MAP).map(symbol => ({
        bank: symbol,
        ltp: null,
        status: "Timeout",
        dataSource: 'none',
        fetchedAt: new Date().toISOString()
      }));
    });
  }

  const successCount = results.filter(r => r.ltp !== null).length;
  console.log(`\n✅ COMPLETED: ${successCount}/${results.length} banks (${((successCount/results.length)*100).toFixed(1)}%)`);
  console.log(`📡 Data source: ${dataSource}`);
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
      dataSource: dataSource
    }
  });
});

/**
 * Get indices data using REAL-TIME marketData API
 * Returns current LTP and interval-based change calculations
 */
router.post("/indices-data", requireAuth, async (req, res) => {
  const dashboard = req.dashboard;
  const fetchTime = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  console.log("\n========================================");
  console.log(`📈 FETCHING INDICES DATA at ${fetchTime}`);
  console.log("========================================");

  const marketOpenNow = isMarketOpen();
  const results = {};

  // Group tokens by exchange for proper LTP fetching
  const tokensByExchange = {};
  Object.entries(INDICES_INSTRUMENTS).forEach(([symbol, info]) => {
    if (!tokensByExchange[info.exchange]) {
      tokensByExchange[info.exchange] = [];
    }
    tokensByExchange[info.exchange].push(info.token);
  });

  // STEP 1: Get real-time LTP for all indices (by exchange)
  console.log(`🔄 Fetching real-time LTP for indices...`);
  let ltpMap = {};

  // Fetch LTP for each exchange in parallel
  const ltpPromises = Object.entries(tokensByExchange).map(async ([exchange, tokens]) => {
    console.log(`   📡 Fetching ${exchange} tokens: ${tokens.join(', ')}`);
    const response = await dashboard.getLTPData(exchange, tokens, "FULL");
    if (response.success && response.data) {
      return response.data;
    }
    return {};
  });

  const ltpResults = await Promise.all(ltpPromises);
  ltpResults.forEach(data => {
    ltpMap = { ...ltpMap, ...data };
  });

  // PARALLEL FETCH: All indices at once
  const indicesPromises = Object.entries(INDICES_INSTRUMENTS).map(async ([symbol, info]) => {
    console.log(`\n📊 Processing ${symbol}...`);

    // Get real-time LTP from marketData response
    let currentLTP = null;
    let ltpTimestamp = null;
    let dataSource = 'none';

    if (ltpMap[info.token] && ltpMap[info.token].ltp !== undefined) {
      currentLTP = ltpMap[info.token].ltp;
      ltpTimestamp = ltpMap[info.token].exchFeedTime;
      dataSource = 'realtime';
      console.log(`   ✅ Real-time LTP: ₹${currentLTP.toFixed(2)}`);
    } else {
      // Fallback to candle data
      const ltpInterval = marketOpenNow ? "ONE_MINUTE" : "ONE_HOUR";
      const candleResponse = await dashboard.getCandleDataWithFallback(info.exchange, info.token, ltpInterval);

      if (candleResponse.status && candleResponse.data && candleResponse.data.length > 0) {
        const latestCandle = candleResponse.data[candleResponse.data.length - 1];
        currentLTP = parseFloat(latestCandle[4]);
        ltpTimestamp = latestCandle[0];
        dataSource = 'candle';
        console.log(`   ⚠️  Fallback LTP: ₹${currentLTP.toFixed(2)} [${ltpInterval}]`);
      } else {
        console.log(`   ❌ No LTP data available`);
      }
    }

    // Get interval data for calculating changes from different timeframes
    const intervals = {};

    // Helper to check if error is temporary (worth retrying)
    const isTemporaryError = (response) => {
      if (!response) return false;
      const msg = (response.message || '').toLowerCase();
      return msg.includes('something went wrong') ||
             msg.includes('try after') ||
             msg.includes('rate limit') ||
             msg.includes('too many') ||
             response.status === 403;
    };

    // Helper to fetch with smart retry for temporary errors
    const fetchWithRetry = async (exchange, token, interval, maxRetries = 2) => {
      let lastResponse = null;
      let lastError = null;

      for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
        try {
          // Delay between requests (longer for retries)
          const delay = attempt === 1 ? 100 : 500 * attempt;
          await new Promise(resolve => setTimeout(resolve, delay));

          const response = await dashboard.getCandleData(exchange, token, interval);

          // Success - return data
          if (response.status && response.data && response.data.length > 0) {
            if (attempt > 1) {
              console.log(`   ✅ [${symbol}/${interval}]: Succeeded on retry ${attempt - 1}`);
            }
            return { success: true, data: response.data };
          }

          lastResponse = response;

          // Check if temporary error - retry
          if (isTemporaryError(response) && attempt <= maxRetries) {
            console.log(`   🔄 [${symbol}/${interval}]: Retry ${attempt}/${maxRetries} - ${response.message || 'temporary error'}`);
            continue;
          }

          // Empty response or permanent error - don't retry
          break;

        } catch (error) {
          lastError = error;
          // Timeout or other errors - retry if attempts remaining
          if (attempt <= maxRetries) {
            console.log(`   🔄 [${symbol}/${interval}]: Retry ${attempt}/${maxRetries} - ${error.message}`);
            continue;
          }
          break;
        }
      }

      // All retries exhausted or permanent failure
      const reason = lastError?.message || lastResponse?.message || 'Data not available for this interval';
      return { success: false, reason };
    };

    // Fetch intervals SEQUENTIALLY to avoid rate limiting (403 errors)
    for (const interval of TIME_INTERVALS) {
      const result = await fetchWithRetry(info.exchange, info.token, interval);

      if (result.success) {
        const candles = result.data;
        const latestCandle = candles[candles.length - 1];
        const intervalOpen = parseFloat(latestCandle[1]);
        const change = currentLTP !== null ? currentLTP - intervalOpen : null;

        // Determine direction based on change
        let direction = 'neutral';
        if (change !== null) {
          if (change > 0) direction = 'up';
          else if (change < 0) direction = 'down';
        }

        intervals[interval] = {
          ltp: currentLTP !== null ? currentLTP.toFixed(2) : null,
          open: intervalOpen.toFixed(2),
          change: change !== null ? change.toFixed(2) : null,
          direction: direction,
          timestamp: latestCandle[0]
        };
      } else {
        intervals[interval] = {
          ltp: currentLTP !== null ? currentLTP.toFixed(2) : null,
          open: null,
          change: null,
          direction: 'neutral',
          timestamp: null,
          unavailableReason: result.reason
        };
      }
    }

    const indexData = {
      ltp: currentLTP !== null ? currentLTP.toFixed(2) : null,
      ltpTimestamp: ltpTimestamp,
      dataSource: dataSource,
      change: ltpMap[info.token]?.change?.toFixed(2) || null,
      changePercent: ltpMap[info.token]?.changePercent?.toFixed(2) || null,
      open: ltpMap[info.token]?.open?.toFixed(2) || null,
      high: ltpMap[info.token]?.high?.toFixed(2) || null,
      low: ltpMap[info.token]?.low?.toFixed(2) || null,
      intervals: intervals,
      fetchedAt: new Date().toISOString()
    };

    console.log(`   ✅ ${symbol} complete (${dataSource})`);
    return { symbol, data: indexData };
  });

  // Wait for all indices with timeout
  const indicesData = await Promise.race([
    Promise.all(indicesPromises),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Indices fetch timeout')), 20000)
    )
  ]).catch(error => {
    console.error('❌ Indices fetch failed:', error.message);
    return [];
  });

  // Convert to object format
  indicesData.forEach(({ symbol, data }) => {
    results[symbol] = data;
  });

  console.log("\n========================================");
  console.log(`✅ COMPLETED: Fetched ${Object.keys(results).length} indices`);
  console.log("========================================\n");

  res.json({
    success: true,
    data: results,
    meta: {
      fetchedAt: new Date().toISOString(),
      marketStatus: marketOpenNow ? 'OPEN' : 'CLOSED',
      dataSource: Object.keys(ltpMap).length > 0 ? 'realtime' : 'candle'
    }
  });
});

module.exports = router;