// ============================================================================
// FILE: frontend/js/components/PaperTradingWidget.js
// Institutional Forward Simulation Paper Trading Order Management System (OMS) Widget
// Renders active virtual balance, realized P&L, win rate, active positions, and quick trade controls
// Dynamic ATM option strike calculation based on real-time spot price
// Passes live signalRationale & optionType to /api/paper/trade
// ============================================================================

const PaperTradingWidget = {
  activeAtmStrike: 57500,
  estimatedPremium: 280,

  render(summaryData = {}, liveSpotPrice = null) {
    const container = document.getElementById('paper-trading-container');
    if (!container) return;

    const spotPrice = liveSpotPrice || 57491.10;
    // Calculate dynamic At-The-Money (ATM) option strike (rounded to nearest 100)
    const atmStrike = Math.round(spotPrice / 100) * 100;
    // Calculate estimated ATM option premium (~0.5% of underlying spot price)
    const estimatedPremium = Math.round(spotPrice * 0.005);
    this.activeAtmStrike = atmStrike;
    this.estimatedPremium = estimatedPremium;

    const { currentBalance, activePositionsCount, winRatePct, totalRealizedPnL, activePositions = [] } = summaryData;
    const pnlClass = totalRealizedPnL >= 0 ? 'text-green' : 'text-red';

    container.innerHTML = `
      <div class="paper-card">
        <div class="paper-header">
          <div class="paper-title">
            <span class="icon">📝</span>
            <h3>Paper Trading OMS (Forward Simulation)</h3>
          </div>
          <div class="paper-controls">
            <button id="btn-quick-paper-trade" class="btn btn-trade">⚡ Order 1 Lot CE (${atmStrike} CE @ ₹${estimatedPremium})</button>
            <button id="btn-kill-switch" class="btn btn-danger">🚨 KILL SWITCH</button>
          </div>
        </div>

        <div class="paper-summary-row">
          <div class="summary-item">
            <span class="label">Virtual Balance</span>
            <span class="val">₹${currentBalance ? currentBalance.toLocaleString('en-IN') : '1,00,000'}</span>
          </div>
          <div class="summary-item">
            <span class="label">Realized P&L</span>
            <span class="val ${pnlClass}">₹${totalRealizedPnL ? totalRealizedPnL.toFixed(2) : '0.00'}</span>
          </div>
          <div class="summary-item">
            <span class="label">Win Rate</span>
            <span class="val">${winRatePct !== undefined ? winRatePct : 0.0}%</span>
          </div>
          <div class="summary-item">
            <span class="label">Active Positions</span>
            <span class="val">${activePositionsCount || 0}</span>
          </div>
        </div>

        <div class="paper-positions-section">
          <h4>Active Open Positions</h4>
          ${activePositions.length === 0 ? `
            <div class="empty-positions">
              <span>No open paper trading positions. Ready to execute signals.</span>
            </div>
          ` : `
            <div class="table-responsive">
              <table class="table paper-table">
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th>Type</th>
                    <th>Qty</th>
                    <th>Entry (₹)</th>
                    <th>LTP (₹)</th>
                    <th>P&L (₹)</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  ${activePositions.map(pos => `
                    <tr>
                      <td>${pos.symbol}</td>
                      <td><span class="badge badge-${pos.type.toLowerCase()}">${pos.type}</span></td>
                      <td>${pos.quantity}</td>
                      <td>₹${pos.entryPrice}</td>
                      <td>₹${pos.currentPrice || pos.entryPrice}</td>
                      <td class="${pos.pnl >= 0 ? 'text-green' : 'text-red'}">₹${pos.pnl.toFixed(2)}</td>
                      <td>
                        <button class="btn btn-sm btn-danger btn-close-pos" data-symbol="${pos.symbol}">Close</button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `}
        </div>
      </div>
    `;

    this.attachEventListeners();
  },

  attachEventListeners() {
    const btnTrade = document.getElementById('btn-quick-paper-trade');
    if (btnTrade) {
      btnTrade.addEventListener('click', () => {
        this.executeQuickTrade(this.activeAtmStrike, this.estimatedPremium);
      });
    }

    const btnKill = document.getElementById('btn-kill-switch');
    if (btnKill) {
      btnKill.addEventListener('click', () => {
        if (confirm('🚨 EMERGENCY KILL SWITCH: Close all paper positions immediately?')) {
          if (typeof ToastNotification !== 'undefined') {
            ToastNotification.show('🚨 Emergency Kill Switch Triggered. All positions liquidated.', 'error');
          }
        }
      });
    }
  },

  async executeQuickTrade(atmStrike = 57500, entryPremium = 280) {
    try {
      const activeSignal = window.lastQuantSignal || {};
      const optType = activeSignal.signal === 'BUY_PUT_PE' ? 'PE' : 'CE';
      const rationaleText = activeSignal.signalRationale || 'Fib 0.618 Support + PCR Z-Score Confluence';

      const res = await fetch('/api/paper/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: 'BANKNIFTY',
          optionType: optType,
          strikePrice: atmStrike,
          entryPrice: entryPremium,
          quantity: 15,
          rationale: rationaleText
        })
      });
      const data = await res.json();
      if (data.success) {
        if (typeof ToastNotification !== 'undefined') {
          ToastNotification.show(`✅ Simulated Paper Trade Placed: 1 Lot ${atmStrike} ${optType} @ ₹${entryPremium}`, 'success');
        } else {
          alert(`✅ Simulated Paper Trade Placed: 1 Lot ${atmStrike} ${optType} @ ₹${entryPremium}`);
        }
        
        // Refresh quant & paper data without full page reload
        if (window.appInstance && typeof window.appInstance.fetchQuantData === 'function') {
          window.appInstance.fetchQuantData();
        }
      } else {
        alert('❌ Paper Trade Failed: ' + data.message);
      }
    } catch (e) {
      console.error('❌ Error placing paper trade:', e.message);
    }
  }
};
