// ============================================================================
// FILE: backend/services/pcrCollectorService.js
// Background PCR Collector - Runs every minute to store PCR snapshots
// - Fetches option chain from NSE India public API
// - Calculates PCR from Put OI / Call OI
// - Stores snapshot in local file
// - Auto-runs in background
// ============================================================================

const PCRStorageService = require('./pcrStorageService');
const InstrumentFetcher = require('./instrumentFetcher');
const AngelOptionChainService = require('./angelOptionChainService');

class PCRCollectorService {
  constructor(smartAPI, intervalMinutes = 1) {
    this.smartAPI = smartAPI;
    this.storage = new PCRStorageService();
    this.instrumentFetcher = new InstrumentFetcher();
    this.angelOptionChainService = new AngelOptionChainService(smartAPI);
    this.intervalMinutes = intervalMinutes;
    this.intervalMs = intervalMinutes * 60 * 1000;
    this.isRunning = false;
    this.intervalId = null;
    this.collectCount = 0;
    this.cachedExpiry = null;
    this.expiryLastFetched = null;
    this.EXPIRY_CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
  }

  /**
   * Start collecting PCR data
   */
  start() {
    if (this.isRunning) {
      console.log('⚠️  PCR Collector is already running');
      return;
    }
    
    console.log('\n🚀 Starting Angel One Native PCR Collector Service');
    console.log(`   Interval: Every ${this.intervalMinutes} minute(s)`);
    console.log(`   Symbol: BANKNIFTY (Angel One SmartAPI Provider)`);
    console.log('─'.repeat(80));
    
    this.isRunning = true;
    
    // Collect immediately
    this.collectPCR();
    
    // Then collect every interval
    this.intervalId = setInterval(() => {
      this.collectPCR();
    }, this.intervalMs);
    
    console.log('✅ Angel One PCR Collector started successfully\n');
  }

  /**
   * Stop collecting
   */
  stop() {
    if (!this.isRunning) {
      console.log('⚠️  PCR Collector is not running');
      return;
    }
    
    console.log('\n🛑 Stopping PCR Collector Service...');
    
    this.isRunning = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    console.log(`✅ PCR Collector stopped (collected ${this.collectCount} snapshots)\n`);
  }

  /**
   * Collect current PCR and store it via Angel One SmartAPI
   */
  async collectPCR() {
    const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    try {
      console.log(`\n[${timestamp}] 📊 Collecting Angel One PCR snapshot #${this.collectCount + 1}...`);

      const pcrData = await this.angelOptionChainService.calculateAngelPCR('BANKNIFTY');

      console.log(`   📈 Call Contracts: ${pcrData.callCount}`);
      console.log(`   📉 Put Contracts: ${pcrData.putCount}`);
      console.log(`   📊 PCR: ${pcrData.pcr}`);

      // Fetch live spot price and constituent banking stocks via marketData API
      let spotPrice = null;
      let stockBreadth = null;

      try {
        const marketDataRes = await this.smartAPI.marketData({
          mode: 'FULL',
          exchangeTokens: {
            'NSE': ['99926009', '1333', '4963', '1922', '5900', '3045']
          }
        });

        if (marketDataRes && marketDataRes.status && marketDataRes.data && marketDataRes.data.fetched) {
          const items = marketDataRes.data.fetched;
          const bnfItem = items.find(i => i.symbolToken === '99926009');
          if (bnfItem && bnfItem.ltp) {
            spotPrice = parseFloat(bnfItem.ltp);
          }

          const tokenSymbolMap = {
            '1333': 'HDFCBANK',
            '4963': 'ICICIBANK',
            '1922': 'KOTAKBANK',
            '5900': 'AXISBANK',
            '3045': 'SBIN'
          };

          stockBreadth = items
            .filter(i => tokenSymbolMap[i.symbolToken])
            .map(i => ({
              symbol: tokenSymbolMap[i.symbolToken],
              pChange: parseFloat(i.percentChange || i.pChange || 0.0)
            }));
        }
      } catch (marketErr) {
        console.warn(`   ⚠️ Could not fetch marketData for spot: ${marketErr.message}`);
      }

      // Create snapshot using Angel One native data
      const snapshot = {
        symbol: 'BANKNIFTY',
        pcr: pcrData.pcr,
        pcrVolume: pcrData.pcrVolume,
        expiry: pcrData.expiry,
        strikeCount: pcrData.strikeCount,
        sentiment: this.determineSentiment(pcrData.pcr),
        spotPrice: spotPrice || 57491.10,
        stockBreadth: stockBreadth || [],
        source: 'angel_smartapi_native'
      };

      // Store snapshot
      await this.storage.storeSnapshot(snapshot);
      this.collectCount++;

      console.log(`   ✅ Stored: PCR=${pcrData.pcr.toFixed(2)} (${snapshot.sentiment}) - Spot: ₹${snapshot.spotPrice} - Expiry: ${pcrData.expiry}`);

    } catch (error) {
      console.error(`   ❌ Error collecting Angel One PCR: ${error.message}`);
    }
  }


  /**
   * Show collection statistics
   */
  async showStats() {
    try {
      const stats = await this.storage.getStats();
      
      console.log('\n' + '─'.repeat(80));
      console.log('📊 PCR COLLECTOR STATISTICS');
      console.log('─'.repeat(80));
      console.log(`   Total Snapshots: ${stats.totalSnapshots}`);
      console.log(`   Data Span: ${stats.dataSpanHours} hours`);
      console.log(`   Oldest Snapshot: ${stats.oldestSnapshot || 'N/A'}`);
      console.log(`   Newest Snapshot: ${stats.newestSnapshot || 'N/A'}`);
      
      if (stats.symbolCounts.length > 0) {
        console.log(`\n   Symbols:`);
        stats.symbolCounts.forEach(item => {
          console.log(`     • ${item.symbol}: ${item.count} snapshots`);
        });
      }
      
      console.log('─'.repeat(80) + '\n');
      
    } catch (error) {
      console.error(`❌ Error showing stats: ${error.message}`);
    }
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      intervalMinutes: this.intervalMinutes,
      collectCount: this.collectCount,
      nextCollection: this.isRunning ? 
        new Date(Date.now() + this.intervalMs).toLocaleString('en-IN') : 
        'Not running'
    };
  }

  /**
   * Determine sentiment
   */
  determineSentiment(pcr) {
    if (typeof pcr !== 'number') return 'Neutral';
    
    if (pcr > 1.2) {
      return 'Selling';
    } else if (pcr < 0.8) {
      return 'Buying';
    } else {
      return 'Neutral';
    }
  }
}

module.exports = PCRCollectorService;