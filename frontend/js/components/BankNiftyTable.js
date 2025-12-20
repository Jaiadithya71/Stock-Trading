const BankNiftyTable = {
    render(data, timestamp) {
        if (!data || data.length === 0) {
            return LoadingSpinner.render('Loading Bank Nifty data...');
        }

        const rows = data.map(row => `
            <tr>
                <td>${row.bank}</td>
                <td>${Formatters.formatCurrency(row.ltp)}</td>
                <td>${Formatters.formatNumber(row.volume)}</td>
                <td class="${Formatters.getChangeClass(row.changePercent)}">
                    ${Formatters.formatPercentage(row.changePercent)}
                </td>
                <td class="${Formatters.getStatusClass(row.status)}">${row.status}</td>
                <td>${row.weightage || '-'}%</td>
            </tr>
        `).join('');

        return `
            <div class="card" style="grid-column: span 2;">
                <div class="card-header">
                    <div>
                        <div class="card-title">Bank Nifty Stocks</div>
                        <div class="timestamp">Last updated: ${timestamp || '--'}</div>
                    </div>
                    <button class="refresh-btn" onclick="App.refreshBankNifty()">🔄 Refresh</button>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>Bank</th>
                            <th>LTP</th>
                            <th>Volume</th>
                            <th>Change %</th>
                            <th>Status</th>
                            <th>Weightage</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;
    }
};