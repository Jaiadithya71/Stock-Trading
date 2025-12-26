// ============================================================================
// FILE: optionService_ENHANCED.js
// Uses proper Angel One APIs for better option chain data
// - market_data API for quotes (LTP, OI, bid/ask)
// - optionGreek API for Greeks and IV
// ============================================================================

const { OPTION_SYMBOLS, OPTION_CONFIG, OPTION_TYPES } = require("../config/constants");

class OptionService {
  constructor(smartAPI) {
    this.smartAPI = smartAPI;
    this.cache = new Map();
    this.CACHE_DURATION = 10000;
  }

  // ========================================================================
  // 1. GET SPOT PRICE
  // ========================================================================
  async getSpotPrice(symbol) {
    const config = OPTION_SYMBOLS[symbol];
    if (!config) throw new Error(`Invalid symbol: ${symbol}`);

    const cacheKey = `spot_${symbol}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 5000) {
      return cached.data;
    }

    try {
      const now = new Date();
      const fromDate = new Date(now.getTime() - 4 * 60 * 60 * 1000);
      
      const response = await this.smartAPI.getCandleData({
        exchange: config.spotExchange,
        symboltoken: config.token,
        interval: "ONE_MINUTE",
        fromdate: this.formatDateTime(fromDate),
        todate: this.formatDateTime(now)
      });

      if (response?.status && response.data?.length > 0) {
        const latestCandle = response.data[response.data.length - 1];
        const spotPrice = parseFloat(latestCandle[4]);
        
        this.cache.set(cacheKey, { data: spotPrice, timestamp: Date.now() });
        console.log(`✅ Spot price: ₹${spotPrice.toFixed(2)}`);
        return spotPrice;
      }

      return null;
    } catch (error) {
      console.error(`❌ Error fetching spot price: ${error.message}`);
      return null;
    }
  }

  // ========================================================================
  // 2. GET EXPIRY DATES
  // ========================================================================
  async getExpiryDates(symbol) {
    console.log(`\n🔍 Finding expiry dates for ${symbol}...`);
    
    try {
      const searchResponse = await this.smartAPI.searchScrip({
        exchange: OPTION_SYMBOLS[symbol].exchange,
        searchscrip: symbol
      });

      // Handle both array and object with data property
      let contracts = Array.isArray(searchResponse) ? searchResponse : searchResponse?.data;

      if (!contracts || contracts.length === 0) {
        console.log(`⚠️  No contracts found`);
        return [];
      }

      console.log(`✅ Found ${contracts.length} total contracts`);

      // Extract unique expiry dates
      const expirySet = new Set();
      const expiryMap = {};

      contracts.forEach(contract => {
        const symbolName = contract.tradingsymbol || contract.symbol;
        const match = symbolName.match(/([0-9]{2}[A-Z]{3}[0-9]{2})/);
        
        if (match) {
          const dateStr = match[1];
          
          if (!expirySet.has(dateStr)) {
            expirySet.add(dateStr);
            const day = dateStr.slice(0, 2);
            const month = dateStr.slice(2, 5);
            const year = "20" + dateStr.slice(5, 7);
            
            expiryMap[dateStr] = {
              date: `${day}-${month}-${year}`,
              formatted: `${day} ${month} ${year}`,
              type: 'monthly',
              searchString: dateStr
            };
          }
        }
      });

      const expiries = Object.values(expiryMap).sort((a, b) => {
        const dateA = this.parseExpiryDate(a.date);
        const dateB = this.parseExpiryDate(b.date);
        return dateA - dateB;
      });

      const today = new Date();
      const futureExpiries = expiries.filter(exp => {
        const expDate = this.parseExpiryDate(exp.date);
        return expDate >= today;
      });

      console.log(`✅ Found ${futureExpiries.length} future expiries`);
      return futureExpiries;

    } catch (error) {
      console.error(`❌ Error finding expiry dates: ${error.message}`);
      return [];
    }
  }

  // ========================================================================
  // 3. SEARCH OPTION CONTRACTS
  // ========================================================================
  async searchOptionContracts(symbol, expiryDate) {
    const config = OPTION_SYMBOLS[symbol];
    const searchPatterns = [
      `${symbol}${this.formatExpiryForSymbol(expiryDate)}`,
      symbol
    ];
    
    for (const pattern of searchPatterns) {
      try {
        const response = await this.smartAPI.searchScrip({
          exchange: config.exchange,
          searchscrip: pattern
        });

        let contractsList = Array.isArray(response) ? response : response?.data;

        if (contractsList && contractsList.length > 0) {
          const expiryStr = this.formatExpiryForSymbol(expiryDate);
          const filtered = contractsList.filter(contract => {
            const symbolName = contract.tradingsymbol || contract.symbol;
            return symbolName.includes(expiryStr);
          });

          if (filtered.length > 0) {
            console.log(`✅ Found ${filtered.length} contracts`);
            return filtered;
          }
        }
      } catch (error) {
        // Try next pattern
      }
    }
    
    return [];
  }

  // ========================================================================
  // 4. GET MARKET DATA (BATCH) - Using market_data API
  // ========================================================================
  /**
   * Get market data for multiple contracts using the quote API
   * This gives us: LTP, bid/ask, OI, volume, etc.
   */
  async getMarketDataBatch(contracts, exchange) {
    try {
      // Build the request - Angel One format (from example)
      const params = {
        mode: "FULL", // FULL gives all data including OI
        exchangeTokens: {}
      };
      
      // Group tokens by exchange
      params.exchangeTokens[exchange] = contracts.map(c => 
        c.symboltoken || c.token
      );
      
      console.log(`📡 Fetching market data for ${contracts.length} contracts...`);
      console.log(`   Params: ${JSON.stringify(params)}`);
      
      const response = await this.smartAPI.marketData(params); // FIXED: marketData not getMarketData
      
      console.log(`   Response: ${JSON.stringify(response, null, 2)}`);
      
      if (response?.status && response.data?.fetched) {
        console.log(`✅ Got market data for ${response.data.fetched.length} contracts`);
        
        // Map response back to contracts
        const dataMap = {};
        response.data.fetched.forEach(item => {
          const token = item.symbolToken || item.token;
          dataMap[token] = {
            ltp: parseFloat(item.ltp || item.close || 0),
            open: parseFloat(item.open || 0),
            high: parseFloat(item.high || 0),
            low: parseFloat(item.low || 0),
            close: parseFloat(item.close || 0),
            volume: parseInt(item.volume || item.totVolume || 0),
            oi: parseInt(item.oi || item.opnInterest || 0),
            oiChange: parseFloat(item.oiChange || item.oichangepercent || 0),
            bidPrice: parseFloat(item.bidPrice || 0),
            bidQty: parseInt(item.bidQty || 0),
            askPrice: parseFloat(item.askPrice || 0),
            askQty: parseInt(item.askQty || 0),
            timestamp: new Date().toISOString()
          };
        });
        
        return dataMap;
      }
      
      return null;
    } catch (error) {
      console.error(`❌ Market data batch error: ${error.message}`);
      return null;
    }
  }

  // ========================================================================
  // 5. GET OPTION GREEKS (BATCH)
  // ========================================================================
  /**
   * Get Greeks and IV for option contracts
   * NOTE: Based on example, optionGreek takes name (underlying) and expirydate
   * Format: { "name": "TCS", "expirydate": "25JAN2024" }
   * This might not work for individual contracts - may need different approach
   */
  async getOptionGreeksBatch(symbol, expiryDate) {
    try {
      // Format expiry as DDMMMYYYY (e.g., "25JAN2024")
      const formattedExpiry = this.formatExpiryForGreeks(expiryDate);
      
      const params = {
        name: symbol, // Underlying symbol (BANKNIFTY, NIFTY, etc.)
        expirydate: formattedExpiry
      };
      
      console.log(`📊 Fetching option Greeks for ${symbol} ${formattedExpiry}...`);
      console.log(`   Params: ${JSON.stringify(params)}`);
      
      const response = await this.smartAPI.optionGreek(params);
      
      console.log(`   Response: ${JSON.stringify(response, null, 2)}`);
      
      if (response?.status && response.data) {
        console.log(`✅ Got Greeks data`);
        
        // Response structure might be different
        // Parse and return what we get
        return response.data;
      }
      
      return null;
    } catch (error) {
      console.error(`⚠️  Greeks data unavailable: ${error.message}`);
      return null;
    }
  }
  
  /**
   * Format expiry date for optionGreek API
   * Input: "31-JAN-2026" -> Output: "31JAN2026"
   */
  formatExpiryForGreeks(expiryDate) {
    if (typeof expiryDate === 'string') {
      const parts = expiryDate.split('-');
      if (parts.length === 3) {
        const [day, month, year] = parts;
        return `${day}${month}${year}`;
      }
    }
    return expiryDate;
  }

  // ========================================================================
  // 6. GET OPTION CHAIN - ENHANCED with proper APIs
  // ========================================================================
  async getOptionChain(symbol, expiryDate, onProgress = null) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📊 Fetching option chain: ${symbol} - ${expiryDate}`);
    console.log('='.repeat(80));
    
