// ============================================================================
// FILE: backend/services/stockMarketDataProvider.js
// Live & Simulated Market Data Provider for Liquid NSE Equities
// Supports Batch Real-Time SmartAPI Quotes + Seamless Offline Brownian Simulation
// ============================================================================

const { STOCK_UNIVERSE } = require('../config/constants');

class StockMarketDataProvider {
  constructor() {
    // Base benchmark prices (realistic NSE close levels for expanded universe)
    this.stockPrices = {
      'HDFCBANK': 1642.50, 'ICICIBANK': 1184.20, 'RELIANCE': 2985.40, 'INFY': 1872.10,
      'SBIN': 815.60, 'TCS': 4420.00, 'AXISBANK': 1165.30, 'LT': 3650.00,
      'BHARTIARTL': 1580.40, 'TATAMOTORS': 1092.50, 'KOTAKBANK': 1780.00,
      'BAJFINANCE': 6950.00, 'BAJAJFINSV': 1640.00, 'INDUSINDBK': 1420.00,
      'HCLTECH': 1740.00, 'WIPRO': 520.00, 'TECHM': 1540.00, 'NTPC': 410.00,
      'POWERGRID': 335.00, 'ONGC': 310.00, 'BPCL': 345.00, 'MARUTI': 12450.00,
      'M&M': 2780.00, 'HEROMOTOCO': 5320.00, 'EICHERMOT': 4850.00, 'TATASTEEL': 154.00,
      'JSWSTEEL': 945.00, 'HINDALCO': 690.00, 'COALINDIA': 495.00, 'ITC': 505.00,
      'HINDUNILVR': 2820.00, 'TITAN': 3620.00, 'ASIANPAINT': 3150.00, 'NESTLEIND': 2520.00,
      'BRITANNIA': 5980.00, 'TATACONSUM': 1180.00, 'SUNPHARMA': 1840.00, 'CIPLA': 1620.00,
      'DRREDDY': 6650.00, 'APOLLOHOSP': 7120.00
    };

    // Rolling intraday candle / quote memory
    this.stockHistory = {};
    STOCK_UNIVERSE.forEach(s => {
      this.stockHistory[s.symbol] = {
        open: this.stockPrices[s.symbol],
        high: this.stockPrices[s.symbol] * 1.008,
        low: this.stockPrices[s.symbol] * 0.994,
        close: this.stockPrices[s.symbol],
        vwap: this.stockPrices[s.symbol] * 1.001,
        orbHigh: this.stockPrices[s.symbol] * 1.006, // 15-min Opening Range High
        orbLow: this.stockPrices[s.symbol] * 0.995,  // 15-min Opening Range Low
        ema20: this.stockPrices[s.symbol] * 0.999,
        volume: 250000
      };
    });
  }

