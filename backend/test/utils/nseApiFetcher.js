// backend/test/utils/nseApiFetcher.js
// Fetch option chain data directly from NSE website

const https = require('https');

class NSEApiFetcher {
  constructor(outputPath) {
    this.outputPath = outputPath;
    this.baseUrl = 'https://www.nseindia.com';
    this.cookies = null;
    this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  }

  /**
   * Initialize session by visiting homepage (required to get cookies)
   */
  async initSession() {
    console.log('🔐 Initializing NSE session...');
    
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'www.nseindia.com',
        port: 443,
        path: '/',
        method: 'GET',
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
        }
      };

      const req = https.request(options, (res) => {
        // Extract cookies
        const setCookie = res.headers['set-cookie'];
        if (setCookie) {
          this.cookies = setCookie.map(cookie => cookie.split(';')[0]).join('; ');
          console.log('✅ Session initialized, cookies obtained');
        }
        
        // Drain response
        res.on('data', () => {});
        res.on('end', () => resolve(true));
      });

      req.on('error', (error) => {
        console.error('❌ Session init error:', error.message);
        reject(error);
      });

      req.setTimeout(10000, () => {
        req.destroy();
        reject(new Error('Session init timeout'));
      });

      req.end();
    });
  }

  /**
   * Format expiry date for NSE API
   * Angel One format: "30DEC2025"
   * NSE format: "30-Dec-2025"
   */
  formatExpiryForNSE(angelExpiry) {
    // angelExpiry = "30DEC2025"
    const day = angelExpiry.substring(0, 2);
    const month = angelExpiry.substring(2, 5);
    const year = angelExpiry.substring(5, 9);
    
    // Capitalize first letter only
    const monthFormatted = month.charAt(0) + month.substring(1).toLowerCase();
    
    return `${day}-${monthFormatted}-${year}`;
  }

  /**
   * Fetch option chain from NSE
   */
  async fetchOptionChain(symbol = 'BANKNIFTY', expiry = '30DEC2025') {
    // Format expiry for NSE API
    const nseExpiry = this.formatExpiryForNSE(expiry);
    
    console.log(`\n📊 Fetching NSE Option Chain...`);
    console.log(`   Symbol: ${symbol}`);
    console.log(`   Expiry: ${nseExpiry}`);
    
    // Initialize session if needed
    if (!this.cookies) {
      await this.initSession();
      // Wait a bit for cookies to be valid
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // NSE API v3 endpoint with expiry parameter
    let nseSymbol = symbol;
    if (symbol === 'BANKNIFTY') {
      nseSymbol = 'BANKNIFTY';
    } else if (symbol === 'FINNIFTY') {
      nseSymbol = 'FINNIFTY';
    } else if (symbol === 'NIFTY') {
      nseSymbol = 'NIFTY';
    }
    
    // Use option-chain-v3 API with type and expiry
    const path = `/api/option-chain-v3?type=Indices&symbol=${nseSymbol}&expiry=${encodeURIComponent(nseExpiry)}`;
    console.log(`   URL: ${this.baseUrl}${path}`);

    return new Promise((resolve, reject) => {
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

      const req = https.request(options, (res) => {
        const chunks = [];
        
        // Handle gzip/deflate compression
        const encoding = res.headers['content-encoding'];
        let stream = res;
        
        if (encoding === 'gzip') {
          const zlib = require('zlib');
          stream = res.pipe(zlib.createGunzip());
        } else if (encoding === 'deflate') {
          const zlib = require('zlib');
          stream = res.pipe(zlib.createInflate());
        } else if (encoding === 'br') {
          const zlib = require('zlib');
          stream = res.pipe(zlib.createBrotliDecompress());
        }

        stream.on('data', (chunk) => {
          chunks.push(chunk);
        });

        stream.on('end', () => {
          try {
            const data = Buffer.concat(chunks).toString('utf8');
            
            // Check if data is empty
            if (!data || data.trim().length === 0) {
              console.error('❌ Empty response from NSE');
              reject(new Error('Empty response from NSE'));
              return;
            }
            
            const json = JSON.parse(data);
            
            // V3 API structure: json.records.data (not nested inside json.data)
            if (json.records && json.records.data) {
              const dataArray = json.records.data;
              console.log(`✅ Fetched ${dataArray.length} option entries from NSE`);
              
              // Filter out entries with zero strike price (invalid data)
              const validData = dataArray.filter(item => {
                const ceStrike = item.CE?.strikePrice || 0;
                const peStrike = item.PE?.strikePrice || 0;
                return ceStrike > 0 || peStrike > 0;
              });
              
              console.log(`✅ Found ${validData.length} valid option contracts`);
              
              resolve({
                success: true,
                underlyingValue: json.records.underlyingValue,
                timestamp: json.records.timestamp,
                expiry: nseExpiry,
                data: validData,
                raw: json
              });
            } else {
              console.error('❌ Unexpected response structure');
              console.log('Response keys:', Object.keys(json));
              if (json.records) {
                console.log('Records keys:', Object.keys(json.records));
              }
              reject(new Error('Invalid response structure from NSE'));
            }
          } catch (error) {
            console.error('❌ Parse error:', error.message);
            console.log('Raw response (first 200 chars):', Buffer.concat(chunks).toString('utf8').substring(0, 200));
            reject(error);
          }
        });

        stream.on('error', (error) => {
          console.error('❌ Stream error:', error.message);
          reject(error);
        });
      });

      req.on('error', (error) => {
        console.error('❌ Request error:', error.message);
        reject(error);
      });

      req.setTimeout(15000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.end();
    });
  }

  /**
   * Parse NSE data into simplified format
   */
  parseNSEData(nseData) {
    const optionChain = {
      symbol: 'BANKNIFTY',
      expiry: nseData.expiry,
      underlyingValue: nseData.underlyingValue,
      timestamp: nseData.timestamp,
      strikes: {}
    };

    nseData.data.forEach(item => {
      // In v3 API, CE and PE might have different strike prices
      // We need to handle both
      
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
          bidQty: item.CE.buyQuantity1 || item.CE.bidQty,
          bidprice: item.CE.buyPrice1 || item.CE.bidprice,
          askQty: item.CE.sellQuantity1 || item.CE.askQty,
          askPrice: item.CE.sellPrice1 || item.CE.askPrice,
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
          bidQty: item.PE.buyQuantity1 || item.PE.bidQty,
          bidprice: item.PE.buyPrice1 || item.PE.bidprice,
          askQty: item.PE.sellQuantity1 || item.PE.askQty,
          askPrice: item.PE.sellPrice1 || item.PE.askPrice,
          underlyingValue: item.PE.underlyingValue
        };
      }
    });

    const strikeCount = Object.keys(optionChain.strikes).length;
    console.log(`✅ Parsed ${strikeCount} unique strikes`);
    
    // Count CE and PE
    let ceCount = 0, peCount = 0;
    Object.values(optionChain.strikes).forEach(strike => {
      if (strike.CE) ceCount++;
      if (strike.PE) peCount++;
    });
    console.log(`   Calls: ${ceCount}, Puts: ${peCount}`);

    return optionChain;
  }

  /**
   * Get option chain in simplified format
   */
  async getOptionChain(symbol = 'BANKNIFTY', expiry = '30DEC2025') {
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
   * Get available expiry dates
   */
  async getExpiryDates(symbol = 'BANKNIFTY') {
    try {
      const nseData = await this.fetchOptionChain(symbol, null);
      
      // Extract unique expiry dates
      const expiries = new Set();
      nseData.data.forEach(item => {
        if (item.expiryDate) {
          expiries.add(item.expiryDate);
        }
      });
      
      return Array.from(expiries).sort();
    } catch (error) {
      console.error('❌ Error fetching expiries:', error.message);
      return [];
    }
  }
}

module.exports = NSEApiFetcher;