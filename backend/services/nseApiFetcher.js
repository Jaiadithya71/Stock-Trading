// backend/services/nseApiFetcher.js - NON-BLOCKING VERSION WITH TIMEOUT
const https = require('https');
const zlib = require('zlib');

class NSEApiFetcher {
  constructor() {
    this.baseUrl = 'https://www.nseindia.com';
    this.cookies = null;
    this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    this.sessionInitialized = false;
    this.REQUEST_TIMEOUT = 10000; // 10 second timeout
  }

  /**
   * Make HTTP request with timeout protection
   * NON-BLOCKING: Uses promises properly
   */
  async makeRequest(options, timeout = this.REQUEST_TIMEOUT) {
    return Promise.race([
      this._makeRequestInternal(options),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), timeout)
      )
    ]);
  }

  /**
   * Internal request handler
   */
  _makeRequestInternal(options) {
    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        const chunks = [];
        
        // Handle compression
        let stream = res;
        const encoding = res.headers['content-encoding'];
        
        if (encoding === 'gzip') {
          stream = res.pipe(zlib.createGunzip());
        } else if (encoding === 'deflate') {
          stream = res.pipe(zlib.createInflate());
        } else if (encoding === 'br') {
          stream = res.pipe(zlib.createBrotliDecompress());
        }

        stream.on('data', (chunk) => chunks.push(chunk));
        
        stream.on('end', () => {
          try {
            const data = Buffer.concat(chunks).toString('utf8');
            resolve({
              statusCode: res.statusCode,
              headers: res.headers,
              data: data
            });
          } catch (error) {
            reject(error);
          }
        });

        stream.on('error', (error) => reject(error));
      });

      req.on('error', (error) => reject(error));
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.setTimeout(this.REQUEST_TIMEOUT);
      req.end();
    });
  }

  /**
   * Initialize session by visiting homepage
   * NON-BLOCKING: Returns immediately with Promise
   */
  async initSession() {
    if (this.sessionInitialized && this.cookies) {
      return true;
    }

    console.log('🔐 Initializing NSE session...');
    
    try {
      const options = {
        hostname: 'www.nseindia.com',
        port: 443,
        path: '/',
        method: 'GET',
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
        }
      };

      const response = await this.makeRequest(options, 5000); // 5s timeout for session init
      
      // Extract cookies
      const setCookieHeaders = response.headers['set-cookie'];
      if (setCookieHeaders) {
        this.cookies = Array.isArray(setCookieHeaders) 
          ? setCookieHeaders.map(c => c.split(';')[0]).join('; ')
          : setCookieHeaders.split(';')[0];
        this.sessionInitialized = true;
        return true;
      } else {
        this.sessionInitialized = true;
        return true;
      }
    } catch (error) {
      console.error('❌ Session init failed:', error.message);
      // Continue anyway - sometimes NSE works without session
      this.sessionInitialized = true;
      return true;
    }
  }

  /**
   * Format expiry date for NSE API
   */
  formatExpiryForNSE(angelExpiry) {
    const day = angelExpiry.substring(0, 2);
    const month = angelExpiry.substring(2, 5);
    const year = angelExpiry.substring(5, 9);
    const monthFormatted = month.charAt(0) + month.substring(1).toLowerCase();
    return `${day}-${monthFormatted}-${year}`;
  }

  /**
   * Fetch option chain from NSE
   * NON-BLOCKING: Properly uses async/await
   */
  async fetchOptionChain(symbol = 'BANKNIFTY', expiry) {
    if (!expiry) {
      throw new Error('Expiry date is required for NSE API');
    }

    // Initialize session (with timeout)
    await this.initSession();
    
    // Small delay after session init (NSE sometimes needs this)
    await new Promise(resolve => setTimeout(resolve, 500));

    // Map symbols
    let nseSymbol = symbol;
    if (symbol === 'BANKNIFTY') {
      nseSymbol = 'BANKNIFTY';
    } else if (symbol === 'FINNIFTY') {
      nseSymbol = 'FINNIFTY';
    } else if (symbol === 'NIFTY') {
      nseSymbol = 'NIFTY';
    } else if (symbol === 'MIDCPNIFTY') {
      nseSymbol = 'MIDCPNIFTY';
    }
    
    // Build URL with expiry
    const path = `/api/option-chain-v3?type=Indices&symbol=${nseSymbol}&expiry=${encodeURIComponent(expiry)}`;

    try {
      const options = {
        hostname: 'www.nseindia.com',
        port: 443,
        path: path,
        method: 'GET',
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Cookie': this.cookies || '',
          'Referer': 'https://www.nseindia.com/option-chain',
          'X-Requested-With': 'XMLHttpRequest'
        }
      };

      // Make request with timeout
      const response = await this.makeRequest(options, 15000); // 15s timeout for data fetch
      
      if (!response.data || response.data.trim().length === 0) {
        throw new Error('Empty response from NSE');
      }
      
      const json = JSON.parse(response.data);
      
      // NSE API v3 structure
      if (json.records && json.records.data) {
        // Filter valid data
        const validData = json.records.data.filter(item => {
          const ceStrike = item.CE?.strikePrice || 0;
          const peStrike = item.PE?.strikePrice || 0;
          return ceStrike > 0 || peStrike > 0;
        });
        
        return {
          success: true,
          underlyingValue: json.records.underlyingValue,
          timestamp: json.records.timestamp,
          expiry: expiry,
          data: validData,
          raw: json
        };
      } else {
        console.error('❌ Unexpected response structure');
        throw new Error('Invalid response structure from NSE');
      }
    } catch (error) {
      if (error.message === 'Request timeout') {
        console.error('⏱️  NSE request timed out');
      } else {
        console.error('❌ Request error:', error.message);
      }
      throw error;
    }
  }

  /**
   * Parse NSE data into simplified format
   */
  parseNSEData(nseData) {
    const optionChain = {
      symbol: nseData.raw?.records?.underlying || 'BANKNIFTY',
      expiry: nseData.expiry,
      underlyingValue: nseData.underlyingValue,
      timestamp: nseData.timestamp,
      strikes: {}
    };

    nseData.data.forEach(item => {
      // Process Call (CE)
      if (item.CE && item.CE.strikePrice && item.CE.strikePrice > 0) {
        const strike = item.CE.strikePrice;
        
        if (!optionChain.strikes[strike]) {
          optionChain.strikes[strike] = {};
        }
        
        optionChain.strikes[strike].CE = {
          strikePrice: strike,
          expiryDate: item.CE.expiryDate || item.expiryDates,
          underlying: item.CE.underlying,
          identifier: item.CE.identifier,
          openInterest: item.CE.openInterest,
          changeinOpenInterest: item.CE.changeinOpenInterest,
          pchangeinOpenInterest: item.CE.pchangeinOpenInterest,
          totalTradedVolume: item.CE.totalTradedVolume,
          impliedVolatility: item.CE.impliedVolatility,
          lastPrice: item.CE.lastPrice,
          change: item.CE.change,
          pChange: item.CE.pChange || item.CE.pchange,
          totalBuyQuantity: item.CE.totalBuyQuantity,
          totalSellQuantity: item.CE.totalSellQuantity,
          bidQty: item.CE.bidQty || item.CE.buyQuantity1,
          bidprice: item.CE.bidprice || item.CE.buyPrice1,
          askQty: item.CE.askQty || item.CE.sellQuantity1,
          askPrice: item.CE.askPrice || item.CE.sellPrice1,
          underlyingValue: item.CE.underlyingValue
        };
      }

      // Process Put (PE)
      if (item.PE && item.PE.strikePrice && item.PE.strikePrice > 0) {
        const strike = item.PE.strikePrice;
        
        if (!optionChain.strikes[strike]) {
          optionChain.strikes[strike] = {};
        }
        
        optionChain.strikes[strike].PE = {
          strikePrice: strike,
          expiryDate: item.PE.expiryDate || item.expiryDates,
          underlying: item.PE.underlying,
          identifier: item.PE.identifier,
          openInterest: item.PE.openInterest,
          changeinOpenInterest: item.PE.changeinOpenInterest,
          pchangeinOpenInterest: item.PE.pchangeinOpenInterest,
          totalTradedVolume: item.PE.totalTradedVolume,
          impliedVolatility: item.PE.impliedVolatility,
          lastPrice: item.PE.lastPrice,
          change: item.PE.change,
          pChange: item.PE.pChange || item.PE.pchange,
          totalBuyQuantity: item.PE.totalBuyQuantity,
          totalSellQuantity: item.PE.totalSellQuantity,
          bidQty: item.PE.bidQty || item.PE.buyQuantity1,
          bidprice: item.PE.bidprice || item.PE.buyPrice1,
          askQty: item.PE.askQty || item.PE.sellQuantity1,
          askPrice: item.PE.askPrice || item.PE.sellPrice1,
          underlyingValue: item.PE.underlyingValue
        };
      }
    });

    return optionChain;
  }

  /**
   * Get option chain in simplified format
   */
  async getOptionChain(symbol = 'BANKNIFTY', expiry) {
    try {
      const nseData = await this.fetchOptionChain(symbol, expiry);
      const parsed = this.parseNSEData(nseData);
      return parsed;
    } catch (error) {
      console.error('❌ Error fetching from NSE:', error.message);
      return null;
    }
  }

  /**
   * Clear session cache
   */
  clearSession() {
    this.cookies = null;
    this.sessionInitialized = false;
    console.log('🗑️  NSE session cleared');
  }
}

module.exports = NSEApiFetcher;