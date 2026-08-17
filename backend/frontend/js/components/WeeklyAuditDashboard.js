// ============================================================================
// FILE: frontend/js/components/WeeklyAuditDashboard.js
// Weekend Simulation Review Dashboard Component
// Displays explicit trade actions, dynamic strikes, P&L, and Signal Trigger Confluence Rationale
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
      const res = await fetch('/api/paper/weekly-audit');
      const json = await res.json();
      const auditData = json.data || {};
      const summary = auditData.weeklySummary || {};
      const trades = auditData.trades || [];

      const pnlClass = (summary.netRealizedPnL || 0) >= 0 ? 'text-green' : 'text-red';

      container.innerHTML = `
        <div class="weekly-audit-wrapper" style="padding: 20px; color: #f8fafc; font-family: 'Inter', sans-serif;">
          <!-- HEADER -->
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; background: rgba(30, 41, 59, 0.8); backdrop-filter: blur(16px); padding: 20px; border-radius: 16px; border: 1px solid rgba(255, 255, 255, 0.12); flex-wrap: wrap; gap: 16px;">
            <div style="display: flex; align-items: center; gap: 14px;">
              <span style="font-size: 32px;">📅</span>
              <div>
                <h2 style="margin: 0; font-size: 22px; background: linear-gradient(135deg, #60a5fa, #34d399); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">Weekend Simulation Audit & Performance Review</h2>
                <p style="margin: 4px 0 0 0; color: #94a3b8; font-size: 13px;">Automated 7-day telemetry log tracking signals, trade actions, market trigger scenarios, and P&L outcomes (IST Timezone)</p>
              </div>
            </div>

            <div style="display: flex; align-items: center; gap: 10px;">
              <button class="btn btn-trade" onclick="WeeklyAuditDashboard.downloadCSV()">📥 Download CSV</button>
              <button class="btn btn-trade" onclick="WeeklyAuditDashboard.downloadJSON()">📥 Download JSON</button>
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
              <span style="font-size: 12px; color: #94a3b8; text-transform: uppercase;">Total Signals Evaluated</span>
              <div style="font-size: 26px; font-weight: 700; color: #3b82f6; margin-top: 4px;">${summary.totalSignalsGenerated || 0}</div>
              <span style="font-size: 11px; color: #64748b;">1-Min PCR + Fib Telemetry</span>
            </div>

            <div style="background: rgba(30, 41, 59, 0.75); border: 1px solid rgba(255,255,255,0.1); border-radius: 14px; padding: 18px;">
              <span style="font-size: 12px; color: #94a3b8; text-transform: uppercase;">Max Drawdown</span>
              <div style="font-size: 26px; font-weight: 700; color: #f59e0b; margin-top: 4px;">-${summary.maxDrawdownPct || 0}%</div>
              <span style="font-size: 11px; color: #64748b;">Quarter-Kelly Guarded</span>
            </div>
          </div>

          <!-- TRADE LOG TABLE -->
          <div style="background: rgba(30, 41, 59, 0.75); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 16px; padding: 20px;">
            <h3 style="margin: 0 0 16px 0; font-size: 16px; color: #38bdf8;">📜 Complete Weekly Execution Audit & Signal Confluence Rationale Log</h3>

            ${trades.length === 0 ? `
              <div style="padding: 30px; text-align: center; color: #94a3b8;">
                <span>ℹ️ No executed trades logged for the current 7-day period yet. Paper trade fills will accumulate here automatically for weekend performance reviews.</span>
              </div>
            ` : `
              <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                  <thead>
                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.1); color: #94a3b8; text-align: left;">
                      <th style="padding: 10px;">Timestamp (IST)</th>
                      <th style="padding: 10px;">Action</th>
                      <th style="padding: 10px;">Strike</th>
                      <th style="padding: 10px;">Entry</th>
                      <th style="padding: 10px;">Exit</th>
                      <th style="padding: 10px;">P&L (₹)</th>
                      <th style="padding: 10px; min-width: 280px;">Signal Trigger Scenario & Confluence Rationale</th>
                      <th style="padding: 10px;">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${trades.map(t => {
                      const isCall = t.optionType === 'CE';
                      const actionBadge = isCall ?
                        '<span class="badge badge-bullish" style="padding: 4px 8px; font-weight: 700;">🟢 BUY CE</span>' :
                        '<span class="badge badge-bearish" style="padding: 4px 8px; font-weight: 700;">🔻 BUY PE</span>';
                      const pnlVal = t.pnl || 0;
                      const tradePnlClass = pnlVal >= 0 ? 'text-green' : 'text-red';
                      const triggerScenario = t.rationale || 'Fib 0.618 Support + PCR Z-Score Confluence';

                      return `
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                          <td style="padding: 10px; color: #94a3b8; font-size: 12px; white-space: nowrap;">${this.formatIST(t.timestamp)}</td>
                          <td style="padding: 10px; white-space: nowrap;">${actionBadge}</td>
                          <td style="padding: 10px; font-weight: 600;">₹${t.strikePrice}</td>
                          <td style="padding: 10px; color: #cbd5e1;">₹${t.entryPrice}</td>
                          <td style="padding: 10px; color: #cbd5e1;">${t.exitPrice ? '₹' + t.exitPrice : 'OPEN'}</td>
                          <td style="padding: 10px; font-weight: 700;" class="${tradePnlClass}">₹${pnlVal.toFixed(2)}</td>
                          <td style="padding: 10px; color: #38bdf8; font-size: 12px; line-height: 1.4;">${triggerScenario}</td>
                          <td style="padding: 10px;"><span style="background: rgba(16,185,129,0.15); color: #10b981; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700;">${t.status}</span></td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              </div>
            `}
          </div>
        </div>
      `;
    } catch (e) {
      container.innerHTML = `<div style="padding: 20px; color: #ef4444;">Failed to load weekly audit log: ${e.message}</div>`;
    }
  },

  downloadCSV() {
    window.open('/api/paper/weekly-audit/download?format=csv', '_blank');
  },

  downloadJSON() {
    window.open('/api/paper/weekly-audit/download?format=json', '_blank');
  }
};
