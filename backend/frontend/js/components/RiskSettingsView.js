// ============================================================================
// FILE: frontend/js/components/RiskSettingsView.js
// Risk, Capital & Execution Settings Page Component
// Allows user to configure initial trade capital, Daily Max Loss Stop, and link to Survey
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
              <p>Configure paper trading initial capital, lot sizing, daily stop-loss caps, and survey preferences</p>
            </div>
          </div>
        </div>

        <div class="settings-grid">
          <!-- CARD 1: CAPITAL & LOT SIZING -->
          <div class="settings-card">
            <h3>💰 Trade Sizing & Capital Allocation</h3>
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

          <!-- CARD 4: STRATEGY & QUESTIONNAIRE SURVEY -->
          <div class="settings-card">
            <h3>📋 Client Strategy & Preferences Survey</h3>
            <p class="s-desc">Review or update your 16-question trading strategy specifications and baseline requirements.</p>

            <a href="/survey.html" target="_blank" class="btn btn-trade" style="display: inline-flex; align-items: center; gap: 8px; text-decoration: none; padding: 10px 18px; font-weight: 600; border-radius: 8px;">
              <span>📋 Open Interactive Strategy Survey</span>
            </a>
          </div>
        </div>
      </div>
    `;
  },

  async saveSettings() {
    try {
      const capital = document.getElementById('setting-capital')?.value || 1000;
      const lots = document.getElementById('setting-lots')?.value || 1;
      const maxLoss = document.getElementById('setting-maxloss')?.value || 5000;

      const res = await fetch('/api/quant/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ capital, lots, maxLoss })
      });
      const data = await res.json();

      if (typeof ToastNotification !== 'undefined') {
        ToastNotification.show(`✅ Risk Settings Saved: ₹${capital} Initial Capital per Trade allocated.`, 'success');
      } else {
        alert(`✅ Risk Settings Saved: ₹${capital} Initial Capital per Trade allocated.`);
      }
    } catch (e) {
      if (typeof ToastNotification !== 'undefined') {
        ToastNotification.show('❌ Failed to save settings: ' + e.message, 'error');
      } else {
        alert('❌ Failed to save settings: ' + e.message);
      }
    }
  }
};
