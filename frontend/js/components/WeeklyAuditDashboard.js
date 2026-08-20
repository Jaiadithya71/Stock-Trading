// ============================================================================
// FILE: frontend/js/components/WeeklyAuditDashboard.js
// Weekend Simulation Review Dashboard Component
// Displays BOTH Executed Trade Actions AND 375-Minute Daily Signal Telemetry Audit Logs
// 1-Click CSV & JSON Export for both Trade Actions and Minute-by-Minute Telemetry
// ============================================================================

const WeeklyAuditDashboard = {
  formatIST(dateString) {
    try {
      const d = new Date(dateString);
      return d.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
    } catch (e) {
      return dateString;
    }
  },

  async render() {
    const container = document.getElementById('weekly-audit-dashboard');
    if (!container) return;

    try {
      // 1. Fetch Weekly Executed Trade Actions Log
      const res = await fetch('/api/paper/weekly-audit');
      const json = await res.json();
      const auditData = json.data || {};
      const summary = auditData.weeklySummary || {};
      const trades = auditData.trades || [];

      // 2. Fetch Minute-by-Minute Signal Telemetry Log for Today
      let minuteTelemetryEntries = [];
      const telemetryLogs = (resTelemetry && resTelemetry.data && Array.isArray(resTelemetry.data)) ? resTelemetry.data : (signalAuditLog || []);

      const pnlClass = (summary.netRealizedPnL || 0) >= 0 ? 'text-green' : 'text-red';

      container.innerHTML = `
        <div class="weekly-audit-wrapper" style="padding: 20px; color: #f8fafc; font-family: 'Inter', sans-serif;">
          <!-- HEADER -->
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; background: rgba(30, 41, 59, 0.8); backdrop-filter: blur(16px); padding: 20px; border-radius: 16px; border: 1px solid rgba(255, 255, 255, 0.12); flex-wrap: wrap; gap: 16px;">
            <div style="display: flex; align-items: center; gap: 14px;">
              <span style="font-size: 32px;">📅</span>
              <div>
                <h2 style="margin: 0; font-size: 22px; background: linear-gradient(135deg, #60a5fa, #34d399); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">Simulation Audit & Strategy Telemetry Review</h2>
                <p style="margin: 4px 0 0 0; color: #94a3b8; font-size: 13px;">Minute-by-minute autonomous market evaluation stream, trade executions, and performance telemetry (IST)</p>
              </div>
            </div>

            <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
              <button class="btn btn-trade" onclick="WeeklyAuditDashboard.downloadCSV()">📥 Export Trades (CSV)</button>
              <button class="btn btn-trade" onclick="window.open('/api/quant/signal-audit/download?range=today&format=csv', '_blank')">📥 Export 1-Min Telemetry (CSV)</button>
              <button class="btn btn-trade" onclick="WeeklyAuditDashboard.render()">🔄 Refresh</button>
            </div>
          </div>

          <!-- WEEKLY PERFORMANCE HERO CARDS -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px;">
            <div style="background: rgba(30, 41, 59, 0.75); border: 1px solid rgba(255,255,255,0.1); border-radius: 14px; padding: 18px;">
              <span style="font-size: 12px; color: #94a3b8; text-transform: uppercase;">Weekly Win Rate</span>
              <div style="font-size: 26px; font-weight: 700; color: #10b981; margin-top: 4px;">${summary.winRatePct || 0}%</div>
              <span style="font-size: 11px; color: #64748b;">${summary.winningTrades || 0} Wins / ${summary.losingTrades || 0} Losses</span>
            </div>

            <div style="background: rgba(30, 41, 59, 0.75); border: 1px solid rgba(255,255,255,0.1); border-radius: 14px; padding: 18px;">
              <span style="font-size: 12px; color: #94a3b8; text-transform: uppercase;">Net Realized P&L</span>
              <div style="font-size: 26px; font-weight: 700; margin-top: 4px;" class="${pnlClass}">₹${(summary.netRealizedPnL || 0).toFixed(2)}</div>
              <span style="font-size: 11px; color: #64748b;">Simulated Paper OMS Fills</span>
            </div>

            <div style="background: rgba(30, 41, 59, 0.75); border: 1px solid rgba(255,255,255,0.1); border-radius: 14px; padding: 18px;">
              <span style="font-size: 12px; color: #94a3b8; text-transform: uppercase;">1-Min Telemetry Snapshots</span>
              <div style="font-size: 26px; font-weight: 700; color: #38bdf8; margin-top: 4px;">${telemetryLogs.length}</div>
              <span style="font-size: 11px; color: #64748b;">Autonomous 60s Stream</span>
            </div>

            <div style="background: rgba(30, 41, 59, 0.75); border: 1px solid rgba(255,255,255,0.1); border-radius: 14px; padding: 18px;">
              <span style="font-size: 12px; color: #94a3b8; text-transform: uppercase;">Max Drawdown</span>
              <div style="font-size: 26px; font-weight: 700; color: #f59e0b; margin-top: 4px;">-${summary.maxDrawdownPct || 0}%</div>
              <span style="font-size: 11px; color: #64748b;">Quarter-Kelly Guarded</span>
            </div>
          </div>

          <!-- SECTION 1: LIVE 1-MINUTE TELEMETRY LEDGER -->
          <div style="background: rgba(30, 41, 59, 0.75); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 16px; padding: 20px; margin-bottom: 24px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 12px;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <h3 style="margin: 0; font-size: 16px; color: #38bdf8;">⏱️ 1-Minute Live Signal Telemetry Ledger</h3>
                <span style="background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); color: #10b981; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 700;">🟢 AUTO-REFRESHING (EVERY 60s)</span>
                <span style="color: #94a3b8; font-size: 12px;">${telemetryLogs.length} Snapshots Today</span>
              </div>
            </div>

            ${telemetryLogs.length === 0 ? `
              <div style="padding: 24px; text-align: center; color: #94a3b8;">
                <span>ℹ️ Telemetry ledger loading. Snapshots evaluate and stream here automatically every 60 seconds.</span>
              </div>
            ` : `
              <div style="max-height: 380px; overflow-y: auto; overflow-x: auto; border: 1px solid rgba(255,255,255,0.06); border-radius: 8px;">
                <table style="width: 100%; border-collapse: collapse; font-size: 12px; text-align: left;">
                  <thead style="position: sticky; top: 0; background: #0f172a; z-index: 10;">
                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.12); color: #94a3b8;">
                      <th style="padding: 10px 12px;">Time (IST)</th>
                      <th style="padding: 10px 12px;">Spot Price</th>
                      <th style="padding: 10px 12px;">ATM Strike</th>
                      <th style="padding: 10px 12px;">Raw PCR / Z-Score</th>
                      <th style="padding: 10px 12px;">Banking Breadth</th>
                      <th style="padding: 10px 12px;">Evaluated Signal</th>
                      <th style="padding: 10px 12px;">Confluence Rationale</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${[...telemetryLogs].reverse().map(e => {
                      const isBuyCE = e.signal === 'BUY_CALL_CE';
                      const isBuyPE = e.signal === 'BUY_PUT_PE';
                      const badge = isBuyCE ?
                        '<span style="background: rgba(16, 185, 129, 0.2); color: #10b981; padding: 2px 8px; border-radius: 4px; font-weight: 700;">🟢 BUY CE</span>' :
                        isBuyPE ?
                        '<span style="background: rgba(239, 68, 68, 0.2); color: #ef4444; padding: 2px 8px; border-radius: 4px; font-weight: 700;">🔻 BUY PE</span>' :
                        '<span style="background: rgba(234, 179, 8, 0.15); color: #eab308; padding: 2px 8px; border-radius: 4px; font-weight: 600;">🟡 HOLD</span>';
                      
                      return `
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.04);">
                          <td style="padding: 8px 12px; color: #94a3b8; white-space: nowrap;">${e.timeIST || ''}</td>
                          <td style="padding: 8px 12px; font-weight: 600; color: #f8fafc;">₹${(e.spotPrice || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                          <td style="padding: 8px 12px; color: #cbd5e1;">₹${e.atmStrike || 0}</td>
                          <td style="padding: 8px 12px; color: #cbd5e1;">${e.rawPcr || 0} <span style="font-size: 11px; color: #64748b;">(Z: ${e.pcrZScore !== undefined ? e.pcrZScore : 0})</span></td>
                          <td style="padding: 8px 12px; font-size: 11px; color: #94a3b8;">Adv ${e.advancingWeight || 0}% / Dec ${e.decliningWeight || 0}%</td>
                          <td style="padding: 8px 12px; white-space: nowrap;">${badge} <span style="font-size: 11px; color: #64748b;">${e.confidenceScore || ''}</span></td>
                          <td style="padding: 8px 12px; color: #38bdf8; font-size: 11px; max-width: 320px; line-height: 1.3;">${e.signalRationale || ''}</td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              </div>
            `}
          </div>

          <!-- SECTION 2: EXECUTED TRADES TABLE -->
          <div style="background: rgba(30, 41, 59, 0.75); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 16px; padding: 20px;">
            <h3 style="margin: 0 0 16px 0; font-size: 16px; color: #38bdf8;">📜 Complete Weekly Trade Execution & P&L Audit Log</h3>

            ${trades.length === 0 ? `
                <span style="font-size: 24px; display: block; margin-bottom: 8px;">ℹ️</span>
                <span style="font-weight: 600; font-size: 14px;">No Executed Trade Actions Logged Yet</span>
                <p style="margin: 6px 0 0 0; font-size: 12px; color: #64748b;">The signal engine stayed in NEUTRAL_HOLD mode to preserve capital. No paper trade actions were executed today.</p>
              </div>
            ` : `
              <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                  <thead>
                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.1); color: #94a3b8; text-align: left;">
                      <th style="padding: 10px;">Timestamp (IST)</th>
                      <th style="padding: 10px;">Symbol / Contract</th>
                      <th style="padding: 10px;">Type</th>
                      <th style="padding: 10px;">Entry</th>
                      <th style="padding: 10px;">Exit</th>
                      <th style="padding: 10px;">Qty</th>
                      <th style="padding: 10px;">Realized P&L</th>
                      <th style="padding: 10px;">Status</th>
                      <th style="padding: 10px; min-width: 200px;">Signal Trigger Rationale</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${trades.map(t => {
                      const tradePnlClass = (t.pnl || 0) >= 0 ? 'text-green' : 'text-red';
                      return `
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                          <td style="padding: 10px; color: #cbd5e1; white-space: nowrap;">${WeeklyAuditDashboard.formatIST(t.timestamp)}</td>
                          <td style="padding: 10px; font-weight: 700; color: #38bdf8;">${t.symbol}</td>
                          <td style="padding: 10px;">
                            <span style="padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; background: ${t.optionType === 'CE' ? 'rgba(16,185,129,0.2); color: #10b981;' : 'rgba(239,68,68,0.2); color: #ef4444;'}">
                              ${t.optionType}
                            </span>
                          </td>
                          <td style="padding: 10px;">₹${t.entryPrice}</td>
                          <td style="padding: 10px;">${t.exitPrice ? `₹${t.exitPrice}` : 'OPEN'}</td>
                          <td style="padding: 10px;">${t.quantity}</td>
                          <td style="padding: 10px; font-weight: 700;" class="${tradePnlClass}">
                            ${(t.pnl || 0) >= 0 ? '+' : ''}₹${(t.pnl || 0).toFixed(2)}
                          </td>
                          <td style="padding: 10px;">
                            <span style="padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 700; background: rgba(255,255,255,0.1); color: #94a3b8;">
                              ${t.status}
                            </span>
                          </td>
                          <td style="padding: 10px; color: #38bdf8; font-size: 12px;">${t.rationale}</td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              </div>
            `}
          </div>

          <!-- SECTION 2: 375-MINUTE DAILY SIGNAL TELEMETRY AUDIT LOG -->
          <div style="background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; padding: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 12px;">
              <div>
                <h3 style="margin: 0; font-size: 17px; color: #38bdf8;">📡 1-Minute Market Signal Telemetry Audit Log</h3>
                <p style="margin: 4px 0 0 0; color: #94a3b8; font-size: 12px;">Every 1-minute market snapshot evaluated today (${minuteTelemetryEntries.length} snapshots recorded)</p>
              </div>

              <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                <button class="btn btn-trade" onclick="WeeklyAuditDashboard.downloadTelemetry('today', 'csv')" style="background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); font-weight: 700; font-size: 11px; padding: 6px 12px;" title="Download today's 1-minute telemetry snapshots">
                  📥 Today (CSV)
                </button>
                <button class="btn btn-trade" onclick="WeeklyAuditDashboard.downloadTelemetry('7d', 'csv')" style="background: linear-gradient(135deg, #059669 0%, #047857 100%); font-weight: 700; font-size: 11px; padding: 6px 12px;" title="Download complete 7-day weekly telemetry bundle">
                  📥 7-Day Weekly Bundle (CSV)
                </button>
                <button class="btn btn-trade" onclick="WeeklyAuditDashboard.downloadTelemetry('all', 'csv')" style="background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); font-weight: 700; font-size: 11px; padding: 6px 12px;" title="Download all available historical telemetry (up to 30 days)">
                  📥 Full 30-Day Archive (CSV)
                </button>
              </div>
            </div>

            ${minuteTelemetryEntries.length === 0 ? `
              <div style="padding: 28px; text-align: center; color: #94a3b8; background: rgba(15, 23, 42, 0.5); border-radius: 12px; border: 1px dashed rgba(255, 255, 255, 0.15);">
                <span style="font-size: 20px; display: block; margin-bottom: 6px;">📡</span>
                <span style="font-weight: 600; font-size: 13px;">1-Minute Signal Telemetry Accumulating...</span>
                <p style="margin: 4px 0 0 0; font-size: 12px; color: #64748b;">Minute-by-minute market evaluation snapshots will appear here as live signal queries run.</p>
              </div>
            ` : `
              ${minuteTelemetryEntries.length > 150 ? `
                <div style="padding: 8px 14px; margin-bottom: 12px; background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.25); border-radius: 8px; font-size: 12px; color: #38bdf8; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
                  <span>ℹ️ Showing newest <strong>150 of ${minuteTelemetryEntries.length}</strong> snapshots</span>
                  <span style="color: #94a3b8; font-size: 11px;">Download the CSV spreadsheets above to inspect the complete 375+ minute dataset.</span>
                </div>
              ` : ''}
              <div style="overflow-x: auto; max-height: 420px; overflow-y: auto;">
                <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                  <thead>
                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.1); color: #94a3b8; text-align: left; position: sticky; top: 0; background: #0f172a;">
                      <th style="padding: 10px;">Time (IST)</th>
                      <th style="padding: 10px;">Spot Price</th>
                      <th style="padding: 10px;">ATM Strike</th>
                      <th style="padding: 10px;">Raw PCR</th>
                      <th style="padding: 10px;">PCR Z-Score</th>
                      <th style="padding: 10px;">Banking Breadth</th>
                      <th style="padding: 10px;">Signal Output</th>
                      <th style="padding: 10px; min-width: 260px;">Market Confluence Rationale</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${minuteTelemetryEntries.slice(0, 150).map(e => `
                      <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                        <td style="padding: 8px 10px; color: #cbd5e1; white-space: nowrap;">${e.timeIST || 'N/A'}</td>
                        <td style="padding: 8px 10px; font-weight: 600;">₹${e.spotPrice}</td>
                        <td style="padding: 8px 10px;">₹${e.atmStrike}</td>
                        <td style="padding: 8px 10px;">${e.rawPcr}</td>
                        <td style="padding: 8px 10px;" class="${e.pcrZScore <= -1.2 ? 'text-green' : e.pcrZScore >= 1.2 ? 'text-red' : ''}">${e.pcrZScore}</td>
                        <td style="padding: 8px 10px;">Adv ${e.advancingWeight}% / Dec ${e.decliningWeight}%</td>
                        <td style="padding: 8px 10px;">
                          <span style="padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 800; background: ${e.signal === 'BUY_CALL_CE' ? 'rgba(16,185,129,0.2); color: #10b981;' : e.signal === 'BUY_PUT_PE' ? 'rgba(239,68,68,0.2); color: #ef4444;' : 'rgba(255,255,255,0.1); color: #94a3b8;'}">
                            ${e.signal}
                          </span>
                        </td>
                        <td style="padding: 8px 10px; color: #38bdf8; font-size: 11px;">${e.signalRationale}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            `}
          </div>
        </div>
      `;
    } catch (error) {
      console.error('❌ Error rendering WeeklyAuditDashboard:', error);
      container.innerHTML = `<div style="padding: 24px; color: #ef4444;">Failed to load weekly audit log: ${error.message}</div>`;
    }
  },

  downloadCSV() {
    window.open('/api/paper/weekly-audit/download?format=csv', '_blank');
  },

  downloadJSON() {
    window.open('/api/paper/weekly-audit/download?format=json', '_blank');
  },

  downloadTelemetry(range = '7d', format = 'csv') {
    window.open(`/api/quant/signal-audit/download?range=${range}&format=${format}`, '_blank');
  },

  downloadTelemetryCSV() {
    this.downloadTelemetry('7d', 'csv');
  },

  downloadTelemetryJSON() {
    this.downloadTelemetry('7d', 'json');
  }
};
