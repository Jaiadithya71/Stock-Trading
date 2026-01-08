const BankNiftyTable = {
    render(data, timestamp) {
        if (!data || data.length === 0) {
            return LoadingSpinner.render('Loading Bank Nifty data...');
        }

        const rows = data.map(row => {
            const isDataMissing = row.status === "Data Not Fetched" || row.status === "No Data";

            return `
                <tr data-action="view-details" data-bank="${row.bank}" class="${isDataMissing ? 'no-data-row' : ''}">
                    <td>${row.bank}</td>
                    <td>${row.open ? Formatters.formatCurrency(row.open) : '<span class="no-data-text">-</span>'}</td>
                    <td>${row.ltp ? Formatters.formatCurrency(row.ltp) : '<span class="no-data-text">-</span>'}</td>
                    <td>${row.volume ? Formatters.formatNumber(row.volume) : '<span class="no-data-text">-</span>'}</td>
                    <td class="${row.changePercent ? Formatters.getChangeClass(row.changePercent) : ''}">
                        ${row.changePercent ? Formatters.formatPercentage(row.changePercent) : '<span class="no-data-text">-</span>'}
                    </td>
                    <td class="${Formatters.getStatusClass(row.status)}">${row.status}</td>
                    <td>${row.weightage || '-'}%</td>
                </tr>
            `;
        }).join('');

        return `
            <div class="card" style="grid-column: span 2;">
                <div class="card-header">
                    <div>
                        <div class="card-title">Bank Nifty Stocks</div>
                        <div class="timestamp">Last updated: ${timestamp || '--'}</div>
                    </div>
                    <button class="refresh-btn" data-action="refresh-banknifty">🔄 Refresh</button>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>Bank</th>
                            <th>Open</th>
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