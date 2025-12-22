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
                                id="autoRefreshToggle"
                                data-change-action="toggle-autorefresh" 
                                ${state.autoRefreshEnabled ? 'checked' : ''}
                            >
                            <span class="toggle-label">Auto Refresh</span>
                        </label>
                        
                        <select 
                            id="refreshIntervalSelect"
                            class="auto-refresh-interval" 
                            data-change-action="change-refresh-interval"
                            ${!state.autoRefreshEnabled ? 'disabled' : ''}
                        >
                            <option value="10000" ${state.refreshInterval === 10000 ? 'selected' : ''}>Every 10 sec</option>
                            <option value="15000" ${state.refreshInterval === 15000 ? 'selected' : ''}>Every 15 sec</option>
                            <option value="30000" ${state.refreshInterval === 30000 ? 'selected' : ''}>Every 30 sec</option>
                            <option value="45000" ${state.refreshInterval === 45000 ? 'selected' : ''}>Every 45 sec</option>
                            <option value="60000" ${state.refreshInterval === 60000 ? 'selected' : ''}>Every 1 min</option>
                            <option value="120000" ${state.refreshInterval === 120000 ? 'selected' : ''}>Every 2 min</option>
                            <option value="300000" ${state.refreshInterval === 300000 ? 'selected' : ''}>Every 5 min</option>
                        </select>
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