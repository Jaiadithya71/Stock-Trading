// ============================================================================
// FILE: frontend/js/components/DevDiagnosticsView.js
// Dev Diagnostics & System Telemetry Cockpit (Dev View)
// Real-time monitoring across Broker Auth, Data Pipeline, Strategy Engines,
// OMS Risk Gates, Automation/Crons, and Interactive 1-Click Testbench.
// ============================================================================

const DevDiagnosticsView = {
  healthData: null,
  auditResults: null,
  telemetryLogs: [],
  activeFilter: 'ALL',
  isAuditing: false,
  isEmailing: false,
  isReauthing: false,
  isSettling: false,
  pollTimer: null,
  isPaused: false,

  init() {
    this.fetchHealth();
    this.fetchTelemetry();
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = setInterval(() => {
      if (!this.isPaused) {
        this.fetchHealth(true);
        this.fetchTelemetry(true);
      }
    }, 5000);
  },

  async fetchHealth(silent = false) {
    try {
      const res = await fetch('/api/dev/system-health');
      const json = await res.json();
      if (json.success && json.data) {
        this.healthData = json.data;
        if (!silent) this.render();
        else this.updateDynamicValues();
      }
    } catch (e) {
      console.warn('⚠️ [DevView] Error fetching system health:', e.message);
    }
  },

  async fetchTelemetry(silent = false) {
    try {
      const res = await fetch('/api/dev/telemetry-stream');
      const json = await res.json();
      if (json.success && json.logs) {
        this.telemetryLogs = json.logs;
        this.renderTelemetryLogs();
      }
    } catch (e) {}
  },

  async runFullAudit() {
    if (this.isAuditing) return;
    this.isAuditing = true;
    this.render();

    try {
      const res = await fetch('/api/dev/run-audit', { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        this.auditResults = json;
        if (typeof ToastNotification !== 'undefined') {
          ToastNotification.show(`System Audit Completed: ${json.overallStatus}`, json.overallStatus === 'PASS' ? 'success' : 'warning');
        }
      }
    } catch (e) {
      if (typeof ToastNotification !== 'undefined') {
        ToastNotification.show('Audit failed: ' + e.message, 'error');
      }
    } finally {
      this.isAuditing = false;
      this.fetchHealth(true);
      this.fetchTelemetry(true);
      this.render();
    }
  },

  async sendTestEmail() {
    if (this.isEmailing) return;
    this.isEmailing = true;
    this.render();

    try {
      const res = await fetch('/api/dev/send-test-email', { method: 'POST' });
      const json = await res.json();
      if (res.ok && json.success && (json.delivered || json.result?.delivered)) {
        document.getElementById('dev-email-creds-modal')?.remove();
        if (typeof ToastNotification !== 'undefined') {
          ToastNotification.show(json.message || '✅ Test email successfully dispatched to your inbox!', 'success', 6000);
        }
      } else {
        if (typeof ToastNotification !== 'undefined') {
          ToastNotification.show(json.message || '⚠️ Could not dispatch email. Check SMTP settings.', 'warning', 7000);
        }
      }
    } catch (e) {
      if (typeof ToastNotification !== 'undefined') {
        ToastNotification.show('Email test error: ' + e.message, 'error', 6000);
      }
    } finally {
      this.isEmailing = false;
      this.fetchHealth(true);
      this.fetchTelemetry(true);
      this.render();
    }
  },

  promptEmailCredentialsModal(errorReason = '') {
    const existing = document.getElementById('dev-email-creds-modal');
    if (existing) existing.remove();

    const curUser = this.healthData?.modules?.automationUptime?.emailService?.recipient || 'jaiadithya2020@gmail.com';

    const modalHtml = `
      <div id="dev-email-creds-modal" style="position: fixed; inset: 0; background: rgba(0,0,0,0.8); backdrop-filter: blur(5px); z-index: 99999; display: flex; align-items: center; justify-content: center; padding: 20px;">
        <div style="background: #181c27; border: 1px solid #3b82f6; border-radius: 12px; max-width: 520px; width: 100%; padding: 22px; box-shadow: 0 20px 50px rgba(0,0,0,0.8);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
            <div style="font-size: 15px; font-weight: 700; color: #fff; display: flex; align-items: center; gap: 8px;">
              <span>📧</span> Configure Gmail SMTP Delivery
            </div>
            <button onclick="document.getElementById('dev-email-creds-modal').remove()" style="background: none; border: none; color: #8896a8; font-size: 18px; cursor: pointer;">✕</button>
          </div>

          ${errorReason ? `
            <div style="background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.35); border-radius: 6px; padding: 10px; margin-bottom: 14px; font-size: 11.5px; color: #f59e0b; line-height: 1.4;">
              <strong>⚠️ Diagnostic Notice:</strong> ${errorReason}
            </div>
          ` : ''}

          <div style="background: rgba(59, 130, 246, 0.08); border: 1px solid rgba(59, 130, 246, 0.2); border-radius: 6px; padding: 10px; margin-bottom: 14px; font-size: 11.5px; color: #93c5fd; line-height: 1.4;">
            👉 <strong>Google Requirement:</strong> Gmail requires an <strong>App Password</strong> (16 characters), not your regular login password.<br>
            Generate one instantly at: <a href="https://myaccount.google.com/apppasswords" target="_blank" style="color: #60a5fa; font-weight: 700; text-decoration: underline;">myaccount.google.com/apppasswords</a>
          </div>

          <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px;">
            <div>
              <label style="font-size: 11px; color: #8896a8; font-weight: 600; display: block; margin-bottom: 4px;">GMAIL SENDER ADDRESS</label>
              <input id="devEmailInputUser" type="email" value="${curUser}" placeholder="e.g. yourname@gmail.com" style="width: 100%; background: #131722; border: 1px solid #2a2e39; border-radius: 6px; padding: 8px 10px; color: #fff; font-size: 12px; font-family: monospace; box-sizing: border-box;">
            </div>

            <div>
              <label style="font-size: 11px; color: #8896a8; font-weight: 600; display: block; margin-bottom: 4px;">16-CHAR GOOGLE APP PASSWORD</label>
              <input id="devEmailInputPass" type="password" placeholder="e.g. abcd efgh ijkl mnop" style="width: 100%; background: #131722; border: 1px solid #2a2e39; border-radius: 6px; padding: 8px 10px; color: #fff; font-size: 12px; font-family: monospace; box-sizing: border-box;">
              <span style="font-size: 10px; color: #64748b; margin-top: 2px; display: block;">Spaces are automatically trimmed.</span>
            </div>

            <div>
              <label style="font-size: 11px; color: #8896a8; font-weight: 600; display: block; margin-bottom: 4px;">RECIPIENT INBOX</label>
              <input id="devEmailInputTo" type="email" value="${curUser}" placeholder="e.g. yourname@gmail.com" style="width: 100%; background: #131722; border: 1px solid #2a2e39; border-radius: 6px; padding: 8px 10px; color: #fff; font-size: 12px; font-family: monospace; box-sizing: border-box;">
            </div>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 8px;">
            <button onclick="document.getElementById('dev-email-creds-modal').remove()" style="padding: 8px 14px; font-size: 11.5px; background: transparent; border: 1px solid #2a2e39; color: #8896a8; border-radius: 6px; cursor: pointer;">
              Cancel
            </button>
            <button onclick="DevDiagnosticsView.saveAndTestEmailCredentials()" style="padding: 8px 16px; font-size: 11.5px; font-weight: 700; background: #2563eb; color: #fff; border: none; border-radius: 6px; cursor: pointer;">
              💾 Save & Send Test Email
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
  },

  async saveAndTestEmailCredentials() {
    const user = document.getElementById('devEmailInputUser')?.value?.trim();
    const pass = document.getElementById('devEmailInputPass')?.value?.trim();
    const to = document.getElementById('devEmailInputTo')?.value?.trim();

    if (!user || !pass) {
      if (typeof ToastNotification !== 'undefined') {
        ToastNotification.show('Please provide both Gmail address and 16-character App Password.', 'error');
      }
      return;
    }

    try {
      const res = await fetch('/api/dev/save-email-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ smtpUser: user, smtpPass: pass, recipientEmail: to || user })
      });
      const json = await res.json();
      if (json.success) {
        document.getElementById('dev-email-creds-modal')?.remove();
        if (typeof ToastNotification !== 'undefined') {
          ToastNotification.show('Credentials saved! Dispatching test email...', 'info');
        }
        await this.sendTestEmail();
      } else {
        if (typeof ToastNotification !== 'undefined') {
          ToastNotification.show(json.message || 'Failed to save credentials', 'error');
        }
      }
    } catch (e) {
      if (typeof ToastNotification !== 'undefined') {
        ToastNotification.show('Error saving credentials: ' + e.message, 'error');
      }
    }
  },

  async reauthBroker() {
    if (this.isReauthing) return;
    this.isReauthing = true;
    this.render();

    try {
      const res = await fetch('/api/dev/reauth', { method: 'POST' });
      const json = await res.json();
      if (typeof ToastNotification !== 'undefined') {
        ToastNotification.show(json.message || 'Re-authentication complete', json.success ? 'success' : 'error');
      }
    } catch (e) {
      if (typeof ToastNotification !== 'undefined') {
        ToastNotification.show('Re-auth error: ' + e.message, 'error');
      }
    } finally {
      this.isReauthing = false;
      this.fetchHealth(true);
      this.fetchTelemetry(true);
      this.render();
    }
  },

  async forceEODSettlement() {
    if (this.isSettling) return;
    if (!confirm('Force trigger End-of-Day Settlement and Archival for testing now?')) return;
    
    this.isSettling = true;
    this.render();

    try {
      const res = await fetch('/api/dev/force-eod', { method: 'POST' });
      const json = await res.json();
      if (typeof ToastNotification !== 'undefined') {
        ToastNotification.show(json.message || 'EOD Settlement completed!', json.success ? 'success' : 'error');
      }
    } catch (e) {
      if (typeof ToastNotification !== 'undefined') {
        ToastNotification.show('EOD Settlement error: ' + e.message, 'error');
      }
    } finally {
      this.isSettling = false;
      this.fetchHealth(true);
      this.fetchTelemetry(true);
      this.render();
    }
  },

  async clearLogs() {
    try {
      await fetch('/api/dev/clear-logs', { method: 'POST' });
      this.telemetryLogs = [];
      this.renderTelemetryLogs();
    } catch (e) {}
  },

  setFilter(category) {
    this.activeFilter = category;
    this.renderTelemetryLogs();
  },

  togglePause() {
    this.isPaused = !this.isPaused;
    const btn = document.getElementById('devBtnPause');
    if (btn) {
      btn.innerText = this.isPaused ? '▶️ Resume Stream' : '⏸️ Pause Stream';
    }
  },

  render() {
    const container = document.getElementById('dev-diagnostics-view');
    if (!container) return;

    if (!this.healthData) {
      container.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 400px; color: #8896a8;">
          <div class="loading-spinner" style="width: 36px; height: 36px; margin-bottom: 16px;"></div>
          <div style="font-size: 14px; font-weight: 600;">Connecting to System Diagnostics Engine...</div>
        </div>
      `;
      this.init();
      return;
    }

    const { modules, istTime } = this.healthData;
    const { brokerAuth, marketData, strategyEngines, omsRisk, automationUptime } = modules;

    container.innerHTML = `
      <div class="dev-diagnostics-cockpit" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #d1d4dc;">
        
        <!-- TOP STATUS & CONTROLS BAR -->
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 18px; background: #131722; border: 1px solid #2a2e39; border-radius: 10px; margin-bottom: 14px; flex-wrap: wrap; gap: 12px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <span style="font-size: 20px;">🛠️</span>
            <div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 16px; font-weight: 800; color: #fff; letter-spacing: 0.5px;">DEV DIAGNOSTICS & SYSTEM TELEMETRY</span>
                <span style="font-size: 10.5px; padding: 2px 7px; border-radius: 4px; font-weight: 700; background: ${automationUptime.isRender ? 'rgba(0, 208, 132, 0.15)' : 'rgba(59, 130, 246, 0.15)'}; color: ${automationUptime.isRender ? '#00d084' : '#60a5fa'}; border: 1px solid ${automationUptime.isRender ? 'rgba(0, 208, 132, 0.3)' : 'rgba(59, 130, 246, 0.3)'};">
                  ${automationUptime.isRender ? '☁️ RENDER CLUSTER' : '💻 LOCAL DEV'}
                </span>
              </div>
              <div style="font-size: 11px; color: #8896a8; margin-top: 2px;">
                IST: <strong style="color: #fff;">${istTime}</strong> • Node: <strong style="color: #fff;">${automationUptime.nodeVersion}</strong> • Uptime: <strong style="color: #00d084;">${automationUptime.uptimeFormatted}</strong>
              </div>
            </div>
          </div>

          <!-- TOP ACTION CONTROLS -->
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <button onclick="DevDiagnosticsView.runFullAudit()" style="display: flex; align-items: center; gap: 6px; padding: 7px 14px; font-size: 11.5px; font-weight: 700; background: ${this.isAuditing ? '#2a2e39' : 'rgba(0, 208, 132, 0.15)'}; color: #00d084; border: 1px solid rgba(0, 208, 132, 0.4); border-radius: 6px; cursor: pointer;">
              ${this.isAuditing ? '⏳ Auditing...' : '⚡ Run Full System Audit'}
            </button>
            <button onclick="DevDiagnosticsView.sendTestEmail()" style="display: flex; align-items: center; gap: 6px; padding: 7px 14px; font-size: 11.5px; font-weight: 700; background: ${this.isEmailing ? '#2a2e39' : 'rgba(59, 130, 246, 0.15)'}; color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.4); border-radius: 6px; cursor: pointer;">
              ${this.isEmailing ? '⏳ Sending...' : '📧 Send Test Email'}
            </button>
            <button onclick="DevDiagnosticsView.reauthBroker()" style="display: flex; align-items: center; gap: 6px; padding: 7px 12px; font-size: 11.5px; font-weight: 700; background: rgba(245, 158, 11, 0.15); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.4); border-radius: 6px; cursor: pointer;">
              ${this.isReauthing ? '⏳ Auth...' : '🔄 Re-Auth Broker'}
            </button>
            <button onclick="DevDiagnosticsView.forceEODSettlement()" style="display: flex; align-items: center; gap: 6px; padding: 7px 12px; font-size: 11.5px; font-weight: 700; background: rgba(255, 255, 255, 0.08); color: #fff; border: 1px solid #2a2e39; border-radius: 6px; cursor: pointer;">
              ${this.isSettling ? '⏳ Settling...' : '📦 Test EOD Settlement'}
            </button>
          </div>
        </div>

        <!-- SYNTHETIC AUDIT MODAL BANNER (If audit ran) -->
        ${this.renderAuditBanner()}

        <!-- 6-MODULE BENTO GRID -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 14px; margin-bottom: 14px;">
          
          <!-- MODULE 1: BROKER & AUTH SENTINEL -->
          <div style="background: #181c27; border: 1px solid #2a2e39; border-radius: 10px; padding: 14px; display: flex; flex-direction: column; justify-content: space-between;">
            <div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <div style="display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; color: #fff;">
                  <span>🔐</span> Broker & Auth Health
                </div>
                <span style="font-size: 10.5px; padding: 2px 8px; border-radius: 12px; font-weight: 700; ${this.getPillStyle(brokerAuth.status)}">
                  ${brokerAuth.status === 'PASS' ? '🟢 AUTHENTICATED' : (brokerAuth.status === 'WARN' ? '🟡 CREDS DETECTED' : '🔴 DISCONNECTED')}
                </span>
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px; font-size: 11.5px;">
                <div style="background: #131722; padding: 8px; border-radius: 6px; border: 1px solid #2a2e39;">
                  <div style="color: #8896a8; font-size: 10px;">CLIENT ID</div>
                  <div style="font-weight: 700; color: #fff; font-family: monospace;">${brokerAuth.clientId}</div>
                </div>
                <div style="background: #131722; padding: 8px; border-radius: 6px; border: 1px solid #2a2e39;">
                  <div style="color: #8896a8; font-size: 10px;">AUTH MODE</div>
                  <div style="font-weight: 700; color: #00d084; font-size: 11px;">${brokerAuth.authMode}</div>
                </div>
              </div>

              <!-- ENVIRONMENT VARIABLES CHECK MATRIX -->
              <div style="background: #131722; padding: 10px; border-radius: 6px; border: 1px solid #2a2e39;">
                <div style="font-size: 10.5px; font-weight: 700; color: #8896a8; margin-bottom: 6px;">ENVIRONMENT SECRETS AUDIT</div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 11px; font-family: monospace;">
                  ${Object.entries(brokerAuth.envAudit).map(([k, present]) => `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 2px 4px;">
                      <span style="color: #8896a8;">${k}</span>
                      <span style="color: ${present ? '#00d084' : '#ef4444'}; font-weight: 700;">${present ? '✓ OK' : '✗ UNSET'}</span>
                    </div>
                  `).join('')}
                </div>
              </div>
            </div>
          </div>

          <!-- MODULE 2: LIVE MARKET DATA PIPELINE -->
          <div style="background: #181c27; border: 1px solid #2a2e39; border-radius: 10px; padding: 14px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
              <div style="display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; color: #fff;">
                <span>📡</span> Live Market Data Pipeline
              </div>
              <span style="font-size: 10.5px; padding: 2px 8px; border-radius: 12px; font-weight: 700; ${this.getPillStyle(marketData.status)}">
                ${marketData.feedSource === 'SMARTAPI_LIVE' ? '🟢 SMARTAPI LIVE' : '🟡 SIMULATED FEED'}
              </span>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px; font-size: 11.5px;">
              <div style="background: #131722; padding: 8px; border-radius: 6px; border: 1px solid #2a2e39;">
                <div style="color: #8896a8; font-size: 10px;">EXCHANGE SESSION</div>
                <div style="font-weight: 700; color: ${marketData.isMarketOpen ? '#00d084' : '#f59e0b'};">
                  ${marketData.isMarketOpen ? '🟢 OPEN (09:15 - 15:30)' : '🌙 CLOSED'}
                </div>
              </div>
              <div style="background: #131722; padding: 8px; border-radius: 6px; border: 1px solid #2a2e39;">
                <div style="color: #8896a8; font-size: 10px;">40-STOCKS BATCH</div>
                <div style="font-weight: 700; color: #fff; font-family: monospace;">
                  ${marketData.stocksBatch.totalStocks} Stocks (${marketData.stocksBatch.batchLatencyMs}ms)
                </div>
              </div>
            </div>

            <div style="background: #131722; padding: 10px; border-radius: 6px; border: 1px solid #2a2e39; font-size: 11.5px;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                <span style="color: #8896a8;">Put-Call Ratio (Raw PCR):</span>
                <strong style="color: #fff; font-family: monospace;">${marketData.pcrMetrics.rawPcr}</strong>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                <span style="color: #8896a8;">PCR Z-Score:</span>
                <strong style="color: ${marketData.pcrMetrics.pcrZScore >= 0 ? '#00d084' : '#ef4444'}; font-family: monospace;">${marketData.pcrMetrics.pcrZScore}</strong>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span style="color: #8896a8;">PCR Snapshots Today:</span>
                <strong style="color: #60a5fa; font-family: monospace;">${marketData.pcrMetrics.todaySnapshots} snapshots</strong>
              </div>
            </div>
          </div>

          <!-- MODULE 3: STRATEGY EXECUTION ENGINES -->
          <div style="background: #181c27; border: 1px solid #2a2e39; border-radius: 10px; padding: 14px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
              <div style="display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; color: #fff;">
                <span>⚙️</span> Strategy Engines Health
              </div>
              <span style="font-size: 10.5px; padding: 2px 8px; border-radius: 12px; font-weight: 700; ${this.getPillStyle(strategyEngines.status)}">
                ${strategyEngines.engineRunning ? '🟢 ENGINE ACTIVE (60s)' : '🔴 STOPPED'}
              </span>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px; font-size: 11.5px;">
              <div style="background: #131722; padding: 8px; border-radius: 6px; border: 1px solid #2a2e39;">
                <div style="color: #8896a8; font-size: 10px;">AUTO-EXECUTION</div>
                <div style="font-weight: 700; color: ${strategyEngines.autoExecutionEnabled ? '#00d084' : '#f59e0b'};">
                  ${strategyEngines.autoExecutionEnabled ? '⚡ ENABLED' : '⏸️ PAUSED'}
                </div>
              </div>
              <div style="background: #131722; padding: 8px; border-radius: 6px; border: 1px solid #2a2e39;">
                <div style="color: #8896a8; font-size: 10px;">KILL SWITCH</div>
                <div style="font-weight: 700; color: ${strategyEngines.killSwitchActive ? '#ef4444' : '#00d084'};">
                  ${strategyEngines.killSwitchActive ? '🚨 ARMED (HALTED)' : '🛡️ DISARMED (SAFE)'}
                </div>
              </div>
            </div>

            <div style="background: #131722; padding: 10px; border-radius: 6px; border: 1px solid #2a2e39; font-size: 11.5px;">
              <div style="font-size: 10.5px; color: #8896a8; margin-bottom: 6px;">40-STOCK UNIVERSE SIGNALS BREAKDOWN:</div>
              <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
                <div style="flex: 1; background: rgba(0, 208, 132, 0.1); padding: 6px; border-radius: 4px; text-align: center; border: 1px solid rgba(0, 208, 132, 0.2);">
                  <div style="color: #00d084; font-weight: 800; font-size: 14px;">${strategyEngines.signalDistribution.BUY_LONG}</div>
                  <div style="color: #8896a8; font-size: 9.5px;">BUY LONG</div>
                </div>
                <div style="flex: 1; background: rgba(239, 68, 68, 0.1); padding: 6px; border-radius: 4px; text-align: center; border: 1px solid rgba(239, 68, 68, 0.2);">
                  <div style="color: #ef4444; font-weight: 800; font-size: 14px;">${strategyEngines.signalDistribution.SELL_SHORT}</div>
                  <div style="color: #8896a8; font-size: 9.5px;">SELL SHORT</div>
                </div>
                <div style="flex: 1; background: rgba(255, 255, 255, 0.05); padding: 6px; border-radius: 4px; text-align: center; border: 1px solid #2a2e39;">
                  <div style="color: #fff; font-weight: 800; font-size: 14px;">${strategyEngines.signalDistribution.NEUTRAL_HOLD}</div>
                  <div style="color: #8896a8; font-size: 9.5px;">NEUTRAL</div>
                </div>
              </div>
            </div>
          </div>

          <!-- MODULE 4: OMS & RISK SAFETY GATES -->
          <div style="background: #181c27; border: 1px solid #2a2e39; border-radius: 10px; padding: 14px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
              <div style="display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; color: #fff;">
                <span>🛡️</span> OMS & Risk Safety Gates
              </div>
              <span style="font-size: 10.5px; padding: 2px 8px; border-radius: 12px; font-weight: 700; ${this.getPillStyle(omsRisk.status)}">
                🟢 RISK GATES ACTIVE
              </span>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px; font-size: 11.5px;">
              <div style="background: #131722; padding: 8px; border-radius: 6px; border: 1px solid #2a2e39;">
                <div style="color: #8896a8; font-size: 10px;">PORTFOLIO BALANCE</div>
                <div style="font-weight: 700; color: #fff; font-family: monospace;">₹${omsRisk.currentBalance.toLocaleString('en-IN')}</div>
              </div>
              <div style="background: #131722; padding: 8px; border-radius: 6px; border: 1px solid #2a2e39;">
                <div style="color: #8896a8; font-size: 10px;">TODAY'S NET P&L</div>
                <div style="font-weight: 700; color: ${omsRisk.realizedPnLToday >= 0 ? '#00d084' : '#ef4444'}; font-family: monospace;">
                  ${omsRisk.realizedPnLToday >= 0 ? '+' : ''}₹${omsRisk.realizedPnLToday.toFixed(2)}
                </div>
              </div>
            </div>

            <!-- DAILY LOSS LIMIT BAR -->
            <div style="background: #131722; padding: 10px; border-radius: 6px; border: 1px solid #2a2e39; font-size: 11px;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                <span style="color: #8896a8;">Daily Loss Gate (₹5,000 max):</span>
                <strong style="color: ${omsRisk.dailyLossUsage.percentUsed > 80 ? '#ef4444' : '#00d084'}; font-family: monospace;">
                  ₹${omsRisk.dailyLossUsage.currentLoss} / ₹${omsRisk.dailyLossUsage.maxDailyLoss} (${omsRisk.dailyLossUsage.percentUsed}%)
                </strong>
              </div>
              <div style="height: 5px; background: #2a2e39; border-radius: 3px; overflow: hidden;">
                <div style="height: 100%; width: ${Math.min(100, omsRisk.dailyLossUsage.percentUsed)}%; background: ${omsRisk.dailyLossUsage.percentUsed > 80 ? '#ef4444' : '#00d084'};"></div>
              </div>
              <div style="display: flex; justify-content: space-between; margin-top: 6px; color: #8896a8;">
                <span>Active Slots: <strong style="color: #fff;">${omsRisk.openPositionsCount} / ${omsRisk.maxOpenPositionsLimit}</strong></span>
                <span>Trades Executed: <strong style="color: #fff;">${omsRisk.completedTradesToday} (${omsRisk.winRateToday} Win)</strong></span>
              </div>
            </div>
          </div>

          <!-- MODULE 5: AUTOMATION & CRONS -->
          <div style="background: #181c27; border: 1px solid #2a2e39; border-radius: 10px; padding: 14px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
              <div style="display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; color: #fff;">
                <span>⏰</span> Automation & Uptime Health
              </div>
              <span style="font-size: 10.5px; padding: 2px 8px; border-radius: 12px; font-weight: 700; ${this.getPillStyle(automationUptime.status)}">
                🟢 UP (${automationUptime.uptimeFormatted})
              </span>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px; font-size: 11.5px;">
              <div style="background: #131722; padding: 8px; border-radius: 6px; border: 1px solid #2a2e39;">
                <div style="color: #8896a8; font-size: 10px;">MEMORY FOOTPRINT</div>
                <div style="font-weight: 700; color: #fff; font-family: monospace;">
                  ${automationUptime.memory.heapUsedMB} MB / ${automationUptime.memory.rssMB} MB RSS
                </div>
              </div>
              <div style="background: #131722; padding: 8px; border-radius: 6px; border: 1px solid #2a2e39;">
                <div style="color: #8896a8; font-size: 10px;">DAILY ARCHIVES</div>
                <div style="font-weight: 700; color: #60a5fa; font-family: monospace;">
                  ${automationUptime.archiver.totalArchiveFiles} files archived
                </div>
              </div>
            </div>

            <!-- EMAIL SERVICE STATUS -->
            <div style="background: #131722; padding: 10px; border-radius: 6px; border: 1px solid #2a2e39; font-size: 11.5px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <span style="color: #8896a8;">SMTP Server:</span>
                <strong style="color: #fff; font-family: monospace;">${automationUptime.emailService.smtpHost}</strong>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <span style="color: #8896a8;">Recipient Inbox:</span>
                <strong style="color: #60a5fa; font-family: monospace;">${automationUptime.emailService.recipient}</strong>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span style="color: #8896a8;">SMTP Auth Configured:</span>
                <span style="color: ${automationUptime.emailService.configured ? '#00d084' : '#f59e0b'}; font-weight: 700;">
                  ${automationUptime.emailService.configured ? '✓ READY' : '⚠️ UNSET IN ENV'}
                </span>
              </div>
              <button onclick="DevDiagnosticsView.promptEmailCredentialsModal()" style="width: 100%; padding: 6px; font-size: 11px; font-weight: 700; background: rgba(59, 130, 246, 0.12); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3); border-radius: 4px; cursor: pointer;">
                ⚙️ Configure Gmail Credentials
              </button>
            </div>
          </div>

          <!-- MODULE 6: QUICK ACTION DIAGNOSTIC TESTBENCH -->
          <div style="background: #181c27; border: 1px solid #2a2e39; border-radius: 10px; padding: 14px; display: flex; flex-direction: column; justify-content: space-between;">
            <div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <div style="display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; color: #fff;">
                  <span>🧪</span> 1-Click Interactive Testbench
                </div>
                <span style="font-size: 10.5px; padding: 2px 8px; border-radius: 12px; font-weight: 700; background: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3);">
                  READY
                </span>
              </div>
              <p style="font-size: 11.5px; color: #8896a8; margin-bottom: 12px; line-height: 1.4;">
                Execute synthetic tests on demand to verify live pipelines, force EOD settlement, test Gmail delivery, or trigger broker re-authentication.
              </p>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
              <button onclick="DevDiagnosticsView.runFullAudit()" style="padding: 8px; font-size: 11px; font-weight: 700; background: rgba(0, 208, 132, 0.12); color: #00d084; border: 1px solid rgba(0, 208, 132, 0.3); border-radius: 6px; cursor: pointer;">
                ⚡ Full Audit
              </button>
              <button onclick="DevDiagnosticsView.sendTestEmail()" style="padding: 8px; font-size: 11px; font-weight: 700; background: rgba(59, 130, 246, 0.12); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3); border-radius: 6px; cursor: pointer;">
                📧 Test Email
              </button>
              <button onclick="DevDiagnosticsView.reauthBroker()" style="padding: 8px; font-size: 11px; font-weight: 700; background: rgba(245, 158, 11, 0.12); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 6px; cursor: pointer;">
                🔄 Re-Auth
              </button>
              <button onclick="DevDiagnosticsView.fetchHealth()" style="padding: 8px; font-size: 11px; font-weight: 700; background: rgba(255, 255, 255, 0.06); color: #fff; border: 1px solid #2a2e39; border-radius: 6px; cursor: pointer;">
                🔄 Refresh
              </button>
            </div>
          </div>

        </div>

        <!-- MODULE 7: LIVE TELEMETRY & EVENT STREAM -->
        <div style="background: #131722; border: 1px solid #2a2e39; border-radius: 10px; padding: 14px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-wrap: wrap; gap: 8px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 14px;">📜</span>
              <span style="font-size: 13px; font-weight: 700; color: #fff;">LIVE BACKEND TELEMETRY & EVENT STREAM</span>
              <span style="font-size: 10.5px; color: #8896a8;">(Last 60 in-memory events)</span>
            </div>

            <!-- FILTER BUTTONS -->
            <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
              ${['ALL', 'AUTH', 'MARKET', 'SIGNAL', 'TRADE', 'EMAIL', 'SYSTEM'].map(cat => `
                <button onclick="DevDiagnosticsView.setFilter('${cat}')" style="padding: 3px 8px; font-size: 10.5px; font-weight: 700; border-radius: 4px; border: 1px solid ${this.activeFilter === cat ? '#00d084' : '#2a2e39'}; background: ${this.activeFilter === cat ? 'rgba(0, 208, 132, 0.2)' : 'transparent'}; color: ${this.activeFilter === cat ? '#00d084' : '#8896a8'}; cursor: pointer;">
                  ${cat}
                </button>
              `).join('')}
              <button id="devBtnPause" onclick="DevDiagnosticsView.togglePause()" style="padding: 3px 8px; font-size: 10.5px; border-radius: 4px; border: 1px solid #2a2e39; background: transparent; color: #8896a8; cursor: pointer;">
                ${this.isPaused ? '▶️ Resume' : '⏸️ Pause'}
              </button>
              <button onclick="DevDiagnosticsView.clearLogs()" style="padding: 3px 8px; font-size: 10.5px; border-radius: 4px; border: 1px solid #2a2e39; background: transparent; color: #ef4444; cursor: pointer;">
                🧹 Clear
              </button>
            </div>
          </div>

          <!-- LOGS TERMINAL CONTAINER -->
          <div id="devTelemetryLogsContainer" style="background: #090b10; border: 1px solid #1f2430; border-radius: 6px; padding: 10px; max-height: 240px; overflow-y: auto; font-family: 'JetBrains Mono', monospace; font-size: 11px;">
            ${this.renderLogRows()}
          </div>
        </div>

      </div>
    `;
  },

  renderAuditBanner() {
    if (!this.auditResults) return '';

    const { overallStatus, overallDurationMs, tests } = this.auditResults;
    const isPass = overallStatus === 'PASS';

    return `
      <div style="background: ${isPass ? 'rgba(0, 208, 132, 0.08)' : 'rgba(245, 158, 11, 0.08)'}; border: 1px solid ${isPass ? 'rgba(0, 208, 132, 0.3)' : 'rgba(245, 158, 11, 0.3)'}; border-radius: 10px; padding: 14px; margin-bottom: 14px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 16px;">${isPass ? '✅' : '⚠️'}</span>
            <span style="font-weight: 800; font-size: 13px; color: ${isPass ? '#00d084' : '#f59e0b'};">
              SYNTHETIC HEALTH AUDIT REPORT: ${overallStatus} (${overallDurationMs}ms total)
            </span>
          </div>
          <button onclick="DevDiagnosticsView.auditResults = null; DevDiagnosticsView.render();" style="background: transparent; border: none; color: #8896a8; cursor: pointer; font-size: 14px;">✕</button>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 8px;">
          ${tests.map(t => `
            <div style="background: #131722; padding: 8px 10px; border-radius: 6px; border: 1px solid #2a2e39; font-size: 11.5px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px;">
                <span style="font-weight: 700; color: #fff;">${t.name}</span>
                <span style="font-size: 10px; font-weight: 800; ${this.getPillStyle(t.status)} padding: 1px 6px; border-radius: 4px;">
                  ${t.status} (${t.durationMs}ms)
                </span>
              </div>
              <div style="color: #8896a8; font-size: 10.5px;">${t.message}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  },

  renderLogRows() {
    if (!this.telemetryLogs || this.telemetryLogs.length === 0) {
      return `<div style="color: #8896a8; text-align: center; padding: 20px;">No telemetry events in ring buffer. Trigger an action to stream events.</div>`;
    }

    const filtered = this.activeFilter === 'ALL'
      ? this.telemetryLogs
      : this.telemetryLogs.filter(l => l.category === this.activeFilter);

    if (filtered.length === 0) {
      return `<div style="color: #8896a8; text-align: center; padding: 20px;">No events matching filter '${this.activeFilter}'.</div>`;
    }

    return filtered.map(l => {
      let lvlColor = '#8896a8';
      if (l.level === 'SUCCESS') lvlColor = '#00d084';
      else if (l.level === 'WARN') lvlColor = '#f59e0b';
      else if (l.level === 'ERROR') lvlColor = '#ef4444';
      else if (l.level === 'INFO') lvlColor = '#60a5fa';

      return `
        <div style="display: flex; gap: 8px; padding: 3px 0; border-bottom: 1px solid rgba(255,255,255,0.03);">
          <span style="color: #55657e;">[${l.istTime}]</span>
          <span style="color: #eab308; min-width: 55px;">[${l.category}]</span>
          <span style="color: ${lvlColor}; min-width: 60px;">${l.level}</span>
          <span style="color: #d1d4dc; flex: 1;">${l.message}</span>
        </div>
      `;
    }).join('');
  },

  renderTelemetryLogs() {
    const el = document.getElementById('devTelemetryLogsContainer');
    if (el) {
      el.innerHTML = this.renderLogRows();
    }
  },

  updateDynamicValues() {
    // If user is currently looking at dev tab, refresh live text
    this.render();
  },

  getPillStyle(status) {
    if (status === 'PASS') {
      return 'background: rgba(0, 208, 132, 0.15); color: #00d084; border: 1px solid rgba(0, 208, 132, 0.3);';
    } else if (status === 'WARN') {
      return 'background: rgba(245, 158, 11, 0.15); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.3);';
    } else if (status === 'FAIL') {
      return 'background: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3);';
    }
    return 'background: rgba(255, 255, 255, 0.08); color: #8896a8; border: 1px solid #2a2e39;';
  }
};

window.DevDiagnosticsView = DevDiagnosticsView;
