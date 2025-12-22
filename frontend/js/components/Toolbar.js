const Toolbar = {
    render(state) {
        return `
            <div class="toolbar">
                <div class="toolbar-section">
                    <h3>Controls</h3>
                    <button class="btn-icon" data-action="refresh-all" title="Refresh All Data">
                        🔄 Refresh All
                    </button>
                    
                    <div class="toggle-group">
                        <label class="toggle">
                            <input 
                                type="checkbox" 
                                data-change-action="toggle-autorefresh" 
                                ${state.autoRefreshEnabled ? 'checked' : ''}
                            >
                            <span class="toggle-slider"></span>
                            <span class="toggle-label">Auto Refresh</span>
                        </label>
                    </div>
                </div>

                <div class="toolbar-section">
                    <h3>Filters</h3>
                    <div class="filter-group">
                        <label class="checkbox-label">
                            <input 
                                type="checkbox" 
                                data-change-action="toggle-filter" 
                                data-filter="showBuying"
                                ${state.filters.showBuying ? 'checked' : ''}
                            >
                            <span class="status-buying">● Buying</span>
                        </label>
                        
                        <label class="checkbox-label">
                            <input 
                                type="checkbox" 
                                data-change-action="toggle-filter" 
                                data-filter="showSelling"
                                ${state.filters.showSelling ? 'checked' : ''}
                            >
                            <span class="status-selling">● Selling</span>
                        </label>
                        
                        <label class="checkbox-label">
                            <input 
                                type="checkbox" 
                                data-change-action="toggle-filter" 
                                data-filter="showNeutral"
                                ${state.filters.showNeutral ? 'checked' : ''}
                            >
                            <span class="status-neutral">● Neutral</span>
                        </label>
                    </div>
                </div>

                <div class="toolbar-section">
                    <h3>Interval</h3>
                    <select data-change-action="change-interval" class="interval-select">
                        <option value="ONE_MINUTE" ${state.selectedInterval === 'ONE_MINUTE' ? 'selected' : ''}>1 Minute</option>
                        <option value="THREE_MINUTE" ${state.selectedInterval === 'THREE_MINUTE' ? 'selected' : ''}>3 Minutes</option>
                        <option value="FIVE_MINUTE" ${state.selectedInterval === 'FIVE_MINUTE' ? 'selected' : ''}>5 Minutes</option>
                        <option value="FIFTEEN_MINUTE" ${state.selectedInterval === 'FIFTEEN_MINUTE' ? 'selected' : ''}>15 Minutes</option>
                        <option value="THIRTY_MINUTE" ${state.selectedInterval === 'THIRTY_MINUTE' ? 'selected' : ''}>30 Minutes</option>
                        <option value="ONE_HOUR" ${state.selectedInterval === 'ONE_HOUR' ? 'selected' : ''}>1 Hour</option>
                    </select>
                </div>

                <div class="toolbar-section">
                    <h3>Export</h3>
                    <button class="btn-secondary" data-action="export-csv">
                        📄 Export CSV
                    </button>
                    <button class="btn-secondary" data-action="export-json">
                        📋 Export JSON
                    </button>
                </div>
            </div>
        `;
    }
};