    const startTime = Date.now();
    const results = {
      success: false,
      symbol,
      displayName: OPTION_SYMBOLS[symbol].displayName,
      expiryDate,
      spotPrice: null,
      optionChain: [],
      errors: [],
      warnings: [],
      fetchTime: 0,
      totalContracts: 0,
      successfulContracts: 0,
      dataSource: 'market_data_api' // New field
    };
    
    try {
      // Step 1: Get spot price
      results.spotPrice = await this.getSpotPrice(symbol);
      if (!results.spotPrice) {
        results.errors.push('Spot price unavailable');
        results.success = false;
        return results;
      }
      
      // Step 2: Get expiries
      let expiries = await this.getExpiryDates(symbol);
      if (expiries.length === 0) {
        results.errors.push('No expiries available');
        results.success = false;
        return results;
      }
      
      const requestedExpiry = expiries.find(e => e.date === expiryDate);
      if (!requestedExpiry) {
        expiryDate = expiries[0].date;
        results.expiryDate = expiryDate;
        results.warnings.push(`Using ${expiries[0].formatted}`);
      }
      
      // Step 3: Search contracts
      let contracts = await this.searchOptionContracts(symbol, expiryDate);
      if (!contracts || contracts.length === 0) {
        results.errors.push('No contracts found');
        results.success = false;
        return results;
      }
      
      // Step 4: Calculate strikes
      const strikes = this.calculateStrikes(results.spotPrice, symbol);
      const config = OPTION_SYMBOLS[symbol];
      
      // Build contract lists for each strike
      const contractsToFetch = [];
      const contractMap = {};
      
      contracts.forEach(c => {
        const symbolName = c.tradingsymbol || c.symbol;
        contractMap[symbolName] = c;
      });
      
      strikes.forEach(strike => {
        const ceSymbol = this.buildTradingSymbol(symbol, expiryDate, strike, 'CE');
        const peSymbol = this.buildTradingSymbol(symbol, expiryDate, strike, 'PE');
        
        if (contractMap[ceSymbol]) contractsToFetch.push(contractMap[ceSymbol]);
        if (contractMap[peSymbol]) contractsToFetch.push(contractMap[peSymbol]);
      });
      
      results.totalContracts = contractsToFetch.length;
      
      if (contractsToFetch.length === 0) {
        results.errors.push('No matching contracts');
        results.success = false;
        return results;
      }
      
      // Step 5: Fetch market data (batch)
      const marketDataMap = await this.getMarketDataBatch(contractsToFetch, config.exchange);
      
      // Step 6: Fetch Greeks (batch) - Note: This gets Greeks for ALL options of this expiry
      const greeksData = await this.getOptionGreeksBatch(symbol, expiryDate);
      
      // Step 7: Build option chain
      strikes.forEach(strike => {
        const ceSymbol = this.buildTradingSymbol(symbol, expiryDate, strike, 'CE');
        const peSymbol = this.buildTradingSymbol(symbol, expiryDate, strike, 'PE');
        
        const ceContract = contractMap[ceSymbol];
        const peContract = contractMap[peSymbol];
        
        const ceToken = ceContract?.symboltoken || ceContract?.token;
        const peToken = peContract?.symboltoken || peContract?.token;
        
        const callData = marketDataMap?.[ceToken];
        const putData = marketDataMap?.[peToken];
        
        // Greeks data structure is unknown - need to map it when we see actual response
        // For now, attach raw greeks data if available
        
        if (callData || putData) {
          results.optionChain.push({
            strike,
            isATM: Math.abs(strike - results.spotPrice) < config.strikeInterval / 2,
            call: callData ? {
              ...callData,
              greeks: greeksData // Will need to extract specific contract greeks from this
            } : null,
            put: putData ? {
              ...putData,
              greeks: greeksData // Will need to extract specific contract greeks from this
            } : null,
            callSymbol: ceSymbol,
            putSymbol: peSymbol
          });
        }
      });
      
      results.successfulContracts = results.optionChain.length * 2;
      results.fetchTime = Date.now() - startTime;
      results.success = true;
      results.lotSize = config.lotSize;
      
      console.log(`\n✅ Option chain built successfully`);
      console.log(`   Strikes: ${results.optionChain.length}`);
      console.log(`   Data source: ${results.dataSource}`);
      console.log(`   Time: ${results.fetchTime}ms`);
      
      return results;
      
    } catch (error) {
      results.success = false;
      results.errors.push(error.message);
      results.fetchTime = Date.now() - startTime;
      return results;
    }
  }

  // ========================================================================
  // HELPER FUNCTIONS
  // ========================================================================
  
  calculateStrikes(spotPrice, symbol) {
    const config = OPTION_SYMBOLS[symbol];
    const interval = config.strikeInterval;
    const baseStrike = Math.round(spotPrice / interval) * interval;
    const strikes = [];
    
    for (let i = -15; i <= 15; i++) {
      strikes.push(baseStrike + (i * interval));
    }
    
    return strikes;
  }

  buildTradingSymbol(symbol, expiryDate, strikePrice, optionType) {
    const dateStr = this.formatExpiryForSymbol(expiryDate);
    return `${symbol}${dateStr}${strikePrice}${optionType}`;
  }

  formatExpiryForSymbol(expiryDate) {
    if (typeof expiryDate === 'string') {
      const parts = expiryDate.split('-');
      if (parts.length === 3) {
        const [day, month, year] = parts;
        const shortYear = year.slice(-2);
        return `${day}${month}${shortYear}`;
      }
      return expiryDate.replace(/-/g, '');
    }
    return expiryDate;
  }

  parseExpiryDate(dateStr) {
    const [day, month, year] = dateStr.split('-');
    const monthMap = {
      'JAN': 0, 'FEB': 1, 'MAR': 2, 'APR': 3, 'MAY': 4, 'JUN': 5,
      'JUL': 6, 'AUG': 7, 'SEP': 8, 'OCT': 9, 'NOV': 10, 'DEC': 11
    };
    return new Date(parseInt(year), monthMap[month], parseInt(day));
  }

  formatDateTime(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  clearCache() {
    this.cache.clear();
  }
}

module.exports = OptionService;