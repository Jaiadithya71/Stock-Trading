// ============================================================================
// FILE: frontend/js/components/QuantSignalWidget.js
// Quantitative Strategy Signal & Risk Allocation Visualizer
// ============================================================================

const QuantSignalWidget = {
  render(signalData) {
    const container = document.getElementById('quant-signal-widget');
    if (!container) return;

    if (!signalData) {
      container.innerHTML = `
        <div class="quant-card loading">
          <h3>⚡ Quant Signal Engine</h3>
          <p>Loading real-time strategy signals...</p>
        </div>
      `;
      return;
    }

    const { signal, targetContract, pcrMetrics, breadthMetrics, riskAllocation, rationale } = signalData;

    let badgeClass = 'badge-neutral';
    let signalText = 'NEUTRAL / HOLD';
    if (signal === 'BUY_CALL_CE') {
      badgeClass = 'badge-bullish';
      signalText = '🚀 BUY CALL (CE)';
    } else if (signal === 'BUY_PUT_PE') {
      badgeClass = 'badge-bearish';
      signalText = '🔻 BUY PUT (PE)';
    }

    const zScoreVal = pcrMetrics?.pcrZScore !== undefined ? pcrMetrics.pcrZScore.toFixed(2) : '0.00';
    const breadthScoreVal = breadthMetrics?.weightedBreadthScore !== undefined ? breadthMetrics.weightedBreadthScore.toFixed(2) : '0.00';
    const recommendedLots = riskAllocation?.recommendedLotSize || 1;
    const allocatedCapital = riskAllocation?.allocatedCapital ? riskAllocation.allocatedCapital.toLocaleString('en-IN') : '0';

    container.innerHTML = `
      <div class="quant-card">
        <div class="quant-header">
          <div class="quant-title">
            <span class="icon">⚡</span>
            <h3>Quant Signal Engine (Bank Nifty)</h3>
          </div>
          <span class="signal-badge ${badgeClass}">${signalText}</span>
        </div>

        <div class="quant-body-grid">
          <div class="metric-box">
            <span class="metric-label">PCR 30d Z-Score</span>
            <span class="metric-value ${zScoreVal < -1.0 ? 'text-green' : zScoreVal > 1.0 ? 'text-red' : ''}">${zScoreVal}</span>
            <span class="metric-sub">${zScoreVal < -1.2 ? 'Oversold' : zScoreVal > 1.2 ? 'Overbought' : 'Neutral'}</span>
          </div>

          <div class="metric-box">
            <span class="metric-label">Bank Stock Breadth</span>
            <span class="metric-value ${breadthScoreVal > 0 ? 'text-green' : 'text-red'}">${breadthScoreVal > 0 ? '+' : ''}${breadthScoreVal}%</span>
            <span class="metric-sub">${breadthMetrics?.directionalBias || 'NEUTRAL'}</span>
          </div>

          <div class="metric-box">
            <span class="metric-label">Kelly Vol-Target Size</span>
            <span class="metric-value text-gold">${recommendedLots} Lot(s)</span>
            <span class="metric-sub">Capital: ₹${allocatedCapital}</span>
          </div>
        </div>

        <div class="quant-rationale">
          <strong>Strategy Rationale:</strong>
          <ul>
            ${(rationale || []).map(r => `<li>• ${r}</li>`).join('')}
          </ul>
        </div>
      </div>
    `;
  }
};
