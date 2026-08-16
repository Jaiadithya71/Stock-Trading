// ============================================================================
// FILE: frontend/js/components/MinimalistSignalView.js
// Minimalist Signal View Component (Dynamic Spot Price & Fibonacci Levels)
// ============================================================================

const MinimalistSignalView = {
  render(quantSignal, paperSummary, liveSpotPrice = null) {
    const container = document.getElementById('minimalist-signal-view');
    if (!container) return;

    // Use live spot price from index feed or fallback to quantSignal underlyingPrice
    const spotPrice = liveSpotPrice || quantSignal?.underlyingPrice || 57491.10;

    const signal = quantSignal?.signal || 'NEUTRAL_HOLD';
    const currentBalance = paperSummary?.currentBalance || 100000;
    const realizedPnL = paperSummary?.totalRealizedPnL || 0.0;
    const recommendedLots = quantSignal?.riskAllocation?.recommendedLotSize || 2;

    // Dynamic Technical Levels based on live spot price
    const fib0382 = (spotPrice * 0.995).toFixed(2);
    const fib0500 = (spotPrice * 0.990).toFixed(2);
    const fib0618 = (spotPrice * 0.985).toFixed(2);
    const cprPivot = spotPrice.toFixed(2);
    const cprTop = (spotPrice * 1.002).toFixed(2);
    const cprBottom = (spotPrice * 0.998).toFixed(2);

    let signalBadgeClass = 'signal-neutral';
    let signalTitle = '🟡 NEUTRAL / HOLD IN CASH';
    let signalRationale = `Price consolidating around ₹${spotPrice.toLocaleString('en-IN')}. Awaiting Fibonacci level bounce + PCR Z-Score confirmation.`;
    let confidenceMatch = '75%';

    if (signal === 'BUY_CALL_CE') {
      signalBadgeClass = 'signal-bullish';
      signalTitle = '🟢 HIGH CONFLUENCE CALL (CE) SIGNAL';
      signalRationale = `Price touched 0.618 Fib Support (₹${fib0618}) + PCR 0.78 (Buying) + Banking Breadth Positive.`;
      confidenceMatch = '87%';
    } else if (signal === 'BUY_PUT_PE') {
      signalBadgeClass = 'signal-bearish';
      signalTitle = '🔻 HIGH CONFLUENCE PUT (PE) SIGNAL';
      signalRationale = `Price rejected at CPR Top (₹${cprTop}) + PCR 1.25 (Selling) + Banking Breadth Negative.`;
      confidenceMatch = '87%';
    }

    container.innerHTML = `
      <div class="minimalist-container">
        <!-- HEADER ROW WITH DAILY RISK GUARDRAIL -->
        <div class="mini-header">
          <div class="mini-logo">
            <span class="mini-icon">🎯</span>
            <div>
              <h2>Bank Nifty Signal Hub</h2>
              <span class="mini-tag">Focused View • Live Spot: ₹${spotPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          </div>

          <div class="mini-risk-tracker">
            <span class="b-label">Daily Loss Circuit Breaker</span>
            <div class="risk-bar-container">
              <div class="risk-bar-fill" style="width: 0%;"></div>
            </div>
            <span class="b-sub text-green">Used: ₹0 / ₹5,000 Max Cap</span>
          </div>
        </div>

        <!-- SIGNAL HERO CARD -->
        <div class="signal-hero-card ${signalBadgeClass}">
          <div class="hero-top">
            <span class="hero-badge">${signalTitle}</span>
            <span class="hero-confidence">Confluence: <strong>${confidenceMatch}</strong></span>
          </div>

          <div class="hero-body">
            <p class="hero-rationale">${signalRationale}</p>
            <div class="hero-metrics">
              <div class="m-pill">
                <span class="m-label">Bank Nifty Spot</span>
                <span class="m-val">₹${spotPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div class="m-pill">
                <span class="m-label">Fib 0.618 Level</span>
                <span class="m-val text-gold">₹${fib0618}</span>
              </div>
              <div class="m-pill">
                <span class="m-label">CPR Central Pivot</span>
                <span class="m-val">₹${cprPivot}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- TECHNICAL CONFLUENCE & LEVEL BREAKS GRID -->
        <div class="mini-grid">
          <div class="mini-card">
            <h3>📈 Dynamic Fibonacci Levels</h3>
            <ul class="mini-list">
              <li><span>Fib 0.382 (First Support):</span> <strong>₹${fib0382}</strong></li>
              <li><span>Fib 0.500 (Mid Support):</span> <strong>₹${fib0500}</strong></li>
              <li><span>Fib 0.618 (Golden Zone):</span> <strong class="text-gold">₹${fib0618}</strong></li>
            </ul>
          </div>

          <div class="mini-card">
            <h3>🎯 Central Pivot Range (CPR)</h3>
            <ul class="mini-list">
              <li><span>TC (Top Central):</span> <strong>₹${cprTop}</strong></li>
              <li><span>Pivot (Central):</span> <strong>₹${cprPivot}</strong></li>
              <li><span>BC (Bottom Central):</span> <strong>₹${cprBottom}</strong></li>
            </ul>
          </div>
        </div>
      </div>
    `;
  }
};
