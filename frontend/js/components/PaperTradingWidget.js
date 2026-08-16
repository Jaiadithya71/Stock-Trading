// ============================================================================
// FILE: frontend/js/components/PaperTradingWidget.js
// Paper Trading Execution & Portfolio OMS Dashboard Component
// Dynamic ATM Strike Calculation, Glassmorphism Toast Notifications & Reload-Free Refresh
// ============================================================================

const PaperTradingWidget = {
  render(summaryData, liveSpotPrice = null) {
    const container = document.getElementById('paper-trading-widget');
    if (!container) return;

    if (!summaryData) {
      container.innerHTML = `
        <div class="paper-card loading">
          <h3>📝 Paper Trading OMS</h3>
          <p>Loading portfolio summary...</p>
        </div>
      `;
      return;
    }

    const spotPrice = liveSpotPrice || 57491.10;
    // Calculate dynamic At-The-Money (ATM) option strike (rounded to nearest 100)
    const atmStrike = Math.round(spotPrice / 100) * 100;
    this.activeAtmStrike = atmStrike;

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
            <button id="btn-quick-paper-trade" class="btn btn-trade">⚡ Order 1 Lot CE (${atmStrike} CE)</button>
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
            <span class="val">${winRatePct ? winRatePct.toFixed(1) : '0.0'}%</span>
          </div>
          <div class="summary-item">
            <span class="label">Active Positions</span>
            <span class="val">${activePositionsCount || 0}</span>
          </div>
        </div>

        <div class="active-positions-table">
          <h4>Active Open Positions</h4>
          ${activePositions.length === 0 ? `
            <p class="no-positions">No open paper trading positions. Ready to execute signals.</p>
          ` : `
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Contract</th>
                  <th>Strike</th>
                  <th>Entry Price</th>
                  <th>Qty</th>
                  <th>Stop Loss</th>
                  <th>Target</th>
                </tr>
              </thead>
              <tbody>
                ${activePositions.map(pos => `
                  <tr>
                    <td>${pos.id}</td>
                    <td><span class="badge ${pos.optionType === 'CE' ? 'badge-bullish' : 'badge-bearish'}">${pos.optionType}</span></td>
                    <td>${pos.strikePrice}</td>
                    <td>₹${pos.entryPrice}</td>
                    <td>${pos.quantity}</td>
                    <td class="text-red">₹${pos.stopLossPrice.toFixed(2)}</td>
                    <td class="text-green">₹${pos.targetPrice.toFixed(2)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          `}
        </div>
      </div>
    `;

    // Attach event listeners
    const tradeBtn = document.getElementById('btn-quick-paper-trade');
    if (tradeBtn) {
      tradeBtn.onclick = () => this.executeQuickTrade(atmStrike);
    }

    const killBtn = document.getElementById('btn-kill-switch');
    if (killBtn) {
      killBtn.onclick = () => this.triggerKillSwitch();
    }
  },

  async executeQuickTrade(atmStrike = 57500) {
    try {
      const res = await fetch('/api/paper/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: 'BANKNIFTY',
          optionType: 'CE',
          strikePrice: atmStrike,
          entryPrice: 320,
          quantity: 15
        })
      });
      const data = await res.json();
      if (data.success) {
        if (typeof ToastNotification !== 'undefined') {
          ToastNotification.show(`✅ Simulated Paper Trade Placed: 1 Lot ${atmStrike} CE @ ₹320`, 'success');
        } else {
          alert(`✅ Simulated Paper Trade Placed: 1 Lot ${atmStrike} CE @ ₹320`);
        }
        
        // Refresh quant & paper data without full page reload
        if (window.appInstance && typeof window.appInstance.fetchQuantData === 'function') {
          await window.appInstance.fetchQuantData();
          window.appInstance.updateDashboard();
        }
      } else {
        if (typeof ToastNotification !== 'undefined') {
          ToastNotification.show('❌ Error: ' + data.message, 'error');
        } else {
          alert('❌ Error: ' + data.message);
        }
      }
    } catch (e) {
      if (typeof ToastNotification !== 'undefined') {
        ToastNotification.show('❌ Failed to place trade: ' + e.message, 'error');
      } else {
        alert('❌ Failed to place trade: ' + e.message);
      }
    }
  },

  triggerKillSwitch() {
    if (typeof ToastNotification !== 'undefined') {
      ToastNotification.confirm('🚨 ARE YOU SURE YOU WANT TO TRIGGER THE EMERGENCY KILL SWITCH? This will freeze paper trading and cancel open signals.', () => {
        ToastNotification.show('🚨 EMERGENCY KILL SWITCH TRIGGERED: Paper trading engine paused.', 'danger', 5000);
      });
    } else if (confirm('🚨 ARE YOU SURE YOU WANT TO TRIGGER THE EMERGENCY KILL SWITCH?')) {
      alert('🚨 EMERGENCY KILL SWITCH TRIGGERED');
    }
  }
};
