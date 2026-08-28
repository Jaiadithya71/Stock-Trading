// ============================================================================
// FILE: frontend/js/components/WeeklyAuditDashboard.js
// Institutional Simulation Audit & Strategy Telemetry Review - Obsidian Bento
// ============================================================================

const WeeklyAuditDashboard = {
  formatIST(dateString) {
    try {
      const d = new Date(dateString);
      return d.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
    } catch (e) {
      return dateString;
    }
  },

  async render(signalAuditLog = null) {
    const container = document.getElementById('weekly-audit-dashboard');
    if (!container) return;

    try {
      const [resWeekly, resTelemetry] = await Promise.all([
        fetch('/api/paper/weekly-audit').then(r => r.json()).catch(() => ({ data: {} })),
        signalAuditLog ? Promise.resolve({ data: signalAuditLog }) : fetch('/api/quant/signal-audit?range=today').then(r => r.json()).catch(() => ({ data: [] }))
      ]);

      const auditData = resWeekly.data || {};
      const summary = auditData.weeklySummary || {};
      const trades = auditData.trades || [];
      const telemetryLogs = (resTelemetry && resTelemetry.data && Array.isArray(resTelemetry.data)) ? resTelemetry.data : (signalAuditLog || []);

      const pnlVal = summary.netRealizedPnL || 0;
      const pnlClass = pnlVal >= 0 ? 'val-positive' : 'val-negative';

      container.innerHTML = `
        <div class="weekly-audit-wrapper" style="display: flex; flex-direction: column; gap: 14px; font-family: var(--font-ui);">
          
          <!-- TOP TOOLBAR & KPI SUMMARY -->
          <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(14, 18, 28, 0.78); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 12px 18px; backdrop-filter: blur(16px);">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 22px;">📅</span>
              <div>
                <h2 style="margin: 0; font-size: 15px; font-weight: 700; color: #f8fafc;">Simulation Audit & Strategy Telemetry Review</h2>
                <span style="font-size: 11px; color: #94a3b8;">Minute-by-minute evaluation log, trade executions, and performance analytics (IST)</span>
              </div>
            </div>

            <div style="display: flex; align-items: center; gap: 8px;">
              <button class="btn-icon" style="padding: 6px 12px; font-size: 11.5px;" onclick="WeeklyAuditDashboard.downloadCSV()">
                📥 Export Trades (CSV)
              </button>
              <button class="btn-icon" style="padding: 6px 12px; font-size: 11.5px;" onclick="window.open('/api/quant/signal-audit/download?range=today&format=csv', '_blank')">
                📥 Export Telemetry (CSV)
              </button>
              <button class="btn-icon" style="padding: 6px 12px; font-size: 11.5px;" onclick="WeeklyAuditDashboard.render()">
                🔄 Refresh
              </button>
            </div>
          </div>

          <!-- 4 KPI SUMMARY CARDS -->
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;">
            <div class="card" style="margin: 0; padding: 12px 16px;">
              <span style="font-size: 10.5px; color: #64748b; font-weight: 600; text-transform: uppercase; display: block;">Weekly Win Rate</span>
              <div style="font-size: 20px; font-weight: 700; color: #10b981; margin-top: 2px; font-family: var(--font-mono);">${summary.winRatePct || 0}%</div>
              <span style="font-size: 11px; color: #94a3b8;">${summary.winningTrades || 0} Wins / ${summary.losingTrades || 0} Losses</span>
            </div>

            <div class="card" style="margin: 0; padding: 12px 16px;">
              <span style="font-size: 10.5px; color: #64748b; font-weight: 600; text-transform: uppercase; display: block;">Net Realized P&L</span>
              <div style="font-size: 20px; font-weight: 700; margin-top: 2px; font-family: var(--font-mono);" class="${pnlClass}">₹${pnlVal.toFixed(2)}</div>
              <span style="font-size: 11px; color: #94a3b8;">Simulated Paper OMS Fills</span>
            </div>

            <div class="card" style="margin: 0; padding: 12px 16px;">
              <span style="font-size: 10.5px; color: #64748b; font-weight: 600; text-transform: uppercase; display: block;">1-Min Telemetry Logs</span>
              <div style="font-size: 20px; font-weight: 700; color: #38bdf8; margin-top: 2px; font-family: var(--font-mono);">${telemetryLogs.length}</div>
              <span style="font-size: 11px; color: #94a3b8;">Autonomous 60s Stream</span>
            </div>

            <div class="card" style="margin: 0; padding: 12px 16px;">
              <span style="font-size: 10.5px; color: #64748b; font-weight: 600; text-transform: uppercase; display: block;">Max Drawdown</span>
              <div style="font-size: 20px; font-weight: 700; color: #f59e0b; margin-top: 2px; font-family: var(--font-mono);">-${summary.maxDrawdownPct || 0}%</div>
              <span style="font-size: 11px; color: #94a3b8;">Quarter-Kelly Guarded</span>
            </div>
          </div>

          <!-- 2-COLUMN BENTO AUDIT SECTION -->
          <div style="display: grid; grid-template-columns: 1.15fr 0.85fr; gap: 14px; align-items: stretch;">
            
            <!-- LEFT PANEL: 1-MINUTE TELEMETRY STREAM TABLE -->
            <div class="card" style="margin: 0; padding: 16px 18px; display: flex; flex-direction: column;">
              <div class="card-header" style="margin-bottom: 10px; padding-bottom: 8px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span class="card-title" style="font-size: 13px;">⏱️ 1-Minute Live Signal Telemetry Ledger</span>
                  <span class="badge badge-bullish" style="font-size: 9.5px; padding: 2px 6px;">AUTO 60s</span>
                </div>
                <span style="font-size: 11px; color: #64748b; font-family: var(--font-mono);">${telemetryLogs.length} Snapshots</span>
              </div>

              ${telemetryLogs.length === 0 ? `
                <div style="padding: 24px; text-align: center; color: #64748b; background: rgba(0,0,0,0.25); border-radius: 10px; border: 1px dashed rgba(255,255,255,0.08); font-size: 12px;">
                  <span>Autonomous signal engine evaluates and streams snapshots here every 60 seconds.</span>
                </div>
              ` : `
                <div class="indices-table-wrapper" style="margin: 0; max-height: 420px; overflow-y: auto;">
                  <table class="indices-table" style="font-size: 11.5px;">
                    <thead style="position: sticky; top: 0; background: #0f131d; z-index: 10;">
                      <tr>
                        <th style="padding: 8px 10px;">Time (IST)</th>
                        <th>Spot</th>
                        <th>Strike</th>
                        <th>PCR / Z</th>
                        <th>Breadth</th>
                        <th>Signal</th>
                        <th style="text-align: left; padding-left: 10px;">Rationale</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${[...telemetryLogs].reverse().map(e => {
                        const isBuyCE = e.signal === 'BUY_CALL_CE';
                        const isBuyPE = e.signal === 'BUY_PUT_PE';
                        const badge = isBuyCE ?
                          '<span class="badge badge-bullish">🟢 BUY CE</span>' :
                          isBuyPE ?
                          '<span class="badge badge-bearish">🔻 BUY PE</span>' :
                          '<span class="badge badge-neutral">🟡 HOLD</span>';
                        
                        return `
                          <tr>
                            <td class="num" style="color: #94a3b8; font-size: 10.5px; white-space: nowrap;">${e.timeIST || ''}</td>
                            <td class="num" style="font-weight: 600; color: #38bdf8;">₹${(e.spotPrice || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                            <td class="num" style="color: #f59e0b;">${e.atmStrike || 0}</td>
                            <td class="num" style="color: #f8fafc;">${e.rawPcr || 0} <span style="font-size: 10px; color: #64748b;">(${e.pcrZScore !== undefined ? e.pcrZScore : 0})</span></td>
                            <td class="num" style="font-size: 10.5px; color: #94a3b8;">${e.advancingWeight || 0}% / ${e.decliningWeight || 0}%</td>
                            <td style="white-space: nowrap;">${badge}</td>
                            <td style="text-align: left; padding-left: 10px; color: #94a3b8; font-size: 11px; max-width: 220px; line-height: 1.3; font-family: var(--font-ui);">${e.signalRationale || ''}</td>
                          </tr>
                        `;
                      }).join('')}
                    </tbody>
                  </table>
                </div>
              `}
            </div>

            <!-- RIGHT PANEL: EXECUTED PAPER TRADES TABLE -->
            <div class="card" style="margin: 0; padding: 16px 18px; display: flex; flex-direction: column;">
              <div class="card-header" style="margin-bottom: 10px; padding-bottom: 8px;">
                <span class="card-title" style="font-size: 13px;">📜 Executed Trade & P&L Log</span>
                <span style="font-size: 11px; color: #64748b; font-family: var(--font-mono);">${trades.length} Fills</span>
              </div>

              ${trades.length === 0 ? `
                <div style="padding: 24px; text-align: center; color: #64748b; background: rgba(0,0,0,0.25); border-radius: 10px; border: 1px dashed rgba(255,255,255,0.08); font-size: 12px;">
                  <span>No executed trades logged for the current period. Fills will record here automatically.</span>
                </div>
              ` : `
                <div class="indices-table-wrapper" style="margin: 0; max-height: 420px; overflow-y: auto;">
                  <table class="indices-table" style="font-size: 11.5px;">
                    <thead style="position: sticky; top: 0; background: #0f131d; z-index: 10;">
                      <tr>
                        <th style="padding: 8px 10px;">Time</th>
                        <th>Action</th>
                        <th>Strike</th>
                        <th>Entry</th>
                        <th>Exit</th>
                        <th>P&L</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${trades.map(t => {
                        const isCall = t.optionType === 'CE';
                        const actionBadge = isCall ?
                          '<span class="badge badge-bullish">🟢 BUY CE</span>' :
                          '<span class="badge badge-bearish">🔻 BUY PE</span>';
                        const tradePnl = t.pnl || 0;
                        const pnlCls = tradePnl >= 0 ? 'val-positive' : 'val-negative';

                        return `
                          <tr>
                            <td class="num" style="color: #94a3b8; font-size: 10.5px; white-space: nowrap;">${this.formatIST(t.timestamp)}</td>
                            <td>${actionBadge}</td>
                            <td class="num" style="font-weight: 600; color: #f59e0b;">₹${t.strikePrice}</td>
                            <td class="num">₹${t.entryPrice}</td>
                            <td class="num">${t.exitPrice ? '₹' + t.exitPrice : 'OPEN'}</td>
                            <td class="num ${pnlCls}" style="font-weight: 700;">₹${tradePnl.toFixed(2)}</td>
                            <td><span class="status-pill buying">${t.status}</span></td>
                          </tr>
                        `;
                      }).join('')}
                    </tbody>
                  </table>
                </div>
              `}
            </div>

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
