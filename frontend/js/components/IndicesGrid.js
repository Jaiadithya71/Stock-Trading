const IndicesGrid = {
    render(data, timestamp) {
        if (!data || Object.keys(data).length === 0) {
            return LoadingSpinner.render('Loading indices data...');
        }

        const cards = Object.entries(data).map(([symbol, intervals]) => {
            const badges = Object.entries(intervals).map(([interval, sentiment]) => `
                <div class="sentiment-badge ${Formatters.getSentimentClass(sentiment)}">
                    ${Formatters.formatInterval(interval)}: ${sentiment}
                </div>
            `).join('');

            return `
                <div class="index-card">
                    <div class="index-name">${symbol}</div>
                    <div class="sentiment-grid">${badges}</div>
                </div>
            `;
        }).join('');

        return `
            <div class="card">
                <div class="card-header">
                    <div>
                        <div class="card-title">Market Indices</div>
                        <div class="timestamp">Last updated: ${timestamp || '--'}</div>
                    </div>
                    <button class="refresh-btn" onclick="App.refreshIndices()">🔄 Refresh</button>
                </div>
                <div class="indices-grid">${cards}</div>
            </div>
        `;
    }
};