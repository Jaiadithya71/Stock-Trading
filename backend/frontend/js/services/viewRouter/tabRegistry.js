// ============================================================================
// FILE: frontend/js/services/viewRouter/tabRegistry.js
// Declarative Tab Registry Mapping Tabs to View Components
// Includes Live Option Chain Matrix + 2-Column Market Bento Layout
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
  weekly: [
    { 
      id: 'weekly-audit-dashboard', 
      render: (state) => WeeklyAuditDashboard.render(state.signalAuditLog) 
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
        let html = `
          <div class="market-bento-grid" style="display: grid; grid-template-columns: 1.15fr 0.95fr; gap: 14px; margin-bottom: 14px;">
            <div>${IndicesGrid.render(state.indicesData, state.indicesTimestamp)}</div>
            <div>${BankNiftyTable.render(filteredData, state.bankNiftyTimestamp)}</div>
          </div>
          <div style="display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 14px; margin-bottom: 14px;">
            <div>${PCRWidget.render(state.pcrData, state.pcrTimestamp)}</div>
            <div>${CurrencyWidget.render(state.currencyData, state.currencyTimestamp)}</div>
          </div>
        `;
        // Live NSE Option Chain with ATM strike highlights and scrollable container
        if (state.nseOptionChainData) {
          html += OptionChain.render(state.nseOptionChainData, state.selectedNSESymbol || 'BANKNIFTY');
        }
        return html;
      }
    }
  ]
};
