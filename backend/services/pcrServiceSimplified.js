// ============================================================================
// FILE: backend/services/pcrServiceSimplified.js
// SIMPLIFIED PCR Service using Angel One's putCallRatio API
// Much faster - uses direct API instead of manual calculation
// ============================================================================

class PCRServiceSimplified {
  constructor(smartAPI) {
    this.smartAPI = smartAPI;
    this.cache = new Map();
    this.CACHE_DURATION = 60000; // 1 minute cache
  }

  /**
   * Get PCR data using Angel One's putCallRatio API
   * @returns {Object} PCR data with analysis
   */
  async getPCRData() {
    console.log(`\n${'='.repeat(100)}`);
    console.log(`📊 FETCHING PCR DATA USING putCallRatio API`);
    console.log('='.repeat(100));

    const startTime = Date.now();
    
    try {
      // Call the putCallRatio API
      console.log('\n⏳ Calling putCallRatio API...');
      const response = await this.smartAPI.putCallRatio();
      
      if (!response || !response.status) {
        throw new Error(response?.message || 'Failed to fetch PCR data');
      }

      console.log(`✅ Received PCR data for ${response.data.length} symbols`);

      // Debug: Show sample symbols to understand the format
      console.log('\n📋 Sample symbols returned:');
      response.data.slice(0, 10).forEach((item, idx) => {
        console.log(`   ${idx + 1}. ${item.tradingSymbol} - PCR: ${item.pcr}`);
      });

      // Filter for BANKNIFTY (try both futures and options)
      const bankniftyAll = response.data.filter(item => {
        const symbol = item.tradingSymbol || '';
        return symbol.includes('BANKNIFTY');
      });

      console.log(`\n✅ Found ${bankniftyAll.length} BANKNIFTY entries (futures + options)`);

      // Separate futures and options
      const bankniftyFutures = bankniftyAll.filter(item => 
        (item.tradingSymbol || '').includes('FUT')
      );
      
      const bankniftyOptions = bankniftyAll.filter(item => 
        !(item.tradingSymbol || '').includes('FUT')
      );

      console.log(`   Futures: ${bankniftyFutures.length}`);
      console.log(`   Options: ${bankniftyOptions.length}`);

      // Use whichever we have data for
      let bankniftyPCR = bankniftyOptions.length > 0 ? bankniftyOptions : bankniftyFutures;
      
      if (bankniftyPCR.length === 0) {
        console.log('\n⚠️  No BANKNIFTY data found. Using overall market PCR instead.');
        // Calculate overall PCR from all symbols
        const totalPCR = response.data.reduce((sum, item) => sum + (item.pcr || 0), 0) / response.data.length;
        
        return {
          symbol: 'OVERALL_MARKET',
          displayName: 'Overall Market',
          timestamp: new Date().toISOString(),
          currentValue: {
            oiPCR: totalPCR.toFixed(2),
            volumePCR: 'N/A',
          },
          nearestExpiry: {
            date: 'ALL',
            pcr: totalPCR.toFixed(4),
            sentiment: this.determineSentiment(totalPCR),
            symbolCount: response.data.length
          },
          allExpiries: [{
            date: 'ALL',
            pcr: totalPCR.toFixed(4),
            sentiment: this.determineSentiment(totalPCR),
            symbolCount: response.data.length
          }],
          grandTotal: {
            sentiment: this.determineSentiment(totalPCR),
            interpretation: this.getInterpretation(totalPCR)
          },
          fetchTime: Date.now() - startTime,
          dataSource: 'putCallRatio API (Overall Market)',
          totalSymbols: response.data.length
        };
      }

      console.log(`✅ Using ${bankniftyPCR.length} BANKNIFTY ${bankniftyOptions.length > 0 ? 'option' : 'future'} entries`);

      // If we have multiple expiries, get the nearest one
      const pcrByExpiry = this.groupByExpiry(bankniftyPCR);
      
      // Check if we have any expiry data
      if (Object.keys(pcrByExpiry).length === 0) {
        console.log('\n⚠️  No expiry data found. Calculating simple average PCR.');
        
        const avgPCR = bankniftyPCR.reduce((sum, item) => sum + (item.pcr || 0), 0) / bankniftyPCR.length;
        
        return {
          symbol: 'BANKNIFTY',
          displayName: 'Bank Nifty',
          timestamp: new Date().toISOString(),
          currentValue: {
            oiPCR: avgPCR.toFixed(2),
            volumePCR: 'N/A',
          },
          nearestExpiry: {
            date: 'UNKNOWN',
            pcr: avgPCR.toFixed(4),
            sentiment: this.determineSentiment(avgPCR),
            symbolCount: bankniftyPCR.length
          },
          allExpiries: [{
            date: 'AVERAGE',
            pcr: avgPCR.toFixed(4),
            sentiment: this.determineSentiment(avgPCR),
            symbolCount: bankniftyPCR.length
          }],
          grandTotal: {
            sentiment: this.determineSentiment(avgPCR),
            interpretation: this.getInterpretation(avgPCR)
          },
          fetchTime: Date.now() - startTime,
          dataSource: 'putCallRatio API (Average)',
          totalSymbols: bankniftyPCR.length
        };
      }
      
      // Log all available expiries
      console.log(`\n📅 Available Expiries with PCR:`);
      Object.keys(pcrByExpiry).forEach((expiry, idx) => {
        const data = pcrByExpiry[expiry];
        console.log(`   ${idx + 1}. ${expiry}: PCR = ${data.pcr.toFixed(4)} (${data.symbols.length} symbols)`);
      });

      // Use nearest expiry
      const expiries = Object.keys(pcrByExpiry).sort();
      const nearestExpiry = expiries[0];
      const nearestPCRData = pcrByExpiry[nearestExpiry];

      console.log(`\n✅ Using nearest expiry: ${nearestExpiry}`);
      console.log(`   PCR: ${nearestPCRData.pcr.toFixed(4)}`);

      // Determine sentiment
      const sentiment = this.determineSentiment(nearestPCRData.pcr);
      
      // Build response
      const pcrData = {
        symbol: 'BANKNIFTY',
        displayName: 'Bank Nifty',
        timestamp: new Date().toISOString(),
        currentValue: {
          oiPCR: nearestPCRData.pcr.toFixed(2),
          volumePCR: 'N/A', // API doesn't provide volume-based PCR
        },
        nearestExpiry: {
          date: nearestExpiry,
          pcr: nearestPCRData.pcr.toFixed(4),
          sentiment: sentiment,
          symbolCount: nearestPCRData.symbols.length
        },
        allExpiries: Object.keys(pcrByExpiry).map(expiry => ({
          date: expiry,
          pcr: pcrByExpiry[expiry].pcr.toFixed(4),
          sentiment: this.determineSentiment(pcrByExpiry[expiry].pcr),
          symbolCount: pcrByExpiry[expiry].symbols.length
        })),
        grandTotal: {
          sentiment: sentiment,
          interpretation: this.getInterpretation(nearestPCRData.pcr)
        },
        fetchTime: Date.now() - startTime,
        dataSource: 'putCallRatio API',
        totalSymbols: bankniftyPCR.length
      };

      console.log(`\n📊 Analysis:`);
      console.log(`   PCR: ${pcrData.currentValue.oiPCR}`);
      console.log(`   Sentiment: ${sentiment}`);
      console.log(`   Interpretation: ${pcrData.grandTotal.interpretation}`);
      console.log(`\n✅ Fetch completed in ${pcrData.fetchTime}ms`);
      console.log('='.repeat(100));

      return pcrData;

    } catch (error) {
      console.error(`❌ Error fetching PCR: ${error.message}`);
      throw error;
    }
  }

