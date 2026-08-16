// ============================================================================
// FILE: frontend/js/services/viewRouter/ViewRouter.js
// View Router Engine Class
// ============================================================================

const ViewRouterEngine = {
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

  renderActiveTab(activeTab, container, state, filteredData) {
    if (!container) return;

    const spotPrice = this.extractSpotPrice(state);
    window.lastSpotPrice = spotPrice;

    const views = TAB_REGISTRY[activeTab] || TAB_REGISTRY['signals'];

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

const ViewRouter = ViewRouterEngine;
