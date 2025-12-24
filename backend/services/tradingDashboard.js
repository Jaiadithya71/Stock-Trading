// backend/services/tradingDashboard.js - ENHANCED VERSION
const { SmartAPI } = require("smartapi-javascript");
const { getDateRange } = require("../utils/dateHelpers");
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
    this.CACHE_DURATION = 10000; // 10 seconds - longer cache for better performance
  }

  async authenticate() {
    try {
      const totp = generateTOTP(this.credentials.totp_token);
      
      console.log("🔐 Attempting authentication...");
      console.log("Client ID:", this.credentials.client_id);
      console.log("TOTP:", totp);
      
      const sessionData = await this.smart_api.generateSession(
        this.credentials.client_id,
        this.credentials.password,
        totp
      );
      
      console.log("Session response:", sessionData);
      
      if (sessionData && sessionData.status === true && sessionData.data) {
        this.authToken = sessionData.data.jwtToken;
        this.refreshToken = sessionData.data.refreshToken;
        this.feedToken = sessionData.data.feedToken;
        
        await this.smart_api.setSessionExpiryHook({
          token: this.refreshToken
        });
        
        const profile = await this.smart_api.getProfile(this.refreshToken);
        console.log("Profile:", profile);
        
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
      console.error("❌ Authentication error:", error);
      return { 
        success: false, 
        message: error.message || "Authentication failed"
      };
    }
  }

  /**
   * Get candle data - basic method
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
      const response = await this.smart_api.getCandleData(params);
      
      // Cache successful responses
      if (response.status && response.data && response.data.length > 0) {
        this.cache.set(cacheKey, {
          data: response,
          timestamp: Date.now()
        });
      }
      
      return response;
    } catch (error) {
      console.error(`Error fetching candle data:`, error);
      return { status: false, data: null };
    }
  }

  /**
   * Get candle data with automatic fallback to reliable intervals
   * This ensures we almost always get data
   */
  async getCandleDataWithFallback(exchange, symboltoken, preferredInterval) {
    // Priority order based on your diagnostic results
    // ONE_MINUTE has issues (THREE_MINUTE failed), so we start with reliable ones
    const intervals = [
      preferredInterval,
      "FIVE_MINUTE",      // Most reliable based on your results
      "FIFTEEN_MINUTE",   // Second most reliable
      "ONE_HOUR",         // Good reliability
      "THIRTY_MINUTE",    // Backup
      "ONE_MINUTE"        // Last resort
    ];
    
    // Remove duplicates while preserving order
    const uniqueIntervals = [...new Set(intervals)];
    
    for (const interval of uniqueIntervals) {
      const response = await this.getCandleData(exchange, symboltoken, interval);
      
      if (response.status && response.data && response.data.length > 0) {
        return response;
      }
      
      // Small delay before trying next interval
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return { status: false, data: null };
  }

  /**
   * Get latest candle with smart retry and fallback
   * Returns: { candle: {...}, interval: "...", success: true } or null
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
   * Get multiple candles for a symbol with fallback
   */
  async getRecentCandles(exchange, symboltoken, interval, count = 50) {
    const response = await this.getCandleDataWithFallback(exchange, symboltoken, interval);
    
    if (response.status && response.data && response.data.length > 0) {
      const candles = response.data.slice(-count).map(c => ({
        timestamp: c[0],
        open: c[1],
        high: c[2],
        low: c[3],
        close: c[4],
        volume: c[5]
      }));
      return candles;
    }
    
    return [];
  }

  /**
   * Batch fetch multiple symbols efficiently with caching
   */
  async batchFetchSymbols(symbols, interval = "ONE_MINUTE") {
    const results = {};
    
    for (const { symbol, exchange, token } of symbols) {
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
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 150));
    }
    
    return results;
  }

  /**
   * Clear cache - useful for manual refresh
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