// ============================================================================
// FILE: backend/services/pcrStorageService.js
// PCR Storage Service - Stores PCR snapshots and calculates historical intervals
// - Stores data in JSON file (can switch to SQLite later)
// - Auto-cleanup of old data
// - Atomic writes to prevent corruption
// - Calculates 1min, 3min, 5min, 15min, 30min intervals from stored data
// ============================================================================

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
   * Store a PCR snapshot
   * @param {Object} snapshot - { symbol, pcr, callOI, putOI, callVolume, putVolume, sentiment }
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
   * @param {string} symbol - Symbol (e.g., 'BANKNIFTY')
   * @param {Array} intervals - Intervals in minutes (e.g., [1, 3, 5, 15, 30])
   */
  async getHistoricalPCR(symbol, intervals = [1, 3, 5, 15, 30]) {
    console.log(`\n📊 Calculating historical PCR for ${symbol}...`);
    
    try {
      const data = await this.loadData();
      const now = Date.now();
      const results = {};
      
      // Filter snapshots for this symbol
      const symbolSnapshots = data.snapshots.filter(s => s.symbol === symbol);
      
      if (symbolSnapshots.length === 0) {
        console.log(`⚠️  No snapshots found for ${symbol}`);
        return null;
      }
      
      console.log(`   Found ${symbolSnapshots.length} snapshots`);
      
      // Calculate for each interval
      for (const intervalMinutes of intervals) {
        const intervalMs = intervalMinutes * 60 * 1000;
        const cutoffTime = now - intervalMs;
        
        // Get snapshots within this interval
        const intervalSnapshots = symbolSnapshots.filter(s => 
          s.timestampMs >= cutoffTime
        );
        
        if (intervalSnapshots.length === 0) {
          console.log(`   ⚠️  ${intervalMinutes}min: No data`);
          results[`${intervalMinutes}min`] = {
            pcr: null,
            sentiment: 'No Data',
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
        const changePercent = (change / firstPCR) * 100;
        
        // Determine sentiment
        const sentiment = this.determineSentiment(avgPCR);
        const trend = change > 0 ? 'Rising' : change < 0 ? 'Falling' : 'Stable';
        
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
        ((newestSnapshot.timestampMs - oldestSnapshot.timestampMs) / (1000 * 60 * 60)).toFixed(2) : 0
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