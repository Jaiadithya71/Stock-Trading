// ============================================================================
// FILE: frontend/js/services/viewRouter.js
// Layer 5: Display & View Router
// Declarative view registry mapping tab IDs to component renderers
// Dynamic spot price & telemetry age extractor
// ============================================================================

const ViewRouter = {
  extractSpotPrice(state) {
    if (state.indicesData) {
      let indices = state.indicesData;
      if (indices.data) indices = indices.data;
      if (Array.isArray(indices)) {
        const bn = indices.find(i => i.symbol === 'BANKNIFTY' || i.symbol === 'NIFTY BANK' || i.name === 'BANKNIFTY');
        if (bn && (bn.ltp || bn.price)) {
          return parseFloat(bn.ltp || bn.price);
        }
      }
    }
    return state.quantSignalData?.underlyingPrice || 57491.10;
  },

  TAB_REGISTRY: {
    signals: [
      { 
        id: 'minimalist-signal-view', 
        render: (state, spotPrice) => MinimalistSignalView.render(state.quantSignalData, state.paperSummaryData, spotPrice) 
      }
    ],
    portfolio: [
      { 
        id: 'paper-trading-widget', 
        render: (state, spotPrice) => PaperTradingWidget.render(state.paperSummaryData, spotPrice) 
      }
    ],
    audit: [
      { 
        id: 'strategy-audit-view', 
        render: (state, spotPrice) => StrategyAuditView.render(state.quantSignalData, 'algo1', spotPrice) 
      }
    ],
    settings: [
      { 
        id: 'risk-settings-view', 
        render: (state) => RiskSettingsView.render() 
      }
    ],
    market: [
      { 
        id: 'master-grid-container', 
        renderHtml: (state, filteredData) => {
          let html = IndicesGrid.render(state.indicesData, state.indicesTimestamp);
          if (state.showPCR) html += PCRWidget.render(state.pcrData, state.pcrTimestamp);
          if (state.showCurrency && state.currencyData) html += CurrencyWidget.render(state.currencyData, state.currencyTimestamp);
          if (state.showOptionChain) html += OptionChain.render(state.nseOptionChainData, state.selectedNSESymbol);
          html += BankNiftyTable.render(filteredData, state.bankNiftyTimestamp);
          return html;
        }
      }
    ]
  },

  renderActiveTab(activeTab, container, state, filteredData) {
    if (!container) return;

    const spotPrice = this.extractSpotPrice(state);
    window.lastSpotPrice = spotPrice;

    const views = this.TAB_REGISTRY[activeTab] || this.TAB_REGISTRY['signals'];

    // Generate DOM Containers
    let html = '';
    views.forEach(v => {
      if (v.renderHtml) {
        html += v.renderHtml(state, filteredData);
      } else {
        html += `<div id="${v.id}"></div>`;
      }
    });

    container.innerHTML = html;

    // Execute Component Renderers
    views.forEach(v => {
      if (v.render) {
        v.render(state, spotPrice);
      }
    });
  }
};
