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
  try {
    const dashboard = req.dashboard;
    const fetchTime = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    // Stage 1 Local Testing: Check Mock Exchange on Port 3001
    const marketDataProvider = require("../services/marketDataProvider");
    if (marketDataProvider.isLocal) {
      const mockData = await marketDataProvider.queryMockServer();
      if (mockData) {
        if (mockData.outage) {
          return res.status(503).json({ success: false, message: 'Broker Disconnected (Outage Active)' });
        }
        if (mockData.bankStocks && mockData.bankStocks.length > 0) {
        const results = mockData.bankStocks.map(s => {
          const pChange = s.pChange || 0;
          let status = "Neutral";
          if (pChange > 0.3) status = "Buying";
          else if (pChange < -0.3) status = "Selling";
          return {
            bank: s.symbol,
            token: s.token || SYMBOL_TOKEN_MAP[s.symbol] || "1333",
            ltp: s.ltp || 1650,
            changePercent: pChange,
            status: status,
            intervals: { "ONE_MINUTE": { change: pChange, status } },
            dataSource: "mockExchange"
          };
        });
        return res.json({
          success: true,
          data: results,
          meta: {
            timestamp: new Date().toISOString(),
            isMarketOpen: true,
            dataSource: 'mockExchange'
          }
        });
      }
    }
  }

    let results = [];
    let dataSource = 'marketData';

    // STEP 1: Try real-time marketData API first
    const tokens = Object.values(SYMBOL_TOKEN_MAP);
    const ltpResponse = await dashboard.getLTPData("NSE", tokens, "FULL");

    if (ltpResponse.success && ltpResponse.data) {
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
  } catch (error) {
    console.error("❌ Error in /banknifty-data:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Error fetching Bank Nifty data"
    });
  }
});

/**
 * Get indices data using REAL-TIME marketData API
 * Returns current LTP and interval-based change calculations
 */
router.post("/indices-data", requireAuth, async (req, res) => {
  try {
    const dashboard = req.dashboard;
    const fetchTime = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    // Stage 1 Local Testing: Check Mock Exchange on Port 3001
    const marketDataProvider = require("../services/marketDataProvider");
    if (marketDataProvider.isLocal) {
      const mockData = await marketDataProvider.queryMockServer();
      if (mockData) {
        if (mockData.outage) {
          return res.status(503).json({ success: false, message: 'Broker Disconnected (Outage Active)' });
        }
        const spot = mockData.spotPrice;
        const bnfResult = {
          ltp: spot,
          timestamp: new Date().toISOString(),
          dataSource: 'mockExchange',
          intervals: {
            "ONE_MINUTE": { change: parseFloat(((mockData.advancingWeight - 50) / 20).toFixed(2)), status: mockData.advancingWeight > 60 ? "Bullish" : (mockData.advancingWeight < 40 ? "Bearish" : "Neutral") },
            "FIVE_MINUTE": { change: parseFloat(((mockData.advancingWeight - 50) / 15).toFixed(2)), status: mockData.advancingWeight > 60 ? "Bullish" : (mockData.advancingWeight < 40 ? "Bearish" : "Neutral") },
            "FIFTEEN_MINUTE": { change: parseFloat(((mockData.advancingWeight - 50) / 10).toFixed(2)), status: mockData.advancingWeight > 60 ? "Bullish" : (mockData.advancingWeight < 40 ? "Bearish" : "Neutral") }
          }
        };
        return res.json({
          success: true,
          data: {
            "BANKNIFTY": bnfResult,
            "NIFTY": { ltp: Math.round(spot * 0.435), timestamp: new Date().toISOString(), dataSource: 'mockExchange', intervals: {} },
            "INDIA VIX": { ltp: 13.85, timestamp: new Date().toISOString(), dataSource: 'mockExchange', intervals: {} }
          },
          meta: {
            timestamp: new Date().toISOString(),
            isMarketOpen: true,
            dataSource: 'mockExchange'
          }
        });
      }
    }

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
    let ltpMap = {};

    // Fetch LTP for each exchange in parallel
    const ltpPromises = Object.entries(tokensByExchange).map(async ([exchange, tokens]) => {
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
      // Get real-time LTP from marketData response
      let currentLTP = null;
      let ltpTimestamp = null;
      let dataSource = 'none';

      if (ltpMap[info.token] && ltpMap[info.token].ltp !== undefined) {
        currentLTP = ltpMap[info.token].ltp;
        ltpTimestamp = ltpMap[info.token].exchFeedTime;
        dataSource = 'realtime';
      } else {
        // Fallback to candle data
        const ltpInterval = marketOpenNow ? "ONE_MINUTE" : "ONE_HOUR";
        const candleResponse = await dashboard.getCandleDataWithFallback(info.exchange, info.token, ltpInterval);

        if (candleResponse.status && candleResponse.data && candleResponse.data.length > 0) {
          const latestCandle = candleResponse.data[candleResponse.data.length - 1];
          currentLTP = parseFloat(latestCandle[4]);
          ltpTimestamp = latestCandle[0];
          dataSource = 'candle';
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
      if (symbol && data) {
        results[symbol] = data;
      }
    });

    res.json({
      success: true,
      data: results,
      meta: {
        fetchedAt: new Date().toISOString(),
        marketStatus: marketOpenNow ? 'OPEN' : 'CLOSED',
        dataSource: Object.keys(ltpMap).length > 0 ? 'realtime' : 'candle'
      }
    });
  } catch (error) {
    console.error("❌ Error in /indices-data:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Error fetching indices data"
    });
  }
});

module.exports = router;