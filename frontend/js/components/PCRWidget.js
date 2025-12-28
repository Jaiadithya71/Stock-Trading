// frontend/js/components/PCRWidget.js - ENHANCED with better no-data handling
const PCRWidget = {
    render(data, timestamp) {
        if (!data || !data.intervals) {
            return this.renderNoData();
        }

        const { symbol, intervals, totalSnapshots } = data;

        // Check if we have enough data
        if (totalSnapshots === 0 || Object.keys(intervals).length === 0) {
            return this.renderNoData();
        }

        return `
            <div class="card pcr-widget-container">
                ${this.renderHeader(symbol, totalSnapshots, timestamp)}
                ${this.renderTable(intervals)}
                ${this.renderFooter(timestamp)}
            </div>
        `;
    },

    renderNoData() {
        return `
            <div class="card pcr-widget-container">
                <div class="card-header">
                    <div class="card-title">📊 Put-Call Ratio (PCR) Analysis</div>
                </div>
                <div class="pcr-no-data">
                    <div class="pcr-no-data-icon">⏳</div>
                    <div class="pcr-no-data-title">PCR Data Collecting...</div>
                    <div class="pcr-no-data-message">
                        <p>The PCR collector is gathering data in the background.</p>
                        <p><strong>What's happening:</strong></p>
                        <ul style="text-align: left; display: inline-block; margin: 15px 0;">
                            <li>✅ Background collector is running</li>
                            <li>⏰ Collects data every 1 minute</li>
                            <li>📊 Data will appear after 2-3 snapshots</li>
                        </ul>
                        <p style="margin-top: 15px;">
                            <strong>Expected wait time:</strong> 2-3 minutes
                        </p>
                        <p style="font-size: 12px; color: #666; margin-top: 10px;">
                            The dashboard will continue to load and refresh normally.
                            <br>
                            PCR data will appear automatically when ready.
                        </p>
                    </div>
                    <button class="refresh-btn" data-action="refresh-pcr" style="margin-top: 20px;">
                        🔄 Check for Data
                    </button>
                </div>
            </div>
        `;
    },

    renderHeader(symbol, totalSnapshots, timestamp) {
        return `
            <div class="card-header">
                <div>
                    <div class="card-title">📊 Put-Call Ratio (PCR) Analysis - ${symbol}</div>
                    <div class="timestamp">
                        ${totalSnapshots} snapshots collected | Last updated: ${timestamp || '--'}
                    </div>
                </div>
                <button class="refresh-btn" data-action="refresh-pcr">🔄 Refresh</button>
            </div>
        `;
    },

    renderTable(intervals) {
        // Time intervals to display
        const timeIntervals = [
            { key: '1min', label: '1min' },
            { key: '3min', label: '3min' },
            { key: '5min', label: '5min' },
            { key: '15min', label: '15min' }
        ];

        return `
            <div class="pcr-table-wrapper">
                <table class="pcr-table">
                    <thead>
                        <tr>
                            <th class="pcr-metric-col">Option</th>
                            <th class="pcr-label-col">PCR</th>
                            ${timeIntervals.map(interval => `
                                <th class="pcr-interval-col">${interval.label}</th>
                            `).join('')}
                            <th class="pcr-grand-col">Grand<br>Bank Nifty</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.renderCurrentValueRow(intervals, timeIntervals)}
                        ${this.renderPCRChangeRow(intervals, timeIntervals)}
                        ${this.renderPCRVolumeRow(intervals, timeIntervals)}
                    </tbody>
                </table>
            </div>
        `;
    },

    renderCurrentValueRow(intervals, timeIntervals) {
        return `
            <tr class="pcr-row">
                <td class="pcr-metric-cell" rowspan="2">Current Value</td>
                <td class="pcr-label-cell">value</td>
                ${timeIntervals.map(interval => {
                    const data = intervals[interval.key];
                    return `
                        <td class="pcr-value-cell">
                            ${data ? data.pcr : '--'}
                        </td>
                    `;
                }).join('')}
                <td class="pcr-grand-cell" rowspan="2">
                    ${this.renderGrandSentiment(intervals)}
                </td>
            </tr>
            <tr class="pcr-row">
                <td class="pcr-label-cell">Sentiment</td>
                ${timeIntervals.map(interval => {
                    const data = intervals[interval.key];
                    return `
                        <td class="pcr-sentiment-cell ${this.getSentimentClass(data?.sentiment)}">
                            ${data?.sentiment || 'N/A'}
                        </td>
                    `;
                }).join('')}
            </tr>
        `;
    },

    renderPCRChangeRow(intervals, timeIntervals) {
        return `
            <tr class="pcr-row">
                <td class="pcr-metric-cell" rowspan="2">PCR change - inc/dec</td>
                <td class="pcr-label-cell">value</td>
                ${timeIntervals.map(interval => {
                    const data = intervals[interval.key];
                    const changeClass = this.getChangeClass(data?.change);
                    return `
                        <td class="pcr-change-cell ${changeClass}">
                            ${data?.change ? (parseFloat(data.change) >= 0 ? '+' : '') + data.change : '--'}
                        </td>
                    `;
                }).join('')}
                <td class="pcr-trend-cell" rowspan="2">
                    ${this.renderTrend(intervals)}
                </td>
            </tr>
            <tr class="pcr-row">
                <td class="pcr-label-cell">%</td>
                ${timeIntervals.map(interval => {
                    const data = intervals[interval.key];
                    const changeClass = this.getChangeClass(data?.changePercent);
                    return `
                        <td class="pcr-change-cell ${changeClass}">
                            ${data?.changePercent ? (parseFloat(data.changePercent) >= 0 ? '+' : '') + data.changePercent + '%' : '--'}
                        </td>
                    `;
                }).join('')}
            </tr>
        `;
    },

    renderPCRVolumeRow(intervals, timeIntervals) {
        return `
            <tr class="pcr-row">
                <td class="pcr-metric-cell">PCR Volume</td>
                <td class="pcr-label-cell">Data Points</td>
                ${timeIntervals.map(interval => {
                    const data = intervals[interval.key];
                    return `
                        <td class="pcr-volume-cell">
                            ${data?.dataPoints || 0}
                        </td>
                    `;
                }).join('')}
                <td class="pcr-total-cell">
                    ${this.calculateTotalDataPoints(intervals)}
                </td>
            </tr>
        `;
    },

    renderGrandSentiment(intervals) {
        // Use 5min interval as the "grand" sentiment
        const fiveMinData = intervals['5min'];
        if (!fiveMinData) return 'Neutral';
        
        const sentiment = fiveMinData.sentiment;
        return `<span class="pcr-grand-sentiment ${this.getSentimentClass(sentiment)}">${sentiment}</span>`;
    },

    renderTrend(intervals) {
        // Show trend from 5min interval
        const fiveMinData = intervals['5min'];
        if (!fiveMinData) return '--';
        
        const trend = fiveMinData.trend;
        let trendIcon = '→';
        let trendClass = 'neutral';
        
        if (trend === 'Rising') {
            trendIcon = '↑';
            trendClass = 'rising';
        } else if (trend === 'Falling') {
            trendIcon = '↓';
            trendClass = 'falling';
        }
        
        return `<span class="pcr-trend ${trendClass}">${trendIcon} ${trend}</span>`;
    },

    calculateTotalDataPoints(intervals) {
        let total = 0;
        Object.values(intervals).forEach(data => {
            if (data && data.dataPoints) {
                total += data.dataPoints;
            }
        });
        return total;
    },

    getSentimentClass(sentiment) {
        if (!sentiment) return 'sentiment-neutral';
        
        const s = sentiment.toLowerCase();
        if (s === 'buying' || s.includes('buying')) {
            return 'sentiment-buying';
        } else if (s === 'selling' || s.includes('selling')) {
            return 'sentiment-selling';
        } else {
            return 'sentiment-neutral';
        }
    },

    getChangeClass(value) {
        if (!value) return '';
        const numValue = parseFloat(value);
        if (numValue > 0) return 'change-positive';
        if (numValue < 0) return 'change-negative';
        return '';
    },

    renderFooter(timestamp) {
        return `
            <div class="pcr-footer">
                <div class="pcr-legend">
                    <div class="pcr-legend-item">
                        <span class="sentiment-buying">Buying</span> = PCR &lt; 0.8 (Bullish)
                    </div>
                    <div class="pcr-legend-item">
                        <span class="sentiment-neutral">Neutral</span> = PCR 0.8-1.2
                    </div>
                    <div class="pcr-legend-item">
                        <span class="sentiment-selling">Selling</span> = PCR &gt; 1.2 (Bearish)
                    </div>
                </div>
            </div>
        `;
    }
};