// frontend/js/components/OptionChain.js - NSE VERSION
const OptionChain = {
    render(data, selectedSymbol = 'BANKNIFTY') {
        // Show loading spinner if no data
        if (!data) {
            return LoadingSpinner.render('Loading NSE option chain...');
        }

        // Show error message if there was an error
        if (data.error) {
            return `
                <div class="card option-chain-container" style="grid-column: span 2;">
                    <div class="option-chain-header">
                        <div class="symbol-info">
                            <h2>📊 Option Chain</h2>
                        </div>
                    </div>
                    <div class="error-message" style="text-align: center; padding: 40px; color: #ef4444;">
                        <div style="font-size: 48px; margin-bottom: 20px;">⚠️</div>
                        <div style="font-size: 18px; margin-bottom: 10px;">Failed to load option chain</div>
                        <div style="color: #888;">${data.error}</div>
                        <button class="refresh-btn" data-action="refresh-nse-option-chain" style="margin-top: 20px;">
                            🔄 Try Again
                        </button>
                    </div>
                </div>
            `;
        }

        // Show loading if optionChain is not yet available
        if (!data.optionChain || data.optionChain.length === 0) {
            return LoadingSpinner.render('Loading NSE option chain...');
        }

        const { symbol, displayName, spotPrice, optionChain, timestamp, expiryDates, selectedExpiry, atmStrike, dataSource } = data;

        // Calculate statistics
        const stats = this.calculateStatistics(optionChain);

        return `
            <div class="card option-chain-container" style="grid-column: span 2;">
                ${this.renderHeader(displayName, spotPrice, expiryDates, selectedExpiry, selectedSymbol, dataSource)}
                ${this.renderStats(stats)}
                ${this.renderTable(optionChain, atmStrike)}
                <div class="timestamp" style="text-align: center; margin-top: 15px;">
                    Last updated: ${new Date(timestamp).toLocaleString()}
                    <span class="data-source-badge">Data Source: ${dataSource}</span>
                </div>
            </div>
        `;
    },

    renderHeader(displayName, spotPrice, expiryDates, selectedExpiry, selectedSymbol, dataSource) {
        const expiryOptions = expiryDates ? expiryDates.map(exp => `
            <option value="${exp}" ${exp === selectedExpiry ? 'selected' : ''}>${exp}</option>
        `).join('') : '';

        return `
            <div class="option-chain-header">
                <div class="symbol-info">
                    <h2>📊 ${displayName} Option Chain</h2>
                    <div class="spot-price">Spot: ₹${spotPrice.toFixed(2)}</div>
                    <div class="data-source-info" style="font-size: 12px; color: #4ade80; margin-top: 5px;">
                        🌐 Live data from NSE
                    </div>
                </div>
                
                <div class="symbol-selector">
                    <button 
                        class="symbol-btn ${selectedSymbol === 'NIFTY' ? 'active' : ''}"
                        data-action="select-nse-symbol"
                        data-symbol="NIFTY"
                    >
                        NIFTY
                    </button>
                    <button 
                        class="symbol-btn ${selectedSymbol === 'BANKNIFTY' ? 'active' : ''}"
                        data-action="select-nse-symbol"
                        data-symbol="BANKNIFTY"
                    >
                        BANK NIFTY
                    </button>
                    <button 
                        class="symbol-btn ${selectedSymbol === 'FINNIFTY' ? 'active' : ''}"
                        data-action="select-nse-symbol"
                        data-symbol="FINNIFTY"
                    >
                        FIN NIFTY
                    </button>
                </div>
                
                <div class="expiry-selector">
                    <label>Expiry:</label>
                    <select data-change-action="change-nse-expiry">
                        ${expiryOptions}
                    </select>
                </div>
                
                <button class="refresh-btn" data-action="refresh-nse-option-chain">
                    🔄 Refresh
                </button>
            </div>
        `;
    },

    renderStats(stats) {
        return `
            <div class="option-chain-stats">
                <div class="stat-box">
                    <div class="stat-label">Call OI</div>
                    <div class="stat-value positive">${Formatters.formatNumber(stats.totalCallOI)}</div>
                </div>
                <div class="stat-box">
                    <div class="stat-label">Put OI</div>
                    <div class="stat-value negative">${Formatters.formatNumber(stats.totalPutOI)}</div>
                </div>
                <div class="stat-box">
                    <div class="stat-label">PCR (OI)</div>
                    <div class="stat-value ${stats.pcr > 1 ? 'positive' : 'negative'}">${stats.pcr}</div>
                </div>
                <div class="stat-box">
                    <div class="stat-label">Max Call OI</div>
                    <div class="stat-value">${stats.maxCallOIStrike}</div>
                </div>
                <div class="stat-box">
                    <div class="stat-label">Max Put OI</div>
                    <div class="stat-value">${stats.maxPutOIStrike}</div>
                </div>
                <div class="stat-box">
                    <div class="stat-label">Call Vol</div>
                    <div class="stat-value">${Formatters.formatNumber(stats.totalCallVolume)}</div>
                </div>
                <div class="stat-box">
                    <div class="stat-label">Put Vol</div>
                    <div class="stat-value">${Formatters.formatNumber(stats.totalPutVolume)}</div>
                </div>
            </div>
        `;
    },

    renderTable(optionChain, atmStrike) {
        const rows = optionChain.map(row => {
            const { strike, isATM, call, put } = row;

            return `
                <tr class="${isATM ? 'atm-strike' : ''}">
                    <!-- CALLS Section -->
                    <td class="oi-cell">${this.formatOI(call?.openInterest)}</td>
                    <td class="change-oi-cell ${this.getChangeClass(call?.changeinOpenInterest)}">${this.formatChange(call?.changeinOpenInterest)}</td>
                    <td class="volume-cell">${this.formatVolume(call?.totalTradedVolume)}</td>
                    <td class="iv-cell">${this.formatIV(call?.impliedVolatility)}</td>
                    <td class="ltp-cell ${this.getChangeClass(call?.change)}">${this.formatLTP(call?.lastPrice)}</td>
                    <td class="change-cell ${this.getChangeClass(call?.pChange)}">${this.formatPercentChange(call?.pChange)}</td>
                    <td class="bid-ask-cell">
                        <span class="bid">${this.formatPrice(call?.bidprice)}</span> / 
                        <span class="ask">${this.formatPrice(call?.askPrice)}</span>
                    </td>
                    
                    <!-- STRIKE -->
                    <td class="strike-cell">${strike}</td>
                    
                    <!-- PUTS Section -->
                    <td class="bid-ask-cell">
                        <span class="bid">${this.formatPrice(put?.bidprice)}</span> / 
                        <span class="ask">${this.formatPrice(put?.askPrice)}</span>
                    </td>
                    <td class="change-cell ${this.getChangeClass(put?.pChange)}">${this.formatPercentChange(put?.pChange)}</td>
                    <td class="ltp-cell ${this.getChangeClass(put?.change)}">${this.formatLTP(put?.lastPrice)}</td>
                    <td class="iv-cell">${this.formatIV(put?.impliedVolatility)}</td>
                    <td class="volume-cell">${this.formatVolume(put?.totalTradedVolume)}</td>
                    <td class="change-oi-cell ${this.getChangeClass(put?.changeinOpenInterest)}">${this.formatChange(put?.changeinOpenInterest)}</td>
                    <td class="oi-cell">${this.formatOI(put?.openInterest)}</td>
                </tr>
            `;
        }).join('');

        return `
            <div class="option-table-wrapper">
                <table class="option-chain-table">
                    <thead>
                        <tr>
                            <th colspan="7" class="calls-header">CALLS</th>
                            <th rowspan="2" class="strike-header">STRIKE</th>
                            <th colspan="7" class="puts-header">PUTS</th>
                        </tr>
                        <tr>
                            <th>OI</th>
                            <th>Chng in OI</th>
                            <th>Volume</th>
                            <th>IV</th>
                            <th>LTP</th>
                            <th>Chng%</th>
                            <th>Bid/Ask</th>
                            
                            <th>Bid/Ask</th>
                            <th>Chng%</th>
                            <th>LTP</th>
                            <th>IV</th>
                            <th>Volume</th>
                            <th>Chng in OI</th>
                            <th>OI</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </div>
        `;
    },

    calculateStatistics(optionChain) {
        let totalCallOI = 0;
        let totalPutOI = 0;
        let totalCallVolume = 0;
        let totalPutVolume = 0;
        let maxCallOI = 0;
        let maxPutOI = 0;
        let maxCallOIStrike = 0;
        let maxPutOIStrike = 0;

        optionChain.forEach(row => {
            const callOI = row.call?.openInterest || 0;
            const putOI = row.put?.openInterest || 0;
            const callVol = row.call?.totalTradedVolume || 0;
            const putVol = row.put?.totalTradedVolume || 0;

            totalCallOI += callOI;
            totalPutOI += putOI;
            totalCallVolume += callVol;
            totalPutVolume += putVol;

            if (callOI > maxCallOI) {
                maxCallOI = callOI;
                maxCallOIStrike = row.strike;
            }

            if (putOI > maxPutOI) {
                maxPutOI = putOI;
                maxPutOIStrike = row.strike;
            }
        });

        const pcr = totalCallOI > 0 ? (totalPutOI / totalCallOI).toFixed(2) : '0.00';

        return {
            totalCallOI,
            totalPutOI,
            totalCallVolume,
            totalPutVolume,
            pcr,
            maxCallOIStrike,
            maxPutOIStrike
        };
    },

    // Formatting helpers
    formatOI(value) {
        return value > 0 ? Formatters.formatNumber(value) : '-';
    },

    formatVolume(value) {
        return value > 0 ? Formatters.formatNumber(value) : '-';
    },

    formatLTP(value) {
        return value > 0 ? '₹' + value.toFixed(2) : '-';
    },

    formatPrice(value) {
        return value > 0 ? value.toFixed(2) : '-';
    },

    formatIV(value) {
        return value > 0 ? value.toFixed(2) + '%' : '-';
    },

    formatChange(value) {
        if (!value || value === 0) return '-';
        return value > 0 ? '+' + Formatters.formatNumber(value) : Formatters.formatNumber(value);
    },

    formatPercentChange(value) {
        if (!value || value === 0) return '-';
        return value > 0 ? '+' + value.toFixed(2) + '%' : value.toFixed(2) + '%';
    },

    getChangeClass(value) {
        if (!value || value === 0) return '';
        return value > 0 ? 'positive' : 'negative';
    }
};