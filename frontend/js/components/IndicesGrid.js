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
            { name: 'Bank Nifty Future', key: 'BANKNIFTY' },
            { name: 'Nifty', key: 'NIFTY' },
            { name: 'Gift Nifty', key: null },
            { name: 'India VIX', key: 'INDIA VIX' }
        ];

        const rows = indices.map((index, idx) => {
            const label = String.fromCharCode(65 + idx); // A, B, C, D, E
            const ltpValue = index.key && data[index.key]?.ltp ? data[index.key].ltp : '--';
            
            return `
                <tr>
                    <td class="index-label">${label}</td>
                    <td class="index-name">${index.name}</td>
                    <td class="index-ltp">${ltpValue}</td>
                    ${timeIntervals.map(interval => {
                        if (!index.key) {
                            return `<td class="sentiment-cell coming-soon-cell">Coming Soon</td>`;
                        }
                        const sentiment = data[index.key]?.[interval.key] || 'No Data';
                        return `<td class="sentiment-cell ${Formatters.getSentimentClass(sentiment)}">${sentiment}</td>`;
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
                    <button class="refresh-btn" onclick="App.refreshIndices()">🔄 Refresh</button>
                </div>
                
                <div class="indices-table-wrapper">
                    <table class="indices-table">
                        <thead>
                            <tr>
                                <th rowspan="2" class="label-col"></th>
                                <th rowspan="2" class="name-col">Index</th>
                                <th rowspan="2" class="ltp-col">LTP</th>
                                ${timeIntervals.map(interval => 
                                    `<th class="interval-col">${interval.label}</th>`
                                ).join('')}
                            </tr>
                            <tr>
                                ${timeIntervals.map(interval => {
                                    const minutes = parseInt(interval.key.split('_')[0]) || 
                                                  (interval.key === 'ONE_MINUTE' ? 1 :
                                                   interval.key === 'THREE_MINUTE' ? 3 :
                                                   interval.key === 'FIVE_MINUTE' ? 5 :
                                                   interval.key === 'FIFTEEN_MINUTE' ? 15 :
                                                   interval.key === 'THIRTY_MINUTE' ? 30 : 60);
                                    return `<th class="time-range-col">${getTimeRange(minutes)}</th>`;
                                }).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${rows}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }
};