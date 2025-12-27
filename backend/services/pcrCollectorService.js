// ============================================================================
// FILE: backend/services/pcrCollectorService.js
// Background PCR Collector - Runs every minute to store PCR snapshots
// - Fetches current PCR from putCallRatio API
// - Stores snapshot in local file
// - Auto-runs in background
// ============================================================================

const PCRStorageService = require('./pcrStorageService');

class PCRCollectorService {
  constructor(smartAPI, intervalMinutes = 1) {
    this.smartAPI = smartAPI;
    this.storage = new PCRStorageService();
    this.intervalMinutes = intervalMinutes;
    this.intervalMs = intervalMinutes * 60 * 1000;
    this.isRunning = false;
    this.intervalId = null;
    this.collectCount = 0;
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
   * Collect current PCR and store it
   */
  async collectPCR() {
    const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    
    try {
      console.log(`\n[${ timestamp}] 📊 Collecting PCR snapshot #${this.collectCount + 1}...`);
      
      // Fetch current PCR from API
      const response = await this.smartAPI.putCallRatio();
      
      if (!response || !response.status) {
        throw new Error('Failed to fetch PCR data');
      }
      
      // Find BANKNIFTY
      const banknifty = response.data.find(item => 
        (item.tradingSymbol || '').includes('BANKNIFTY')
      );
      
      if (!banknifty) {
        console.log('   ⚠️  BANKNIFTY not found, using market average');
        
        // Calculate market average
        const avgPCR = response.data.reduce((sum, item) => sum + (item.pcr || 0), 0) / response.data.length;
        
        const snapshot = {
          symbol: 'BANKNIFTY',
          pcr: avgPCR,
          callOI: null,
          putOI: null,
          callVolume: null,
          putVolume: null,
          sentiment: this.determineSentiment(avgPCR),
          source: 'market_average'
        };
        
        await this.storage.storeSnapshot(snapshot);
        this.collectCount++;
        
        console.log(`   ✅ Stored: PCR=${avgPCR.toFixed(4)} (${snapshot.sentiment})`);
        return;
      }
      
      // Extract expiry
      const expiryMatch = banknifty.tradingSymbol.match(/(\d{2}[A-Z]{3}\d{2})/);
      const expiry = expiryMatch ? expiryMatch[1] : 'UNKNOWN';
      
      // Create snapshot
      const snapshot = {
        symbol: 'BANKNIFTY',
        pcr: banknifty.pcr,
        expiry: expiry,
        tradingSymbol: banknifty.tradingSymbol,
        callOI: null, // Not provided by putCallRatio
        putOI: null,
        callVolume: null,
        putVolume: null,
        sentiment: this.determineSentiment(banknifty.pcr),
        source: 'putCallRatio_api'
      };
      
      // Store snapshot
      await this.storage.storeSnapshot(snapshot);
      this.collectCount++;
      
      console.log(`   ✅ Stored: PCR=${banknifty.pcr.toFixed(4)} (${snapshot.sentiment}) - Expiry: ${expiry}`);
      
      // Show statistics every 10 snapshots
      if (this.collectCount % 10 === 0) {
        await this.showStats();
      }
      
    } catch (error) {
      console.error(`   ❌ Error collecting PCR: ${error.message}`);
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