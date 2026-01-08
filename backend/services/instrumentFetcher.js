// backend/services/instrumentFetcher.js
// Download and filter OpenAPIScripMaster.json for expiry dates

const https = require('https');
const fs = require('fs');
const path = require('path');

class InstrumentFetcher {
  constructor() {
    this.instrumentUrl = 'https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json';
    this.cacheDir = path.join(__dirname, '../cache');
    this.instrumentsFile = path.join(this.cacheDir, 'instruments.json');
    this.CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
    
    // Ensure cache directory exists
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  /**
   * Check if cached instruments are still valid
   */
  isCacheValid() {
    if (!fs.existsSync(this.instrumentsFile)) {
      return false;
    }

    const stats = fs.statSync(this.instrumentsFile);
    const age = Date.now() - stats.mtimeMs;
    return age < this.CACHE_DURATION;
  }

  /**
   * Download instruments from Angel One
   */
  async downloadInstruments() {
    console.log('📥 Downloading instruments from Angel One...');
    
    return new Promise((resolve, reject) => {
      https.get(this.instrumentUrl, (res) => {
        const chunks = [];
        
        res.on('data', (chunk) => {
          chunks.push(chunk);
        });
        
        res.on('end', () => {
          try {
            const data = Buffer.concat(chunks).toString('utf8');
            const instruments = JSON.parse(data);
            
            console.log(`✅ Downloaded ${instruments.length} instruments`);
            
            // Save to cache
            fs.writeFileSync(this.instrumentsFile, JSON.stringify(instruments, null, 2));
            console.log(`💾 Cached to: ${this.instrumentsFile}`);
            
            resolve(instruments);
          } catch (error) {
            console.error('❌ Parse error:', error.message);
            reject(error);
          }
        });
      }).on('error', (error) => {
        console.error('❌ Download error:', error.message);
        reject(error);
      });
    });
  }

  /**
   * Load instruments from cache
   */
  loadFromCache() {
    if (!fs.existsSync(this.instrumentsFile)) {
      return null;
    }

    try {
      const data = fs.readFileSync(this.instrumentsFile, 'utf8');
      const instruments = JSON.parse(data);
      console.log(`✅ Loaded ${instruments.length} instruments from cache`);
      return instruments;
    } catch (error) {
      console.error('❌ Cache read error:', error.message);
      return null;
    }
  }

  /**
   * Get instruments (from cache or download)
   */
  async getInstruments() {
    // Try cache first
    if (this.isCacheValid()) {
      const cached = this.loadFromCache();
      if (cached) {
        return cached;
      }
    }

    // Download fresh data
    return await this.downloadInstruments();
  }

  /**
   * Get expiry dates for a symbol
   */
  async getExpiryDates(symbol = 'BANKNIFTY') {
    console.log(`\n📅 Getting expiry dates for ${symbol}...`);
    
    const instruments = await this.getInstruments();
    
    // Filter for NFO options of the symbol
    // IMPORTANT: Use 'name' field, not 'symbol' field
    const filtered = instruments.filter(inst => {
      return inst.exch_seg === 'NFO' &&
             inst.instrumenttype === 'OPTIDX' &&
             inst.name === symbol;
    });
    
    console.log(`✅ Found ${filtered.length} ${symbol} option contracts`);
    
    // Extract unique expiry dates
    const expirySet = new Set();
    filtered.forEach(inst => {
      if (inst.expiry) {
        expirySet.add(inst.expiry);
      }
    });
    
    // Convert to array and sort
    const expiries = Array.from(expirySet).sort((a, b) => {
      // Parse dates in format: "30DEC2025"
      const parseDate = (dateStr) => {
        const day = dateStr.substring(0, 2);
        const month = dateStr.substring(2, 5);
        const year = dateStr.substring(5, 9);
        const monthMap = {
          'JAN': '01', 'FEB': '02', 'MAR': '03', 'APR': '04',
          'MAY': '05', 'JUN': '06', 'JUL': '07', 'AUG': '08',
          'SEP': '09', 'OCT': '10', 'NOV': '11', 'DEC': '12'
        };
        return new Date(`${year}-${monthMap[month]}-${day}`);
      };
      
      return parseDate(a) - parseDate(b);
    });
    
    // Filter only future expiries
    const today = new Date();
    const futureExpiries = expiries.filter(exp => {
      const day = exp.substring(0, 2);
      const month = exp.substring(2, 5);
      const year = exp.substring(5, 9);
      const monthMap = {
        'JAN': '01', 'FEB': '02', 'MAR': '03', 'APR': '04',
        'MAY': '05', 'JUN': '06', 'JUL': '07', 'AUG': '08',
        'SEP': '09', 'OCT': '10', 'NOV': '11', 'DEC': '12'
      };
      const expDate = new Date(`${year}-${monthMap[month]}-${day}`);
      return expDate >= today;
    });
    
    console.log(`✅ Found ${futureExpiries.length} future expiries`);
    
    // Format for NSE API (30DEC2025 → 30-Dec-2025)
    const formattedExpiries = futureExpiries.map(exp => {
      const day = exp.substring(0, 2);
      const month = exp.substring(2, 5);
      const year = exp.substring(5, 9);
      const monthFormatted = month.charAt(0) + month.substring(1).toLowerCase();
      return `${day}-${monthFormatted}-${year}`;
    });
    
    return formattedExpiries;
  }

  /**
   * Get the nearest (current month) futures contract for a symbol
   * @param {string} symbol - Symbol name (e.g., 'BANKNIFTY', 'NIFTY')
   * @returns {Object|null} - Futures instrument with token, symbol, expiry, exchange
   */
  async getNearestFutures(symbol = 'BANKNIFTY') {
    console.log(`\n🔍 Finding nearest futures contract for ${symbol}...`);

    const instruments = await this.getInstruments();

    // Filter for futures contracts of this symbol
    const futures = instruments.filter(inst => {
      return inst.exch_seg === 'NFO' &&
             inst.instrumenttype === 'FUTIDX' &&
             inst.name === symbol;
    });

    if (futures.length === 0) {
      console.log(`❌ No futures contracts found for ${symbol}`);
      return null;
    }

    console.log(`📋 Found ${futures.length} futures contracts for ${symbol}`);

    // Parse expiry dates and find the nearest one that hasn't expired
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const parseExpiry = (dateStr) => {
      // Format: "27JAN2026"
      const day = parseInt(dateStr.substring(0, 2));
      const monthStr = dateStr.substring(2, 5);
      const year = parseInt(dateStr.substring(5, 9));
      const monthMap = {
        'JAN': 0, 'FEB': 1, 'MAR': 2, 'APR': 3,
        'MAY': 4, 'JUN': 5, 'JUL': 6, 'AUG': 7,
        'SEP': 8, 'OCT': 9, 'NOV': 10, 'DEC': 11
      };
      return new Date(year, monthMap[monthStr], day);
    };

    // Filter for future expiries and sort by date
    const validFutures = futures
      .map(f => ({
        ...f,
        expiryDate: parseExpiry(f.expiry)
      }))
      .filter(f => f.expiryDate >= today)
      .sort((a, b) => a.expiryDate - b.expiryDate);

    if (validFutures.length === 0) {
      console.log(`❌ No valid (non-expired) futures contracts found for ${symbol}`);
      return null;
    }

    const nearest = validFutures[0];
    console.log(`✅ Nearest ${symbol} futures: ${nearest.symbol} (expires: ${nearest.expiry}, token: ${nearest.token})`);

    return {
      token: nearest.token,
      symbol: nearest.symbol,
      name: nearest.name,
      expiry: nearest.expiry,
      expiryDate: nearest.expiryDate,
      exchange: 'NFO',
      lotsize: nearest.lotsize
    };
  }

  /**
   * Clear cache
   */
  clearCache() {
    if (fs.existsSync(this.instrumentsFile)) {
      fs.unlinkSync(this.instrumentsFile);
      console.log('🗑️  Cache cleared');
    }
  }
}

module.exports = InstrumentFetcher;