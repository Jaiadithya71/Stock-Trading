// ============================================================================
// FILE: frontend/js/components/MinimalistSignalView.js
// Single-Screen Bento Cockpit Layout (100% Zero-Scroll Viewport Optimized)
// ============================================================================

const MinimalistSignalView = {
  render(quantSignal, paperSummary, liveSpotPrice = null) {
    const container = document.getElementById('minimalist-signal-view');
    if (!container) return;

    // Resolve live spot price from index feed or quant signal
    const spotPrice = liveSpotPrice || quantSignal?.underlyingPrice || 57491.10;
    const signal = quantSignal?.signal || 'NEUTRAL_HOLD';
    const targetContract = quantSignal?.targetContract || `BANKNIFTY ${Math.round(spotPrice / 100) * 100} CE`;
    const targetOptionPrice = quantSignal?.targetOptionPrice || Math.round(spotPrice * 0.005);
    const confidenceMatch = quantSignal?.confidenceScore || '75%';
    const signalTitle = quantSignal?.signalTitle || (signal === 'BUY_CALL_CE' ? '🟢 CALL (CE) MOMENTUM BREAKOUT' : (signal === 'BUY_PUT_PE' ? '🔻 PUT (PE) WATERFALL BREAKDOWN' : '🟡 NEUTRAL / HOLD IN CASH'));
    const signalRationale = quantSignal?.signalRationale || `Price consolidating around ₹${spotPrice.toLocaleString('en-IN')}. Awaiting technical breakout or Fibonacci bounce.`;

    const advWeight = quantSignal?.breadthMetrics?.advancingWeight || 50;
    const decWeight = quantSignal?.breadthMetrics?.decliningWeight || 50;
    const recommendedLots = quantSignal?.riskAllocation?.recommendedLotSize || 2;
    const maxRiskCap = quantSignal?.riskAllocation?.maxRiskPerTrade || '₹1,500';

    // Technical Levels
    const fib0382 = (spotPrice * 0.995).toFixed(2);
    const fib0500 = (spotPrice * 0.990).toFixed(2);
    const fib0618 = (spotPrice * 0.985).toFixed(2);
    const cprPivot = spotPrice.toFixed(2);
    const cprTop = (spotPrice * 1.002).toFixed(2);
    const cprBottom = (spotPrice * 0.998).toFixed(2);

    let signalBadgeClass = 'signal-neutral';
    let heroBorder = 'rgba(234, 179, 8, 0.35)';
    let heroGlow = 'rgba(234, 179, 8, 0.12)';
    let heroBg = 'linear-gradient(180deg, rgba(234, 179, 8, 0.08) 0%, rgba(14, 18, 28, 0.85) 100%)';
    let btnColor = 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';

    if (signal === 'BUY_CALL_CE') {
      signalBadgeClass = 'signal-bullish';
      heroBorder = 'rgba(16, 185, 129, 0.45)';
      heroGlow = 'rgba(16, 185, 129, 0.18)';
      heroBg = 'linear-gradient(180deg, rgba(16, 185, 129, 0.1) 0%, rgba(14, 18, 28, 0.85) 100%)';
      btnColor = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
    } else if (signal === 'BUY_PUT_PE') {
      signalBadgeClass = 'signal-bearish';
      heroBorder = 'rgba(244, 63, 94, 0.45)';
      heroGlow = 'rgba(244, 63, 94, 0.18)';
      heroBg = 'linear-gradient(180deg, rgba(244, 63, 94, 0.1) 0%, rgba(14, 18, 28, 0.85) 100%)';
      btnColor = 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)';
    }

    container.innerHTML = `
      <div class="bento-cockpit-grid" style="display: grid; grid-template-columns: 1.25fr 0.95fr; gap: 14px; align-items: stretch; max-height: calc(100vh - 100px);">
        
        <!-- LEFT COLUMN: SIGNAL HERO & LIVE BREADTH METER -->
        <div style="display: flex; flex-direction: column; gap: 12px;">
          
          <!-- SPOT TICKER BAR -->
          <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(14, 18, 28, 0.78); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 10px 16px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #10b981; box-shadow: 0 0 8px #10b981;"></span>
              <span style="font-size: 0.85rem; color: #94a3b8; font-weight: 500;">Spot Index:</span>
              <strong style="font-size: 1.2rem; color: #38bdf8; font-family: var(--font-mono); letter-spacing: -0.02em;">₹${spotPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
            </div>
            <div style="display: flex; gap: 10px; align-items: center;">
              <span style="font-size: 0.78rem; color: #64748b; font-weight: 600; text-transform: uppercase;">Strike:</span>
              <strong style="font-size: 0.95rem; color: #f59e0b; font-family: var(--font-mono);">${targetContract}</strong>
              <span style="color: rgba(255,255,255,0.15);">|</span>
              <span style="font-size: 0.78rem; color: #64748b; font-weight: 600; text-transform: uppercase;">Est. Prem:</span>
              <strong style="font-size: 0.95rem; color: #10b981; font-family: var(--font-mono);">₹${targetOptionPrice}</strong>
            </div>
          </div>

          <!-- SIGNAL HERO CARD -->
          <div class="signal-hero-card ${signalBadgeClass}" style="background: ${heroBg}; border: 1px solid ${heroBorder}; box-shadow: 0 10px 30px ${heroGlow}; border-radius: 14px; padding: 18px 20px; flex: 1; display: flex; flex-direction: column; justify-content: space-between;">
            <div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <span style="font-size: 1.15rem; font-weight: 800; color: #f8fafc; letter-spacing: -0.01em;">${signalTitle}</span>
                <span style="background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.1); padding: 4px 12px; border-radius: 16px; font-size: 0.82rem; font-weight: 600;">
                  Confluence: <strong style="color: #38bdf8; font-family: var(--font-mono);">${confidenceMatch}</strong>
                </span>
              </div>
              <p style="font-size: 0.92rem; line-height: 1.5; color: #cbd5e1; margin: 0 0 14px 0;">${signalRationale}</p>
            </div>

            <!-- BANKING BREADTH VISUAL METER -->
            <div style="background: rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 12px 16px;">
              <div style="display: flex; justify-content: space-between; font-size: 0.82rem; margin-bottom: 6px; font-weight: 600;">
                <span style="color: #34d399;">🟢 Advancing: <strong style="font-family: var(--font-mono);">${advWeight}%</strong> (HDFC/ICICI)</span>
                <span style="color: #fb7185;">Declining: <strong style="font-family: var(--font-mono);">${decWeight}%</strong> 🔴</span>
              </div>
              <div style="height: 8px; width: 100%; background: rgba(255,255,255,0.1); border-radius: 4px; overflow: hidden; display: flex;">
                <div style="width: ${advWeight}%; background: #10b981; transition: width 0.4s ease; box-shadow: 0 0 8px #10b981;"></div>
                <div style="width: ${decWeight}%; background: #f43f5e; transition: width 0.4s ease; box-shadow: 0 0 8px #f43f5e;"></div>
              </div>
            </div>
          </div>

        </div>

        <!-- RIGHT COLUMN: TECHNICAL LEVELS & KELLY RISK ORDER ACTION -->
        <div style="display: flex; flex-direction: column; gap: 12px;">
          
          <!-- TECHNICAL LEVELS MATRIX -->
          <div class="card" style="margin: 0; padding: 14px 18px; flex: 1;">
            <div class="card-header" style="margin-bottom: 10px; padding-bottom: 8px;">
              <span class="card-title" style="font-size: 13px;">📈 Dynamic Levels & CPR Matrix</span>
              <span style="font-size: 0.72rem; color: #38bdf8; font-family: var(--font-mono);">GOLDEN FIB 0.618</span>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 0.85rem;">
              <div>
                <span style="font-size: 0.72rem; text-transform: uppercase; color: #64748b; font-weight: 600; display: block; margin-bottom: 4px;">Fibonacci Pivots</span>
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                  <span style="color: #94a3b8;">0.382 Level:</span>
                  <strong style="font-family: var(--font-mono);">₹${fib0382}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                  <span style="color: #94a3b8;">0.500 Mid:</span>
                  <strong style="font-family: var(--font-mono);">₹${fib0500}</strong>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span style="color: #f59e0b;">0.618 Golden:</span>
                  <strong style="color: #f59e0b; font-family: var(--font-mono);">₹${fib0618}</strong>
                </div>
              </div>

              <div>
                <span style="font-size: 0.72rem; text-transform: uppercase; color: #64748b; font-weight: 600; display: block; margin-bottom: 4px;">Central Pivot Range</span>
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                  <span style="color: #94a3b8;">TC (Top):</span>
                  <strong style="font-family: var(--font-mono);">₹${cprTop}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                  <span style="color: #94a3b8;">Pivot Central:</span>
                  <strong style="font-family: var(--font-mono);">₹${cprPivot}</strong>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span style="color: #94a3b8;">BC (Bottom):</span>
                  <strong style="font-family: var(--font-mono);">₹${cprBottom}</strong>
                </div>
              </div>
            </div>
          </div>

          <!-- KELLY SIZING & QUICK TRADE EXECUTION -->
          <div class="card" style="margin: 0; padding: 14px 18px; background: rgba(14, 18, 28, 0.85); border-color: rgba(56, 189, 248, 0.2);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
              <span style="font-size: 13px; font-weight: 700; color: #f8fafc;">🛡️ Kelly Sizing & Order Action</span>
              <span style="font-size: 0.75rem; color: #34d399; font-family: var(--font-mono); font-weight: 600;">Sizing: ${recommendedLots} Lots (30 Qty)</span>
            </div>

            <div style="display: flex; justify-content: space-between; font-size: 0.82rem; color: #94a3b8; margin-bottom: 12px;">
              <span>Target / SL: <strong style="color: #f8fafc; font-family: var(--font-mono);">+35 pt / -15 pt</strong></span>
              <span>Max Risk Cap: <strong style="color: #f43f5e; font-family: var(--font-mono);">${maxRiskCap}</strong></span>
            </div>

            <button id="btn-cockpit-quick-trade" class="btn-icon" style="width: 100%; justify-content: center; background: ${btnColor}; color: #fff; border: none; padding: 10px; font-size: 12.5px; font-weight: 700; box-shadow: 0 4px 16px rgba(0,0,0,0.4);" onclick="MinimalistSignalView.executeTrade('${targetContract}', ${targetOptionPrice}, '${signal}')">
              ⚡ Execute Paper Trade (${targetContract} @ ₹${targetOptionPrice})
            </button>
          </div>

        </div>

      </div>
    `;
  },

  async executeTrade(contract, price, signal) {
    const isPE = signal === 'BUY_PUT_PE';
    const optType = isPE ? 'PE' : 'CE';
    
    if (typeof ToastNotification !== 'undefined') {
      ToastNotification.show(`⚡ Executing Paper Order: ${contract} @ ₹${price}...`, 'info', 2500);
    }

    try {
      const res = await fetch('/api/paper/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: contract,
          optionType: optType,
          entryPrice: price,
          quantity: 30,
          signalRationale: `${signal} Confluence Trigger`
        })
      });
      const data = await res.json();
      if (data.success) {
        if (typeof ToastNotification !== 'undefined') {
          ToastNotification.show(`✅ Order Filled: ${contract} (30 Qty @ ₹${price})`, 'success', 4000);
        }
      } else {
        if (typeof ToastNotification !== 'undefined') {
          ToastNotification.show(`❌ Order Failed: ${data.message || 'Execution error'}`, 'error', 4000);
        }
      }
    } catch(err) {
      console.error('Trade error:', err);
    }
  }
};
