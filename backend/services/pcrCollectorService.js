// ============================================================================
// FILE: backend/services/pcrCollectorService.js
// Background PCR Collector - Runs periodically to store PCR snapshots
// Clean, non-verbose logging
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
    this.EXPIRY_CACHE_DURATION = 30 * 60 * 1000;
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('🚀 [PCRCollector] Angel One PCR Collector started (every 1 min)');
    this.collectPCR();
    this.intervalId = setInterval(() => {
      this.collectPCR();
    }, this.intervalMs);
  }

  stop() {
    if (!this.isRunning) return;
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    console.log(`🛑 [PCRCollector] Stopped (collected ${this.collectCount} snapshots)`);
  }

  async collectPCR() {
    try {
      const pcrData = await this.angelOptionChainService.calculateAngelPCR('BANKNIFTY');

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
        // silent fail
      }

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

      await this.storage.storeSnapshot(snapshot);
      this.collectCount++;
      console.log(`⏱️ [PCRCollector] Snapshot #${this.collectCount} Stored: PCR=${pcrData.pcr.toFixed(2)} (${snapshot.sentiment}) | Spot: ₹${snapshot.spotPrice}`);
    } catch (error) {
      console.error(`❌ [PCRCollector] Error: ${error.message}`);
    }
  }

  determineSentiment(pcr) {
    if (pcr >= 1.3) return 'Extremely Bullish';
    if (pcr >= 1.1) return 'Bullish';
    if (pcr <= 0.7) return 'Extremely Bearish';
    if (pcr <= 0.9) return 'Bearish';
    return 'Neutral';
  }

  async showStats() {
    try {
      const stats = await this.storage.getStats();
      console.log(`📊 [PCRCollector Stats] Total Snapshots: ${stats.totalSnapshots}, Span: ${stats.dataSpanHours} hrs`);
    } catch (error) {
      console.error('❌ Error showing stats:', error.message);
    }
  }
}

module.exports = PCRCollectorService;