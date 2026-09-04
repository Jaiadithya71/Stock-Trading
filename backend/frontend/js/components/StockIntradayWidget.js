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
  currentCandles: [],
  pollInterval: null,
  activeTab: 'positions', // 'positions', 'history', 'backtest'

  render() {
    const container = document.getElementById('stock-intraday-widget');
    if (!container) return;

    container.innerHTML = `
      <div class="tradingview-terminal" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #d1d4dc; background: #131722; border-radius: 10px; overflow: hidden; border: 1px solid #2a2e39; margin-top: 14px; margin-bottom: 24px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
        
        <style>
          .tv-terminal-main-grid {
            display: grid;
            grid-template-columns: 310px 1fr 360px;
            min-height: 500px;
          }
          @media (max-width: 1380px) {
            .tv-terminal-main-grid {
              grid-template-columns: 290px 1fr 330px;
            }
          }
          @media (max-width: 1100px) {
            .tv-terminal-main-grid {
              grid-template-columns: 1fr;
            }
          }
          .tv-watchlist-row:hover {
            background: #1c2230 !important;
          }
        </style>

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
            <button onclick="window.open('/api/stocks/export-trades-csv', '_blank')" style="padding: 3px 8px; font-size: 10.5px; background: rgba(0, 208, 132, 0.15); border: 1px solid rgba(0, 208, 132, 0.3); color: #00d084; border-radius: 4px; cursor: pointer;">
              📥 Export Trades (CSV)
            </button>
            <button onclick="window.open('/api/stocks/download-pnl-data', '_blank')" style="padding: 3px 8px; font-size: 10.5px; background: rgba(255,255,255,0.08); border: 1px solid #2a2e39; color: #fff; border-radius: 4px; cursor: pointer;">
              📥 Export P&L Bundle
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

            <!-- Strategy Horizon Selector (Intraday vs Positional Swing vs Hybrid) -->
            <div style="display: flex; align-items: center; background: #131722; padding: 3px; border-radius: 6px; border: 1px solid #2a2e39;">
              <span style="font-size: 10px; color: #8896a8; font-weight: 700; padding: 0 6px;">HORIZON:</span>
              <button id="horizonBtnIntraday" onclick="StockIntradayWidget.setStrategyHorizon('INTRADAY')" 
                style="padding: 4px 8px; font-size: 10.5px; font-weight: 700; border: none; border-radius: 4px; background: transparent; color: #8896a8; cursor: pointer;"
                title="Intraday 5x MIS margin with automatic 3:15 PM EOD square-off">
                ⚡ Intraday
              </button>
              <button id="horizonBtnSwing" onclick="StockIntradayWidget.setStrategyHorizon('SWING_POSITIONAL')" 
                style="padding: 4px 8px; font-size: 10.5px; font-weight: 700; border: none; border-radius: 4px; background: transparent; color: #8896a8; cursor: pointer;"
                title="Multi-week Stage-2 Breakouts held up to 30 days with trailing 20-EMA stop">
                📅 Swing (1M)
              </button>
              <button id="horizonBtnHybrid" onclick="StockIntradayWidget.setStrategyHorizon('HYBRID_RUNNER')" 
                style="padding: 4px 8px; font-size: 10.5px; font-weight: 700; border: none; border-radius: 4px; background: #2962ff; color: #fff; cursor: pointer;"
                title="Starts as Intraday 5x; automatically promotes profitable runners (>1.0%) to Swing with breakeven stop-loss">
                🚀 Hybrid (30% Goal)
              </button>
            </div>

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
            <button onclick="StockIntradayWidget.resetVirtualCapital()" style="padding: 6px 12px; font-size: 11px; font-weight: 700; border-radius: 6px; border: 1px solid #00d084; background: rgba(0, 208, 132, 0.15); color: #00d084; cursor: pointer;">
              🔄 Refill Capital (₹1L)
            </button>
          </div>

        </div>

        <!-- EXECUTIVE STOCKS P&L PERFORMANCE SCORECARD -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1px; background: #2a2e39; border-bottom: 1px solid #2a2e39;">
          
          <!-- KPI 1: REALIZED P&L -->
          <div style="background: #171b26; padding: 12px 16px;">
            <div style="font-size: 11px; font-weight: 700; color: #8896a8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
              Realized P&L (Today)
            </div>
            <div id="tvKpiRealized" style="font-size: 18px; font-weight: 800; font-family: monospace; color: #d1d4dc;">
              ₹0.00
            </div>
            <div id="tvKpiRealizedSub" style="font-size: 10.5px; color: #8896a8; margin-top: 2px;">
              0 Closed Trades Today
            </div>
          </div>

          <!-- KPI 2: UNREALIZED P&L (ACTIVE) -->
          <div style="background: #171b26; padding: 12px 16px;">
            <div style="font-size: 11px; font-weight: 700; color: #8896a8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
              Unrealized P&L (Floating)
            </div>
            <div id="tvKpiUnrealized" style="font-size: 18px; font-weight: 800; font-family: monospace; color: #d1d4dc;">
              ₹0.00
            </div>
            <div id="tvKpiUnrealizedSub" style="font-size: 10.5px; color: #8896a8; margin-top: 2px;">
              0 Open Positions
            </div>
          </div>

          <!-- KPI 3: NET TOTAL INTRADAY P&L -->
          <div style="background: #171b26; padding: 12px 16px; border-left: 2px solid #2962ff;">
            <div style="font-size: 11px; font-weight: 700; color: #2962ff; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
              Net Total Intraday P&L
            </div>
            <div id="tvKpiNetTotal" style="font-size: 20px; font-weight: 800; font-family: monospace; color: #d1d4dc;">
              ₹0.00
            </div>
            <div id="tvKpiNetTotalSub" style="font-size: 10.5px; color: #8896a8; margin-top: 2px;">
              Realized + Floating
            </div>
          </div>

          <!-- KPI 4: WIN RATE & RECORD -->
          <div style="background: #171b26; padding: 12px 16px;">
            <div style="font-size: 11px; font-weight: 700; color: #8896a8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
              Win Rate & Record
            </div>
            <div id="tvKpiWinRate" style="font-size: 18px; font-weight: 800; font-family: monospace; color: #d1d4dc;">
              0.0%
            </div>
            <div id="tvKpiWinRecordSub" style="font-size: 10.5px; color: #8896a8; margin-top: 2px;">
              0W / 0L (0 Total)
            </div>
          </div>

          <!-- KPI 5: CAPITAL & 5X MARGIN -->
          <div style="background: #171b26; padding: 12px 16px;">
            <div style="font-size: 11px; font-weight: 700; color: #8896a8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
              Available Cash (Free Margin)
            </div>
            <div id="tvKpiBalance" style="font-size: 17px; font-weight: 800; font-family: monospace; color: #fff;">
              ₹1,00,000.00
            </div>
            <div id="tvKpiMarginSub" style="font-size: 10.5px; color: #8896a8; margin-top: 2px;">
              Margin Blocked: ₹0.00
            </div>
          </div>

        </div>

        <!-- MAIN TRADING INTERFACE: 3-COLUMN BENTO TERMINAL (INTEL vs PRO CHART vs EXPANDED WATCHLIST) -->
        <div class="tv-terminal-main-grid" style="border-bottom: 1px solid #2a2e39;">
          
          <!-- COLUMN 1: DEDICATED STOCK INTEL & ORDER STATION -->
          <div style="padding: 14px; background: #161a25; border-right: 1px solid #2a2e39; display: flex; flex-direction: column; gap: 12px; overflow-y: auto; max-height: 520px;">
            
            <!-- Stock Overview Card -->
            <div style="background: #1c212f; border: 1px solid #2a2e39; border-radius: 8px; padding: 12px;">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
                <div>
                  <div style="display: flex; align-items: center; gap: 6px;">
                    <span id="tvIntelSymbol" style="font-size: 16px; font-weight: 800; color: #fff; letter-spacing: 0.5px;">HDFCBANK</span>
                    <span id="tvIntelSector" style="font-size: 10px; background: rgba(41, 98, 255, 0.2); color: #2962ff; padding: 1px 6px; border-radius: 3px; font-weight: 700; border: 1px solid rgba(41, 98, 255, 0.4);">Banking</span>
                  </div>
                  <div id="tvIntelName" style="font-size: 10.5px; color: #8896a8; margin-top: 2px;">HDFC Bank Ltd.</div>
                </div>
                <div style="text-align: right;">
                  <div id="tvIntelLtp" style="font-size: 18px; font-weight: 800; font-family: monospace; color: #00d084;">₹1,642.50</div>
                  <div id="tvIntelChg" style="font-size: 11px; font-weight: 700; font-family: monospace; color: #00d084;">+0.85%</div>
                </div>
              </div>

              <!-- Day Range Meter -->
              <div style="margin-top: 10px;">
                <div style="display: flex; justify-content: space-between; font-size: 9.5px; color: #8896a8; margin-bottom: 3px;">
                  <span>L: <strong id="tvIntelRangeLow" style="color: #ff4757; font-family: monospace;">₹1,632.00</strong></span>
                  <span style="font-weight: 600; color: #d1d4dc;">Intraday Range</span>
                  <span>H: <strong id="tvIntelRangeHigh" style="color: #00d084; font-family: monospace;">₹1,655.00</strong></span>
                </div>
                <div style="position: relative; height: 6px; background: #262b3a; border-radius: 3px;">
                  <div id="tvIntelRangeFill" style="height: 100%; width: 55%; background: linear-gradient(90deg, #ff4757, #eab308, #00d084); border-radius: 3px;"></div>
                  <div id="tvIntelRangeMarker" style="position: absolute; top: -3px; left: 55%; width: 4px; height: 12px; background: #fff; border-radius: 2px; box-shadow: 0 0 4px #000;"></div>
                </div>
              </div>
            </div>

            <!-- Technical Confluence Grid -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
              
              <!-- VWAP -->
              <div style="background: #1c212f; border: 1px solid #2a2e39; border-radius: 6px; padding: 8px 10px;">
                <div style="font-size: 10px; color: #8896a8; text-transform: uppercase; font-weight: 700;">VWAP</div>
                <div id="tvIntelVwap" style="font-size: 13px; font-weight: 700; color: #2962ff; font-family: monospace; margin: 2px 0;">₹1,640.20</div>
                <div id="tvIntelVwapBias" style="font-size: 9.5px; color: #00d084; font-weight: 600;">▲ +0.14% Above</div>
              </div>

              <!-- 20 EMA -->
              <div style="background: #1c212f; border: 1px solid #2a2e39; border-radius: 6px; padding: 8px 10px;">
                <div style="font-size: 10px; color: #8896a8; text-transform: uppercase; font-weight: 700;">20 EMA</div>
                <div id="tvIntelEma20" style="font-size: 13px; font-weight: 700; color: #eab308; font-family: monospace; margin: 2px 0;">₹1,638.50</div>
                <div id="tvIntelEmaTrend" style="font-size: 9.5px; color: #00d084; font-weight: 600;">Bullish Trend</div>
              </div>

              <!-- 15m ORB High -->
              <div style="background: #1c212f; border: 1px solid #2a2e39; border-radius: 6px; padding: 8px 10px;">
                <div style="font-size: 10px; color: #8896a8; text-transform: uppercase; font-weight: 700;">15m ORB High</div>
                <div id="tvIntelOrbHigh" style="font-size: 13px; font-weight: 700; color: #00d084; font-family: monospace; margin: 2px 0;">₹1,650.00</div>
                <div style="font-size: 9px; color: #8896a8;">Breakout Barrier</div>
              </div>

              <!-- 15m ORB Low -->
              <div style="background: #1c212f; border: 1px solid #2a2e39; border-radius: 6px; padding: 8px 10px;">
                <div style="font-size: 10px; color: #8896a8; text-transform: uppercase; font-weight: 700;">15m ORB Low</div>
                <div id="tvIntelOrbLow" style="font-size: 13px; font-weight: 700; color: #ff4757; font-family: monospace; margin: 2px 0;">₹1,635.00</div>
                <div style="font-size: 9px; color: #8896a8;">Breakdown Barrier</div>
              </div>

              <!-- ATR 14 -->
              <div style="background: #1c212f; border: 1px solid #2a2e39; border-radius: 6px; padding: 8px 10px;">
                <div style="font-size: 10px; color: #8896a8; text-transform: uppercase; font-weight: 700;">ATR (14 Volatility)</div>
                <div id="tvIntelAtr" style="font-size: 13px; font-weight: 700; color: #fff; font-family: monospace; margin: 2px 0;">₹19.50</div>
                <div style="font-size: 9px; color: #8896a8;">~1.2% Day Range</div>
              </div>

              <!-- Volume -->
              <div style="background: #1c212f; border: 1px solid #2a2e39; border-radius: 6px; padding: 8px 10px;">
                <div style="font-size: 10px; color: #8896a8; text-transform: uppercase; font-weight: 700;">Session Volume</div>
                <div id="tvIntelVolume" style="font-size: 13px; font-weight: 700; color: #fff; font-family: monospace; margin: 2px 0;">250K</div>
                <div style="font-size: 9px; color: #8896a8;">NSE Equities</div>
              </div>

            </div>

            <!-- Trade Setup & Sizing Card -->
            <div style="background: #1c212f; border: 1px solid #2a2e39; border-radius: 8px; padding: 12px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span style="font-size: 10.5px; font-weight: 800; color: #8896a8; text-transform: uppercase;">1:2 Risk Setup</span>
                <span id="tvIntelSetupConfidence" style="font-size: 10px; font-weight: 700; color: #00d084; background: rgba(0,208,132,0.12); padding: 1px 6px; border-radius: 3px;">88% Confidence</span>
              </div>

              <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 5px;">
                <span style="color: #8896a8;">Target Price (2x ATR):</span>
                <strong id="tvIntelTarget" style="color: #00d084; font-family: monospace;">₹1,675.00</strong>
              </div>

              <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 5px;">
                <span style="color: #8896a8;">Stop Loss (1.2x ATR):</span>
                <strong id="tvIntelStopLoss" style="color: #ff4757; font-family: monospace;">₹1,625.00</strong>
              </div>

              <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 5px;">
                <span style="color: #8896a8;">Risk Budget (1%):</span>
                <strong style="color: #fff; font-family: monospace;">₹1,000.00</strong>
              </div>

              <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 5px;">
                <span style="color: #8896a8;">Allocated Position:</span>
                <strong id="tvOrderShares" style="color: #2962ff; font-family: monospace;">40 Shares</strong>
              </div>

              <div style="display: flex; justify-content: space-between; font-size: 11px; padding-top: 5px; border-top: 1px dashed #2a2e39;">
                <span style="color: #8896a8;">Margin Required (5x):</span>
                <strong id="tvOrderMargin" style="color: #eab308; font-family: monospace;">₹13,140</strong>
              </div>
            </div>

            <!-- Instant Order Execution Buttons -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: auto;">
              <button onclick="StockIntradayWidget.executeSelectedOrder('BUY')" style="padding: 10px 12px; background: #00d084; color: #000; border: none; border-radius: 6px; font-weight: 800; font-size: 11.5px; cursor: pointer; transition: opacity 0.2s; display: flex; align-items: center; justify-content: center; gap: 4px;">
                <span>🟢</span> BUY (MIS)
              </button>
              <button onclick="StockIntradayWidget.executeSelectedOrder('SELL')" style="padding: 10px 12px; background: #ff4757; color: #fff; border: none; border-radius: 6px; font-weight: 800; font-size: 11.5px; cursor: pointer; transition: opacity 0.2s; display: flex; align-items: center; justify-content: center; gap: 4px;">
                <span>🔴</span> SELL (MIS)
              </button>
            </div>

          </div>

          <!-- COLUMN 2: PRO CANDLESTICK CHART & RATIONALE -->
          <div style="padding: 14px; background: #131722; border-right: 1px solid #2a2e39; display: flex; flex-direction: column; min-width: 0;">
            
            <!-- Chart Toolbar -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 8px;">
              <div style="display: flex; gap: 8px; align-items: center; font-size: 11px;">
                <span style="background: #2a2e39; color: #fff; padding: 2px 7px; border-radius: 4px; font-weight: 700;">15m ORB</span>
                <span style="color: #2962ff; font-weight: 600;">● VWAP</span>
                <span style="color: #eab308; font-weight: 600;">● 20 EMA</span>
                <span style="color: #00d084; font-weight: 600;">-- ORB High</span>
                <span style="color: #ff4757; font-weight: 600;">-- ORB Low</span>
              </div>

              <div id="tvChartStatus" style="font-size: 10.5px; color: #8896a8; font-family: monospace;">
                💡 Hover candle for details
              </div>
            </div>

            <!-- Real-Time Interactive OHLC Inspection Bar -->
            <div id="tvChartOhlcBar" style="display: flex; gap: 10px; font-size: 11px; font-family: 'JetBrains Mono', monospace; color: #8896a8; background: #181c27; padding: 6px 12px; border-radius: 6px; margin-bottom: 8px; flex-wrap: wrap; align-items: center; border: 1px solid rgba(255,255,255,0.06);">
              <span>Bar: <strong id="tvOhlcTime" style="color: #fff;">--:--</strong></span>
              <span>O: <strong id="tvOhlcOpen" style="color: #fff;">₹-</strong></span>
              <span>H: <strong id="tvOhlcHigh" style="color: #00d084;">₹-</strong></span>
              <span>L: <strong id="tvOhlcLow" style="color: #ff4757;">₹-</strong></span>
              <span>C: <strong id="tvOhlcClose" style="color: #fff;">₹-</strong></span>
              <span>Chg: <strong id="tvOhlcChg" style="color: #00d084;">-</strong></span>
              <span>Vol: <strong id="tvOhlcVol" style="color: #2962ff;">-</strong></span>
            </div>

            <!-- Signal Rationale Callout -->
            <div id="tvSignalRationale" style="font-size: 11.5px; color: #d1d4dc; background: #1a1e2b; border-left: 3px solid #2962ff; padding: 7px 12px; border-radius: 0 6px 6px 0; margin-bottom: 8px; line-height: 1.4;">
              Awaiting ORB Breakout...
            </div>

            <!-- Candlestick SVG Visualizer & Hover Overlay -->
            <div id="tvChartContainer" style="flex: 1; min-height: 350px; background: #0e1118; position: relative; border-radius: 6px; border: 1px solid #202634; display: flex; flex-direction: column; justify-content: center;" onmouseleave="StockIntradayWidget.onLeaveCandle()">
              <!-- Rendered via renderChartSVG -->
            </div>

          </div>

          <!-- COLUMN 3: EXPANDED UNIVERSE WATCHLIST (RICH MULTI-DATA) -->
          <div style="background: #181c27; display: flex; flex-direction: column; min-width: 0;">
            
            <div style="padding: 10px 12px; border-bottom: 1px solid #2a2e39;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <span style="font-size: 12px; font-weight: 800; color: #fff; text-transform: uppercase; letter-spacing: 0.5px;">Universe Watchlist</span>
                <span id="tvWatchlistCount" style="font-size: 10.5px; color: #00d084; font-weight: 700;">40 Stocks (5x MIS)</span>
              </div>
              
              <input type="text" id="tvSearchInput" placeholder="🔍 Search (e.g. INFY, ITC, MARUTI)..." oninput="StockIntradayWidget.onSearch(this.value)" style="width: 100%; box-sizing: border-box; padding: 6px 10px; background: #131722; border: 1px solid #2a2e39; color: #fff; border-radius: 4px; font-size: 11px; margin-bottom: 6px;">
              
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
          
          <div style="display: flex; border-bottom: 1px solid #2a2e39; padding: 0 16px; align-items: center;">
            <button class="tv-tab-btn active" id="tabBtnPos" onclick="StockIntradayWidget.switchBottomTab('positions')" style="padding: 10px 16px; font-size: 12px; font-weight: 700; background: transparent; border: none; border-bottom: 2px solid #2962ff; color: #fff; cursor: pointer;">
              💼 Active Positions (<span id="tvOpenCount">0</span> / 5 Slots)
            </button>
            <button class="tv-tab-btn" id="tabBtnTrades" onclick="StockIntradayWidget.switchBottomTab('trades')" style="padding: 10px 16px; font-size: 12px; font-weight: 700; background: transparent; border: none; color: #8896a8; cursor: pointer;">
              📜 Closed Trades History (<span id="tvClosedCount">0</span>)
            </button>
            <button class="tv-tab-btn" id="tabBtnHist" onclick="StockIntradayWidget.switchBottomTab('history')" style="padding: 10px 16px; font-size: 12px; font-weight: 700; background: transparent; border: none; color: #8896a8; cursor: pointer;">
              📅 Daily P&L Ledger (Stored on Disk)
            </button>
            <button class="tv-tab-btn" id="tabBtnSim" onclick="StockIntradayWidget.switchBottomTab('backtest')" style="padding: 10px 16px; font-size: 12px; font-weight: 700; background: transparent; border: none; color: #8896a8; cursor: pointer;">
              📊 Stage 1 Backtesting Replay
            </button>
            <div style="margin-left: auto; display: flex; align-items: center;">
              <button onclick="StockIntradayWidget.openEmailSummaryModal()" title="View and dispatch EOD Market Close Summary to jaiadithya2020@gmail.com" 
                style="padding: 4px 12px; font-size: 11px; font-weight: 700; background: rgba(56, 189, 248, 0.12); border: 1px solid rgba(56, 189, 248, 0.35); color: #38bdf8; border-radius: 4px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all 0.2s;">
                📧 EOD Market Summary Email
              </button>
            </div>
          </div>

          <!-- TAB 1: POSITIONS BLOTTER -->
          <div id="tabContentPositions" style="padding: 14px; max-height: 200px; overflow-y: auto;">
            <div id="tvSlotStatusBanner" style="display: flex; justify-content: space-between; align-items: center; background: rgba(41, 98, 255, 0.08); border: 1px solid rgba(41, 98, 255, 0.2); border-radius: 6px; padding: 6px 12px; margin-bottom: 10px; font-size: 11px; color: #d1d4dc;">
              <div>
                <span>⚡ Position Slots: <strong id="tvSlotUsedText" style="color: #00d084;">0 / 5 Used</strong></span>
                <span style="color: #8896a8; margin-left: 10px;">• Running positions are held autonomously until ATR Target (+2.4%) or Stop-Loss (-1.2%) triggers.</span>
              </div>
              <div style="font-size: 10.5px; color: #8896a8;">
                Click "Exit" to square off immediately and free up a slot
              </div>
            </div>
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

          <!-- TAB: CLOSED TRADES HISTORY -->
          <div id="tabContentTrades" style="display: none; padding: 14px; max-height: 250px; overflow-y: auto;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; background: rgba(255,255,255,0.02); padding: 6px 10px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.05);">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 11px; color: #8896a8; font-weight: 600;">Session:</span>
                <button id="btnViewCurrentTrades" onclick="StockIntradayWidget.toggleTradesView('current')" 
                  style="padding: 3px 10px; font-size: 11px; font-weight: 700; border-radius: 4px; border: 1px solid #2962ff; background: #2962ff; color: #fff; cursor: pointer;">
                  ⚡ Active Session (<span id="tvCurrentTradesBadge">0</span>)
                </button>
                <button id="btnViewArchivedTrades" onclick="StockIntradayWidget.toggleTradesView('archived')" 
                  style="padding: 3px 10px; font-size: 11px; font-weight: 700; border-radius: 4px; border: 1px solid #2a2e39; background: transparent; color: #8896a8; cursor: pointer;">
                  📁 Archived Session Trades
                </button>
              </div>
              <div style="font-size: 10.5px; color: #8896a8;">
                💡 Hover any row for strategy rationale & timing details
              </div>
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 11.5px; text-align: left;">
              <thead>
                <tr style="color: #8896a8; border-bottom: 1px solid #2a2e39;">
                  <th style="padding: 6px 8px;">Time</th>
                  <th style="padding: 6px 8px;">Symbol</th>
                  <th style="padding: 6px 8px;">Side</th>
                  <th style="padding: 6px 8px;">Qty</th>
                  <th style="padding: 6px 8px;">Entry Price</th>
                  <th style="padding: 6px 8px; color: #00d084;">Target Price</th>
                  <th style="padding: 6px 8px;">Exit Price</th>
                  <th style="padding: 6px 8px;">Realized P&L</th>
                  <th style="padding: 6px 8px;">Exit Reason</th>
                </tr>
              </thead>
              <tbody id="tvTradesTbody">
                <tr><td colspan="9" style="text-align: center; padding: 18px; color: #8896a8;">No closed trades yet today.</td></tr>
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
    if (!symbol) return;
    const clean = symbol.replace('-EQ', '').trim().toUpperCase();
    this.selectedSymbol = clean;

    // 1. Update Left Stock Intel, Center Pro Chart & Top Header
    this.updateActiveStockView();

    // 2. Right Side Watchlist: Ensure the selected stock is visible and highlighted
    const stockInUniverse = (this.activeStocks || []).find(s => s.symbol.replace('-EQ', '').toUpperCase() === clean);
    if (stockInUniverse) {
      // If a sector filter is active that hides this stock, reset to ALL so it appears
      if (this.selectedSector && this.selectedSector !== 'ALL' && stockInUniverse.sector !== this.selectedSector) {
        this.selectedSector = 'ALL';
        const chips = document.querySelectorAll('.sector-chip');
        chips.forEach(c => {
          if (c.textContent.trim().startsWith('All')) {
            c.classList.add('active');
            c.style.background = '#2962ff';
            c.style.color = '#fff';
            c.style.border = 'none';
          } else {
            c.classList.remove('active');
            c.style.background = 'transparent';
            c.style.color = '#8896a8';
            c.style.border = '1px solid #2a2e39';
          }
        });
      }
      // If a search query is active that filters out this stock, clear it
      if (this.searchQuery && !clean.includes(this.searchQuery.toUpperCase())) {
        this.searchQuery = '';
        const searchInput = document.getElementById('tvSearchInput');
        if (searchInput) searchInput.value = '';
      }
    }

    // Re-render watchlist so the selected stock receives active styling
    this.renderWatchlist(this.activeStocks || []);

    // Smoothly scroll the selected row into view in the watchlist container
    setTimeout(() => {
      const row = document.getElementById(`tvWatchlistRow_${clean}`);
      if (row) {
        row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }, 60);

    // 3. Highlight the corresponding row in Active Positions blotter
    this.highlightActivePositionRow(clean);

    // 4. Smoothly scroll view to main trading terminal if user is scrolled down
    const mainTerminal = document.querySelector('.tv-terminal-main-grid') || document.getElementById('tvChartContainer');
    if (mainTerminal) {
      const rect = mainTerminal.getBoundingClientRect();
      if (rect.top < 0 || rect.top > 250) {
        mainTerminal.scrollIntoView({ block: 'start', behavior: 'smooth' });
      }
    }
  },

  highlightActivePositionRow(clean) {
    const tbody = document.getElementById('tvPositionsTbody');
    if (!tbody) return;
    const rows = tbody.querySelectorAll('tr');
    rows.forEach(r => {
      if (r.id === `tvPosRow_${clean}`) {
        r.style.background = 'rgba(41, 98, 255, 0.18)';
        r.style.borderLeft = '3px solid #2962ff';
      } else {
        r.style.background = 'transparent';
        r.style.borderLeft = '3px solid transparent';
      }
    });
  },

  switchBottomTab(tab) {
    this.activeTab = tab;
    document.getElementById('tabContentPositions').style.display = tab === 'positions' ? 'block' : 'none';
    document.getElementById('tabContentTrades').style.display = tab === 'trades' ? 'block' : 'none';
    document.getElementById('tabContentHistory').style.display = tab === 'history' ? 'block' : 'none';
    document.getElementById('tabContentBacktest').style.display = tab === 'backtest' ? 'block' : 'none';

    document.getElementById('tabBtnPos').style.borderBottom = tab === 'positions' ? '2px solid #2962ff' : 'none';
    document.getElementById('tabBtnPos').style.color = tab === 'positions' ? '#fff' : '#8896a8';
    document.getElementById('tabBtnTrades').style.borderBottom = tab === 'trades' ? '2px solid #2962ff' : 'none';
    document.getElementById('tabBtnTrades').style.color = tab === 'trades' ? '#fff' : '#8896a8';
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

  async resetVirtualCapital() {
    if (!confirm('Refill virtual capital back to ₹1,00,000?\n\nYour prior 11 trades and loss record will be permanently archived on disk for strategy comparison.')) return;
    try {
      const res = await fetch('/api/paper/reset', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        localStorage.removeItem('prot_active_positions_backup');
        alert(`✅ Capital Refilled Successfully!\n\nVirtual Balance: ₹1,00,000.00\nPrior Session: ${data.archive?.totalTrades || 0} trades permanently archived.`);
        this.fetchData();
        this.fetchDailyLedger();
      }
    } catch (e) {
      alert('Reset failed: ' + e.message);
    }
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

      // Fetch positions & closed trades
      const posRes = await fetch('/api/paper/summary');
      if (posRes.ok) {
        const posData = await posRes.json();
        const p = posData.data || posData.portfolio || posData;
        const activePositions = p.activePositions || [];

        // Dual Persistence: Mirror active positions to browser storage for cloud persistence
        if (activePositions.length > 0) {
          try {
            localStorage.setItem('prot_active_positions_backup', JSON.stringify({
              positions: activePositions,
              balance: p.currentBalance,
              capital: p.initialCapital,
              tradeHistory: p.tradeHistory || [],
              dateStr: new Date().toISOString().split('T')[0],
              timestamp: Date.now()
            }));
          } catch (err) {}
        } else if (!this._restoredThisSession) {
          // If server reports 0 active positions (e.g. after cloud rebuild/restart), auto-restore from backup
          try {
            const rawBackup = localStorage.getItem('prot_active_positions_backup');
            if (rawBackup) {
              const backup = JSON.parse(rawBackup);
              const todayStr = new Date().toISOString().split('T')[0];
              const isToday = backup.dateStr === todayStr;
              const isRecent = (Date.now() - (backup.timestamp || 0)) < 12 * 3600 * 1000;
              if (isToday && isRecent && Array.isArray(backup.positions) && backup.positions.length > 0) {
                this._restoredThisSession = true;
                console.log('♻️ [StockTerminal] Auto-restoring active positions across cloud deployment...', backup.positions.length);
                fetch('/api/paper/restore-state', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    positions: backup.positions,
                    currentBalance: backup.balance,
                    initialCapital: backup.capital,
                    tradeHistory: backup.tradeHistory
                  })
                }).then(() => this.fetchData());
                return;
              }
            }
          } catch (err) {}
        }

        this.renderPositions(activePositions);
        this.renderClosedTrades(p.tradeHistory || []);
        this.renderScorecard(p);
      }
    } catch (e) {}
  },

  updateActiveStockView() {
    if (!this.activeStocks || this.activeStocks.length === 0) return;
    const cleanTarget = (this.selectedSymbol || '').replace('-EQ', '').trim().toUpperCase();
    const stock = this.activeStocks.find(s => s.symbol.replace('-EQ', '').trim().toUpperCase() === cleanTarget) || this.activeStocks[0];
    if (!stock) return;

    this.selectedSymbol = stock.symbol;

    // Top Header Bar
    const titleEl = document.getElementById('tvSymbolTitle');
    if (titleEl) titleEl.textContent = stock.symbol;
    const ltpEl = document.getElementById('tvLtpDisplay');
    if (ltpEl) ltpEl.textContent = `₹${stock.ltp.toFixed(2)}`;
    
    const isUp = (stock.pChange || 0) >= 0;
    const chgEl = document.getElementById('tvChgDisplay');
    if (chgEl) {
      chgEl.textContent = `${isUp ? '+' : ''}${stock.pChange || 0}%`;
      chgEl.style.color = isUp ? '#00d084' : '#ff4757';
    }
    if (ltpEl) ltpEl.style.color = isUp ? '#00d084' : '#ff4757';

    // Signal pill in Top Header Bar
    const pill = document.getElementById('tvSignalPill');
    if (pill) {
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
    }

    // Column 1: Left Stock Intel Card
    const intelSym = document.getElementById('tvIntelSymbol');
    if (intelSym) intelSym.textContent = stock.symbol;
    const intelSec = document.getElementById('tvIntelSector');
    if (intelSec) intelSec.textContent = stock.sector || 'Equities';
    const intelName = document.getElementById('tvIntelName');
    if (intelName) intelName.textContent = stock.name || `${stock.symbol} Ltd.`;
    const intelLtp = document.getElementById('tvIntelLtp');
    if (intelLtp) {
      intelLtp.textContent = `₹${stock.ltp.toFixed(2)}`;
      intelLtp.style.color = isUp ? '#00d084' : '#ff4757';
    }
    const intelChg = document.getElementById('tvIntelChg');
    if (intelChg) {
      intelChg.textContent = `${isUp ? '+' : ''}${stock.pChange || 0}%`;
      intelChg.style.color = isUp ? '#00d084' : '#ff4757';
    }

    // Day Range Meter
    const high = stock.high || (stock.ltp * 1.008);
    const low = stock.low || (stock.ltp * 0.994);
    const range = Math.max(0.01, high - low);
    const pctFromLow = Math.max(0, Math.min(100, ((stock.ltp - low) / range) * 100));

    const lowEl = document.getElementById('tvIntelRangeLow');
    if (lowEl) lowEl.textContent = `₹${low.toFixed(2)}`;
    const highEl = document.getElementById('tvIntelRangeHigh');
    if (highEl) highEl.textContent = `₹${high.toFixed(2)}`;
    const fillEl = document.getElementById('tvIntelRangeFill');
    if (fillEl) fillEl.style.width = `${pctFromLow}%`;
    const markerEl = document.getElementById('tvIntelRangeMarker');
    if (markerEl) markerEl.style.left = `calc(${pctFromLow}% - 2px)`;

    // Confluence technical values
    const vwapVal = stock.vwap || stock.ltp;
    const vwapEl = document.getElementById('tvIntelVwap');
    if (vwapEl) vwapEl.textContent = `₹${vwapVal.toFixed(2)}`;
    const vwapBiasEl = document.getElementById('tvIntelVwapBias');
    if (vwapBiasEl) {
      const vDiff = (((stock.ltp - vwapVal) / vwapVal) * 100);
      const isAbove = vDiff >= 0;
      vwapBiasEl.textContent = `${isAbove ? '▲ +' : '▼ '}${vDiff.toFixed(2)}% ${isAbove ? 'Above' : 'Below'}`;
      vwapBiasEl.style.color = isAbove ? '#00d084' : '#ff4757';
    }

    const emaVal = stock.ema20 || stock.ltp;
    const emaEl = document.getElementById('tvIntelEma20');
    if (emaEl) emaEl.textContent = `₹${emaVal.toFixed(2)}`;
    const emaTrendEl = document.getElementById('tvIntelEmaTrend');
    if (emaTrendEl) {
      const aboveEma = stock.ltp >= emaVal;
      emaTrendEl.textContent = aboveEma ? 'Bullish Trend' : 'Bearish Trend';
      emaTrendEl.style.color = aboveEma ? '#00d084' : '#ff4757';
    }

    const orbHEl = document.getElementById('tvIntelOrbHigh');
    if (orbHEl) orbHEl.textContent = `₹${(stock.orbHigh || (stock.ltp * 1.005)).toFixed(2)}`;
    const orbLEl = document.getElementById('tvIntelOrbLow');
    if (orbLEl) orbLEl.textContent = `₹${(stock.orbLow || (stock.ltp * 0.995)).toFixed(2)}`;

    const atr = stock.atr || parseFloat((stock.ltp * 0.012).toFixed(2));
    const atrEl = document.getElementById('tvIntelAtr');
    if (atrEl) atrEl.textContent = `₹${atr.toFixed(2)}`;

    const volEl = document.getElementById('tvIntelVolume');
    if (volEl) volEl.textContent = `${((stock.volume || 250000) / 1000).toFixed(0)}K`;

    // Setup Target / Stop Loss
    const targetVal = stock.target || parseFloat((stock.ltp + (2.0 * atr)).toFixed(2));
    const stopLossVal = stock.stopLoss || parseFloat((stock.ltp - (1.2 * atr)).toFixed(2));
    const targetEl = document.getElementById('tvIntelTarget');
    if (targetEl) targetEl.textContent = `₹${targetVal.toFixed(2)}`;
    const slEl = document.getElementById('tvIntelStopLoss');
    if (slEl) slEl.textContent = `₹${stopLossVal.toFixed(2)}`;

    const confEl = document.getElementById('tvIntelSetupConfidence');
    if (confEl) confEl.textContent = `${stock.confidence || '85%'} Confidence`;

    // Order shares & margin
    const sharesEl = document.getElementById('tvOrderShares');
    if (sharesEl) sharesEl.textContent = `${stock.riskAllocation?.allocatedShares || 10} Shares`;
    const marginEl = document.getElementById('tvOrderMargin');
    if (marginEl) marginEl.textContent = `₹${stock.riskAllocation?.marginRequired?.toFixed(0) || '0'}`;

    // Rationale
    const ratEl = document.getElementById('tvSignalRationale');
    if (ratEl) ratEl.textContent = stock.rationale || 'Consolidating inside 15m range. Awaiting breakout confluence.';

    this.renderChartSVG(stock);
  },

  renderWatchlist(stocks) {
    const container = document.getElementById('tvWatchlistContainer');
    if (!container) return;

    let filtered = stocks;
    if (this.searchQuery) {
      filtered = filtered.filter(s => s.symbol.includes(this.searchQuery) || (s.name && s.name.toUpperCase().includes(this.searchQuery)));
    }
    if (this.selectedSector && this.selectedSector !== 'ALL') {
      filtered = filtered.filter(s => s.sector === this.selectedSector);
    }

    const countEl = document.getElementById('tvWatchlistCount');
    if (countEl) countEl.textContent = `${filtered.length} of ${stocks.length} Stocks`;

    container.innerHTML = filtered.map(s => {
      const sClean = s.symbol.replace('-EQ', '').trim().toUpperCase();
      const currentSelected = (this.selectedSymbol || '').replace('-EQ', '').trim().toUpperCase();
      const isSelected = sClean === currentSelected;
      const isUp = (s.pChange || 0) >= 0;
      const isBuy = s.signal === 'BUY_LONG';
      const isSell = s.signal === 'SELL_SHORT';
      
      const vwapDiff = s.vwap ? (((s.ltp - s.vwap) / s.vwap) * 100).toFixed(1) : '0.0';
      const isAboveVwap = s.vwap ? s.ltp >= s.vwap : true;
      const atrVal = s.atr ? s.atr.toFixed(1) : (s.ltp * 0.012).toFixed(1);

      return `
        <div id="tvWatchlistRow_${sClean}" class="tv-watchlist-row" onclick="StockIntradayWidget.selectStock('${s.symbol}')" style="padding: 8px 12px; border-bottom: 1px solid rgba(255,255,255,0.03); cursor: pointer; background: ${isSelected ? '#1e2438' : 'transparent'}; border-left: ${isSelected ? '3px solid #2962ff' : '3px solid transparent'}; transition: background 0.15s;">
          <!-- Row 1: Symbol, Sector, LTP, % Chg -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="font-size: 12.5px; font-weight: 700; color: ${isSelected ? '#2962ff' : '#e1e4ea'};">
                ${isSelected ? '🔹 ' : ''}${s.symbol}
              </span>
              <span style="font-size: 9px; padding: 1px 4px; border-radius: 2px; background: rgba(255,255,255,0.06); color: #8896a8;">${s.sector || 'Eq'}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="font-size: 12.5px; font-weight: 700; font-family: monospace; color: #fff;">₹${s.ltp.toFixed(2)}</span>
              <span style="font-size: 10px; font-weight: 700; font-family: monospace; padding: 1px 5px; border-radius: 3px; background: ${isUp ? 'rgba(0,208,132,0.15)' : 'rgba(255,71,87,0.15)'}; color: ${isUp ? '#00d084' : '#ff4757'};">
                ${isUp ? '+' : ''}${s.pChange || 0}%
              </span>
            </div>
          </div>
          
          <!-- Row 2: Signal badge, VWAP position, ATR -->
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 10px;">
            <div>
              ${isBuy ? '<span style="color: #00d084; font-weight: 700;">🟢 Breakout</span>' : 
                (isSell ? '<span style="color: #ff4757; font-weight: 700;">🔴 Breakdown</span>' : 
                '<span style="color: #8896a8; font-weight: 500;">⚪ Range</span>')}
            </div>
            <div style="display: flex; gap: 8px; color: #8896a8; font-size: 9.5px;">
              <span style="color: ${isAboveVwap ? '#00d084' : '#ff4757'};">
                ${isAboveVwap ? '▲' : '▼'} ${isAboveVwap ? '+' : ''}${vwapDiff}% VWAP
              </span>
              <span>ATR: ₹${atrVal}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');
  },

  renderChartSVG(stock) {
    const container = document.getElementById('tvChartContainer');
    if (!container) return;

    const width = container.clientWidth || 560;
    const height = 350;
    const ltp = stock.ltp;
    const vwap = stock.vwap || ltp;
    const orbHigh = stock.orbHigh || (ltp * 1.005);
    const orbLow = stock.orbLow || (ltp * 0.995);
    const ema20 = stock.ema20 || ltp;

    // Price scaling: dedicated upper pane (y: 25 to 255)
    const allPrices = [ltp, vwap, orbHigh, orbLow, ema20];
    const maxP = Math.max(...allPrices) * 1.003;
    const minP = Math.min(...allPrices) * 0.997;
    const pRange = maxP - minP || 1;

    const priceTop = 25;
    const priceBottom = 255;
    const priceHeight = priceBottom - priceTop; // 230px

    const getY = (price) => {
      const clamped = Math.max(minP, Math.min(maxP, price));
      return priceBottom - (((clamped - minP) / pRange) * priceHeight);
    };

    // Volume Sub-Pane definition (TradingView style at bottom: y = 270 to 345)
    const volSepY = 270;
    const volBaseY = 345;
    const volMaxH = 65;

    // Generate 20 proportional intraday candles ending cleanly at LTP
    const numCandles = 20;
    const candleWidth = (width - 90) / numCandles;
    const bodyW = Math.max(4, Math.min(18, candleWidth * 0.65));

    // First pass: compute all candle data so peak volume is known for scaling
    const rawCandles = [];
    for (let i = 0; i < numCandles; i++) {
      const x = 30 + (i * candleWidth);
      const isLast = i === numCandles - 1;
      
      const progress = i / (numCandles - 1);
      const baseMid = vwap + ((ltp - vwap) * progress * 0.85);
      const osc = Math.sin(i * 0.85) * (pRange * 0.06);
      
      let open = baseMid + osc;
      let close = isLast ? ltp : open + (Math.cos(i * 1.2) * (pRange * 0.05));
      if (isLast) {
        open = close + (stock.signal === 'SELL_SHORT' ? (pRange * 0.06) : -(pRange * 0.06));
      }
      let high = Math.max(open, close) + (pRange * 0.015);
      let low = Math.min(open, close) - (pRange * 0.015);

      const isGreen = close >= open;
      const wickX = x + candleWidth / 2;
      const bodyX = wickX - (bodyW / 2);

      // Timestamps formatted as 15m intervals starting from 09:15 IST
      const startMin = 9 * 60 + 15 + (i * 15);
      const hStr = String(Math.floor(startMin / 60)).padStart(2, '0');
      const mStr = String(startMin % 60).padStart(2, '0');
      const timeStr = `${hStr}:${mStr}`;
      const candleVol = Math.floor(((stock.volume || 250000) / numCandles) * (0.65 + Math.abs(Math.sin(i * 1.4)) * 0.7 + (isLast ? 0.35 : 0)));

      rawCandles.push({
        index: i,
        x,
        wickX,
        bodyX,
        timeStr,
        open: parseFloat(open.toFixed(2)),
        high: parseFloat(high.toFixed(2)),
        low: parseFloat(low.toFixed(2)),
        close: parseFloat(close.toFixed(2)),
        change: parseFloat((close - open).toFixed(2)),
        changePct: parseFloat((((close - open) / open) * 100).toFixed(2)),
        volume: candleVol,
        isGreen
      });
    }

    const maxVol = Math.max(...rawCandles.map(c => c.volume), 1);
    this.currentCandles = [];
    let candleSvg = '';
    let volSvg = '';
    let hoverOverlaySvg = '';

    for (const c of rawCandles) {
      const color = c.isGreen ? '#00d084' : '#ff4757';
      const volBarColor = c.isGreen ? 'rgba(0, 208, 132, 0.45)' : 'rgba(255, 71, 87, 0.45)';
      const yTop = getY(Math.max(c.open, c.close));
      const yBot = getY(Math.min(c.open, c.close));
      const barH = Math.max(3, yBot - yTop);

      // Proportional volume bar height
      const volH = Math.max(3, Math.min(volMaxH, (c.volume / maxVol) * volMaxH));
      const volY = volBaseY - volH;

      this.currentCandles.push({
        ...c,
        yClose: getY(c.close),
        yOpen: getY(c.open),
        volY,
        volH,
        volBarColor
      });

      // Volume Bar SVG (TradingView histogram)
      volSvg += `
        <rect id="tvVolBar_${c.index}" x="${c.bodyX}" y="${volY}" width="${bodyW}" height="${volH}" fill="${volBarColor}" rx="1" style="transition: fill 0.15s ease;" />
      `;

      // Candlestick SVG Group
      candleSvg += `
        <g id="tvCandleG_${c.index}">
          <line x1="${c.wickX}" y1="${getY(c.high)}" x2="${c.wickX}" y2="${getY(c.low)}" stroke="${color}" stroke-width="1.2" />
          <rect x="${c.bodyX}" y="${yTop}" width="${bodyW}" height="${barH}" fill="${color}" rx="1" />
        </g>
      `;

      // Invisible wide hit area for effortless cursor hovering across the entire vertical band
      hoverOverlaySvg += `
        <rect x="${c.x}" y="0" width="${candleWidth}" height="${height}" fill="transparent" cursor="crosshair"
          onmouseenter="StockIntradayWidget.onHoverCandle(${c.index})"
          onmousemove="StockIntradayWidget.onMoveCandle(event, ${c.index})" />
      `;
    }

    // Indicator Lines
    const yOrbHigh = getY(orbHigh);
    const yOrbLow = getY(orbLow);
    const yVwap = getY(vwap);
    const yEma = getY(ema20);

    container.innerHTML = `
      <svg width="100%" height="${height}" style="overflow: hidden; display: block;">
        <!-- Price Grid horizontal lines -->
        <line x1="30" y1="80" x2="${width-20}" y2="80" stroke="#181e2b" stroke-width="1" stroke-dasharray="3,3" />
        <line x1="30" y1="140" x2="${width-20}" y2="140" stroke="#181e2b" stroke-width="1" stroke-dasharray="3,3" />
        <line x1="30" y1="200" x2="${width-20}" y2="200" stroke="#181e2b" stroke-width="1" stroke-dasharray="3,3" />

        <!-- Volume Sub-Pane Separator & Watermark (TradingView style) -->
        <line x1="30" y1="${volSepY}" x2="${width-20}" y2="${volSepY}" stroke="#1f2533" stroke-width="1" stroke-dasharray="2,2" />
        <text x="35" y="${volSepY + 12}" fill="#4f596d" font-size="9" font-weight="700" letter-spacing="0.8">VOLUME</text>
        <text x="${width-85}" y="${volSepY + 12}" fill="#4f596d" font-size="8.5" font-family="monospace">PEAK ${(maxVol / 1000).toFixed(0)}K</text>
        <line x1="30" y1="${volBaseY}" x2="${width-20}" y2="${volBaseY}" stroke="#181e2b" stroke-width="1" />

        <!-- TradingView Volume Histogram Bars -->
        ${volSvg}

        <!-- ORB High Level (Green Dashed) -->
        <line x1="30" y1="${yOrbHigh}" x2="${width-20}" y2="${yOrbHigh}" stroke="#00d084" stroke-width="1.5" stroke-dasharray="5,5" />
        <text x="${width-85}" y="${yOrbHigh - 4}" fill="#00d084" font-size="9.5" font-weight="700">ORB HIGH ₹${orbHigh.toFixed(0)}</text>

        <!-- ORB Low Level (Red Dashed) -->
        <line x1="30" y1="${yOrbLow}" x2="${width-20}" y2="${yOrbLow}" stroke="#ff4757" stroke-width="1.5" stroke-dasharray="5,5" />
        <text x="${width-85}" y="${yOrbLow + 12}" fill="#ff4757" font-size="9.5" font-weight="700">ORB LOW ₹${orbLow.toFixed(0)}</text>

        <!-- VWAP Line (Cyan/Blue Solid) -->
        <line x1="30" y1="${yVwap}" x2="${width-20}" y2="${yVwap}" stroke="#2962ff" stroke-width="2" />
        <text x="35" y="${yVwap - 4}" fill="#2962ff" font-size="9.5" font-weight="700">VWAP ₹${vwap.toFixed(1)}</text>

        <!-- 20 EMA Line (Yellow) -->
        <line x1="30" y1="${yEma}" x2="${width-20}" y2="${yEma}" stroke="#eab308" stroke-width="1.5" stroke-dasharray="2,2" />

        <!-- Candlesticks -->
        ${candleSvg}

        <!-- Interactive Crosshair Lines -->
        <line id="tvCrosshairX" x1="0" y1="0" x2="0" y2="${height}" stroke="#4f596d" stroke-width="1" stroke-dasharray="3,3" style="display: none; pointer-events: none;" />
        <line id="tvCrosshairY" x1="30" y1="0" x2="${width-20}" y2="0" stroke="#4f596d" stroke-width="1" stroke-dasharray="3,3" style="display: none; pointer-events: none;" />

        <!-- Current LTP Marker -->
        <circle cx="${width - 70}" cy="${getY(ltp)}" r="4" fill="#fff" />
        <rect x="${width - 64}" y="${getY(ltp) - 10}" width="60" height="18" fill="#2962ff" rx="3" />
        <text x="${width - 60}" y="${getY(ltp) + 3}" fill="#fff" font-size="10" font-weight="700">₹${ltp.toFixed(1)}</text>

        <!-- Interactive Transparent Hit Overlays (Always on top) -->
        ${hoverOverlaySvg}
      </svg>
      <div id="tvCandleTooltip" style="display: none; position: absolute; pointer-events: none; z-index: 50; background: rgba(18, 22, 33, 0.95); backdrop-filter: blur(8px); border: 1px solid #2a2e39; border-radius: 6px; padding: 8px 12px; font-size: 11px; box-shadow: 0 8px 24px rgba(0,0,0,0.7); min-width: 175px;"></div>
    `;

    // Populate OHLC bar with latest candle data by default
    if (this.currentCandles.length > 0) {
      this.updateOhlcBar(this.currentCandles[this.currentCandles.length - 1]);
    }
  },

  onHoverCandle(idx) {
    const candle = this.currentCandles[idx];
    if (!candle) return;
    this.updateOhlcBar(candle);

    // Reset previously highlighted volume bar
    if (this.lastHoveredIdx !== undefined && this.lastHoveredIdx !== null && this.lastHoveredIdx !== idx) {
      const prevVol = document.getElementById(`tvVolBar_${this.lastHoveredIdx}`);
      const prevCandle = this.currentCandles[this.lastHoveredIdx];
      if (prevVol && prevCandle) {
        prevVol.setAttribute('fill', prevCandle.volBarColor);
      }
    }

    // Highlight currently hovered volume bar to solid color
    const currVol = document.getElementById(`tvVolBar_${idx}`);
    if (currVol) {
      currVol.setAttribute('fill', candle.isGreen ? '#00d084' : '#ff4757');
    }
    this.lastHoveredIdx = idx;
    
    const crossX = document.getElementById('tvCrosshairX');
    const crossY = document.getElementById('tvCrosshairY');
    if (crossX) {
      crossX.setAttribute('x1', candle.wickX);
      crossX.setAttribute('x2', candle.wickX);
      crossX.style.display = 'block';
    }
    if (crossY) {
      crossY.setAttribute('y1', candle.yClose);
      crossY.setAttribute('y2', candle.yClose);
      crossY.style.display = 'block';
    }
  },

  onMoveCandle(event, idx) {
    const candle = this.currentCandles[idx];
    if (!candle) return;
    const container = document.getElementById('tvChartContainer');
    const tooltip = document.getElementById('tvCandleTooltip');
    if (!container || !tooltip) return;

    const rect = container.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    // Position tooltip safely within container
    let leftPos = mouseX + 16;
    if (leftPos + 185 > rect.width) {
      leftPos = Math.max(10, mouseX - 195);
    }
    let topPos = Math.max(10, Math.min(rect.height - 125, mouseY - 55));

    const isUp = candle.isGreen;
    const pnlColor = isUp ? '#00d084' : '#ff4757';
    const tag = isUp ? '🟢 Bullish' : '🔴 Bearish';

    tooltip.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 4px;">
        <span style="font-weight: 700; color: #fff;">🕒 ${candle.timeStr} IST</span>
        <span style="font-size: 10px; font-weight: 700; color: ${pnlColor};">${tag}</span>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px 8px; font-family: monospace; font-size: 11px;">
        <div><span style="color: #8896a8;">O:</span> <strong style="color: #fff;">₹${candle.open.toFixed(2)}</strong></div>
        <div><span style="color: #8896a8;">H:</span> <strong style="color: #00d084;">₹${candle.high.toFixed(2)}</strong></div>
        <div><span style="color: #8896a8;">L:</span> <strong style="color: #ff4757;">₹${candle.low.toFixed(2)}</strong></div>
        <div><span style="color: #8896a8;">C:</span> <strong style="color: #fff;">₹${candle.close.toFixed(2)}</strong></div>
      </div>
      <div style="margin-top: 6px; padding-top: 5px; border-top: 1px dashed rgba(255,255,255,0.08); display: flex; justify-content: space-between; font-size: 10.5px; font-family: monospace;">
        <span style="color: ${pnlColor}; font-weight: 700;">${candle.change >= 0 ? '+' : ''}₹${candle.change.toFixed(2)} (${candle.changePct >= 0 ? '+' : ''}${candle.changePct}%)</span>
        <span style="color: #8896a8;">Vol: <strong style="color: #2962ff;">${(candle.volume / 1000).toFixed(1)}K</strong></span>
      </div>
    `;

    tooltip.style.left = `${leftPos}px`;
    tooltip.style.top = `${topPos}px`;
    tooltip.style.display = 'block';

    const crossY = document.getElementById('tvCrosshairY');
    if (crossY) {
      crossY.setAttribute('y1', mouseY);
      crossY.setAttribute('y2', mouseY);
    }
  },

  onLeaveCandle() {
    const crossX = document.getElementById('tvCrosshairX');
    const crossY = document.getElementById('tvCrosshairY');
    const tooltip = document.getElementById('tvCandleTooltip');
    if (crossX) crossX.style.display = 'none';
    if (crossY) crossY.style.display = 'none';
    if (tooltip) tooltip.style.display = 'none';

    // Reset volume highlight on cursor exit
    if (this.lastHoveredIdx !== undefined && this.lastHoveredIdx !== null) {
      const prevVol = document.getElementById(`tvVolBar_${this.lastHoveredIdx}`);
      const prevCandle = this.currentCandles[this.lastHoveredIdx];
      if (prevVol && prevCandle) {
        prevVol.setAttribute('fill', prevCandle.volBarColor);
      }
      this.lastHoveredIdx = null;
    }

    // Reset OHLC bar to latest candle
    if (this.currentCandles && this.currentCandles.length > 0) {
      this.updateOhlcBar(this.currentCandles[this.currentCandles.length - 1]);
    }
  },

  updateOhlcBar(candle) {
    if (!candle) return;
    const timeEl = document.getElementById('tvOhlcTime');
    const openEl = document.getElementById('tvOhlcOpen');
    const highEl = document.getElementById('tvOhlcHigh');
    const lowEl = document.getElementById('tvOhlcLow');
    const closeEl = document.getElementById('tvOhlcClose');
    const chgEl = document.getElementById('tvOhlcChg');
    const volEl = document.getElementById('tvOhlcVol');

    if (timeEl) timeEl.textContent = `${candle.timeStr} IST`;
    if (openEl) openEl.textContent = `₹${candle.open.toFixed(2)}`;
    if (highEl) highEl.textContent = `₹${candle.high.toFixed(2)}`;
    if (lowEl) lowEl.textContent = `₹${candle.low.toFixed(2)}`;
    if (closeEl) closeEl.textContent = `₹${candle.close.toFixed(2)}`;
    if (chgEl) {
      const isUp = candle.changePct >= 0;
      chgEl.textContent = `${isUp ? '+' : ''}${candle.changePct}% (${isUp ? '+' : ''}₹${candle.change.toFixed(2)})`;
      chgEl.style.color = isUp ? '#00d084' : '#ff4757';
    }
    if (volEl) volEl.textContent = `${(candle.volume / 1000).toFixed(1)}K`;
  },

  renderPositions(positions) {
    this.lastPositions = positions || [];
    const tbody = document.getElementById('tvPositionsTbody');
    const countEl = document.getElementById('tvOpenCount');
    if (countEl) countEl.textContent = positions.length;

    const slotText = document.getElementById('tvSlotUsedText');
    if (slotText) {
      slotText.textContent = `${positions.length} / 5 Used`;
      slotText.style.color = positions.length >= 5 ? '#ff4757' : (positions.length > 0 ? '#eab308' : '#00d084');
    }

    if (!tbody) return;
    if (positions.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 18px; color: #8896a8;">No open positions. 100% virtual capital safe in cash.</td></tr>';
      return;
    }

    tbody.innerHTML = positions.map(pos => {
      const cleanSym = (pos.symbol || '').replace('-EQ', '').trim().toUpperCase();
      const currentSelected = (this.selectedSymbol || '').replace('-EQ', '').trim().toUpperCase();
      const isSelected = cleanSym === currentSelected;
      const isProfitable = (pos.unrealizedPnL || 0) >= 0;
      const pnlColor = isProfitable ? '#00d084' : '#ff4757';
      const isSwing = pos.holdingType === 'SWING_POSITIONAL';

      const horizonBadge = isSwing
        ? `<span style="display: block; font-size: 9px; font-weight: 700; color: #38bdf8; background: rgba(56, 189, 248, 0.15); padding: 1px 4px; border-radius: 3px; border: 1px solid rgba(56, 189, 248, 0.3); margin-top: 2px;">📅 SWING (Day ${pos.holdingDaysCount || 1}/30)</span>`
        : `<span style="display: block; font-size: 9px; font-weight: 600; color: #eab308; background: rgba(234, 179, 8, 0.1); padding: 1px 4px; border-radius: 3px; border: 1px solid rgba(234, 179, 8, 0.2); margin-top: 2px;">⚡ INTRADAY (3:15 PM)</span>`;

      const trailingBadge = pos.trailingStatus 
        ? `<span style="display: block; font-size: 9.5px; font-weight: 700; color: #00d084;">🛡️ ${pos.trailingStatus.replace(/_/g, ' ')}</span>`
        : '';

      const rowBg = isSelected ? 'rgba(41, 98, 255, 0.18)' : 'transparent';
      const rowBorder = isSelected ? '3px solid #2962ff' : '3px solid transparent';

      return `
        <tr id="tvPosRow_${cleanSym}" onclick="StockIntradayWidget.selectStock('${cleanSym}')" 
          onmouseenter="StockIntradayWidget.showPositionTooltip(event, '${pos.id}', true)"
          onmousemove="StockIntradayWidget.movePositionTooltip(event)"
          onmouseleave="StockIntradayWidget.hidePositionTooltip()"
          style="border-bottom: 1px solid rgba(255,255,255,0.03); cursor: pointer; background: ${rowBg}; border-left: ${rowBorder}; transition: background 0.15s;">
          <td style="padding: 8px; font-weight: 700; color: #fff;">
            <span style="display: inline-flex; align-items: center; gap: 6px;">
              <span style="font-size: 11px;">${isSelected ? '🔹' : '📈'}</span>
              <span style="color: ${isSelected ? '#2962ff' : '#fff'}; font-weight: 800; text-decoration: underline; text-underline-offset: 2px;">${pos.symbol}</span>
              <span style="font-size: 10px; opacity: 0.7; color: #38bdf8;" title="Hover for entry rationale & timing">ℹ️</span>
            </span>
            ${horizonBadge}
          </td>
          <td style="padding: 8px; font-weight: 700; color: ${pos.action === 'BUY' ? '#00d084' : '#ff4757'};">${pos.action}</td>
          <td style="padding: 8px; font-family: monospace;">${pos.quantity}</td>
          <td style="padding: 8px; font-family: monospace;">₹${pos.entryPrice.toFixed(2)}</td>
          <td style="padding: 8px; font-family: monospace; color: #ff4757;">
            ₹${pos.stopLoss?.toFixed(2) || '-'}
            ${trailingBadge}
          </td>
          <td style="padding: 8px; font-family: monospace; color: #00d084;">₹${pos.target?.toFixed(2) || '-'}</td>
          <td style="padding: 8px; font-family: monospace;">₹${pos.marginBlocked?.toFixed(2) || '-'}</td>
          <td style="padding: 8px; font-weight: 700; color: ${pnlColor}; font-family: monospace;">
            ${isProfitable ? '+' : ''}₹${(pos.unrealizedPnL || 0).toFixed(2)} (${(pos.unrealizedPnLPct || 0) >= 0 ? '+' : ''}${(pos.unrealizedPnLPct || 0).toFixed(2)}%)
          </td>
          <td style="padding: 8px;">
            <div style="display: flex; gap: 4px; align-items: center;">
              <button onclick="event.stopPropagation(); StockIntradayWidget.closePosition('${pos.id}', ${pos.currentPrice || pos.entryPrice})" 
                style="padding: 3px 6px; background: transparent; border: 1px solid #ff4757; color: #ff4757; border-radius: 4px; font-size: 10px; cursor: pointer; transition: background 0.15s;"
                onmouseenter="this.style.background='rgba(255,71,87,0.2)'" onmouseleave="this.style.background='transparent'">Exit</button>
              ${!isSwing ? `
                <button onclick="event.stopPropagation(); StockIntradayWidget.promoteToSwing('${pos.id}')" 
                  style="padding: 3px 6px; background: rgba(41, 98, 255, 0.18); border: 1px solid #2962ff; color: #38bdf8; border-radius: 4px; font-size: 10px; font-weight: 700; cursor: pointer; transition: background 0.15s;"
                  title="Promote to Multi-Week Swing Runner: Locks Stop-Loss at Breakeven and holds overnight for +30% target">🚀 Swing</button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  async setStrategyHorizon(horizon) {
    this.currentStrategyHorizon = horizon;
    const btnIntra = document.getElementById('horizonBtnIntraday');
    const btnSwing = document.getElementById('horizonBtnSwing');
    const btnHyb = document.getElementById('horizonBtnHybrid');

    if (btnIntra) { btnIntra.style.background = horizon === 'INTRADAY' ? '#2962ff' : 'transparent'; btnIntra.style.color = horizon === 'INTRADAY' ? '#fff' : '#8896a8'; }
    if (btnSwing) { btnSwing.style.background = horizon === 'SWING_POSITIONAL' ? '#2962ff' : 'transparent'; btnSwing.style.color = horizon === 'SWING_POSITIONAL' ? '#fff' : '#8896a8'; }
    if (btnHyb) { btnHyb.style.background = horizon === 'HYBRID_RUNNER' ? '#2962ff' : 'transparent'; btnHyb.style.color = horizon === 'HYBRID_RUNNER' ? '#fff' : '#8896a8'; }

    try {
      await fetch('/api/quant/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategyHorizon: horizon })
      });
      if (typeof ToastNotification !== 'undefined') {
        const name = horizon === 'HYBRID_RUNNER' ? 'Hybrid Runner (Intraday + Multi-Week Swing)' : (horizon === 'SWING_POSITIONAL' ? 'Multi-Week Positional Swing (30% Goal)' : 'Intraday MIS (3:15 PM EOD)');
        ToastNotification.show(`🎯 Trading Horizon updated to: ${name}`, 'success');
      }
    } catch (e) {}
  },

  async promoteToSwing(orderId) {
    try {
      const res = await fetch('/api/quant/promote-to-swing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId })
      });
      const data = await res.json();
      if (data.success) {
        if (typeof ToastNotification !== 'undefined') {
          ToastNotification.show(`🚀 ${data.message}`, 'success');
        }
        this.fetchData();
      } else {
        alert(`Could not promote: ${data.message}`);
      }
    } catch (e) {
      alert(`Error promoting position: ${e.message}`);
    }
  },

  showPositionTooltip(event, id, isOpen) {
    const item = isOpen 
      ? (this.lastPositions || []).find(p => p.id === id)
      : (this.lastClosedTrades || []).find(t => t.id === id);
    if (!item) return;

    let tooltip = document.getElementById('tvPositionHoverCard');
    if (!tooltip) {
      tooltip = document.createElement('div');
      tooltip.id = 'tvPositionHoverCard';
      tooltip.style.cssText = `
        position: fixed;
        z-index: 9999999;
        display: none;
        pointer-events: none;
        width: 390px;
        background: rgba(19, 23, 34, 0.97);
        border: 1px solid #2962ff;
        border-radius: 8px;
        box-shadow: 0 16px 40px rgba(0,0,0,0.85), 0 0 20px rgba(41, 98, 255, 0.25);
        padding: 14px 16px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        color: #d1d4dc;
        font-size: 11.5px;
        line-height: 1.45;
        backdrop-filter: blur(10px);
        transition: opacity 0.1s ease;
      `;
      document.body.appendChild(tooltip);
    }

    const isBuy = (item.action || item.side) === 'BUY';
    const cleanSym = (item.symbol || '').replace('-EQ', '').trim().toUpperCase();
    const entryTime = item.entryTimestamp || item.timestamp;
    const exitTime = item.exitTimestamp;
    
    // Format entry time in Indian Standard Time (IST)
    let entryTimeFormatted = '-';
    let durationText = '';
    if (entryTime) {
      const entryDate = new Date(entryTime);
      entryTimeFormatted = entryDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
      
      const endTime = exitTime ? new Date(exitTime).getTime() : Date.now();
      const diffSec = Math.max(0, Math.floor((endTime - entryDate.getTime()) / 1000));
      const mins = Math.floor(diffSec / 60);
      const secs = diffSec % 60;
      durationText = mins > 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : (mins > 0 ? `${mins}m ${secs}s` : `${secs}s`);
    }

    let exitTimeFormatted = '-';
    if (exitTime) {
      exitTimeFormatted = new Date(exitTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    }

    // Strategy rationale
    let rationale = item.rationale || 'Autonomous ORB Breakout / Breakdown trigger with VWAP confluence.';
    if (rationale.startsWith('Automated Exit:') && isOpen) {
      rationale = 'Opening Range Breakout (ORB) momentum trigger with VWAP confluence and ATR risk boundary.';
    } else if (rationale.startsWith('Automated Exit:') && !isOpen) {
      rationale = `Position triggered via Intraday ${isBuy ? 'Bullish' : 'Bearish'} ORB momentum. Closed upon ${item.exitReason || 'Exit trigger'}.`;
    }

    // Target & SL calculations
    const entryPrice = item.entryPrice || 0;
    const targetPrice = item.target || 0;
    const slPrice = item.stopLoss || 0;
    const riskPerShare = isBuy ? (entryPrice - slPrice) : (slPrice - entryPrice);
    const rewardPerShare = isBuy ? (targetPrice - entryPrice) : (entryPrice - targetPrice);
    const rrRatio = (riskPerShare > 0 && rewardPerShare > 0) ? (rewardPerShare / riskPerShare).toFixed(2) : '-';

    const pnl = isOpen ? (item.unrealizedPnL || 0) : (item.pnl || 0);
    const pnlPct = isOpen ? (item.unrealizedPnLPct || 0) : (item.pnlPct || 0);
    const isProfitable = pnl >= 0;
    const pnlColor = isProfitable ? '#00d084' : '#ff4757';

    tooltip.innerHTML = `
      <!-- HEADER -->
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 8px; margin-bottom: 10px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 14px; font-weight: 800; color: #fff;">${cleanSym}</span>
          <span style="font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; background: ${isBuy ? 'rgba(0,208,132,0.15)' : 'rgba(255,71,87,0.15)'}; color: ${isBuy ? '#00d084' : '#ff4757'}; border: 1px solid ${isBuy ? 'rgba(0,208,132,0.3)' : 'rgba(255,71,87,0.3)'};">
            ${isBuy ? '▲ BUY (LONG)' : '▼ SELL (SHORT)'}
          </span>
          <span style="font-size: 10px; color: #8896a8;">${item.quantity || 0} Shares (${item.holdingType === 'SWING_POSITIONAL' ? 'CNC Delivery 1x' : 'MIS 5x'})</span>
        </div>
        <span style="font-size: 10.5px; font-weight: 700; color: ${isOpen ? '#00d084' : '#8896a8'}; background: rgba(255,255,255,0.05); padding: 2px 7px; border-radius: 4px;">
          ${isOpen ? '🟢 ACTIVE IN-FLIGHT' : '🏁 CLOSED'}
        </span>
      </div>

      <!-- HORIZON & MONTHLY ROADMAP -->
      <div style="display: flex; justify-content: space-between; align-items: center; background: ${item.holdingType === 'SWING_POSITIONAL' ? 'rgba(56, 189, 248, 0.08)' : 'rgba(234, 179, 8, 0.08)'}; border: 1px solid ${item.holdingType === 'SWING_POSITIONAL' ? 'rgba(56, 189, 248, 0.25)' : 'rgba(234, 179, 8, 0.2)'}; border-radius: 6px; padding: 6px 10px; margin-bottom: 10px; font-size: 10.5px;">
        <span style="color: ${item.holdingType === 'SWING_POSITIONAL' ? '#38bdf8' : '#eab308'}; font-weight: 700;">
          ${item.holdingType === 'SWING_POSITIONAL' ? `📅 Positional Swing (Day ${item.holdingDaysCount || 1} of 30)` : '⚡ Intraday MIS (EOD 3:15 PM Square-off)'}
        </span>
        <span style="color: #d1d4dc; font-weight: 600;">
          ${item.holdingType === 'SWING_POSITIONAL' ? '🎯 Target: +30% Monthly Gain Goal' : '🛡️ Strict 1:2 R:R Target'}
        </span>
      </div>

      <!-- TIMELINE: WHEN CHOSEN -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.04); border-radius: 6px; padding: 8px; margin-bottom: 10px;">
        <div>
          <div style="font-size: 10px; color: #8896a8; text-transform: uppercase;">🕒 Entry Time (IST)</div>
          <div style="font-weight: 600; color: #fff; font-family: monospace;">${entryTimeFormatted}</div>
        </div>
        <div>
          <div style="font-size: 10px; color: #8896a8; text-transform: uppercase;">⏱️ ${isOpen ? 'Elapsed Time' : 'Holding Duration'}</div>
          <div style="font-weight: 600; color: #38bdf8; font-family: monospace;">${durationText || '-'}</div>
        </div>
        ${!isOpen && exitTimeFormatted !== '-' ? `
          <div style="grid-column: span 2; border-top: 1px solid rgba(255,255,255,0.04); padding-top: 4px; display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 10px; color: #8896a8;">🚪 Exit Time: <strong style="color: #fff; font-family: monospace;">${exitTimeFormatted}</strong></span>
            <span style="font-size: 10px; color: ${item.exitReason?.includes('TARGET') ? '#00d084' : '#ff4757'}; font-weight: 700;">${(item.exitReason || 'EXIT').replace(/_/g, ' ')}</span>
          </div>
        ` : ''}
      </div>

      <!-- WHY CHOSEN: STRATEGY RATIONALE -->
      <div style="margin-bottom: 10px;">
        <div style="font-size: 10px; font-weight: 700; color: #2962ff; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
          💡 Strategy Rationale (Why Chosen)
        </div>
        <div style="background: rgba(41, 98, 255, 0.08); border-left: 3px solid #2962ff; border-radius: 4px; padding: 8px 10px; font-size: 11px; color: #e2e8f0; line-height: 1.45;">
          ${rationale}
        </div>
      </div>

      <!-- RISK & REWARD ARCHITECTURE -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 10.5px; margin-bottom: 8px;">
        <div style="background: rgba(255,255,255,0.02); padding: 6px; border-radius: 4px;">
          <div style="color: #8896a8;">Entry Price</div>
          <div style="font-weight: 700; color: #fff; font-family: monospace;">₹${entryPrice ? entryPrice.toFixed(2) : '-'}</div>
        </div>
        <div style="background: rgba(255,255,255,0.02); padding: 6px; border-radius: 4px;">
          <div style="color: #8896a8;">${isOpen ? 'Current Price' : 'Exit Price'}</div>
          <div style="font-weight: 700; color: ${pnlColor}; font-family: monospace;">
            ₹${(isOpen ? (item.currentPrice || entryPrice) : (item.exitPrice || entryPrice)).toFixed(2)}
          </div>
        </div>
        <div style="background: rgba(255, 71, 87, 0.06); border: 1px solid rgba(255, 71, 87, 0.2); padding: 6px; border-radius: 4px;">
          <div style="color: #ff4757; font-weight: 600;">🛑 Stop Loss</div>
          <div style="font-weight: 700; color: #ff4757; font-family: monospace;">
            ₹${slPrice ? slPrice.toFixed(2) : '-'} ${riskPerShare > 0 ? `(-₹${riskPerShare.toFixed(2)})` : ''}
          </div>
        </div>
        <div style="background: rgba(0, 208, 132, 0.06); border: 1px solid rgba(0, 208, 132, 0.2); padding: 6px; border-radius: 4px;">
          <div style="color: #00d084; font-weight: 600;">🎯 Target</div>
          <div style="font-weight: 700; color: #00d084; font-family: monospace;">
            ₹${targetPrice ? targetPrice.toFixed(2) : '-'} ${rewardPerShare > 0 ? `(+₹${rewardPerShare.toFixed(2)})` : ''}
          </div>
        </div>
      </div>

      <!-- PNL & RATIO FOOTER -->
      <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 8px; font-size: 11px;">
        <span style="color: #8896a8;">Planned R:R: <strong style="color: #fff;">1 : ${rrRatio}</strong></span>
        <span>${isOpen ? 'Unrealized' : 'Realized'} P&L: 
          <strong style="color: ${pnlColor}; font-family: monospace; font-size: 12px;">
            ${pnl >= 0 ? '+' : ''}₹${pnl.toFixed(2)} (${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%)
          </strong>
        </span>
      </div>
    `;

    tooltip.style.display = 'block';
    this.movePositionTooltip(event);
  },

  movePositionTooltip(event) {
    const tooltip = document.getElementById('tvPositionHoverCard');
    if (!tooltip || tooltip.style.display !== 'block') return;

    const pad = 16;
    const tooltipWidth = 400;
    const tooltipHeight = tooltip.offsetHeight || 280;
    let left = event.clientX + pad;
    let top = event.clientY + pad;

    // Viewport clamping
    if (left + tooltipWidth > window.innerWidth - 12) {
      left = event.clientX - tooltipWidth - pad;
    }
    if (top + tooltipHeight > window.innerHeight - 12) {
      top = window.innerHeight - tooltipHeight - 12;
    }
    if (top < 12) top = 12;
    if (left < 12) left = 12;

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  },

  hidePositionTooltip() {
    const tooltip = document.getElementById('tvPositionHoverCard');
    if (tooltip) tooltip.style.display = 'none';
  },

  renderScorecard(p) {
    const elRealized = document.getElementById('tvKpiRealized');
    const elRealizedSub = document.getElementById('tvKpiRealizedSub');
    const elUnrealized = document.getElementById('tvKpiUnrealized');
    const elUnrealizedSub = document.getElementById('tvKpiUnrealizedSub');
    const elNetTotal = document.getElementById('tvKpiNetTotal');
    const elNetTotalSub = document.getElementById('tvKpiNetTotalSub');
    const elWinRate = document.getElementById('tvKpiWinRate');
    const elWinRecordSub = document.getElementById('tvKpiWinRecordSub');
    const elBalance = document.getElementById('tvKpiBalance');
    const elMarginSub = document.getElementById('tvKpiMarginSub');

    if (!elRealized) return;

    const realized = p.totalRealizedPnL || 0;
    const unrealized = p.totalUnrealizedPnL || 0;
    const netTotal = p.netTotalPnL !== undefined ? p.netTotalPnL : (realized + unrealized);
    const winRate = p.winRatePct || 0;
    const completed = p.completedTradesCount || 0;
    const wins = p.winningTradesCount !== undefined ? p.winningTradesCount : 0;
    const losses = p.losingTradesCount !== undefined ? p.losingTradesCount : (completed - wins);
    const balance = p.currentBalance || 100000;
    const margin = p.totalMarginUsed || 0;

    // 1. Realized
    elRealized.textContent = `${realized >= 0 ? '+' : ''}₹${realized.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    elRealized.style.color = realized > 0 ? '#00d084' : (realized < 0 ? '#ff4757' : '#d1d4dc');
    elRealizedSub.textContent = `${completed} Closed Trades Today`;

    // 2. Unrealized
    elUnrealized.textContent = `${unrealized >= 0 ? '+' : ''}₹${unrealized.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    elUnrealized.style.color = unrealized > 0 ? '#00d084' : (unrealized < 0 ? '#ff4757' : '#8896a8');
    elUnrealizedSub.textContent = `${p.activePositionsCount || 0} Open Positions`;

    // 3. Net Total
    elNetTotal.textContent = `${netTotal >= 0 ? '+' : ''}₹${netTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    elNetTotal.style.color = netTotal > 0 ? '#00d084' : (netTotal < 0 ? '#ff4757' : '#d1d4dc');
    elNetTotalSub.textContent = `${netTotal >= 0 ? '🟢 Net Profitable' : '🔴 Net Drawdown'} (Realized + Floating)`;

    // 4. Win Rate
    elWinRate.textContent = `${winRate.toFixed(1)}%`;
    elWinRate.style.color = winRate >= 50 ? '#00d084' : (completed > 0 ? '#ff4757' : '#d1d4dc');
    elWinRecordSub.textContent = `${wins}W / ${losses}L (${completed} Total)`;

    // 5. Balance & Margin
    elBalance.textContent = `₹${balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const totalEquity = balance + margin + unrealized;
    elMarginSub.textContent = `Blocked: ₹${margin.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} | Total Equity: ₹${totalEquity.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  },

  async toggleTradesView(mode) {
    this._tradesViewMode = mode;
    const btnCur = document.getElementById('btnViewCurrentTrades');
    const btnArc = document.getElementById('btnViewArchivedTrades');

    if (mode === 'archived') {
      if (btnCur) { btnCur.style.background = 'transparent'; btnCur.style.color = '#8896a8'; btnCur.style.borderColor = '#2a2e39'; }
      if (btnArc) { btnArc.style.background = '#2962ff'; btnArc.style.color = '#fff'; btnArc.style.borderColor = '#2962ff'; }
      try {
        const res = await fetch('/api/paper/archived-trades');
        const json = await res.json();
        const archivedTrades = json.data || [];
        this.renderClosedTrades(archivedTrades, true);
      } catch (e) {}
    } else {
      if (btnCur) { btnCur.style.background = '#2962ff'; btnCur.style.color = '#fff'; btnCur.style.borderColor = '#2962ff'; }
      if (btnArc) { btnArc.style.background = 'transparent'; btnArc.style.color = '#8896a8'; btnArc.style.borderColor = '#2a2e39'; }
      this.renderClosedTrades(this._latestSessionTrades || [], false);
    }
  },

  renderClosedTrades(trades, isArchive = false) {
    if (!isArchive) {
      this._latestSessionTrades = (trades || []).filter(t => t.status !== 'OPEN');
      const badge = document.getElementById('tvCurrentTradesBadge');
      if (badge) badge.textContent = this._latestSessionTrades.length;
      if (this._tradesViewMode === 'archived') {
        return; // Don't clobber archived view with empty polling data
      }
    }

    this.lastClosedTrades = (trades || []).filter(t => t.status !== 'OPEN');
    const tbody = document.getElementById('tvTradesTbody');
    const countEl = document.getElementById('tvClosedCount');
    
    const closedTrades = this.lastClosedTrades;
    if (countEl) countEl.textContent = closedTrades.length;

    if (!tbody) return;
    if (closedTrades.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" style="text-align: center; padding: 24px 16px; color: #8896a8;">
            <div style="font-size: 13px; font-weight: 600; color: #d1d4dc; margin-bottom: 6px;">⚡ Active Session: 0 Closed Trades</div>
            <div style="font-size: 11px; margin-bottom: 12px;">All active positions are currently in-flight running towards ATR targets. No trades have exited in this refilled session.</div>
            <button onclick="StockIntradayWidget.toggleTradesView('archived')" 
              style="padding: 6px 14px; background: rgba(41, 98, 255, 0.15); border: 1px solid #2962ff; color: #38bdf8; border-radius: 4px; font-size: 11px; font-weight: 700; cursor: pointer; transition: background 0.15s;">
              📁 View 11 Archived Trades from Prior Session
            </button>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = closedTrades.map(t => {
      const rawTime = t.exitTimestamp || t.timestamp || t.entryTimestamp;
      const timeStr = rawTime ? new Date(rawTime).toLocaleTimeString('en-IN', { hour12: false }) : '-';
      const side = t.action || t.side || (t.rationale?.toUpperCase().includes('BUY') ? 'BUY' : 'SELL');
      const isBuy = side === 'BUY';
      const isProfitable = (t.pnl || 0) >= 0;
      const pnlColor = isProfitable ? '#00d084' : '#ff4757';
      
      const pnlPct = (t.pnlPct !== undefined && t.pnlPct !== null)
        ? t.pnlPct 
        : (t.entryPrice && t.exitPrice ? (((t.exitPrice - t.entryPrice) / t.entryPrice) * (isBuy ? 100 : -100)) : 0);
      
      const rawReason = t.exitReason || (t.rationale?.includes('Automated Exit:') ? t.rationale.replace('Automated Exit: ', '') : (t.pnl >= 0 ? 'TARGET_HIT' : 'STOP_LOSS_HIT'));
      const cleanReason = rawReason.replace(/_/g, ' ');
      const cleanSym = (t.symbol || '').replace('-EQ', '').trim().toUpperCase();
      const currentSelected = (this.selectedSymbol || '').replace('-EQ', '').trim().toUpperCase();
      const isSelected = cleanSym === currentSelected;
      const rowBg = isSelected ? 'rgba(41, 98, 255, 0.15)' : 'transparent';
      const rowBorder = isSelected ? '3px solid #2962ff' : '3px solid transparent';

      return `
        <tr onclick="StockIntradayWidget.selectStock('${cleanSym}')" 
          onmouseenter="StockIntradayWidget.showPositionTooltip(event, '${t.id}', false)"
          onmousemove="StockIntradayWidget.movePositionTooltip(event)"
          onmouseleave="StockIntradayWidget.hidePositionTooltip()"
          style="border-bottom: 1px solid rgba(255,255,255,0.03); cursor: pointer; background: ${rowBg}; border-left: ${rowBorder}; transition: background 0.15s;">
          <td style="padding: 8px; color: #8896a8; font-family: monospace;">${timeStr}</td>
          <td style="padding: 8px; font-weight: 700; color: #fff;">
            <span style="display: inline-flex; align-items: center; gap: 6px;">
              <span style="font-size: 11px;">${isSelected ? '🔹' : '📈'}</span>
              <span style="color: ${isSelected ? '#2962ff' : '#fff'}; font-weight: 800; text-decoration: underline; text-underline-offset: 2px;">${t.symbol}</span>
              <span style="font-size: 10px; opacity: 0.7; color: #38bdf8;" title="Hover for strategy setup & execution timing">ℹ️</span>
            </span>
          </td>
          <td style="padding: 8px; font-weight: 700; color: ${isBuy ? '#00d084' : '#ff4757'};">${side}</td>
          <td style="padding: 8px; font-family: monospace;">${t.quantity}</td>
          <td style="padding: 8px; font-family: monospace;">₹${t.entryPrice ? t.entryPrice.toFixed(2) : '-'}</td>
          <td style="padding: 8px; font-family: monospace; color: #00d084; font-weight: 600;">₹${t.target ? t.target.toFixed(2) : '-'}</td>
          <td style="padding: 8px; font-family: monospace;">₹${t.exitPrice ? t.exitPrice.toFixed(2) : '-'}</td>
          <td style="padding: 8px; font-weight: 700; font-family: monospace; color: ${pnlColor};">
            ${isProfitable ? '+' : ''}₹${(t.pnl || 0).toFixed(2)} (${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%)
          </td>
          <td style="padding: 8px; font-size: 10.5px; color: ${rawReason.includes('TARGET') ? '#00d084' : '#ff4757'}; font-weight: 600;">
            ${cleanReason}
          </td>
        </tr>
      `;
    }).join('');
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
  },

  async openEmailSummaryModal() {
    try {
      const res = await fetch('/api/quant/latest-email-summary');
      const data = await res.json();
      if (!data.html) {
        alert('No compiled summary found yet.');
        return;
      }

      let modal = document.getElementById('tvEmailPreviewModal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'tvEmailPreviewModal';
        modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.85); z-index: 10000; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(6px);';
        document.body.appendChild(modal);
      }

      modal.innerHTML = `
        <div style="width: 90%; max-width: 900px; height: 88vh; background: #131722; border: 1px solid #2a2e39; border-radius: 12px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 20px 50px rgba(0,0,0,0.7);">
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 20px; background: #1e2433; border-bottom: 1px solid #2a3142;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <span style="font-weight: 700; color: #38bdf8; font-size: 15px;">📧 EOD Market Close Summary Email</span>
              <span style="font-size: 11px; background: rgba(56,189,248,0.15); color: #38bdf8; padding: 2px 8px; border-radius: 4px; border: 1px solid rgba(56,189,248,0.3);">
                Target: jaiadithya2020@gmail.com
              </span>
            </div>
            <div style="display: flex; align-items: center; gap: 10px;">
              <button onclick="StockIntradayWidget.dispatchEmailSummaryNow()" style="padding: 6px 14px; background: #0284c7; border: 1px solid #38bdf8; color: #fff; font-size: 11.5px; font-weight: 700; border-radius: 5px; cursor: pointer;">
                📨 Send to jaiadithya2020@gmail.com
              </button>
              <button onclick="document.getElementById('tvEmailPreviewModal').remove()" style="background: transparent; border: none; color: #94a3b8; font-size: 20px; cursor: pointer; padding: 4px 8px;">✕</button>
            </div>
          </div>
          <div style="flex: 1; overflow: auto; padding: 0;">
            <iframe srcdoc="${encodeURIComponent(data.html)}" style="width: 100%; height: 100%; border: none; background: #0f1318;"></iframe>
          </div>
        </div>
      `;
    } catch (e) {
      alert('Could not load summary: ' + e.message);
    }
  },

  async dispatchEmailSummaryNow() {
    try {
      if (typeof ToastNotification !== 'undefined') {
        ToastNotification.show('⏳ Sending market close summary to jaiadithya2020@gmail.com...', 'info');
      }

      const res = await fetch('/api/quant/send-market-close-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient: 'jaiadithya2020@gmail.com', force: true })
      });
      const data = await res.json();

      if (data.delivered) {
        const msg = `🎉 Market close summary successfully sent to ${data.recipient} via ${data.method}!`;
        if (typeof ToastNotification !== 'undefined') ToastNotification.show(msg, 'success');
        else alert(msg);
      } else if (data.archived) {
        const msg = `💾 Summary compiled and saved to ${data.reportFilename}. (To send direct to Gmail inbox, configure your Gmail App Password in Risk Settings).`;
        if (typeof ToastNotification !== 'undefined') ToastNotification.show(msg, 'warning');
        else alert(msg);
      } else {
        const msg = data.message || 'Failed to dispatch email';
        if (typeof ToastNotification !== 'undefined') ToastNotification.show('⚠️ ' + msg, 'warning');
        else alert('⚠️ ' + msg);
      }
    } catch (e) {
      if (typeof ToastNotification !== 'undefined') ToastNotification.show('❌ ' + e.message, 'error');
      else alert('❌ ' + e.message);
    }
  }
};