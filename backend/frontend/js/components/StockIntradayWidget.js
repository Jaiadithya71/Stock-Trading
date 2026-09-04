// ============================================================================
// FILE: frontend/js/components/StockIntradayWidget.js
// TradingView / Trading.com Inspired Pro Trading Terminal for Nifty 50 Equities
// Clean, Intuitive Visual Architecture (Interactive Chart + Watchlist + Blotter)
// ============================================================================

const StockIntradayWidget = {
  currentMode: 'PAPER_TRADING',
  autoExecutionEnabled: true,
  selectedSymbol: 'HDFCBANK',
  searchQuery: '',
  selectedSector: 'ALL',
  activeStocks: [],
  pollInterval: null,
  activeTab: 'positions', // 'positions', 'history', 'backtest'

  render() {
    const container = document.getElementById('stock-intraday-widget');
    if (!container) return;

    container.innerHTML = `
      <div class="tradingview-terminal" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #d1d4dc; background: #131722; border-radius: 10px; overflow: hidden; border: 1px solid #2a2e39; margin-bottom: 20px;">
        
        <!-- DATA INTEGRITY & MARKET STATUS BANNER -->
        <div id="tvMarketStatusBanner" style="display: flex; align-items: center; justify-content: space-between; padding: 8px 16px; background: rgba(234, 179, 8, 0.12); border-bottom: 1px solid rgba(234, 179, 8, 0.25); font-size: 11.5px; color: #eab308;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span id="tvMarketStatusDot" style="font-size: 13px;">⚠️</span>
            <span id="tvMarketStatusText">
              <strong>OFFLINE SIMULATION MODE (MARKET CLOSED)</strong>: Prices below are synthetic Brownian walk projections for offline testing. Real NSE trading runs <strong>09:15 AM - 03:30 PM IST</strong>.
            </span>
          </div>
          <div style="display: flex; gap: 10px; align-items: center;">
            <span id="tvDataSourceTag" style="font-size: 10px; padding: 2px 6px; border-radius: 3px; background: #000; font-family: monospace; color: #eab308; border: 1px solid rgba(234,179,8,0.3);">
              FEED: SIMULATED
            </span>
            <button onclick="window.open('/api/stocks/download-pnl-data', '_blank')" style="padding: 3px 8px; font-size: 10.5px; background: rgba(255,255,255,0.08); border: 1px solid #2a2e39; color: #fff; border-radius: 4px; cursor: pointer;">
              📥 Export P&L Data
            </button>
          </div>
        </div>

        <!-- TRADINGVIEW TOP BAR -->
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 16px; background: #1e222d; border-bottom: 1px solid #2a2e39; flex-wrap: wrap; gap: 10px;">
          
          <!-- LEFT: ACTIVE SYMBOL & QUOTE BADGES -->
          <div style="display: flex; align-items: center; gap: 14px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span id="tvSymbolTitle" style="font-size: 17px; font-weight: 800; color: #fff; letter-spacing: 0.5px;">HDFCBANK</span>
              <span style="font-size: 11px; background: #2a2e39; color: #8896a8; padding: 2px 6px; border-radius: 4px;">NSE CASH</span>
            </div>

            <div style="display: flex; align-items: baseline; gap: 8px;">
              <span id="tvLtpDisplay" style="font-size: 19px; font-weight: 700; color: #00d084; font-family: monospace;">₹1,642.50</span>
              <span id="tvChgDisplay" style="font-size: 12px; font-weight: 700; color: #00d084; font-family: monospace;">+0.85%</span>
            </div>

            <div id="tvSignalPill" style="padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; background: rgba(0, 208, 132, 0.15); color: #00d084; border: 1px solid rgba(0, 208, 132, 0.3);">
              🟢 BUY BREAKOUT (ORB + VWAP)
            </div>
          </div>

          <!-- RIGHT: CONTROLS & 3-STAGE SWITCHER -->
          <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
            <button id="btnAutoTradingToggle" onclick="StockIntradayWidget.toggleAutoExecution()" style="padding: 6px 12px; font-size: 11px; font-weight: 700; border-radius: 6px; border: 1px solid #00d084; background: rgba(0, 208, 132, 0.15); color: #00d084; cursor: pointer;">
              🤖 AUTO-TRADE: ACTIVE
            </button>

            <!-- Mode Switcher -->
            <div style="display: flex; background: #131722; padding: 3px; border-radius: 6px; border: 1px solid #2a2e39;">
              <button id="modeBtnPaper" onclick="StockIntradayWidget.setMode('PAPER_TRADING')" style="padding: 5px 12px; font-size: 11px; font-weight: 700; border: none; border-radius: 4px; background: #2962ff; color: #fff; cursor: pointer;">
                Paper Mode
              </button>
              <button id="modeBtnLive" onclick="StockIntradayWidget.setMode('LIVE_BROKER')" style="padding: 5px 12px; font-size: 11px; font-weight: 700; border: none; border-radius: 4px; background: transparent; color: #8896a8; cursor: pointer;">
                Live Broker
              </button>
            </div>

            <button onclick="StockIntradayWidget.triggerEODSettlement()" style="padding: 6px 12px; font-size: 11px; font-weight: 700; border-radius: 6px; border: 1px solid #3b82f6; background: rgba(59, 130, 246, 0.15); color: #3b82f6; cursor: pointer;">
              💾 Archive EOD P&L
            </button>
          </div>

        </div>

        <!-- MAIN TRADING INTERFACE: 2-COLUMN SPLIT (CHART vs WATCHLIST) -->
        <div style="display: grid; grid-template-columns: 1fr 340px; min-height: 480px; border-bottom: 1px solid #2a2e39;">
          
          <!-- LEFT: PRO CHART & STRATEGY CONFLUENCE VIEW -->
          <div style="padding: 16px; border-right: 1px solid #2a2e39; display: flex; flex-direction: column;">
            
            <!-- Chart Toolbar -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
              <div style="display: flex; gap: 8px; align-items: center; font-size: 12px;">
                <span style="color: #8896a8;">Timeframe:</span>
                <span style="background: #2a2e39; color: #fff; padding: 2px 8px; border-radius: 4px; font-weight: 700;">15m ORB</span>
                <span style="color: #2962ff; font-weight: 600; margin-left: 10px;">● VWAP</span>
                <span style="color: #eab308; font-weight: 600; margin-left: 6px;">● 20 EMA</span>
                <span style="color: #00d084; font-weight: 600; margin-left: 6px;">-- ORB High</span>
                <span style="color: #ff4757; font-weight: 600; margin-left: 6px;">-- ORB Low</span>
              </div>

              <div id="tvSignalRationale" style="font-size: 11px; color: #8896a8; max-width: 450px; text-align: right;">
                Awaiting ORB Breakout...
              </div>
            </div>

            <!-- Candlestick SVG Visualizer -->
            <div id="tvChartContainer" style="flex: 1; min-height: 320px; background: #131722; position: relative; border-radius: 6px; border: 1px solid rgba(255,255,255,0.03);">
              <!-- Rendered via renderChartSVG -->
            </div>

            <!-- Quick Action Bar -->
            <div style="display: flex; gap: 12px; margin-top: 14px; align-items: center; justify-content: space-between; background: #1e222d; padding: 10px 14px; border-radius: 8px;">
              <div style="display: flex; gap: 14px; font-size: 12px;">
                <div>Risk Budget: <strong style="color: #fff;">₹1,000 (1%)</strong></div>
                <div>Allocated Shares: <strong id="tvOrderShares" style="color: #2962ff;">40 Qty</strong></div>
                <div>Margin (5x): <strong id="tvOrderMargin" style="color: #eab308;">₹13,140</strong></div>
              </div>

              <div style="display: flex; gap: 10px;">
                <button onclick="StockIntradayWidget.executeSelectedOrder('BUY')" style="padding: 8px 24px; background: #00d084; color: #000; border: none; border-radius: 6px; font-weight: 800; font-size: 12px; cursor: pointer; transition: opacity 0.2s;">
                  BUY LONG (MIS)
                </button>
                <button onclick="StockIntradayWidget.executeSelectedOrder('SELL')" style="padding: 8px 24px; background: #ff4757; color: #fff; border: none; border-radius: 6px; font-weight: 800; font-size: 12px; cursor: pointer; transition: opacity 0.2s;">
                  SELL SHORT (MIS)
                </button>
              </div>
            </div>

          </div>

          <!-- RIGHT: TRADINGVIEW STYLE WATCHLIST -->
          <div style="background: #181c27; display: flex; flex-direction: column;">
            
            <div style="padding: 10px 14px; border-bottom: 1px solid #2a2e39;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <span style="font-size: 12px; font-weight: 800; color: #fff; text-transform: uppercase; letter-spacing: 0.5px;">Expanded Universe</span>
                <span id="tvWatchlistCount" style="font-size: 11px; color: #00d084; font-weight: 700;">40 Stocks (5x MIS)</span>
              </div>
              <input type="text" id="tvSearchInput" placeholder="🔍 Search stock (e.g. INFY, ITC, MARUTI)..." oninput="StockIntradayWidget.onSearch(this.value)" style="width: 100%; box-sizing: border-box; padding: 6px 10px; background: #131722; border: 1px solid #2a2e39; color: #fff; border-radius: 4px; font-size: 11px; margin-bottom: 6px;">
              <div style="display: flex; gap: 4px; overflow-x: auto; padding-bottom: 2px;">
                <button class="sector-chip active" onclick="StockIntradayWidget.onFilterSector('ALL')" style="padding: 2px 7px; font-size: 10px; border-radius: 3px; border: none; background: #2962ff; color: #fff; cursor: pointer; white-space: nowrap;">All (40)</button>
                <button class="sector-chip" onclick="StockIntradayWidget.onFilterSector('Banking')" style="padding: 2px 7px; font-size: 10px; border-radius: 3px; border: 1px solid #2a2e39; background: transparent; color: #8896a8; cursor: pointer; white-space: nowrap;">Banking</button>
                <button class="sector-chip" onclick="StockIntradayWidget.onFilterSector('IT')" style="padding: 2px 7px; font-size: 10px; border-radius: 3px; border: 1px solid #2a2e39; background: transparent; color: #8896a8; cursor: pointer; white-space: nowrap;">IT</button>
                <button class="sector-chip" onclick="StockIntradayWidget.onFilterSector('Auto')" style="padding: 2px 7px; font-size: 10px; border-radius: 3px; border: 1px solid #2a2e39; background: transparent; color: #8896a8; cursor: pointer; white-space: nowrap;">Auto</button>
                <button class="sector-chip" onclick="StockIntradayWidget.onFilterSector('Energy')" style="padding: 2px 7px; font-size: 10px; border-radius: 3px; border: 1px solid #2a2e39; background: transparent; color: #8896a8; cursor: pointer; white-space: nowrap;">Energy</button>
                <button class="sector-chip" onclick="StockIntradayWidget.onFilterSector('FMCG')" style="padding: 2px 7px; font-size: 10px; border-radius: 3px; border: 1px solid #2a2e39; background: transparent; color: #8896a8; cursor: pointer; white-space: nowrap;">FMCG</button>
                <button class="sector-chip" onclick="StockIntradayWidget.onFilterSector('Metals')" style="padding: 2px 7px; font-size: 10px; border-radius: 3px; border: 1px solid #2a2e39; background: transparent; color: #8896a8; cursor: pointer; white-space: nowrap;">Metals</button>
              </div>
            </div>

            <div id="tvWatchlistContainer" style="flex: 1; overflow-y: auto; max-height: 480px;">
              <!-- Populated via renderWatchlist -->
            </div>

          </div>

        </div>

        <!-- BOTTOM PANEL: TRADINGVIEW STYLE DOCKED TABS -->
        <div style="background: #1e222d;">
          
          <div style="display: flex; border-bottom: 1px solid #2a2e39; padding: 0 16px;">
            <button class="tv-tab-btn active" id="tabBtnPos" onclick="StockIntradayWidget.switchBottomTab('positions')" style="padding: 10px 16px; font-size: 12px; font-weight: 700; background: transparent; border: none; border-bottom: 2px solid #2962ff; color: #fff; cursor: pointer;">
              💼 Active Positions (<span id="tvOpenCount">0</span>)
            </button>
            <button class="tv-tab-btn" id="tabBtnHist" onclick="StockIntradayWidget.switchBottomTab('history')" style="padding: 10px 16px; font-size: 12px; font-weight: 700; background: transparent; border: none; color: #8896a8; cursor: pointer;">
              📅 Daily P&L Ledger (Stored on Disk)
            </button>
            <button class="tv-tab-btn" id="tabBtnSim" onclick="StockIntradayWidget.switchBottomTab('backtest')" style="padding: 10px 16px; font-size: 12px; font-weight: 700; background: transparent; border: none; color: #8896a8; cursor: pointer;">
              📊 Stage 1 Backtesting Replay
            </button>
          </div>

          <!-- TAB 1: POSITIONS BLOTTER -->
          <div id="tabContentPositions" style="padding: 14px; max-height: 200px; overflow-y: auto;">
            <table style="width: 100%; border-collapse: collapse; font-size: 11.5px; text-align: left;">
              <thead>
                <tr style="color: #8896a8; border-bottom: 1px solid #2a2e39;">
                  <th style="padding: 6px 8px;">Symbol</th>
                  <th style="padding: 6px 8px;">Side</th>
                  <th style="padding: 6px 8px;">Shares</th>
                  <th style="padding: 6px 8px;">Entry Price</th>
                  <th style="padding: 6px 8px;">Stop Loss</th>
                  <th style="padding: 6px 8px;">Target</th>
                  <th style="padding: 6px 8px;">Margin (5x)</th>
                  <th style="padding: 6px 8px;">Unrealized P&L</th>
                  <th style="padding: 6px 8px;">Action</th>
                </tr>
              </thead>
              <tbody id="tvPositionsTbody">
                <tr><td colspan="9" style="text-align: center; padding: 18px; color: #8896a8;">No open positions. 100% virtual capital safe in cash.</td></tr>
              </tbody>
            </table>
          </div>

          <!-- TAB 2: DAILY STORED LEDGER -->
          <div id="tabContentHistory" style="display: none; padding: 14px; max-height: 200px; overflow-y: auto;">
            <table style="width: 100%; border-collapse: collapse; font-size: 11.5px; text-align: left;">
              <thead>
                <tr style="color: #8896a8; border-bottom: 1px solid #2a2e39;">
                  <th style="padding: 6px 8px;">Archive Date</th>
                  <th style="padding: 6px 8px;">Trades Executed</th>
                  <th style="padding: 6px 8px;">Win Rate</th>
                  <th style="padding: 6px 8px;">Net Realized P&L</th>
                  <th style="padding: 6px 8px;">Ending Balance</th>
                  <th style="padding: 6px 8px;">Storage Status</th>
                </tr>
              </thead>
              <tbody id="tvLedgerTbody">
                <tr><td colspan="6" style="text-align: center; padding: 18px; color: #8896a8;">Loading stored archives...</td></tr>
              </tbody>
            </table>
          </div>

          <!-- TAB 3: BACKTEST REPLAY -->
          <div id="tabContentBacktest" style="display: none; padding: 14px;">
            <div style="display: flex; gap: 14px; align-items: center; margin-bottom: 14px; flex-wrap: wrap;">
              <div>Horizon: <input type="number" id="tvSimDays" value="20" style="width: 60px; padding: 4px 8px; background: #131722; border: 1px solid #2a2e39; color: #fff; border-radius: 4px;"> days</div>
              <div>Risk/Trade: <input type="number" id="tvSimRisk" value="1.0" step="0.1" style="width: 60px; padding: 4px 8px; background: #131722; border: 1px solid #2a2e39; color: #fff; border-radius: 4px;"> %</div>
              <button onclick="StockIntradayWidget.runBacktest()" style="padding: 6px 16px; background: #00d084; color: #000; border: none; border-radius: 4px; font-weight: 700; cursor: pointer;">
                Run Backtest
              </button>
              <span id="tvSimSummaryResult" style="font-size: 12px; color: #00d084; font-weight: 700; margin-left: 10px;"></span>
            </div>
            <div id="tvSimTradesTable" style="max-height: 140px; overflow-y: auto;">
              <!-- Backtest trades table -->
            </div>
          </div>

        </div>

      </div>
    `;

    this.startPolling();
    this.fetchDailyLedger();
  },

    onSearch(query) {
    this.searchQuery = (query || '').toUpperCase().trim();
    this.renderWatchlist(this.activeStocks);
  },

  onFilterSector(sector) {
    this.selectedSector = sector;
    this.renderWatchlist(this.activeStocks);
  },
  selectStock(symbol) {
    this.selectedSymbol = symbol;
    this.updateActiveStockView();
  },

  switchBottomTab(tab) {
    this.activeTab = tab;
    document.getElementById('tabContentPositions').style.display = tab === 'positions' ? 'block' : 'none';
    document.getElementById('tabContentHistory').style.display = tab === 'history' ? 'block' : 'none';
    document.getElementById('tabContentBacktest').style.display = tab === 'backtest' ? 'block' : 'none';

    document.getElementById('tabBtnPos').style.borderBottom = tab === 'positions' ? '2px solid #2962ff' : 'none';
    document.getElementById('tabBtnPos').style.color = tab === 'positions' ? '#fff' : '#8896a8';
    document.getElementById('tabBtnHist').style.borderBottom = tab === 'history' ? '2px solid #2962ff' : 'none';
    document.getElementById('tabBtnHist').style.color = tab === 'history' ? '#fff' : '#8896a8';
    document.getElementById('tabBtnSim').style.borderBottom = tab === 'backtest' ? '2px solid #2962ff' : 'none';
    document.getElementById('tabBtnSim').style.color = tab === 'backtest' ? '#fff' : '#8896a8';

    if (tab === 'history') this.fetchDailyLedger();
  },

  setMode(mode) {
    this.currentMode = mode;
    document.getElementById('modeBtnPaper').style.background = mode === 'PAPER_TRADING' ? '#2962ff' : 'transparent';
    document.getElementById('modeBtnPaper').style.color = mode === 'PAPER_TRADING' ? '#fff' : '#8896a8';
    document.getElementById('modeBtnLive').style.background = mode === 'LIVE_BROKER' ? '#ff4757' : 'transparent';
    document.getElementById('modeBtnLive').style.color = mode === 'LIVE_BROKER' ? '#fff' : '#8896a8';

    if (mode === 'LIVE_BROKER') {
      alert('⚠️ STAGE 3: LIVE BROKER ORDER ROUTING ACTIVATED\nLive orders will execute via Angel One SmartAPI for NSE cash equities.');
    }
  },

  async toggleAutoExecution() {
    try {
      const res = await fetch('/api/stocks/toggle-auto-execution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !this.autoExecutionEnabled })
      });
      const data = await res.json();
      if (data.success) {
        this.autoExecutionEnabled = data.autoExecutionEnabled;
        const btn = document.getElementById('btnAutoTradingToggle');
        if (this.autoExecutionEnabled) {
          btn.textContent = '🤖 AUTO-TRADE: ACTIVE';
          btn.style.borderColor = '#00d084';
          btn.style.color = '#00d084';
          btn.style.background = 'rgba(0, 208, 132, 0.15)';
        } else {
          btn.textContent = '⏸️ AUTO-TRADE: PAUSED';
          btn.style.borderColor = '#ff4757';
          btn.style.color = '#ff4757';
          btn.style.background = 'rgba(255, 71, 87, 0.15)';
        }
      }
    } catch (e) {}
  },

  async triggerEODSettlement() {
    if (!confirm('Run End-of-Day P&L settlement and disk archive now?')) return;
    try {
      const res = await fetch('/api/stocks/eod-settlement', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        alert(`✅ Daily P&L Archived Successfully!\nDate: ${data.archive.date}\nNet P&L: ₹${data.archive.summary.netRealizedPnL}\nSaved permanently to disk.`);
        this.fetchDailyLedger();
      }
    } catch (e) { alert(e.message); }
  },

    updateMarketBanner(data) {
    const banner = document.getElementById('tvMarketStatusBanner');
    const dot = document.getElementById('tvMarketStatusDot');
    const text = document.getElementById('tvMarketStatusText');
    const tag = document.getElementById('tvDataSourceTag');
    if (!banner || !text || !tag) return;

    if (data.isMarketOpen) {
      banner.style.background = 'rgba(0, 208, 132, 0.12)';
      banner.style.borderBottomColor = 'rgba(0, 208, 132, 0.25)';
      banner.style.color = '#00d084';
      dot.textContent = '🟢';
      text.innerHTML = '<strong>LIVE NSE EXCHANGE SESSION</strong>: Market is OPEN (09:15 AM - 03:30 PM IST). Streaming live tick updates and breakout signals.';
      tag.textContent = data.source === 'SMARTAPI_LIVE' ? 'FEED: LIVE NSE' : 'FEED: STREAMING';
      tag.style.color = '#00d084';
      tag.style.borderColor = 'rgba(0,208,132,0.3)';
    } else {
      banner.style.background = 'rgba(234, 179, 8, 0.12)';
      banner.style.borderBottomColor = 'rgba(234, 179, 8, 0.25)';
      banner.style.color = '#eab308';
      dot.textContent = '⚠️';
      text.innerHTML = '<strong>OFFLINE SIMULATION MODE (MARKET CLOSED)</strong>: Prices below are synthetic Brownian walk projections for offline testing. Real NSE trading runs <strong>09:15 AM - 03:30 PM IST</strong>.';
      tag.textContent = 'FEED: SIMULATED';
      tag.style.color = '#eab308';
      tag.style.borderColor = 'rgba(234,179,8,0.3)';
    }
  },
  startPolling() {
    this.fetchData();
    if (this.pollInterval) clearInterval(this.pollInterval);
    this.pollInterval = setInterval(() => this.fetchData(), 3000);
  },

  async fetchData() {
    try {
      const res = await fetch('/api/stocks/signals');
      const data = await res.json();
      if (data.success && data.signals) {
        this.activeStocks = data.signals;
        this.updateMarketBanner(data);
        this.renderWatchlist(data.signals);
        this.updateActiveStockView();
      }

      // Fetch positions
      const posRes = await fetch('/api/paper/summary');
      if (posRes.ok) {
        const posData = await posRes.json();
        const p = posData.data || posData.portfolio || posData;
        this.renderPositions(p.activePositions || []);
      }
    } catch (e) {}
  },

  updateActiveStockView() {
    if (!this.activeStocks || this.activeStocks.length === 0) return;
    const stock = this.activeStocks.find(s => s.symbol === this.selectedSymbol) || this.activeStocks[0];
    if (!stock) return;

    this.selectedSymbol = stock.symbol;

    document.getElementById('tvSymbolTitle').textContent = stock.symbol;
    document.getElementById('tvLtpDisplay').textContent = `₹${stock.ltp.toFixed(2)}`;
    
    const isUp = (stock.pChange || 0) >= 0;
    const chgEl = document.getElementById('tvChgDisplay');
    chgEl.textContent = `${isUp ? '+' : ''}${stock.pChange || 0}%`;
    chgEl.style.color = isUp ? '#00d084' : '#ff4757';
    document.getElementById('tvLtpDisplay').style.color = isUp ? '#00d084' : '#ff4757';

    // Signal pill
    const pill = document.getElementById('tvSignalPill');
    if (stock.signal === 'BUY_LONG') {
      pill.textContent = '🟢 BUY BREAKOUT (ORB)';
      pill.style.background = 'rgba(0, 208, 132, 0.15)';
      pill.style.color = '#00d084';
      pill.style.borderColor = 'rgba(0, 208, 132, 0.3)';
    } else if (stock.signal === 'SELL_SHORT') {
      pill.textContent = '🔴 SELL BREAKDOWN (ORB)';
      pill.style.background = 'rgba(255, 71, 87, 0.15)';
      pill.style.color = '#ff4757';
      pill.style.borderColor = 'rgba(255, 71, 87, 0.3)';
    } else {
      pill.textContent = '🟡 CONSOLIDATING (HOLD)';
      pill.style.background = 'rgba(255, 255, 255, 0.05)';
      pill.style.color = '#8896a8';
      pill.style.borderColor = '#2a2e39';
    }

    document.getElementById('tvSignalRationale').textContent = stock.rationale || 'Consolidating inside 15m range.';
    document.getElementById('tvOrderShares').textContent = `${stock.riskAllocation?.allocatedShares || 10} Qty`;
    document.getElementById('tvOrderMargin').textContent = `₹${stock.riskAllocation?.marginRequired?.toFixed(0) || '0'}`;

    this.renderChartSVG(stock);
  },

  renderWatchlist(stocks) {
    const container = document.getElementById('tvWatchlistContainer');
    if (!container) return;

    let filtered = stocks;
    if (this.searchQuery) {
      filtered = filtered.filter(s => s.symbol.includes(this.searchQuery));
    }
    if (this.selectedSector && this.selectedSector !== 'ALL') {
      filtered = filtered.filter(s => s.sector === this.selectedSector);
    }

    const countEl = document.getElementById('tvWatchlistCount');
    if (countEl) countEl.textContent = `${filtered.length} of ${stocks.length} Stocks`;

    container.innerHTML = filtered.map(s => {
      const isSelected = s.symbol === this.selectedSymbol;
      const isUp = (s.pChange || 0) >= 0;
      const isBuy = s.signal === 'BUY_LONG';
      const isSell = s.signal === 'SELL_SHORT';

      return `
        <div onclick="StockIntradayWidget.selectStock('${s.symbol}')" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; border-bottom: 1px solid rgba(255,255,255,0.03); cursor: pointer; background: ${isSelected ? '#202634' : 'transparent'}; border-left: ${isSelected ? '3px solid #2962ff' : '3px solid transparent'}; transition: background 0.15s;">
          <div>
            <div style="font-size: 13px; font-weight: 700; color: ${isSelected ? '#fff' : '#d1d4dc'};">${s.symbol}</div>
            <div style="font-size: 10.5px; color: ${isBuy ? '#00d084' : (isSell ? '#ff4757' : '#8896a8')}; font-weight: 600;">
              ${s.signal === 'BUY_LONG' ? '● Breakout' : (s.signal === 'SELL_SHORT' ? '● Breakdown' : 'Neutral')}
            </div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 13px; font-weight: 700; font-family: monospace; color: #fff;">₹${s.ltp.toFixed(2)}</div>
            <div style="font-size: 11px; font-weight: 600; color: ${isUp ? '#00d084' : '#ff4757'};">
              ${isUp ? '+' : ''}${s.pChange || 0}%
            </div>
          </div>
        </div>
      `;
    }).join('');
  },

  renderChartSVG(stock) {
    const container = document.getElementById('tvChartContainer');
    if (!container) return;

    const width = container.clientWidth || 600;
    const height = 300;
    const ltp = stock.ltp;
    const vwap = stock.vwap;
    const orbHigh = stock.orbHigh;
    const orbLow = stock.orbLow;
    const ema20 = stock.ema20;

    // Price scaling with safe symmetrical padding
    const allPrices = [ltp, vwap, orbHigh, orbLow, ema20];
    const maxP = Math.max(...allPrices) * 1.004;
    const minP = Math.min(...allPrices) * 0.996;
    const pRange = maxP - minP || 1;

    const getY = (price) => {
      const clamped = Math.max(minP, Math.min(maxP, price));
      return height - 35 - (((clamped - minP) / pRange) * (height - 70));
    };

    // Generate 18 proportional intraday candles ending cleanly at LTP
    const numCandles = 18;
    const candleWidth = (width - 90) / numCandles;
    let candleSvg = '';

    for (let i = 0; i < numCandles; i++) {
      const x = 30 + (i * candleWidth);
      const isLast = i === numCandles - 1;
      
      const progress = i / (numCandles - 1);
      const baseMid = vwap + ((ltp - vwap) * progress * 0.85);
      const osc = Math.sin(i * 0.85) * (pRange * 0.06);
      
      let open = baseMid + osc;
      let close = isLast ? ltp : open + (Math.cos(i * 1.2) * (pRange * 0.05));
      if (isLast) {
        open = close + (stock.signal === 'SELL_SHORT' ? (pRange * 0.08) : -(pRange * 0.08));
      }
      let high = Math.max(open, close) + (pRange * 0.02);
      let low = Math.min(open, close) - (pRange * 0.02);

      const isGreen = close >= open;
      const color = isGreen ? '#00d084' : '#ff4757';
      const yTop = getY(Math.max(open, close));
      const yBot = getY(Math.min(open, close));
      const barH = Math.max(3, yBot - yTop);

      candleSvg += `
        <line x1="${x + candleWidth/2}" y1="${getY(high)}" x2="${x + candleWidth/2}" y2="${getY(low)}" stroke="${color}" stroke-width="1.2" />
        <rect x="${x + 2}" y="${yTop}" width="${Math.max(2, candleWidth - 5)}" height="${barH}" fill="${color}" rx="1" />
      `;
    }

    // Indicator Lines
    const yOrbHigh = getY(orbHigh);
    const yOrbLow = getY(orbLow);
    const yVwap = getY(vwap);
    const yEma = getY(ema20);

    container.innerHTML = `
      <svg width="100%" height="${height}" style="overflow: hidden; display: block;">

        <!-- Grid horizontal lines -->
        <line x1="30" y1="${height/4}" x2="${width-20}" y2="${height/4}" stroke="#202634" stroke-width="1" stroke-dasharray="3,3" />
        <line x1="30" y1="${height/2}" x2="${width-20}" y2="${height/2}" stroke="#202634" stroke-width="1" stroke-dasharray="3,3" />
        <line x1="30" y1="${height*0.75}" x2="${width-20}" y2="${height*0.75}" stroke="#202634" stroke-width="1" stroke-dasharray="3,3" />

        <!-- ORB High Level (Green Dashed) -->
        <line x1="30" y1="${yOrbHigh}" x2="${width-20}" y2="${yOrbHigh}" stroke="#00d084" stroke-width="1.5" stroke-dasharray="5,5" />
        <text x="${width-70}" y="${yOrbHigh - 4}" fill="#00d084" font-size="10" font-weight="700">ORB HIGH ₹${orbHigh.toFixed(0)}</text>

        <!-- ORB Low Level (Red Dashed) -->
        <line x1="30" y1="${yOrbLow}" x2="${width-20}" y2="${yOrbLow}" stroke="#ff4757" stroke-width="1.5" stroke-dasharray="5,5" />
        <text x="${width-70}" y="${yOrbLow + 12}" fill="#ff4757" font-size="10" font-weight="700">ORB LOW ₹${orbLow.toFixed(0)}</text>

        <!-- VWAP Line (Cyan/Blue Solid) -->
        <line x1="30" y1="${yVwap}" x2="${width-20}" y2="${yVwap}" stroke="#2962ff" stroke-width="2" />
        <text x="35" y="${yVwap - 4}" fill="#2962ff" font-size="10" font-weight="700">VWAP ₹${vwap.toFixed(1)}</text>

        <!-- 20 EMA Line (Yellow) -->
        <line x1="30" y1="${yEma}" x2="${width-20}" y2="${yEma}" stroke="#eab308" stroke-width="1.5" stroke-dasharray="2,2" />

        <!-- Candlesticks -->
        ${candleSvg}

        <!-- Current LTP Marker -->
        <circle cx="${width - 70}" cy="${getY(ltp)}" r="4" fill="#fff" />
        <rect x="${width - 60}" y="${getY(ltp) - 10}" width="55" height="18" fill="#2962ff" rx="3" />
        <text x="${width - 55}" y="${getY(ltp) + 3}" fill="#fff" font-size="10" font-weight="700">₹${ltp.toFixed(0)}</text>
      </svg>
    `;
  },

  renderPositions(positions) {
    const tbody = document.getElementById('tvPositionsTbody');
    const countEl = document.getElementById('tvOpenCount');
    if (countEl) countEl.textContent = positions.length;

    if (!tbody) return;
    if (positions.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 18px; color: #8896a8;">No open positions. 100% virtual capital safe in cash.</td></tr>';
      return;
    }

    tbody.innerHTML = positions.map(pos => `
      <tr style="border-bottom: 1px solid rgba(255,255,255,0.03);">
        <td style="padding: 8px; font-weight: 700; color: #fff;">${pos.symbol}</td>
        <td style="padding: 8px; font-weight: 700; color: ${pos.action === 'BUY' ? '#00d084' : '#ff4757'};">${pos.action}</td>
        <td style="padding: 8px; font-family: monospace;">${pos.quantity}</td>
        <td style="padding: 8px; font-family: monospace;">₹${pos.entryPrice.toFixed(2)}</td>
        <td style="padding: 8px; font-family: monospace; color: #ff4757;">₹${pos.stopLoss?.toFixed(2) || '-'}</td>
        <td style="padding: 8px; font-family: monospace; color: #00d084;">₹${pos.target?.toFixed(2) || '-'}</td>
        <td style="padding: 8px; font-family: monospace;">₹${pos.marginBlocked?.toFixed(2) || '-'}</td>
        <td style="padding: 8px; font-weight: 700; color: #00d084; font-family: monospace;">+0.00</td>
        <td style="padding: 8px;"><button onclick="StockIntradayWidget.closePosition('${pos.id}', ${pos.entryPrice})" style="padding: 3px 8px; background: transparent; border: 1px solid #ff4757; color: #ff4757; border-radius: 4px; font-size: 10.5px; cursor: pointer;">Exit</button></td>
      </tr>
    `).join('');
  },

  async executeSelectedOrder(action) {
    const stock = this.activeStocks.find(s => s.symbol === this.selectedSymbol);
    if (!stock) return;

    const qty = stock.riskAllocation?.allocatedShares || 10;
    if (!confirm(`Confirm ${this.currentMode} Order:\n${action} ${qty} ${stock.symbol} @ ₹${stock.ltp}?`)) return;

    try {
      const res = await fetch('/api/paper/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: `${stock.symbol}-EQ`,
          action,
          entryPrice: stock.ltp,
          quantity: qty,
          stopLoss: stock.stopLoss,
          target: stock.target,
          exchange: 'NSE',
          producttype: 'INTRADAY',
          rationale: stock.rationale
        })
      });
      const data = await res.json();
      if (data.success) {
        alert(`✅ Order Placed: ${action} ${qty} ${stock.symbol}`);
        this.fetchData();
      }
    } catch (e) { alert(e.message); }
  },

  async closePosition(positionId, currentPrice) {
    try {
      const res = await fetch('/api/paper/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ positionId, exitPrice: currentPrice })
      });
      const data = await res.json();
      if (data.success) {
        alert('Position squared off successfully');
        this.fetchData();
      }
    } catch (e) { alert(e.message); }
  },

  async fetchDailyLedger() {
    try {
      const res = await fetch('/api/stocks/daily-ledger');
      const data = await res.json();
      const tbody = document.getElementById('tvLedgerTbody');
      if (tbody && data.ledger && data.ledger.length > 0) {
        tbody.innerHTML = data.ledger.map(e => `
          <tr style="border-bottom: 1px solid rgba(255,255,255,0.03);">
            <td style="padding: 8px; font-weight: 700; color: #fff;">${e.date}</td>
            <td style="padding: 8px;">${e.totalTrades}</td>
            <td style="padding: 8px;">${e.winRatePct}%</td>
            <td style="padding: 8px; font-weight: 700; font-family: monospace; color: ${e.netRealizedPnL >= 0 ? '#00d084' : '#ff4757'};">
              ₹${e.netRealizedPnL.toFixed(2)}
            </td>
            <td style="padding: 8px; font-family: monospace;">₹${e.endingBalance?.toLocaleString('en-IN') || '-'}</td>
            <td style="padding: 8px;"><span style="color: #00d084; font-weight: 700; font-size: 10px;">STORED ON DISK</span></td>
          </tr>
        `).join('');
      } else if (tbody) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 18px; color: #8896a8;">No daily archives yet. Click "Archive EOD P&L" to generate today\'s entry.</td></tr>';
      }
    } catch (e) {}
  },

  async runBacktest() {
    const days = parseInt(document.getElementById('tvSimDays').value, 10) || 20;
    const risk = parseFloat(document.getElementById('tvSimRisk').value) || 1.0;
    const resultSpan = document.getElementById('tvSimSummaryResult');
    resultSpan.textContent = 'Testing...';

    try {
      const res = await fetch('/api/simulation/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days, riskPerTradePct: risk, capital: 100000 })
      });
      const data = await res.json();
      if (data.success && data.summary) {
        const s = data.summary;
        resultSpan.textContent = `Net Profit: ₹${s.netProfit.toLocaleString('en-IN')} (${s.netProfitPct}%) | Win Rate: ${s.winRatePct}% | Sharpe: ${s.sharpeRatio.toFixed(2)}`;
      }
    } catch (e) { alert(e.message); }
  }
};