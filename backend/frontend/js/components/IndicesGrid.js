// frontend/js/components/IndicesGrid.js - UPDATED WITH LTP VALUE DISPLAY
const IndicesGrid = {
    render(data, timestamp) {
        if (!data || Object.keys(data).length === 0) {
            return LoadingSpinner.render('Loading indices data...');
        }

        const timeIntervals = [
            { key: 'ONE_MINUTE', label: '1 Min' },
            { key: 'THREE_MINUTE', label: '3 Min' },
            { key: 'FIVE_MINUTE', label: '5 Min' },
            { key: 'FIFTEEN_MINUTE', label: '15 Min' },
            { key: 'THIRTY_MINUTE', label: '30 Min' },
            { key: 'ONE_HOUR', label: '1 Hour' }
        ];

        // Get current time ranges for subheaders
        const now = new Date();
        const getTimeRange = (minutes) => {
            const start = new Date(now.getTime() - minutes * 60000);
            const formatTime = (d) => {
                const h = d.getHours().toString().padStart(2, '0');
                const m = d.getMinutes().toString().padStart(2, '0');
                return `${h}:${m}`;
            };
            return `${formatTime(start)}-${formatTime(now)}`;
        };

        const indices = [
            { name: 'Bank Nifty', key: 'BANKNIFTY' },
            { name: 'Bank Nifty Future', key: 'BANKNIFTY_FUT' },
            { name: 'Nifty', key: 'NIFTY' },
            { name: 'Nifty Future', key: 'NIFTY_FUT' },
            { name: 'India VIX', key: 'INDIA VIX' }
        ];

        const rows = indices.map((index, idx) => {
            const label = String.fromCharCode(65 + idx); // A, B, C, D, E
            const indexData = index.key && data[index.key];
            
            // Get current LTP value
            let ltpValue = '--';
            if (indexData && indexData.ltp) {
                ltpValue = indexData.ltp;
            }
            
            // Get data age if available
            let dataAge = '';
            let ageClass = '';
            if (indexData?.ltpTimestamp) {
                dataAge = Formatters.formatDataAge(indexData.ltpTimestamp);
                ageClass = Formatters.getDataAgeClass(indexData.ltpTimestamp);
            } else if (indexData?.fetchedAt) {
                dataAge = Formatters.formatDataAge(indexData.fetchedAt);
                ageClass = Formatters.getDataAgeClass(indexData.fetchedAt);
            }
            
            return `
                <tr>
                    <td class="index-label">${label}</td>
                    <td class="index-name">${index.name}</td>
                    <td class="ltp-col">
                        <div class="index-ltp-wrapper">
                            <div class="index-ltp">${ltpValue}</div>
                            ${dataAge ? `<span class="data-age ${ageClass}" title="Last updated ${dataAge}">${dataAge}</span>` : ''}
                        </div>
                    </td>
                    ${timeIntervals.map(interval => {
                        if (!index.key) {
                            return `<td class="interval-value-cell coming-soon-cell">Coming Soon</td>`;
                        }

                        // Get interval data
                        const intervalData = indexData?.intervals?.[interval.key];

                        if (!intervalData || intervalData.open === null) {
                            // Show tooltip with reason why data is unavailable
                            const reason = intervalData?.unavailableReason || 'Data not available for this interval';
                            const shortReason = reason.length > 50 ? reason.substring(0, 47) + '...' : reason;
                            return `<td class="interval-value-cell value-no-data" title="${reason}">
                                <span class="no-data-icon">--</span>
                            </td>`;
                        }

                        // Determine color class based on direction
                        const valueClass = Formatters.getValueDirectionClass(intervalData.direction);

                        // Parse change to number for proper comparison
                        const changeNum = intervalData.change !== null ? parseFloat(intervalData.change) : null;
                        const changeText = changeNum !== null
                            ? `${changeNum >= 0 ? '+' : ''}${changeNum.toFixed(2)}`
                            : '';

                        // Show OPEN price of interval (where candle started)
                        // Change shows: currentLTP - open (how much price moved)
                        return `
                            <td class="interval-value-cell ${valueClass}" title="Current: ${intervalData.ltp}">
                                <div class="interval-ltp-value">${intervalData.open}</div>
                                ${changeText ? `<div class="interval-change">${changeText}</div>` : ''}
                            </td>
                        `;
                    }).join('')}
                </tr>
            `;
        }).join('');

        return `
            <div class="card" style="grid-column: span 2;">
                <div class="card-header">
                    <div>
                        <div class="card-title">Market Indices</div>
                        <div class="timestamp">Last updated: ${timestamp || '--'}</div>
                    </div>
                    <button class="refresh-btn" data-action="refresh-indices">🔄 Refresh</button>
                </div>
                
                <div class="indices-table-wrapper">
                    <table class="indices-table">
                        <thead>
                            <tr>
                                <th rowspan="2" class="label-col"></th>
                                <th rowspan="2" class="name-col">Index</th>
                                <th rowspan="2" class="ltp-col">Current LTP</th>
                                ${timeIntervals.map(interval => 
                                    `<th class="interval-col">${interval.label}</th>`
                                ).join('')}
                            </tr>
                            <tr>
                                ${timeIntervals.map(interval => {
                                    const minutes = this.getIntervalMinutes(interval.key);
                                    return `<th class="time-range-col">${getTimeRange(minutes)}</th>`;
                                }).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${rows}
                        </tbody>
                    </table>
                </div>
                
                <div class="indices-legend">
                    <div class="legend-item">
                        <span class="legend-color value-positive">Green</span> = Price UP from interval open
                    </div>
                    <div class="legend-item">
                        <span class="legend-color value-negative">Red</span> = Price DOWN from interval open
                    </div>
                    <div class="legend-item">
                        <span class="legend-color value-neutral">Gray</span> = No change
                    </div>
                    <div class="legend-item" style="margin-left: 20px; color: #888;">
                        (Values show interval OPEN price, change shows movement to current LTP)
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Helper to get minutes from interval key
     */
    getIntervalMinutes(intervalKey) {
        const map = {
            'ONE_MINUTE': 1,
            'THREE_MINUTE': 3,
            'FIVE_MINUTE': 5,
            'FIFTEEN_MINUTE': 15,
            'THIRTY_MINUTE': 30,
            'ONE_HOUR': 60
        };
        return map[intervalKey] || 1;
    }
};