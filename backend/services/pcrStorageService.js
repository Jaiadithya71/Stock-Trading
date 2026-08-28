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
      
      // Save with atomic write
      await this.saveDataAtomic(data);
      
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
    try {
      const data = await this.loadData();
      const results = {};
      
      // Filter snapshots for this symbol
      const symbolSnapshots = data.snapshots.filter(s => s.symbol === symbol);
      
      if (symbolSnapshots.length === 0) {
        return null;
      }
      
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
      } else {
        // Market is CLOSED - use latest snapshot for historical analysis
        referenceTime = symbolSnapshots[symbolSnapshots.length - 1].timestampMs;
        referenceMode = 'HISTORICAL (Market Closed)';
      }
      
      // Calculate for each interval
      for (const intervalMinutes of intervals) {
        // Special case: 0 minutes = current/latest value
        if (intervalMinutes === 0) {
          const latestSnapshot = symbolSnapshots[symbolSnapshots.length - 1];
          results['0min'] = {
            pcr: latestSnapshot.pcr.toFixed(4),
            pcrVolume: latestSnapshot.pcrVolume?.toFixed(4) || null,
            sentiment: this.determineSentiment(latestSnapshot.pcr),
            trend: 'Current',
            change: null,
            changePercent: null,
            dataPoints: 1,
            available: true,
            callOI: latestSnapshot.callOI,
            putOI: latestSnapshot.putOI,
            underlyingValue: latestSnapshot.underlyingValue,
            timestamp: latestSnapshot.timestamp
          };
          continue;
        }

        const intervalMs = intervalMinutes * 60 * 1000;

        // Calculate cutoff time from reference time
        const cutoffTime = referenceTime - intervalMs;

        // Get snapshots within this interval
        const intervalSnapshots = symbolSnapshots.filter(s =>
          s.timestampMs >= cutoffTime && s.timestampMs <= referenceTime
        );

        if (intervalSnapshots.length === 0) {
          const mode = marketOpen ? 'current time' : 'latest snapshot';
          results[`${intervalMinutes}min`] = {
            pcr: null,
            sentiment: 'No Data',
            trend: 'No Data',
            change: null,
            changePercent: null,
            dataPoints: 0,
            available: false,
            reason: `No snapshots in ${intervalMinutes}min window from ${mode}`
          };
          continue;
        }

        // Check if we have sufficient data span for this interval
        // We need at least 50% of the interval covered with data to show meaningful results
        const oldestInInterval = intervalSnapshots[0].timestampMs;
        const newestInInterval = intervalSnapshots[intervalSnapshots.length - 1].timestampMs;
        const actualSpanMs = newestInInterval - oldestInInterval;
        const requiredSpanMs = intervalMs * 0.5; // Require at least 50% coverage

        // Also check if oldest snapshot is close enough to cutoff time
        // (i.e., we have data from the beginning of the interval, not just recent data)
        const gapFromCutoff = oldestInInterval - cutoffTime;
        const maxAllowedGap = intervalMs * 0.5; // Allow 50% gap from start

        const hasInsufficientSpan = actualSpanMs < requiredSpanMs && intervalSnapshots.length > 1;
        const dataStartsTooLate = gapFromCutoff > maxAllowedGap;

        if (hasInsufficientSpan || dataStartsTooLate) {
          const actualSpanMinutes = (actualSpanMs / 60000).toFixed(1);
          results[`${intervalMinutes}min`] = {
            pcr: null,
            sentiment: 'No Data',
            trend: 'No Data',
            change: null,
            changePercent: null,
            dataPoints: intervalSnapshots.length,
            available: false,
            reason: `Insufficient data: only ${actualSpanMinutes} min of ${intervalMinutes} min available`
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
          available: true,
          oldest: intervalSnapshots[0].timestamp,
          newest: intervalSnapshots[intervalSnapshots.length - 1].timestamp
        };
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
    const emptyData = { snapshots: [] };

    // Try primary file first
    try {
      if (fsSync.existsSync(this.dataFile)) {
        const content = await fs.readFile(this.dataFile, 'utf8');

        // Handle empty file
        if (!content || content.trim() === '') {
          console.log('⚠️  Primary file is empty, trying backup...');
          throw new Error('Empty file');
        }

        const data = JSON.parse(content);

        // Validate structure
        if (!data || !Array.isArray(data.snapshots)) {
          console.log('⚠️  Primary file has invalid structure, trying backup...');
          throw new Error('Invalid structure');
        }

        return data;
      }
    } catch (primaryError) {
      console.log(`⚠️  Primary file issue: ${primaryError.message}`);
    }

    // Try backup file
    try {
      if (fsSync.existsSync(this.backupFile)) {
        console.log('📂 Attempting to load from backup...');
        const backupContent = await fs.readFile(this.backupFile, 'utf8');

        // Handle empty backup
        if (!backupContent || backupContent.trim() === '') {
          console.log('⚠️  Backup file is also empty');
          throw new Error('Empty backup');
        }

        const backupData = JSON.parse(backupContent);

        // Validate structure
        if (!backupData || !Array.isArray(backupData.snapshots)) {
          console.log('⚠️  Backup file has invalid structure');
          throw new Error('Invalid backup structure');
        }

        console.log(`✅ Loaded ${backupData.snapshots.length} snapshots from backup`);

        // Restore primary file from backup
        await this.saveDataAtomic(backupData);
        console.log('✅ Primary file restored from backup');

        return backupData;
      }
    } catch (backupError) {
      console.log(`⚠️  Backup file issue: ${backupError.message}`);
    }

    // Both files failed - start fresh
    console.log('🆕 No valid data found, starting with empty dataset...');

    // Initialize empty files
    await this.saveDataAtomic(emptyData);

    return emptyData;
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
   * Calculate dynamic rolling Z-score for PCR
   * @param {number} pcr - Current PCR value
   * @param {number[]} historicalPcrValues - Array of historical PCR numbers
   * @returns {Object} Z-score and dynamic sentiment metrics
   */
  calculateRollingZScore(pcr, historicalPcrValues = []) {
    if (typeof pcr !== 'number' || isNaN(pcr)) {
      return { zScore: 0.0, mean: 1.0, stdDev: 0.1, dynamicSentiment: 'Neutral' };
    }

    if (!historicalPcrValues || historicalPcrValues.length < 5) {
      const fallbackSentiment = this.determineSentiment(pcr);
      return { zScore: 0.0, mean: pcr, stdDev: 0.0, dynamicSentiment: fallbackSentiment };
    }

    const n = historicalPcrValues.length;
    const mean = historicalPcrValues.reduce((a, b) => a + b, 0) / n;
    const variance = historicalPcrValues.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / n;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) {
      return { zScore: 0.0, mean: parseFloat(mean.toFixed(4)), stdDev: 0.0, dynamicSentiment: 'Neutral' };
    }

    const zScore = (pcr - mean) / stdDev;
    let dynamicSentiment = 'Neutral';

    if (zScore < -1.5) {
      dynamicSentiment = 'Strong Buying (Oversold)';
    } else if (zScore < -0.5) {
      dynamicSentiment = 'Buying';
    } else if (zScore > 1.5) {
      dynamicSentiment = 'Strong Selling (Overbought)';
    } else if (zScore > 0.5) {
      dynamicSentiment = 'Selling';
    } else {
      dynamicSentiment = 'Neutral';
    }

    return {
      zScore: parseFloat(zScore.toFixed(2)),
      mean: parseFloat(mean.toFixed(4)),
      stdDev: parseFloat(stdDev.toFixed(4)),
      dynamicSentiment
    };
  }

  /**
   * Determine sentiment based on PCR value (supports both static and dynamic Z-score)
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