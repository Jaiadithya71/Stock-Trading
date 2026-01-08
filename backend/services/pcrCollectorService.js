// ============================================================================
// FILE: backend/services/pcrCollectorService.js
// Background PCR Collector - Runs every minute to store PCR snapshots
// - Fetches option chain from NSE India public API
// - Calculates PCR from Put OI / Call OI
// - Stores snapshot in local file
// - Auto-runs in background
// ============================================================================

const PCRStorageService = require('./pcrStorageService');
const NSEApiFetcher = require('./nseApiFetcher');
const InstrumentFetcher = require('./instrumentFetcher');

class PCRCollectorService {
  constructor(smartAPI, intervalMinutes = 1) {
    this.smartAPI = smartAPI; // Keep for backwards compatibility, but not used
    this.storage = new PCRStorageService();
    this.nseFetcher = new NSEApiFetcher();
    this.instrumentFetcher = new InstrumentFetcher();
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
    
    console.log('\n🚀 Starting PCR Collector Service');
    console.log(`   Interval: Every ${this.intervalMinutes} minute(s)`);
    console.log(`   Symbol: BANKNIFTY`);
    console.log('─'.repeat(80));
    
    this.isRunning = true;
    
    // Collect immediately
    this.collectPCR();
    
    // Then collect every interval
    this.intervalId = setInterval(() => {
      this.collectPCR();
    }, this.intervalMs);
    
    console.log('✅ PCR Collector started successfully\n');
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
   * Get nearest expiry date (with caching)
   */
  async getNearestExpiry(symbol = 'BANKNIFTY') {
    const now = Date.now();

    // Use cached expiry if still valid
    if (this.cachedExpiry &&
        this.expiryLastFetched &&
        (now - this.expiryLastFetched) < this.EXPIRY_CACHE_DURATION) {
      return this.cachedExpiry;
    }

    console.log(`   📅 Fetching expiry dates for ${symbol}...`);
    const expiries = await this.instrumentFetcher.getExpiryDates(symbol);

    if (expiries && expiries.length > 0) {
      this.cachedExpiry = expiries[0]; // Nearest expiry
      this.expiryLastFetched = now;
      console.log(`   📅 Using expiry: ${this.cachedExpiry}`);
      return this.cachedExpiry;
    }

    throw new Error('No expiry dates available');
  }

  /**
   * Calculate PCR from option chain data
   */
  calculatePCRFromOptionChain(optionChain) {
    let totalCallOI = 0;
    let totalPutOI = 0;
    let totalCallVolume = 0;
    let totalPutVolume = 0;

    // Sum up OI and Volume from all strikes
    Object.values(optionChain.strikes).forEach(strike => {
      if (strike.CE) {
        totalCallOI += strike.CE.openInterest || 0;
        totalCallVolume += strike.CE.totalTradedVolume || 0;
      }
      if (strike.PE) {
        totalPutOI += strike.PE.openInterest || 0;
        totalPutVolume += strike.PE.totalTradedVolume || 0;
      }
    });

    // Calculate PCR (Put/Call ratio)
    const pcrOI = totalCallOI > 0 ? totalPutOI / totalCallOI : 0;
    const pcrVolume = totalCallVolume > 0 ? totalPutVolume / totalCallVolume : 0;

    return {
      pcrOI: Math.round(pcrOI * 100) / 100,
      pcrVolume: Math.round(pcrVolume * 100) / 100,
      totalCallOI,
      totalPutOI,
      totalCallVolume,
      totalPutVolume,
      strikeCount: Object.keys(optionChain.strikes).length
    };
  }

  /**
   * Collect current PCR and store it
   */
  async collectPCR() {
    const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    try {
      console.log(`\n[${timestamp}] 📊 Collecting PCR snapshot #${this.collectCount + 1}...`);

      // Get nearest expiry
      const expiry = await this.getNearestExpiry('BANKNIFTY');

      // Fetch option chain from NSE
      console.log(`   🌐 Fetching NSE option chain...`);
      const optionChain = await this.nseFetcher.getOptionChain('BANKNIFTY', expiry);

      if (!optionChain || !optionChain.strikes) {
        throw new Error('Failed to fetch option chain from NSE');
      }

      // Calculate PCR from OI data
      const pcrData = this.calculatePCRFromOptionChain(optionChain);

      console.log(`   📈 Call OI: ${pcrData.totalCallOI.toLocaleString()}`);
      console.log(`   📉 Put OI: ${pcrData.totalPutOI.toLocaleString()}`);
      console.log(`   📊 PCR (OI): ${pcrData.pcrOI}`);
      console.log(`   📊 PCR (Vol): ${pcrData.pcrVolume}`);

      // Create snapshot using OI-based PCR
      const snapshot = {
        symbol: 'BANKNIFTY',
        pcr: pcrData.pcrOI,
        pcrVolume: pcrData.pcrVolume,
        expiry: expiry,
        callOI: pcrData.totalCallOI,
        putOI: pcrData.totalPutOI,
        callVolume: pcrData.totalCallVolume,
        putVolume: pcrData.totalPutVolume,
        underlyingValue: optionChain.underlyingValue,
        strikeCount: pcrData.strikeCount,
        sentiment: this.determineSentiment(pcrData.pcrOI),
        source: 'nse_option_chain'
      };

      // Store snapshot
      await this.storage.storeSnapshot(snapshot);
      this.collectCount++;

      console.log(`   ✅ Stored: PCR=${pcrData.pcrOI.toFixed(2)} (${snapshot.sentiment}) - Expiry: ${expiry}`);

      // Show statistics every 10 snapshots
      if (this.collectCount % 10 === 0) {
        await this.showStats();
      }

    } catch (error) {
      console.error(`   ❌ Error collecting PCR: ${error.message}`);

      // If NSE fails, try to clear session and retry next time
      if (error.message.includes('timeout') || error.message.includes('Empty response')) {
        console.log(`   🔄 Clearing NSE session for retry...`);
        this.nseFetcher.clearSession();
      }
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