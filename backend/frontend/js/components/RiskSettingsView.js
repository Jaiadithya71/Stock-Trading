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
              <label>Daily Max Trades Cap (0 = Unlimited)</label>
              <input type="number" id="setting-maxtrades" value="10" min="0" max="50">
              <span class="form-hint">Set to 0 for unlimited trades, or cap max trades per day (Default: 10)</span>
            </div>

            <div class="form-group">
              <label>Max Open Concurrent Positions</label>
              <input type="number" id="setting-maxpositions" value="5" min="1" max="20">
              <span class="form-hint">Maximum number of stock positions held simultaneously (Default: 5)</span>
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

          <!-- CARD 3: TRADING HORIZON & MONTHLY TARGET STRATEGY -->
          <div class="settings-card">
            <h3>📅 Trading Horizon & Multi-Week Swing Mode</h3>
            <p class="s-desc">Target ~30% monthly gains by holding Stage-2 breakout runners overnight across 2–4 weeks.</p>

            <div class="form-group">
              <label>Strategy Horizon Mode</label>
              <select id="setting-horizon" style="width: 100%; padding: 8px 12px; background: #131722; border: 1px solid #2a2e39; border-radius: 6px; color: #fff; font-size: 13px;">
                <option value="HYBRID_RUNNER" selected>🚀 Hybrid Runner (Intraday MIS + Auto-Promote Winners to Swing)</option>
                <option value="SWING_POSITIONAL">📅 Pure Positional Swing (Up to 1 Month / 30 Days)</option>
                <option value="INTRADAY">⚡ Pure Intraday MIS (Forced 3:15 PM EOD Square-off)</option>
              </select>
              <span class="form-hint">Hybrid mode enters with 5x MIS margin and locks risk at breakeven before holding multi-day</span>
            </div>

            <div class="form-group">
              <label>Target Monthly Gain Goal (%)</label>
              <input type="number" id="setting-monthly-target" value="30" min="10" max="100" step="5">
              <span class="form-hint">Target compound return goal per month (Default: 30%)</span>
            </div>

            <div class="form-group">
              <label>Swing Trailing Stop Type</label>
              <select id="setting-trailing-type" style="width: 100%; padding: 8px 12px; background: #131722; border: 1px solid #2a2e39; border-radius: 6px; color: #fff; font-size: 13px;">
                <option value="20_EMA_DAILY" selected>20-Day EMA (Exponential Moving Average)</option>
                <option value="SUPERTREND">SuperTrend (10, 3)</option>
                <option value="BREAKEVEN_LOCKED">Breakeven + 0.2% Profit Buffer</option>
              </select>
              <span class="form-hint">Trails stop-loss higher on daily timeframe to protect gains without choking trend</span>
            </div>

            <button class="btn btn-save-settings" onclick="RiskSettingsView.saveSettings()">💾 Save Horizon & Risk Settings</button>
          </div>

          <!-- CARD 4: AUTOMATED MARKET CLOSE EMAIL NOTIFICATIONS -->
          <div class="settings-card" style="border: 1px solid rgba(56, 189, 248, 0.35); background: linear-gradient(180deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.9) 100%);">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
              <h3 style="color: #38bdf8; margin: 0;">📧 Market Close Daily Performance Email</h3>
              <span id="email-status-badge" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">
                Loading...
              </span>
            </div>
            <p class="s-desc">Automatically compiles and emails an executive P&L, closed trades, and overnight swing holdings summary at market close (3:30 PM IST).</p>

            <div class="form-group" style="margin-top: 12px;">
              <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                <input type="checkbox" id="setting-email-enabled" checked style="width: 16px; height: 16px; accent-color: #38bdf8;">
                <span style="font-weight: 600; color: #f0f3f6;">Enable Automated Market Close Email</span>
              </label>
              <span class="form-hint">Dispatches automatically when regular session closes at 3:30 PM IST</span>
            </div>

            <div class="form-group">
              <label>Recipient Email Address</label>
              <input type="email" id="setting-email-recipient" value="jaiadithya2020@gmail.com" placeholder="jaiadithya2020@gmail.com" style="width: 100%; padding: 8px 12px; background: #131722; border: 1px solid #2a2e39; border-radius: 6px; color: #fff; font-size: 13px;">
              <span class="form-hint">Primary inbox where daily trading performance reports will be delivered</span>
            </div>

            <div style="background: rgba(15, 23, 42, 0.6); padding: 12px; border-radius: 6px; border: 1px dashed #334155; margin-bottom: 14px;">
              <div style="font-size: 12px; font-weight: 600; color: #cbd5e1; margin-bottom: 8px;">🔑 Gmail SMTP Credentials (Optional for Direct Inbox Delivery)</div>
              
              <div class="form-group" style="margin-bottom: 10px;">
                <label style="font-size: 11px; color: #94a3b8;">Sender Gmail Address</label>
                <input type="email" id="setting-smtp-user" placeholder="e.g. your-email@gmail.com" style="width: 100%; padding: 7px 10px; background: #0f172a; border: 1px solid #1e293b; border-radius: 5px; color: #fff; font-size: 12px;">
              </div>

              <div class="form-group" style="margin-bottom: 8px;">
                <label style="font-size: 11px; color: #94a3b8;">Gmail 16-Character App Password</label>
                <input type="password" id="setting-smtp-pass" placeholder="xxxx xxxx xxxx xxxx" style="width: 100%; padding: 7px 10px; background: #0f172a; border: 1px solid #1e293b; border-radius: 5px; color: #fff; font-size: 12px; letter-spacing: 1px;">
                <span class="form-hint" style="font-size: 11px; color: #64748b;">
                  Need an App Password? Generate one in 30 seconds at <a href="https://myaccount.google.com/apppasswords" target="_blank" style="color: #38bdf8; text-decoration: underline;">Google Account &gt; App Passwords</a>. If blank, reports are safely compiled & saved to server disk.
                </span>
              </div>
            </div>

            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              <button class="btn btn-save-settings" onclick="RiskSettingsView.saveEmailSettings()" style="flex: 1; min-width: 160px;">💾 Save Email Settings</button>
              <button class="btn btn-trade" onclick="RiskSettingsView.triggerEmailDispatch()" style="flex: 1; min-width: 180px; background: #0284c7; border-color: #38bdf8;">📧 Send Today's Summary Now</button>
              <button class="btn" onclick="RiskSettingsView.previewEmailModal()" style="background: #334155; color: #f1f5f9; border: 1px solid #475569; padding: 8px 14px; border-radius: 6px; cursor: pointer;">👁️ Preview HTML Report</button>
            </div>
          </div>

          <!-- CARD 5: EXECUTION MODE TOGGLE -->
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

          <!-- CARD 6: STRATEGY & QUESTIONNAIRE SURVEY -->
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

    this.loadSettings();
  },

  async loadSettings() {
    try {
      const res = await fetch('/api/quant/settings');
      if (res.ok) {
        const data = await res.json();
        const s = data.settings || data;
        if (s) {
          if (s.capital && document.getElementById('setting-capital')) document.getElementById('setting-capital').value = s.capital;
          if (s.lots && document.getElementById('setting-lots')) document.getElementById('setting-lots').value = s.lots;
          if (s.maxLoss && document.getElementById('setting-maxloss')) document.getElementById('setting-maxloss').value = s.maxLoss;
          if (s.maxDailyTrades !== undefined && document.getElementById('setting-maxtrades')) document.getElementById('setting-maxtrades').value = s.maxDailyTrades;
          if (s.maxOpenPositions !== undefined && document.getElementById('setting-maxpositions')) document.getElementById('setting-maxpositions').value = s.maxOpenPositions;
          if (s.strategyHorizon && document.getElementById('setting-horizon')) document.getElementById('setting-horizon').value = s.strategyHorizon;
          if (s.targetMonthlyGainPct && document.getElementById('setting-monthly-target')) document.getElementById('setting-monthly-target').value = s.targetMonthlyGainPct;
          if (s.swingTrailingStop && document.getElementById('setting-trailing-type')) document.getElementById('setting-trailing-type').value = s.swingTrailingStop;
        }
      }
    } catch (e) {}

    await this.loadEmailSettings();
  },

  async loadEmailSettings() {
    try {
      const res = await fetch('/api/quant/email-settings');
      if (res.ok) {
        const data = await res.json();
        const cfg = data.settings || {};
        if (document.getElementById('setting-email-enabled')) {
          document.getElementById('setting-email-enabled').checked = cfg.enabled !== false;
        }
        if (cfg.recipientEmail && document.getElementById('setting-email-recipient')) {
          document.getElementById('setting-email-recipient').value = cfg.recipientEmail;
        }
        if (cfg.smtpUser && document.getElementById('setting-smtp-user')) {
          document.getElementById('setting-smtp-user').value = cfg.smtpUser;
        }
        if (cfg.smtpPass && document.getElementById('setting-smtp-pass')) {
          document.getElementById('setting-smtp-pass').value = cfg.smtpPass;
        }

        const badge = document.getElementById('email-status-badge');
        if (badge) {
          if (cfg.isConfigured) {
            badge.textContent = '✅ Inbox Ready';
            badge.style.background = 'rgba(0, 208, 132, 0.15)';
            badge.style.color = '#00d084';
            badge.style.borderColor = 'rgba(0, 208, 132, 0.3)';
          } else {
            badge.textContent = '💾 Archiving to Disk (Awaiting App PW)';
            badge.style.background = 'rgba(245, 158, 11, 0.15)';
            badge.style.color = '#fbbf24';
            badge.style.borderColor = 'rgba(245, 158, 11, 0.3)';
          }
        }
      }
    } catch (e) {
      console.warn('Could not load email settings:', e);
    }
  },

  async saveEmailSettings() {
    try {
      const enabled = document.getElementById('setting-email-enabled')?.checked;
      const recipientEmail = document.getElementById('setting-email-recipient')?.value?.trim() || 'jaiadithya2020@gmail.com';
      const smtpUser = document.getElementById('setting-smtp-user')?.value?.trim() || '';
      const smtpPass = document.getElementById('setting-smtp-pass')?.value?.trim() || '';

      const payload = { enabled, recipientEmail };
      if (smtpUser) payload.smtpUser = smtpUser;
      if (smtpPass && !smtpPass.includes('••••')) payload.smtpPass = smtpPass;

      const res = await fetch('/api/quant/email-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        if (typeof ToastNotification !== 'undefined') {
          ToastNotification.show('✅ Email settings saved! Recipient: ' + recipientEmail, 'success');
        } else {
          alert('✅ Email settings saved! Recipient: ' + recipientEmail);
        }
        await this.loadEmailSettings();
      } else {
        throw new Error(data.message || 'Failed to save');
      }
    } catch (e) {
      if (typeof ToastNotification !== 'undefined') {
        ToastNotification.show('❌ Error: ' + e.message, 'error');
      } else {
        alert('❌ Error: ' + e.message);
      }
    }
  },

  async triggerEmailDispatch() {
    try {
      const recipient = document.getElementById('setting-email-recipient')?.value?.trim() || 'jaiadithya2020@gmail.com';
      if (typeof ToastNotification !== 'undefined') {
        ToastNotification.show('⏳ Compiling and sending market close summary to ' + recipient + '...', 'info');
      }

      const res = await fetch('/api/quant/send-market-close-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient, force: true })
      });
      const data = await res.json();

      if (data.delivered) {
        const msg = `🎉 Market close summary successfully sent to ${data.recipient} via ${data.method}!`;
        if (typeof ToastNotification !== 'undefined') ToastNotification.show(msg, 'success');
        else alert(msg);
      } else if (data.archived) {
        const msg = `💾 Summary compiled and saved to ${data.reportFilename}. Add Gmail App Password for direct inbox delivery.`;
        if (typeof ToastNotification !== 'undefined') ToastNotification.show(msg, 'warning');
        else alert(msg);
        this.previewEmailModal();
      } else {
        const msg = data.message || 'Failed to dispatch email';
        if (typeof ToastNotification !== 'undefined') ToastNotification.show('⚠️ ' + msg, 'warning');
        else alert('⚠️ ' + msg);
      }
    } catch (e) {
      if (typeof ToastNotification !== 'undefined') ToastNotification.show('❌ ' + e.message, 'error');
      else alert('❌ ' + e.message);
    }
  },

  async previewEmailModal() {
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
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 14px 20px; background: #1e2433; border-bottom: 1px solid #2a3142;">
            <div style="font-weight: 700; color: #38bdf8; font-size: 15px;">📧 EOD Market Close Summary Email Preview</div>
            <button onclick="document.getElementById('tvEmailPreviewModal').remove()" style="background: transparent; border: none; color: #94a3b8; font-size: 20px; cursor: pointer; padding: 4px 8px;">✕</button>
          </div>
          <div style="flex: 1; overflow: auto; padding: 0;">
            <iframe srcdoc="${encodeURIComponent(data.html)}" style="width: 100%; height: 100%; border: none; background: #0f1318;"></iframe>
          </div>
        </div>
      `;
    } catch (e) {
      alert('Could not open preview: ' + e.message);
    }
  },

  async saveSettings() {
    try {
      const capital = document.getElementById('setting-capital')?.value || 1000;
      const lots = document.getElementById('setting-lots')?.value || 1;
      const maxLoss = document.getElementById('setting-maxloss')?.value || 5000;
      const maxDailyTrades = parseInt(document.getElementById('setting-maxtrades')?.value, 10);
      const maxOpenPositions = parseInt(document.getElementById('setting-maxpositions')?.value, 10) || 5;
      const strategyHorizon = document.getElementById('setting-horizon')?.value || 'HYBRID_RUNNER';
      const targetMonthlyGainPct = parseFloat(document.getElementById('setting-monthly-target')?.value) || 30.0;
      const swingTrailingStop = document.getElementById('setting-trailing-type')?.value || '20_EMA_DAILY';

      const res = await fetch('/api/quant/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          capital, 
          lots, 
          maxLoss, 
          maxDailyTrades: isNaN(maxDailyTrades) ? 0 : maxDailyTrades,
          maxOpenPositions,
          strategyHorizon,
          targetMonthlyGainPct,
          swingTrailingStop
        })
      });
      const data = await res.json();

      const tradesMsg = maxDailyTrades === 0 ? 'Unlimited trades' : `${maxDailyTrades} max trades/day`;
      if (typeof ToastNotification !== 'undefined') {
        ToastNotification.show(`✅ Risk Settings Saved: Max Loss ₹${maxLoss}, ${tradesMsg}.`, 'success');
      } else {
        alert(`✅ Risk Settings Saved: Max Loss ₹${maxLoss}, ${tradesMsg}.`);
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
