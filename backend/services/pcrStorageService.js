// backend/services/pcrStorageService.js - SMART VERSION (Market-aware)
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

class PCRStorageService {
  constructor(dataDir = path.join(__dirname, '../data')) {
    this.dataDir = dataDir;
    this.dataFile = path.join(dataDir, 'pcr_snapshots.json');
    this.backupFile = path.join(dataDir, 'pcr_snapshots.backup.json');
    this.lockFile = path.join(dataDir, 'pcr_snapshots.lock');
    
    // Ensure data directory exists
    if (!fsSync.existsSync(dataDir)) {
      fsSync.mkdirSync(dataDir, { recursive: true });
    }
    
    // Initialize empty file if doesn't exist
    if (!fsSync.existsSync(this.dataFile)) {
      fsSync.writeFileSync(this.dataFile, JSON.stringify({ snapshots: [] }, null, 2));
    }
  }

  /**
   * Check if market is currently open
   * Market hours: Mon-Fri, 9:15 AM - 3:30 PM IST
   */
  isMarketOpen() {
    const now = new Date();
    
    // Convert to IST
    const istTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    
    const dayOfWeek = istTime.getDay(); // 0 = Sunday, 6 = Saturday
    const hours = istTime.getHours();
    const minutes = istTime.getMinutes();
    const currentMinutes = hours * 60 + minutes;
    
    // Market hours: 9:15 AM (555 min) to 3:30 PM (930 min)
    const marketOpen = 9 * 60 + 15;  // 555
    const marketClose = 15 * 60 + 30; // 930
    
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
    const inTradingHours = currentMinutes >= marketOpen && currentMinutes <= marketClose;
    
    return isWeekday && inTradingHours;
  }

