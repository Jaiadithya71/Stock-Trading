// frontend/js/components/OptionChain.js
const OptionChain = {
    render(data, expiries, selectedSymbol) {
        if (!data || !data.optionChain) {
            return LoadingSpinner.render('Loading option chain...');
        }

        const { symbol, displayName, spotPrice, optionChain, timestamp, lotSize } = data;

        // Calculate statistics
        const stats = this.calculateStatistics(optionChain);

        return `
            <div class="card option-chain-container" style="grid-column: span 2;">
                ${this.renderHeader(displayName, spotPrice, expiries, selectedSymbol)}
                ${this.renderStats(stats, lotSize)}
                ${this.renderTable(optionChain, spotPrice)}
                <div class="timestamp" style="text-align: center; margin-top: 15px;">
                    Last updated: ${new Date(timestamp).toLocaleTimeString()}
                </div>
            </div>
        `;
    },

    renderHeader(displayName, spotPrice, expiries, selectedSymbol) {
        const expiryOptions = expiries ? expiries.map(exp => `
            <option value="${exp.date}">${exp.formatted} (${exp.type})</option>
        `).join('') : '';

        return `
            <div class="option-chain-header">
                <div class="symbol-info">
                    <h2>📊 ${displayName} Option Chain</h2>
                    <div class="spot-price">Spot: ₹${spotPrice.toFixed(2)}</div>
                </div>
                
                <div class="symbol-selector">
                    <button 
                        class="symbol-btn ${selectedSymbol === 'NIFTY' ? 'active' : ''}"
                        data-action="select-option-symbol"
                        data-symbol="NIFTY"
                    >
                        NIFTY
                    </button>
                    <button 
                        class="symbol-btn ${selectedSymbol === 'BANKNIFTY' ? 'active' : ''}"
                        data-action="select-option-symbol"
                        data-symbol="BANKNIFTY"
                    >
                        BANK NIFTY
                    </button>
                    <button 
                        class="symbol-btn ${selectedSymbol === 'FINNIFTY' ? 'active' : ''}"
                        data-action="select-option-symbol"
                        data-symbol="FINNIFTY"
                    >
                        FIN NIFTY
                    </button>
                </div>
                
                <div class="expiry-selector">
                    <label>Expiry:</label>
                    <select data-change-action="change-option-expiry">
                        ${expiryOptions}
                    </select>
                </div>
                
                <button class="refresh-btn" data-action="refresh-option-chain">
                    🔄 Refresh
                </button>
            </div>
        `;
    },

    renderStats(stats, lotSize) {
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
                    <div class="stat-label">Lot Size</div>
                    <div class="stat-value">${lotSize}</div>
                </div>
            </div>
        `;
    },

    renderTable(optionChain, spotPrice) {
        const rows = optionChain.map(row => {
            const { strike, isATM, call, put } = row;
            const isCallITM = strike < spotPrice;
            const isPutITM = strike > spotPrice;

            return `
                <tr class="${isATM ? 'atm-strike' : ''} ${isCallITM ? 'itm-call' : ''} ${isPutITM ? 'itm-put' : ''}">
                    <!-- CALLS Section -->
                    <td class="oi-cell">${this.formatOI(call.oi)}</td>
                    <td class="change-oi-cell ${this.getChangeClass(call.changeInOI)}">${this.formatChange(call.changeInOI)}</td>
                    <td class="volume-cell">${this.formatVolume(call.volume)}</td>
                    <td class="iv-cell">${this.formatIV(call.iv)}</td>
                    <td class="ltp-cell ${this.getChangeClass(call.change)}">${this.formatLTP(call.ltp)}</td>
                    <td class="change-cell ${this.getChangeClass(call.changePercent)}">${this.formatPercentChange(call.changePercent)}</td>
                    <td class="bid-ask-cell">
                        <span class="bid">${this.formatPrice(call.bidPrice)}</span> / 
                        <span class="ask">${this.formatPrice(call.askPrice)}</span>
                    </td>
                    
                    <!-- STRIKE -->
                    <td class="strike-cell">${strike}</td>
                    
                    <!-- PUTS Section -->
                    <td class="bid-ask-cell">
                        <span class="bid">${this.formatPrice(put.bidPrice)}</span> / 
                        <span class="ask">${this.formatPrice(put.askPrice)}</span>
                    </td>
                    <td class="change-cell ${this.getChangeClass(put.changePercent)}">${this.formatPercentChange(put.changePercent)}</td>
                    <td class="ltp-cell ${this.getChangeClass(put.change)}">${this.formatLTP(put.ltp)}</td>
                    <td class="iv-cell">${this.formatIV(put.iv)}</td>
                    <td class="volume-cell">${this.formatVolume(put.volume)}</td>
                    <td class="change-oi-cell ${this.getChangeClass(put.changeInOI)}">${this.formatChange(put.changeInOI)}</td>
                    <td class="oi-cell">${this.formatOI(put.oi)}</td>
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
        let maxCallOI = 0;
        let maxPutOI = 0;
        let maxCallOIStrike = 0;
        let maxPutOIStrike = 0;

        optionChain.forEach(row => {
            const callOI = row.call.oi || 0;
            const putOI = row.put.oi || 0;

            totalCallOI += callOI;
            totalPutOI += putOI;

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