  /**
   * Group PCR data by expiry date
   */
  groupByExpiry(pcrData) {
    const byExpiry = {};

    pcrData.forEach(item => {
      const symbol = item.tradingSymbol || '';
      
      // Extract expiry from symbol (format: BANKNIFTY24DEC25...)
      const match = symbol.match(/BANKNIFTY(\d{2}[A-Z]{3}\d{2})/);
      
      if (match) {
        const expiryStr = match[1];
        
        if (!byExpiry[expiryStr]) {
          byExpiry[expiryStr] = {
            pcr: item.pcr,
            symbols: [symbol]
          };
        } else {
          // Average PCR if multiple entries for same expiry
          byExpiry[expiryStr].pcr = (byExpiry[expiryStr].pcr + item.pcr) / 2;
          byExpiry[expiryStr].symbols.push(symbol);
        }
      }
    });

    return byExpiry;
  }

  /**
   * Determine sentiment based on PCR value
   */
  determineSentiment(pcr) {
    if (typeof pcr !== 'number') return 'Neutral';

    // PCR interpretation:
    // PCR > 1.2: More puts than calls (Bearish/Selling)
    // PCR < 0.8: More calls than puts (Bullish/Buying)
    // 0.8 - 1.2: Neutral

    if (pcr > 1.2) {
      return 'Selling'; // Bearish
    } else if (pcr < 0.8) {
      return 'Buying'; // Bullish
    } else {
      return 'Neutral';
    }
  }

  /**
   * Get interpretation text
   */
  getInterpretation(pcr) {
    if (typeof pcr !== 'number') return 'Unable to determine';

    if (pcr > 1.5) {
      return 'Very Bearish - High put activity suggests strong selling pressure';
    } else if (pcr > 1.2) {
      return 'Bearish - More puts than calls, market expecting downside';
    } else if (pcr < 0.6) {
      return 'Very Bullish - High call activity suggests strong buying pressure';
    } else if (pcr < 0.8) {
      return 'Bullish - More calls than puts, market expecting upside';
    } else {
      return 'Neutral - Balanced put-call activity, market undecided';
    }
  }

  /**
   * Get PCR for specific symbol (if needed)
   */
  async getPCRForSymbol(symbol) {
    const response = await this.smartAPI.putCallRatio();
    
    if (!response || !response.status) {
      return null;
    }

    const filtered = response.data.filter(item => 
      (item.tradingSymbol || '').includes(symbol)
    );

    return filtered;
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }
}

module.exports = PCRServiceSimplified;