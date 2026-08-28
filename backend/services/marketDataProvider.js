// ============================================================================
// FILE: backend/services/marketDataProvider.js
// Universal Market Data Adapter (Stage 1 Local Testing vs Stage 2/3 Production)
// Automatically bridges Mock Exchange (:3001) in development and SmartAPI in production
// ============================================================================

const http = require('http');

class MarketDataProvider {
  constructor() {
    this.mockServerUrl = 'http://127.0.0.1:3001/mock/market-data';
    this.isLocal = !process.env.RENDER && (process.env.NODE_ENV !== 'production');
    this.lastOutageState = false;
    this.lastScenario = null;
  }

  /**
   * Checks if Mock Market Exchange is reachable on port 3001
   */
  async queryMockServer() {
    return new Promise((resolve) => {
      const req = http.get(this.mockServerUrl, { timeout: 1000 }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode === 503) {
            if (!this.lastOutageState) {
              this.lastOutageState = true;
              console.log('\n🚨 [BROKER FEED] 🔴 BROKER DISCONNECT / OUTAGE DETECTED (HTTP 503) — Halting new trading signals');
            }
            return resolve({ outage: true, message: 'CHAOS_BROKER_OUTAGE' });
          }

          try {
            const json = JSON.parse(data);
            if (json && json.success && json.data) {
              if (this.lastOutageState) {
                this.lastOutageState = false;
                console.log('\n🟢 [BROKER FEED] 🟢 BROKER CONNECTION RESTORED — Resuming live market ticks');
              }

              // Log scenario transition once
              const currentScenario = (typeof json.data.simulationState === 'object' && json.data.simulationState)
                ? json.data.simulationState.scenario
                : json.data.simulationState;

              if (currentScenario && currentScenario !== 'NORMAL_SIMULATION' && currentScenario !== this.lastScenario) {
                this.lastScenario = currentScenario;
                console.log(`\n⚡ [MOCK FEED] 🎯 Scenario Activated: ${currentScenario} (Spot: ₹${json.data.spotPrice})`);
              } else if (currentScenario === 'NORMAL_SIMULATION') {
                this.lastScenario = null;
              }

              resolve(json.data);
            } else if (json && json.message && json.message.includes('CHAOS')) {
              if (!this.lastOutageState) {
                this.lastOutageState = true;
                console.log('\n🚨 [BROKER FEED] 🔴 BROKER DISCONNECT / OUTAGE DETECTED (HTTP 503) — Halting new trading signals');
              }
              resolve({ outage: true, message: json.message });
            } else {
              resolve(null);
            }
          } catch(e) {
            resolve(null);
          }
        });
      });

      req.on('error', () => resolve(null));
      req.on('timeout', () => { req.destroy(); resolve(null); });
    });
  }

  /**
   * Fetches latest market snapshot from Mock Exchange (Local) or SmartAPI (Production)
   */
  async getMarketSnapshot(dashboard = null) {
    // 1. In local environment, check Mock Exchange on port 3001 first
    if (this.isLocal) {
      const mockData = await this.queryMockServer();
      if (mockData) {
        if (mockData.outage) {
          return {
            source: 'MOCK_EXCHANGE_OUTAGE',
            outage: true,
            spotPrice: 57500,
            atmStrike: 57500,
            bankStocks: [],
            lastTickTime: new Date().toISOString()
          };
        }

        return {
          source: 'MOCK_EXCHANGE_3001',
          spotPrice: mockData.spotPrice,
          atmStrike: mockData.atmStrike,
          advancingWeight: mockData.advancingWeight,
          decliningWeight: mockData.decliningWeight,
          rawPcr: mockData.rawPcr,
          pcrZScore: mockData.pcrZScore,
          bankStocks: mockData.bankStocks,
          lastTickTime: mockData.lastTickTime,
          simulationState: mockData.simulationState
        };
      }
    }

    // 2. Production / Live Broker fallback
    if (dashboard && typeof dashboard.getLTPData === 'function') {
      try {
        const tokens = ['99926009', '1333', '4963', '1922', '5900', '3045'];
        const ltpRes = await dashboard.getLTPData('NSE', tokens, 'FULL');
        
        if (ltpRes && ltpRes.success && ltpRes.data) {
          const spotData = ltpRes.data['99926009'];
          const spotPrice = spotData?.ltp || 57491.10;
          
          const symbolMap = { '1333': 'HDFCBANK', '4963': 'ICICIBANK', '1922': 'SBIN', '5900': 'KOTAKBANK', '3045': 'AXISBANK' };
          const bankStocks = Object.entries(symbolMap).map(([token, symbol]) => ({
            symbol,
            token,
            ltp: ltpRes.data[token]?.ltp || 0,
            pChange: ltpRes.data[token]?.pChange || 0
          }));

          return {
            source: 'SMARTAPI_LIVE',
            spotPrice,
            atmStrike: Math.round(spotPrice / 100) * 100,
            bankStocks,
            lastTickTime: new Date().toISOString()
          };
        }
      } catch (dashErr) {
        console.warn('⚠️ SmartAPI LTP Query error:', dashErr.message);
      }
    }

    // 3. Fallback default
    return {
      source: 'STATIC_FALLBACK',
      spotPrice: 57491.10,
      atmStrike: 57500,
      bankStocks: [],
      lastTickTime: new Date().toISOString()
    };
  }
}

module.exports = new MarketDataProvider();
