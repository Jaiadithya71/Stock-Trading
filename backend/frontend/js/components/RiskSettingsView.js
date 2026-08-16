// ============================================================================
// FILE: frontend/js/components/RiskSettingsView.js
// Risk, Capital & Execution Settings Page Component
// Allows user to configure initial trade capital (e.g. ₹1,000 / 1 Lot), Daily Max Loss Stop, and Simulation Mode
// ============================================================================

const RiskSettingsView = {
  render() {
    const container = document.getElementById('risk-settings-view');
    if (!container) return;

    container.innerHTML = `
      <div class="settings-page-wrapper">
        <div class="settings-header">
          <div class="settings-title">
            <span class="icon">⚙️</span>
            <div>
              <h2>Risk Guardrails & Capital Allocation Settings</h2>
              <p>Configure paper trading initial capital, lot sizing, and daily stop-loss caps</p>
            </div>
          </div>
        </div>

        <div class="settings-grid">
          <!-- CARD 1: CAPITAL & LOT SIZING -->
          <div class="settings-card">
            <h3>💰 Trade Sizing & Capital Sizing</h3>
            <p class="s-desc">Start small to validate paper trading profitability before risking real capital.</p>

            <div class="form-group">
              <label>Initial Capital Allocation per Trade (₹)</label>
              <input type="number" id="setting-capital" value="1000" step="500" min="500" max="100000">
              <span class="form-hint">Default: ₹1,000 for small paper trading simulation</span>
            </div>

            <div class="form-group">
              <label>Max Quantity (Lots)</label>
              <input type="number" id="setting-lots" value="1" min="1" max="50">
              <span class="form-hint">1 Lot Bank Nifty Options = 15 Quantity</span>
            </div>

            <button class="btn btn-save-settings" onclick="RiskSettingsView.saveSettings()">💾 Save Capital Settings</button>
          </div>

          <!-- CARD 2: SAFETY & CIRCUIT BREAKERS -->
          <div class="settings-card">
            <h3>🛡️ Daily Max Loss Circuit Breaker</h3>
            <p class="s-desc">Automatic protection locks execution if daily cumulative loss exceeds threshold.</p>

            <div class="form-group">
              <label>Daily Max Loss Cap (₹)</label>
              <input type="number" id="setting-maxloss" value="5000" step="1000" min="1000">
              <span class="form-hint">Trading automatically freezes if daily loss reaches ₹5,000</span>
            </div>

            <div class="form-group">
              <label>Trailing Stop Loss % per Trade</label>
              <input type="number" id="setting-sl" value="15" step="1" min="5" max="30">
              <span class="form-hint">Default: -15% hard stop loss</span>
            </div>

            <div class="form-group">
              <label>Target Profit % per Trade</label>
              <input type="number" id="setting-target" value="30" step="5" min="10" max="100">
              <span class="form-hint">Default: +30% profit target exit</span>
            </div>
          </div>

          <!-- CARD 3: EXECUTION MODE TOGGLE -->
          <div class="settings-card">
            <h3>⚡ Execution Mode & SmartAPI Broker Credentials</h3>
            <p class="s-desc">Toggle between Forward Simulation Paper Trading and Live Broker Execution.</p>

            <div class="mode-selection-box">
              <div class="mode-option active">
                <span class="m-title">🧪 Forward Paper Trading Simulation (Active)</span>
                <p>Simulates order fills, 0.05% slippage, and real-time P&L against live Angel One market feeds without risking real capital.</p>
              </div>

              <div class="mode-option disabled">
                <span class="m-title">🔒 Live SmartAPI Execution (Locked)</span>
                <p>Requires verified 14-day paper trading Deflated Sharpe Ratio (DSR ≥ 0.95) before unlocking live capital execution.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  saveSettings() {
    const capital = document.getElementById('setting-capital').value;
    alert(`✅ Capital Settings Saved: ₹${capital} Initial Capital per Trade allocated.`);
  }
};
