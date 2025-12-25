// ============================================================================
// FILE: backend/services/optionService.js - CREATE THIS NEW FILE
// LOCATION: backend/services/optionService.js
// ============================================================================

const { OPTION_SYMBOLS, OPTION_CONFIG, OPTION_TYPES } = require("../config/constants");

class OptionService {
  constructor(smartAPI) {
    this.smartAPI = smartAPI;
    this.cache = new Map();
    this.CACHE_DURATION = OPTION_CONFIG.cacheDuration;
  }

  /**
   * Get spot price for the underlying index
   */
  async getSpotPrice(symbol) {
    const config = OPTION_SYMBOLS[symbol];
    if (!config) {
      throw new Error(`Invalid symbol: ${symbol}`);
    }

    try {
      const response = await this.smartAPI.getQuote({
        mode: "LTP",
        exchangeTokens: {
          [config.spotExchange]: [config.token]
        }
      });

      if (response && response.data && response.data.fetched) {
        const data = response.data.fetched[0];
        return parseFloat(data.ltp);
      }

      throw new Error("Failed to fetch spot price");
    } catch (error) {
      console.error(`Error fetching spot price for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Calculate strike prices around the spot price
   */
  calculateStrikes(spotPrice, symbol) {
    const config = OPTION_SYMBOLS[symbol];
    const interval = config.strikeInterval;
    
    // Round spot price to nearest strike
    const baseStrike = Math.round(spotPrice / interval) * interval;
    
    const strikes = [];
    
    // Add strikes below
    for (let i = OPTION_CONFIG.strikesBelow; i > 0; i--) {
      strikes.push(baseStrike - (i * interval));
    }
    
    // Add ATM strike
    strikes.push(baseStrike);
    
    // Add strikes above
    for (let i = 1; i <= OPTION_CONFIG.strikesAbove; i++) {
      strikes.push(baseStrike + (i * interval));
    }
    
    return strikes;
  }

  /**
   * Build trading symbol for options
   * Format: BANKNIFTY26DEC2452000CE
   */
  buildTradingSymbol(symbol, expiryDate, strikePrice, optionType) {
    const dateStr = this.formatExpiryForSymbol(expiryDate);
    return `${symbol}${dateStr}${strikePrice}${optionType}`;
  }

  /**
   * Format expiry date for trading symbol
   * Input: "26-DEC-2024" or Date object
   * Output: "26DEC24"
   */
  formatExpiryForSymbol(expiryDate) {
    let date;
    
    if (typeof expiryDate === 'string') {
      const parts = expiryDate.split('-');
      if (parts.length === 3) {
        const [day, month, year] = parts;
        date = new Date(`${month} ${day}, ${year}`);
      } else {
        return expiryDate.replace(/-/g, '');
      }
    } else {
      date = expiryDate;
    }
    
    const day = String(date.getDate()).padStart(2, '0');
    const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 
                        'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const month = monthNames[date.getMonth()];
    const year = String(date.getFullYear()).slice(-2);
    
    return `${day}${month}${year}`;
  }

  /**
   * Search for option contracts
   */
  async searchOptionContracts(symbol, expiryDate) {
    try {
      const searchString = `${symbol}${this.formatExpiryForSymbol(expiryDate)}`;
      
      const response = await this.smartAPI.searchScrip({
        exchange: OPTION_SYMBOLS[symbol].exchange,
        searchscrip: searchString
      });

      return response;
    } catch (error) {
      console.error(`Error searching option contracts:`, error);
      throw error;
    }
  }

  /**
   * Get option quote data
   */
  async getOptionQuote(tradingSymbol, symbolToken) {
    const config = OPTION_SYMBOLS[tradingSymbol.match(/^[A-Z]+/)[0]];
    
    try {
      const response = await this.smartAPI.getQuote({
        mode: "FULL",
        exchangeTokens: {
          [config.exchange]: [symbolToken]
        }
      });

      if (response && response.data && response.data.fetched) {
        const data = response.data.fetched[0];
        
        return {
          ltp: parseFloat(data.ltp || 0),
          open: parseFloat(data.open || 0),
          high: parseFloat(data.high || 0),
          low: parseFloat(data.low || 0),
          close: parseFloat(data.close || 0),
          volume: parseInt(data.volume || 0),
          oi: parseInt(data.oi || 0),
          change: parseFloat(data.change || 0),
          changePercent: parseFloat(data.changePercent || 0),
          bidPrice: parseFloat(data.depth?.buy?.[0]?.price || 0),
          bidQty: parseInt(data.depth?.buy?.[0]?.quantity || 0),
          askPrice: parseFloat(data.depth?.sell?.[0]?.price || 0),
          askQty: parseInt(data.depth?.sell?.[0]?.quantity || 0),
          timestamp: data.exchangeTimestamp || new Date().toISOString()
        };
      }

      throw new Error("Failed to fetch option quote");
    } catch (error) {
      console.error(`Error fetching option quote for ${tradingSymbol}:`, error);
      return {
        ltp: 0,
        open: 0,
        high: 0,
        low: 0,
        close: 0,
        volume: 0,
        oi: 0,
        change: 0,
        changePercent: 0,
        bidPrice: 0,
        bidQty: 0,
        askPrice: 0,
        askQty: 0,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get complete option chain for a symbol and expiry
   */
  async getOptionChain(symbol, expiryDate, strikeOverride = null) {
    const cacheKey = `${symbol}_${expiryDate}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      console.log(`✅ Returning cached option chain for ${symbol} ${expiryDate}`);
      return cached.data;
    }

    console.log(`\n🔍 Fetching option chain for ${symbol} - ${expiryDate}`);
    
    try {
      const spotPrice = await this.getSpotPrice(symbol);
      console.log(`📊 Spot Price: ₹${spotPrice.toFixed(2)}`);
      
      const strikes = strikeOverride || this.calculateStrikes(spotPrice, symbol);
      console.log(`🎯 Calculated ${strikes.length} strikes from ${strikes[0]} to ${strikes[strikes.length-1]}`);
      
      const contracts = await this.searchOptionContracts(symbol, expiryDate);
      
      if (!contracts || !contracts.data) {
        throw new Error("No contracts found");
      }

      const optionChain = [];
      const config = OPTION_SYMBOLS[symbol];
      
      for (const strike of strikes) {
        console.log(`  Processing strike ${strike}...`);
        
        const ceSymbol = this.buildTradingSymbol(symbol, expiryDate, strike, OPTION_TYPES.CALL);
        const peSymbol = this.buildTradingSymbol(symbol, expiryDate, strike, OPTION_TYPES.PUT);
        
        const ceContract = contracts.data.find(c => c.tradingsymbol === ceSymbol);
        const peContract = contracts.data.find(c => c.tradingsymbol === peSymbol);
        
        let callData = null;
        let putData = null;
        
        if (ceContract) {
          callData = await this.getOptionQuote(ceSymbol, ceContract.symboltoken);
          await this.delay(50);
        }
        
        if (peContract) {
          putData = await this.getOptionQuote(peSymbol, peContract.symboltoken);
          await this.delay(50);
        }
        
        const isATM = Math.abs(strike - spotPrice) < config.strikeInterval / 2;
        
        optionChain.push({
          strike,
          isATM,
          call: callData || this.getDefaultOptionData(),
          put: putData || this.getDefaultOptionData(),
          callSymbol: ceSymbol,
          putSymbol: peSymbol
        });
      }
      
      const result = {
        symbol,
        displayName: config.displayName,
        expiryDate,
        spotPrice,
        optionChain,
        timestamp: new Date().toISOString(),
        lotSize: config.lotSize
      };
      
      this.cache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });
      
      console.log(`✅ Option chain fetched successfully: ${optionChain.length} strikes`);
      
      return result;
      
    } catch (error) {
      console.error(`❌ Error fetching option chain:`, error);
      throw error;
    }
  }

  /**
   * Get default option data when contract is not available
   */
  getDefaultOptionData() {
    return {
      ltp: 0,
      open: 0,
      high: 0,
      low: 0,
      close: 0,
      volume: 0,
      oi: 0,
      change: 0,
      changePercent: 0,
      bidPrice: 0,
      bidQty: 0,
      askPrice: 0,
      askQty: 0,
      timestamp: new Date().toISOString()
    };
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get available expiry dates
   */
  async getExpiryDates(symbol) {
    const expiries = [];
    const today = new Date();
    
    let nextThursday = new Date(today);
    nextThursday.setDate(today.getDate() + ((4 - today.getDay() + 7) % 7));
    
    for (let i = 0; i < 4; i++) {
      const expiry = new Date(nextThursday);
      expiry.setDate(nextThursday.getDate() + (i * 7));
      
      const day = String(expiry.getDate()).padStart(2, '0');
      const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 
                          'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
      const month = monthNames[expiry.getMonth()];
      const year = expiry.getFullYear();
      
      expiries.push({
        date: `${day}-${month}-${year}`,
        formatted: `${day} ${month} ${year}`,
        type: i === 0 ? 'weekly' : 'weekly'
      });
    }
    
    const lastThursday = this.getLastThursday(today);
    const day = String(lastThursday.getDate()).padStart(2, '0');
    const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 
                        'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const month = monthNames[lastThursday.getMonth()];
    const year = lastThursday.getFullYear();
    
    expiries.push({
      date: `${day}-${month}-${year}`,
      formatted: `${day} ${month} ${year}`,
      type: 'monthly'
    });
    
    return expiries;
  }

  getLastThursday(date) {
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    const lastThursday = new Date(lastDay);
    
    while (lastThursday.getDay() !== 4) {
      lastThursday.setDate(lastThursday.getDate() - 1);
    }
    
    return lastThursday;
  }

  clearCache() {
    this.cache.clear();
    console.log("🗑️  Option chain cache cleared");
  }
}

module.exports = OptionService;