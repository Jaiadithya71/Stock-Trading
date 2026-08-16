// ============================================================================
// FILE: frontend/js/components/StrategyAuditView.js
// Strategy Audit & Educational Masterclass Component
// Directly renders the Kindle-Style Strategy E-Book Masterclass Reader
// ============================================================================

const StrategyAuditView = {
  render(quantSignal, selectedAlgo = 'algo1', liveSpotPrice = null) {
    const container = document.getElementById('strategy-audit-view');
    if (!container) return;

    // Render the Kindle Strategy Masterclass Reader directly as the primary page content
    container.innerHTML = KindleStrategyReader.render();
  }
};
