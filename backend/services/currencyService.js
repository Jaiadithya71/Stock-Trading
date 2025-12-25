// backend/services/currencyService.js
const fetch = require('node-fetch');

class CurrencyService {
  constructor() {
    this.nseUrl = "https://www.nseindia.com/api/NextApi/apiClient?functionName=getReferenceRates&&type=null&&flag=CUR";
    this.headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      "Accept": "application/json",
      "Accept-Language": "en-US,en;q=0.9",
      "Referer": "https://www.nseindia.com/",
      "Accept-Encoding": "gzip, deflate, br",
      "Connection": "keep-alive"
    };
    this.cache = null;
    this.cacheTimestamp = null;
    this.CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache
  }

  /**
   * Check if cached data is still valid
   */
  isCacheValid() {
    if (!this.cache || !this.cacheTimestamp) {
      return false;
    }
    return (Date.now() - this.cacheTimestamp) < this.CACHE_DURATION;
  }

  /**
   * Fetch currency rates from NSE
   */
  async fetchCurrencyRates() {
    // Return cached data if valid
    if (this.isCacheValid()) {
      console.log("💾 Returning cached currency data");
      return {
        success: true,
        data: this.cache,
        cached: true
      };
    }

    try {
      console.log("🌍 Fetching currency rates from NSE...");
      
      const response = await fetch(this.nseUrl, {
        method: 'GET',
        headers: this.headers
      });

      if (!response.ok) {
        throw new Error(`NSE API returned status ${response.status}`);
      }

      const data = await response.json();

      // Validate response structure
      if (!data || !data.data || !data.data.currencySpotRates) {
        throw new Error("Invalid response structure from NSE API");
      }

      const currencyData = data.data.currencySpotRates;
      const timestamp = data.data.timeStamp;

      // Format the data
      const formattedData = {
        currencies: currencyData.map(curr => ({
          currency: curr.currency,
          unit: curr.unit,
          value: parseFloat(curr.value),
          prevDayValue: parseFloat(curr.prevDayValue),
          change: parseFloat(curr.value) - parseFloat(curr.prevDayValue),
          changePercent: (((parseFloat(curr.value) - parseFloat(curr.prevDayValue)) / parseFloat(curr.prevDayValue)) * 100).toFixed(2)
        })),
        timestamp: timestamp,
        lastUpdated: new Date().toISOString()
      };

      // Cache the data
      this.cache = formattedData;
      this.cacheTimestamp = Date.now();

      console.log(`✅ Currency rates fetched successfully (${currencyData.length} currencies)`);

      return {
        success: true,
        data: formattedData,
        cached: false
      };

    } catch (error) {
      console.error("❌ Error fetching currency rates:", error.message);
      
      // Return cached data if available, even if expired
      if (this.cache) {
        console.log("⚠️  Returning stale cached data due to error");
        return {
          success: true,
          data: this.cache,
          cached: true,
          stale: true,
          error: error.message
        };
      }

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get specific currency rate
   */
  async getCurrencyRate(currencyCode) {
    const result = await this.fetchCurrencyRates();
    
    if (!result.success) {
      return result;
    }

    const currency = result.data.currencies.find(
      c => c.currency.toUpperCase() === currencyCode.toUpperCase()
    );

    if (!currency) {
      return {
        success: false,
        error: `Currency ${currencyCode} not found`
      };
    }

    return {
      success: true,
      data: currency
    };
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache = null;
    this.cacheTimestamp = null;
    console.log("🗑️  Currency cache cleared");
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      hasCachedData: !!this.cache,
      cacheAge: this.cacheTimestamp ? Date.now() - this.cacheTimestamp : null,
      cacheValid: this.isCacheValid(),
      cacheDuration: this.CACHE_DURATION
    };
  }
}

// Export singleton instance
module.exports = new CurrencyService();