// frontend/js/components/CurrencyWidget.js
const CurrencyWidget = {
    render(data, timestamp) {
        if (!data || !data.currencies || data.currencies.length === 0) {
            return LoadingSpinner.render('Loading currency rates...');
        }

        const currencies = data.currencies;
        
        // Currency symbols and full names
        const currencyInfo = {
            'USD': { symbol: '$', name: 'US Dollar', flag: '🇺🇸' },
            'YEN': { symbol: '¥', name: 'Japanese Yen', flag: '🇯🇵' },
            'GBP': { symbol: '£', name: 'British Pound', flag: '🇬🇧' },
            'EURO': { symbol: '€', name: 'Euro', flag: '🇪🇺' }
        };

        const currencyCards = currencies.map(curr => {
            const info = currencyInfo[curr.currency] || { symbol: '', name: curr.currency, flag: '🌍' };
            const changeClass = curr.change >= 0 ? 'change-positive' : 'change-negative';
            const changeIcon = curr.change >= 0 ? '▲' : '▼';
            
            return `
                <div class="currency-card" data-currency="${curr.currency}">
                    <div class="currency-header">
                        <span class="currency-flag">${info.flag}</span>
                        <div class="currency-title">
                            <div class="currency-code">${curr.currency}</div>
                            <div class="currency-name">${info.name}</div>
                        </div>
                    </div>
                    
                    <div class="currency-main">
                        <div class="currency-rate">
                            <span class="currency-symbol">₹</span>
                            <span class="currency-value">${curr.value.toFixed(4)}</span>
                        </div>
                        <div class="currency-unit">per ${curr.unit} ${info.symbol}</div>
                    </div>
                    
                    <div class="currency-change ${changeClass}">
                        <span class="change-icon">${changeIcon}</span>
                        <span class="change-value">${Math.abs(curr.change).toFixed(4)}</span>
                        <span class="change-percent">(${curr.changePercent > 0 ? '+' : ''}${curr.changePercent}%)</span>
                    </div>
                    
                    <div class="currency-prev">
                        <span class="prev-label">Previous:</span>
                        <span class="prev-value">₹${curr.prevDayValue.toFixed(4)}</span>
                    </div>
                </div>
            `;
        }).join('');

        // Data freshness indicator
        const freshnessClass = data.meta?.stale ? 'data-stale' : 'data-fresh';
        const freshnessText = data.meta?.cached ? 
            (data.meta?.stale ? '⚠️ Stale Data' : '💾 Cached') : 
            '🟢 Live';

        return `
            <div class="card">
                <div class="card-header">
                    <div>
                        <div class="card-title">
                            💱 Currency Exchange Rates
                            <span class="data-freshness ${freshnessClass}">${freshnessText}</span>
                        </div>
                        <div class="timestamp">
                            ${data.timestamp ? `NSE Time: ${data.timestamp}` : ''}
                            <br>
                            Last updated: ${timestamp || '--'}
                        </div>
                    </div>
                    <button class="refresh-btn" data-action="refresh-currency">🔄 Refresh</button>
                </div>
                
                <div class="currency-grid">
                    ${currencyCards}
                </div>
                
                <div class="currency-footer">
                    <small>Exchange rates sourced from NSE India • Rates in INR</small>
                </div>
            </div>
        `;
    }
};