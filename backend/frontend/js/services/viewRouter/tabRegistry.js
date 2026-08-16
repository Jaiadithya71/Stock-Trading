// ============================================================================
// FILE: frontend/js/services/viewRouter/tabRegistry.js
// Declarative Tab Registry Mapping Tabs to View Components
// ============================================================================

const TAB_REGISTRY = {
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
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = TAB_REGISTRY;
}
