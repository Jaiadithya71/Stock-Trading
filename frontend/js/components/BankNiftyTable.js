// ============================================================================
// FILE: frontend/js/components/BankNiftyTable.js
// Institutional Bank Nifty Constituent Stocks Matrix
// ============================================================================

const BankNiftyTable = {
    render(data, timestamp) {
        if (!data || data.length === 0) {
            return LoadingSpinner.render('Loading Bank Nifty data...');
        }

        const rows = data.map(row => {
            const isDataMissing = row.status === "Data Not Fetched" || row.status === "No Data";
            let statusPillClass = 'status-pill neutral';
            let statusText = row.status || 'Neutral';

            if (statusText === 'Buying' || statusText === 'Strong Buying') {
                statusPillClass = 'status-pill buying';
            } else if (statusText === 'Selling' || statusText === 'Strong Selling') {
                statusPillClass = 'status-pill selling';
            }

            return `
                <tr data-action="view-details" data-bank="${row.bank}" class="${isDataMissing ? 'no-data-row' : ''}">
                    <td style="text-align: left; font-weight: 600; color: #f8fafc; font-family: var(--font-ui);">${row.bank}</td>
                    <td class="num">${row.open ? Formatters.formatCurrency(row.open) : '<span class="no-data-text">-</span>'}</td>
                    <td class="num" style="font-weight: 700; color: #38bdf8;">${row.ltp ? Formatters.formatCurrency(row.ltp) : '<span class="no-data-text">-</span>'}</td>
                    <td class="num">${row.volume ? Formatters.formatNumber(row.volume) : '<span class="no-data-text">-</span>'}</td>
                    <td class="num ${row.changePercent ? Formatters.getChangeClass(row.changePercent) : ''}">
                        ${row.changePercent ? Formatters.formatPercentage(row.changePercent) : '<span class="no-data-text">-</span>'}
                    </td>
                    <td><span class="${statusPillClass}">${statusText}</span></td>
                    <td class="num" style="font-weight: 600; color: #f59e0b;">${row.weightage || '-'}%</td>
                </tr>
            `;
        }).join('');

        return `
            <div class="card" style="grid-column: span 2; margin-top: 10px;">
                <div class="card-header">
                    <div>
                        <div class="card-title">🏦 Bank Nifty Heavyweight Constituents</div>
                        <div class="timestamp">Real-Time Weightage & Orderflow Confluence Matrix</div>
                    </div>
                    <button class="btn-icon" data-action="refresh-banknifty">
                        🔄 Refresh
                    </button>
                </div>
                <div class="indices-table-wrapper">
                    <table class="indices-table">
                        <thead>
                            <tr>
                                <th style="text-align: left; padding-left: 16px;">Bank Symbol</th>
                                <th>Open</th>
                                <th>LTP</th>
                                <th>Volume</th>
                                <th>Change %</th>
                                <th>Flow Status</th>
                                <th>Index Weight</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            </div>
        `;
    }
};