// backend/services/tradingDashboard.js - FIXED VERSION WITH TIMEOUTS
const { SmartAPI } = require("smartapi-javascript");
const { getDateRange, isMarketOpen } = require("../utils/dateHelpers");
const { generateTOTP } = require("./authService");

class TradingDashboard {
  constructor(credentials) {
    this.credentials = credentials;
    this.smart_api = new SmartAPI({
      api_key: credentials.api_key
    });
    this.authenticated = false;
    this.highs = {};
    this.lows = {};
    
    // Cache for reducing API calls
    this.cache = new Map();
    this.CACHE_DURATION = 10000; // 10 seconds
    this.API_TIMEOUT = 5000; // 5 second timeout for all API calls
  }

  /**
   * Wrapper for API calls with timeout protection
   */
  async callWithTimeout(apiCall, timeoutMs = this.API_TIMEOUT) {
    return Promise.race([
      apiCall,
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('API call timeout')), timeoutMs)
      )
    ]);
  }

  async authenticate() {
    try {
      const totp = generateTOTP(this.credentials.totp_token);
      
      console.log("🔐 Attempting authentication...");
      console.log("Client ID:", this.credentials.client_id);
      
      const sessionData = await this.callWithTimeout(
        this.smart_api.generateSession(
          this.credentials.client_id,
          this.credentials.password,
          totp
        ),
        10000 // 10 second timeout for auth
      );
      
      if (sessionData && sessionData.status === true && sessionData.data) {
        this.authToken = sessionData.data.jwtToken;
        this.refreshToken = sessionData.data.refreshToken;
        this.feedToken = sessionData.data.feedToken;
        
        await this.smart_api.setSessionExpiryHook({
          token: this.refreshToken
        });
        
        const profile = await this.callWithTimeout(
          this.smart_api.getProfile(this.refreshToken)
        );
        
        this.authenticated = true;
        console.log("✅ Authentication successful");
        
        return { 
          success: true, 
          message: "Authenticated successfully",
          data: {
            clientId: profile.data.clientcode,
            name: profile.data.name
          }
        };
      } else {
        const errorMsg = sessionData?.message || "Authentication failed";
        throw new Error(errorMsg);
      }
    } catch (error) {
      console.error("❌ Authentication error:", error.message);
      return { 
        success: false, 
        message: error.message || "Authentication failed"
      };
    }
  }

  /**
   * Get candle data with timeout protection
   */
  async getCandleData(exchange, symboltoken, interval) {
    // Check cache first
    const cacheKey = `${exchange}_${symboltoken}_${interval}`;
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data;
    }

    const { fromDate, toDate } = getDateRange();

    const params = {
      exchange,
      symboltoken,
      interval,
      fromdate: fromDate,
      todate: toDate
    };

    try {
      // Add timeout to API call
      const response = await this.callWithTimeout(
        this.smart_api.getCandleData(params)
      );

      // Cache successful responses
      if (response.status && response.data && response.data.length > 0) {
        this.cache.set(cacheKey, {
          data: response,
          timestamp: Date.now()
        });
      }
      
      return response;
    } catch (error) {
      if (error.message === 'API call timeout') {
        console.error(`⏱️  Timeout fetching ${exchange}:${symboltoken}`);
      } else {
        console.error(`❌ Error fetching candle data:`, error.message);
      }
      return { status: false, data: null, error: error.message };
    }
  }

  /**
   * Get candle data with smart fallback based on market status
   * Tries preferredInterval first, then falls back to appropriate intervals
   */
  async getCandleDataWithFallback(exchange, symboltoken, preferredInterval) {
    const marketOpenNow = isMarketOpen();

    // SMART INTERVAL SELECTION based on market status
    // Start with preferredInterval, then add fallbacks
    let fallbackIntervals;

    if (marketOpenNow) {
      // Market OPEN: Try real-time intervals as fallback
      fallbackIntervals = ["ONE_MINUTE", "FIVE_MINUTE", "FIFTEEN_MINUTE"];
    } else {
      // Market CLOSED: Skip real-time, use session intervals as fallback
      fallbackIntervals = ["ONE_HOUR", "FIFTEEN_MINUTE", "FIVE_MINUTE"];
    }

    // Build intervals array: preferred first, then fallbacks (removing duplicates)
    const intervals = [preferredInterval, ...fallbackIntervals];
    const uniqueIntervals = [...new Set(intervals)];

    for (const interval of uniqueIntervals) {
      try {
        const response = await this.getCandleData(exchange, symboltoken, interval);

        if (response.status && response.data && response.data.length > 0) {
          return response;
        }
      } catch (error) {
        // Continue to next interval
        continue;
      }

      // Small delay before trying next interval
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    return { status: false, data: null };
  }

  /**
   * Get latest candle with smart retry and fallback
   */
  async getLatestCandleRobust(exchange, symboltoken, preferredInterval = "ONE_MINUTE") {
    const response = await this.getCandleDataWithFallback(exchange, symboltoken, preferredInterval);
    
    if (response.status && response.data && response.data.length > 0) {
      const rawCandle = response.data[response.data.length - 1];
      return {
        candle: {
          timestamp: rawCandle[0],
          open: rawCandle[1],
          high: rawCandle[2],
          low: rawCandle[3],
          close: rawCandle[4],
          volume: rawCandle[5]
        },
        interval: preferredInterval,
        candleCount: response.data.length,
        success: true
      };
    }
    
    return null;
  }

  /**
   * Get real-time LTP data using marketData API
   * This returns actual current LTP, not candle close prices
   * @param {string} exchange - Exchange (NSE, BSE, NFO, etc.)
   * @param {string[]} tokens - Array of symbol tokens
   * @param {string} mode - "LTP", "OHLC", or "FULL"
   * @returns {Object} - Map of token -> market data
   */
  async getLTPData(exchange, tokens, mode = "LTP") {
    try {
      const response = await this.callWithTimeout(
        this.smart_api.marketData({
          mode: mode,
          exchangeTokens: {
            [exchange]: tokens
          }
        }),
        this.API_TIMEOUT
      );

      if (response.status && response.data && response.data.fetched) {
        // Convert array to map by token for easy lookup
        const dataMap = {};
        response.data.fetched.forEach(item => {
          dataMap[item.symbolToken] = {
            ltp: item.ltp,
            open: item.open,
            high: item.high,
            low: item.low,
            close: item.close,
            volume: item.tradeVolume || item.volume,
            change: item.netChange,
            changePercent: item.percentChange,
            lastTradeQty: item.lastTradeQty,
            avgPrice: item.avgPrice,
            lowerCircuit: item.lowerCircuit,
            upperCircuit: item.upperCircuit,
            week52High: item['52WeekHigh'],
            week52Low: item['52WeekLow'],
            exchFeedTime: item.exchFeedTime,
            exchTradeTime: item.exchTradeTime
          };
        });
        return { success: true, data: dataMap };
      }

      return { success: false, data: null, error: response.message || 'No data returned' };
    } catch (error) {
      console.error(`❌ marketData API error:`, error.message);
      return { success: false, data: null, error: error.message };
    }
  }

  /**
   * Get LTP for multiple symbols in batches (marketData API has limits)
   * @param {Object[]} symbols - Array of {symbol, exchange, token}
   * @returns {Object} - Map of symbol -> LTP data
   */
  async batchGetLTP(symbols) {
    const results = {};

    // Group by exchange
    const byExchange = {};
    symbols.forEach(({ symbol, exchange, token }) => {
      if (!byExchange[exchange]) byExchange[exchange] = [];
      byExchange[exchange].push({ symbol, token });
    });

    // Fetch each exchange (marketData supports one exchange at a time)
    for (const [exchange, items] of Object.entries(byExchange)) {
      const tokens = items.map(i => i.token);
      const response = await this.getLTPData(exchange, tokens, "FULL");

      if (response.success && response.data) {
        items.forEach(({ symbol, token }) => {
          if (response.data[token]) {
            results[symbol] = response.data[token];
          }
        });
      }
    }

    return results;
  }

  /**
   * Batch fetch multiple symbols efficiently
   * NEW: Uses Promise.all for parallel fetching
   */
  async batchFetchSymbols(symbols, interval = "ONE_MINUTE") {
    const results = {};
    
    // Fetch all symbols in PARALLEL (not sequential!)
    const promises = symbols.map(async ({ symbol, exchange, token }) => {
      try {
        const response = await this.getCandleDataWithFallback(exchange, token, interval);
        
        if (response.status && response.data && response.data.length > 0) {
          const candle = response.data[response.data.length - 1];
          results[symbol] = {
            ltp: candle[4].toFixed(2),
            open: candle[1].toFixed(2),
            high: candle[2].toFixed(2),
            low: candle[3].toFixed(2),
            volume: candle[5],
            timestamp: candle[0],
            changePercent: (((candle[4] - candle[1]) / candle[1]) * 100).toFixed(2),
            status: this.getStatus(symbol, candle[4])
          };
        } else {
          results[symbol] = {
            ltp: null,
            status: "No Data",
            error: "Unable to fetch data"
          };
        }
      } catch (error) {
        results[symbol] = {
          ltp: null,
          status: "Error",
          error: error.message
        };
      }
    });
    
    // Wait for all to complete (with timeout protection)
    await Promise.race([
      Promise.all(promises),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Batch fetch timeout')), 30000)
      )
    ]).catch(error => {
      console.error('❌ Batch fetch error:', error.message);
    });
    
    return results;
  }

  /**
   * Clear cache
   */
  clearCache() {
    const size = this.cache.size;
    this.cache.clear();
    console.log(`🗑️  Cache cleared (${size} entries removed)`);
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    const now = Date.now();
    let validEntries = 0;
    let expiredEntries = 0;
    
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp < this.CACHE_DURATION) {
        validEntries++;
      } else {
        expiredEntries++;
      }
    }
    
    return {
      total: this.cache.size,
      valid: validEntries,
      expired: expiredEntries,
      cacheDuration: this.CACHE_DURATION / 1000 + 's'
    };
  }

  getStatus(symbol, close) {
    if (!this.highs[symbol]) {
      this.highs[symbol] = close;
      this.lows[symbol] = close;
      return "Neutral";
    }
    
    if (close > this.highs[symbol]) {
      this.highs[symbol] = close;
      return "Buying";
    } else if (close < this.lows[symbol]) {
      this.lows[symbol] = close;
      return "Selling";
    }
    return "Neutral";
  }

  getSentiment(symbol, close) {
    if (!this.highs[symbol]) {
      this.highs[symbol] = close;
      this.lows[symbol] = close;
      return "Neutral";
    }
    
    if (close > this.highs[symbol]) {
      this.highs[symbol] = close;
      return "Bullish";
    } else if (close < this.lows[symbol]) {
      this.lows[symbol] = close;
      return "Bearish";
    }
    return "Neutral";
  }
}

module.exports = TradingDashboard;