  /**
   * Store a PCR snapshot
   */
  async storeSnapshot(snapshot) {
    console.log(`\n💾 Storing PCR snapshot for ${snapshot.symbol}...`);
    
    try {
      // Validate snapshot
      if (!snapshot.symbol || typeof snapshot.pcr !== 'number') {
        throw new Error('Invalid snapshot data');
      }
      
      // Load existing data
      const data = await this.loadData();
      
      // Add timestamp
      const snapshotWithTimestamp = {
        ...snapshot,
        timestamp: new Date().toISOString(),
        timestampMs: Date.now()
      };
      
      // Add to snapshots array
      data.snapshots.push(snapshotWithTimestamp);
      
      // Clean old data (keep last 24 hours)
      data.snapshots = this.cleanOldSnapshots(data.snapshots, 24);
      
      console.log(`   Total snapshots: ${data.snapshots.length}`);
      console.log(`   Oldest: ${data.snapshots[0]?.timestamp || 'N/A'}`);
      console.log(`   Newest: ${data.snapshots[data.snapshots.length - 1]?.timestamp || 'N/A'}`);
      
      // Save with atomic write
      await this.saveDataAtomic(data);
      
      console.log(`✅ Snapshot stored successfully`);
      
      return snapshotWithTimestamp;
      
    } catch (error) {
      console.error(`❌ Error storing snapshot: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get historical PCR for different time intervals
   * SMART VERSION: Uses "now" during market hours, "latest snapshot" when closed
   */
  async getHistoricalPCR(symbol, intervals = [1, 3, 5, 15, 30]) {
    console.log(`\n📊 Calculating historical PCR for ${symbol}...`);
    
    try {
      const data = await this.loadData();
      const results = {};
      
      // Filter snapshots for this symbol
      const symbolSnapshots = data.snapshots.filter(s => s.symbol === symbol);
      
      if (symbolSnapshots.length === 0) {
        console.log(`⚠️  No snapshots found for ${symbol}`);
        return null;
      }
      
      console.log(`   Found ${symbolSnapshots.length} snapshots`);
      
      // Sort by timestamp (oldest to newest)
      symbolSnapshots.sort((a, b) => a.timestampMs - b.timestampMs);
      
      // Determine reference time based on market status
      const marketOpen = this.isMarketOpen();
      let referenceTime;
      let referenceMode;
      
      if (marketOpen) {
        // Market is OPEN - use current time for real-time data
        referenceTime = Date.now();
        referenceMode = 'REAL-TIME (Market Open)';
        console.log(`   🟢 Market is OPEN - Using current time as reference`);
      } else {
        // Market is CLOSED - use latest snapshot for historical analysis
        referenceTime = symbolSnapshots[symbolSnapshots.length - 1].timestampMs;
        referenceMode = 'HISTORICAL (Market Closed)';
        console.log(`   🔴 Market is CLOSED - Using latest snapshot as reference`);
      }
      
      console.log(`   Reference time: ${new Date(referenceTime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
      console.log(`   Mode: ${referenceMode}`);
      
      const oldestSnapshotTime = symbolSnapshots[0].timestampMs;
      const latestSnapshotTime = symbolSnapshots[symbolSnapshots.length - 1].timestampMs;
      const totalSpanMinutes = (latestSnapshotTime - oldestSnapshotTime) / (60 * 1000);
      
      console.log(`   Latest snapshot: ${new Date(latestSnapshotTime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
      console.log(`   Oldest snapshot: ${new Date(oldestSnapshotTime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
      console.log(`   Total span: ${totalSpanMinutes.toFixed(1)} minutes`);
      
      // Calculate for each interval
      for (const intervalMinutes of intervals) {
        const intervalMs = intervalMinutes * 60 * 1000;
        
        // Calculate cutoff time from reference time
        const cutoffTime = referenceTime - intervalMs;
        
        // Get snapshots within this interval
        const intervalSnapshots = symbolSnapshots.filter(s => 
          s.timestampMs >= cutoffTime && s.timestampMs <= referenceTime
        );
        
        if (intervalSnapshots.length === 0) {
          const mode = marketOpen ? 'current time' : 'latest snapshot';
          console.log(`   ⚠️  ${intervalMinutes}min: No data (need snapshots within last ${intervalMinutes} min from ${mode})`);
          results[`${intervalMinutes}min`] = {
            pcr: null,
            sentiment: 'No Data',
            trend: 'No Data',
            change: null,
            changePercent: null,
            dataPoints: 0
          };
          continue;
        }
        
        // Calculate average PCR for this interval
        const avgPCR = intervalSnapshots.reduce((sum, s) => sum + s.pcr, 0) / intervalSnapshots.length;
        
        // Calculate trend (compare first vs last)
        const firstPCR = intervalSnapshots[0].pcr;
        const lastPCR = intervalSnapshots[intervalSnapshots.length - 1].pcr;
        const change = lastPCR - firstPCR;
        const changePercent = firstPCR !== 0 ? (change / firstPCR) * 100 : 0;
        
        // Determine sentiment
        const sentiment = this.determineSentiment(avgPCR);
        const trend = change > 0.01 ? 'Rising' : change < -0.01 ? 'Falling' : 'Stable';
        
        results[`${intervalMinutes}min`] = {
          pcr: avgPCR.toFixed(4),
          sentiment: sentiment,
          trend: trend,
          change: change.toFixed(4),
          changePercent: changePercent.toFixed(2),
          dataPoints: intervalSnapshots.length,
          oldest: intervalSnapshots[0].timestamp,
          newest: intervalSnapshots[intervalSnapshots.length - 1].timestamp
        };
        
        console.log(`   ✅ ${intervalMinutes}min: PCR=${avgPCR.toFixed(4)}, Sentiment=${sentiment}, Trend=${trend} (${intervalSnapshots.length} points)`);
      }
      
      return {
        symbol,
        timestamp: new Date().toISOString(),
        intervals: results,
        totalSnapshots: symbolSnapshots.length,
        marketStatus: marketOpen ? 'OPEN' : 'CLOSED',
        referenceMode: referenceMode,
        dataRange: {
          from: symbolSnapshots[0].timestamp,
          to: symbolSnapshots[symbolSnapshots.length - 1].timestamp
        }
      };
      
    } catch (error) {
      console.error(`❌ Error calculating historical PCR: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get latest PCR snapshot
   */
  async getLatestSnapshot(symbol) {
    const data = await this.loadData();
    const symbolSnapshots = data.snapshots.filter(s => s.symbol === symbol);
    
    if (symbolSnapshots.length === 0) {
      return null;
    }
    
    return symbolSnapshots[symbolSnapshots.length - 1];
  }

  /**
   * Get all snapshots for a symbol
   */
  async getAllSnapshots(symbol, hoursBack = 24) {
    const data = await this.loadData();
    const cutoffTime = Date.now() - (hoursBack * 60 * 60 * 1000);
    
    return data.snapshots.filter(s => 
      s.symbol === symbol && s.timestampMs >= cutoffTime
    );
  }

  /**
   * Get statistics
   */
  async getStats() {
    const data = await this.loadData();
    
    const symbols = [...new Set(data.snapshots.map(s => s.symbol))];
    const oldestSnapshot = data.snapshots[0];
    const newestSnapshot = data.snapshots[data.snapshots.length - 1];
    
    return {
      totalSnapshots: data.snapshots.length,
      symbols: symbols,
      symbolCounts: symbols.map(symbol => ({
        symbol,
        count: data.snapshots.filter(s => s.symbol === symbol).length
      })),
      oldestSnapshot: oldestSnapshot?.timestamp,
      newestSnapshot: newestSnapshot?.timestamp,
      dataSpanHours: oldestSnapshot && newestSnapshot ? 
        ((newestSnapshot.timestampMs - oldestSnapshot.timestampMs) / (1000 * 60 * 60)).toFixed(2) : 0,
      marketStatus: this.isMarketOpen() ? 'OPEN' : 'CLOSED'
    };
  }

  /**
   * Clear all data
   */
  async clearAllData() {
    console.log('\n🗑️  Clearing all PCR data...');
    await this.saveDataAtomic({ snapshots: [] });
    console.log('✅ All data cleared');
  }

  /**
   * Clear data for specific symbol
   */
  async clearSymbolData(symbol) {
    console.log(`\n🗑️  Clearing data for ${symbol}...`);
    const data = await this.loadData();
    data.snapshots = data.snapshots.filter(s => s.symbol !== symbol);
    await this.saveDataAtomic(data);
    console.log(`✅ Data cleared for ${symbol}`);
  }

  // ========================================================================
  // PRIVATE METHODS
  // ========================================================================

  /**
   * Load data from file
   */
  async loadData() {
    try {
      const content = await fs.readFile(this.dataFile, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      // If file is corrupted, try backup
      if (fsSync.existsSync(this.backupFile)) {
        console.log('⚠️  Primary file corrupted, loading from backup...');
        const backupContent = await fs.readFile(this.backupFile, 'utf8');
        return JSON.parse(backupContent);
      }
      
      // If both failed, return empty structure
      console.log('⚠️  No valid data found, starting fresh...');
      return { snapshots: [] };
    }
  }

  /**
   * Save data with atomic write (prevents corruption)
   */
  async saveDataAtomic(data) {
    const tempFile = this.dataFile + '.tmp';
    
    try {
      // Create backup of current file
      if (fsSync.existsSync(this.dataFile)) {
        await fs.copyFile(this.dataFile, this.backupFile);
      }
      
      // Write to temp file
      await fs.writeFile(tempFile, JSON.stringify(data, null, 2), 'utf8');
      
      // Atomic rename (prevents corruption during write)
      await fs.rename(tempFile, this.dataFile);
      
    } catch (error) {
      // Clean up temp file if it exists
      if (fsSync.existsSync(tempFile)) {
        await fs.unlink(tempFile);
      }
      throw error;
    }
  }

  /**
   * Clean old snapshots (keep only last N hours)
   */
  cleanOldSnapshots(snapshots, hoursToKeep = 24) {
    const cutoffTime = Date.now() - (hoursToKeep * 60 * 60 * 1000);
    return snapshots.filter(s => s.timestampMs >= cutoffTime);
  }

  /**
   * Determine sentiment based on PCR value
   */
  determineSentiment(pcr) {
    if (typeof pcr !== 'number') return 'Neutral';
    
    if (pcr > 1.2) {
      return 'Selling'; // Bearish
    } else if (pcr < 0.8) {
      return 'Buying'; // Bullish
    } else {
      return 'Neutral';
    }
  }
}

module.exports = PCRStorageService;