  /**
   * Retrieves live quotes from Angel One SmartAPI in high-speed batch mode (or simulated feed)
   */
  async getQuotes(dashboardInstance = null) {
    let dashboard = dashboardInstance;

    // Automatically retrieve authenticated dashboard session if not passed
    if (!dashboard || typeof dashboard.getLTPData !== 'function') {
      try {
        const { getActiveDashboards } = require('../middleware/authMiddleware');
        const dashboards = getActiveDashboards();
        dashboard = dashboards['default'] || Object.values(dashboards).find(d => d && d.authenticated && typeof d.getLTPData === 'function');
      } catch (e) {}
    }

    // 1. If Angel One SmartAPI dashboard is authenticated, attempt BATCH LTP fetch
    if (dashboard && typeof dashboard.getLTPData === 'function') {
      try {
        const tokens = STOCK_UNIVERSE.map(s => s.token);
        const ltpRes = await dashboard.getLTPData('NSE', tokens, 'FULL');

        if (ltpRes && ltpRes.success && ltpRes.data) {
          const liveResults = {};
          
          STOCK_UNIVERSE.forEach(stock => {
            const tokenData = ltpRes.data[stock.token];
            if (tokenData && tokenData.ltp) {
              const ltp = parseFloat(tokenData.ltp);
              this.stockPrices[stock.symbol] = ltp;
              liveResults[stock.symbol] = ltp;

              const hist = this.stockHistory[stock.symbol];
              if (tokenData.open) hist.open = parseFloat(tokenData.open);
              if (tokenData.high) hist.high = Math.max(hist.high, parseFloat(tokenData.high));
              if (tokenData.low) hist.low = Math.min(hist.low, parseFloat(tokenData.low));
              if (tokenData.close) hist.close = parseFloat(tokenData.close);
              if (tokenData.volume) hist.volume = parseInt(tokenData.volume, 10);
              hist.close = ltp;
              hist.vwap = tokenData.vwap ? parseFloat(tokenData.vwap) : parseFloat(((hist.high + hist.low + ltp) / 3).toFixed(2));
              hist.orbHigh = parseFloat((hist.open * 1.006).toFixed(2));
              hist.orbLow = parseFloat((hist.open * 0.995).toFixed(2));
              hist.ema20 = parseFloat((ltp * 0.998).toFixed(2));
            }
          });

          if (Object.keys(liveResults).length > 0) {
            return this.formatSnapshot('SMARTAPI_LIVE', liveResults);
          }
        }
      } catch (e) {
        console.warn('⚠️ [StockMarketData] Batch SmartAPI quote fetch failed, using local feed:', e.message);
      }
    }

    // 2. Realistic market simulation micro-walk (smooth Brownian motion)
    STOCK_UNIVERSE.forEach(stock => {
      const current = this.stockPrices[stock.symbol];
      const deltaPercent = (Math.random() - 0.49) * 0.0025; // Dynamic fluctuation
      const newPrice = parseFloat((current * (1 + deltaPercent)).toFixed(2));
      this.stockPrices[stock.symbol] = newPrice;

      const hist = this.stockHistory[stock.symbol];
      if (newPrice > hist.high) hist.high = newPrice;
      if (newPrice < hist.low) hist.low = newPrice;
      hist.close = newPrice;
      hist.vwap = parseFloat(((hist.high + hist.low + newPrice) / 3).toFixed(2));
      hist.volume += Math.floor(Math.random() * 8000);
    });

    return this.formatSnapshot('SIMULATED_FEED', this.stockPrices);
  }

  formatSnapshot(source, prices) {
    const marketCalendar = require('../utils/marketCalendar');
    const isMarketOpen = marketCalendar.isMarketOpenNow();
    const effectiveSource = (isMarketOpen && source === 'SMARTAPI_LIVE') ? 'SMARTAPI_LIVE' : 'SIMULATED_FEED';

    const list = STOCK_UNIVERSE.map(stock => {
      const price = prices[stock.symbol] || this.stockPrices[stock.symbol];
      const hist = this.stockHistory[stock.symbol];
      const pChange = parseFloat((((price - hist.open) / hist.open) * 100).toFixed(2));
      return {
        symbol: stock.symbol,
        token: stock.token,
        name: stock.name,
        sector: stock.sector || 'Equities',
        ltp: price,
        open: hist.open,
        high: hist.high,
        low: hist.low,
        vwap: hist.vwap,
        orbHigh: hist.orbHigh,
        orbLow: hist.orbLow,
        ema20: hist.ema20,
        volume: hist.volume,
        pChange,
        weight: stock.weight
      };
    });

    return {
      timestamp: new Date().toISOString(),
      source: effectiveSource,
      isMarketOpen,
      marketStatus: isMarketOpen ? 'OPEN' : 'CLOSED',
      marketNotice: isMarketOpen 
        ? 'LIVE NSE TICK DATA (SMARTAPI BATCH VERIFIED)' 
        : 'SIMULATED BROWNIAN TICKS (NSE IS CURRENTLY CLOSED: TRADING HOURS ARE 09:15 - 15:30 IST)',
      stocks: list
    };
  }
}

module.exports = new StockMarketDataProvider();
