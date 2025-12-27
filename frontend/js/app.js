// frontend/js/app.js - COMPLETE WITH NSE OPTION CHAIN
const App = {
    state: {
        currentUsername: '',
        bankNiftyData: null,
        indicesData: null,
        currencyData: null,
        nseOptionChainData: null,
        bankNiftyTimestamp: null,
        indicesTimestamp: null,
        currencyTimestamp: null,
        refreshIntervalId: null,
        refreshIntervalTime: 60000,
        autoRefreshEnabled: true,
        selectedInterval: 'ONE_MINUTE',
        selectedNSESymbol: 'BANKNIFTY',
        selectedNSEExpiry: null,
        showCurrency: true,
        showOptionChain: false,
        filters: {
            showBuying: true,
            showSelling: true,
            showNeutral: true
        }
    },

    async init() {
        Helpers.log('Initializing app...');
        EventHandler.init();
        this.registerEventHandlers();
        this.renderModals();
    },

    registerEventHandlers() {
        // Authentication handlers
        EventHandler.on('check-user', () => this.checkUser());
        EventHandler.on('save-credentials', () => this.saveAndAuthenticate());
        
        // Dashboard handlers
        EventHandler.on('refresh-banknifty', () => this.refreshBankNifty());
        EventHandler.on('refresh-indices', () => this.refreshIndices());
        EventHandler.on('refresh-currency', () => this.refreshCurrency());
        EventHandler.on('refresh-all', () => this.loadAllData());
        
        // NSE Option Chain handlers
        EventHandler.on('refresh-nse-option-chain', () => this.refreshNSEOptionChain());
        EventHandler.on('select-nse-symbol', (e, target) => this.selectNSESymbol(target.dataset.symbol));
        EventHandler.on('change-nse-expiry', (e, target) => this.changeNSEExpiry(target.value));
        EventHandler.on('toggle-option-chain', (e, target) => this.toggleOptionChain(target));
        
        // Toggle handlers
        EventHandler.on('toggle-autorefresh', (e, target) => this.toggleAutoRefresh(target));
        EventHandler.on('toggle-filter', (e, target) => this.toggleFilter(target));
        EventHandler.on('toggle-currency', (e, target) => this.toggleCurrency(target));
        
        // Interval selectors
        EventHandler.on('change-interval', (e, target) => this.changeInterval(target));
        EventHandler.on('change-refresh-interval', (e, target) => this.changeRefreshInterval(target));
        
        // Export handlers
        EventHandler.on('export-csv', () => this.exportToCSV());
        EventHandler.on('export-json', () => this.exportToJSON());
        
        // Settings
        EventHandler.on('open-settings', () => this.openSettings());
        EventHandler.on('save-settings', () => this.saveSettings());
    },

    renderModals() {
        const app = document.getElementById('app');
        app.innerHTML = LoginModal.render() + CredentialsModal.render();
    },

    async checkUser() {
        const username = document.getElementById('username').value.trim();
        
        if (!username) {
            Helpers.showError('loginError', 'Please enter a username');
            return;
        }

        this.state.currentUsername = username;
        
        try {
            const result = await ApiService.checkUser(username);
            
            if (result.exists) {
                await this.authenticate();
            } else {
                LoginModal.hide();
                CredentialsModal.show();
            }
        } catch (error) {
            Helpers.showError('loginError', 'Connection error. Please check if server is running.');
        }
    },

    async saveAndAuthenticate() {
        const credentials = {
            api_key: document.getElementById('apiKey').value.trim(),
            client_id: document.getElementById('clientId').value.trim(),
            password: document.getElementById('password').value.trim(),
            totp_token: document.getElementById('totpToken').value.trim()
        };

        if (!credentials.api_key || !credentials.client_id || !credentials.password || !credentials.totp_token) {
            Helpers.showError('credError', 'Please fill all fields');
            return;
        }

        try {
            const result = await ApiService.saveCredentials(this.state.currentUsername, credentials);
            
            if (result.success) {
                Helpers.showSuccess('credError', 'Credentials saved! Authenticating...');
                setTimeout(() => this.authenticate(), 1000);
            } else {
                Helpers.showError('credError', result.message);
            }
        } catch (error) {
            Helpers.showError('credError', 'Error saving credentials');
        }
    },

    async authenticate() {
        try {
            const result = await ApiService.authenticate(this.state.currentUsername);
            
            if (result.success) {
                LoginModal.hide();
                CredentialsModal.hide();
                this.renderDashboard();
                await this.loadAllData();
                this.startAutoRefresh();
            } else {
                Helpers.showError('loginError', result.message);
                LoginModal.show();
                CredentialsModal.hide();
            }
        } catch (error) {
            Helpers.showError('loginError', 'Authentication failed');
        }
    },

    renderDashboard() {
        const app = document.getElementById('app');
        app.innerHTML = `
            ${Header.render(this.state.currentUsername)}
            ${Toolbar.render(this.state)}
            <div class="dashboard-container" id="dashboardContent">
                ${LoadingSpinner.render('Loading dashboard...')}
            </div>
        `;
    },

    async loadAllData() {
        const promises = [
            this.fetchBankNiftyData(),
            this.fetchIndicesData()
        ];
        
        if (this.state.showCurrency) {
            promises.push(this.fetchCurrencyData());
        }

        if (this.state.showOptionChain) {
            promises.push(this.fetchNSEOptionChain());
        }
        
        await Promise.all(promises);
        this.updateDashboard();
    },

    async fetchBankNiftyData() {
        try {
            const result = await ApiService.getBankNiftyData(this.state.currentUsername);
            if (result.success) {
                this.state.bankNiftyData = result.data;
                this.state.bankNiftyTimestamp = Helpers.getCurrentTime();
            }
        } catch (error) {
            Helpers.log('Error fetching Bank Nifty data: ' + error.message, 'error');
        }
    },

    async fetchIndicesData() {
        try {
            const result = await ApiService.getIndicesData(this.state.currentUsername);
            if (result.success) {
                this.state.indicesData = result.data;
                this.state.indicesTimestamp = Helpers.getCurrentTime();
            }
        } catch (error) {
            Helpers.log('Error fetching indices data: ' + error.message, 'error');
        }
    },

    async fetchCurrencyData() {
        try {
            const result = await ApiService.getCurrencyRates(this.state.currentUsername);
            if (result.success) {
                this.state.currencyData = result;
                this.state.currencyTimestamp = Helpers.getCurrentTime();
                Helpers.log('Currency rates fetched: ' + result.currencies.length + ' currencies');
            }
        } catch (error) {
            Helpers.log('Error fetching currency data: ' + error.message, 'error');
        }
    },

    async fetchNSEOptionChain() {
        try {
            Helpers.log('Fetching NSE option chain for ' + this.state.selectedNSESymbol + '...');
            const result = await ApiService.getNSEOptionChain(
                this.state.selectedNSESymbol,
                this.state.selectedNSEExpiry
            );
            
            if (result.success) {
                this.state.nseOptionChainData = result.data;
                
                // Set default expiry if not set
                if (!this.state.selectedNSEExpiry && result.data.expiryDates?.length > 0) {
                    this.state.selectedNSEExpiry = result.data.expiryDates[0];
                }
                
                Helpers.log(`NSE option chain fetched: ${result.data.optionChain.length} strikes`);
            } else {
                Helpers.log('Failed to fetch NSE option chain: ' + result.message, 'error');
            }
        } catch (error) {
            Helpers.log('Error fetching NSE option chain: ' + error.message, 'error');
        }
    },

    async refreshNSEOptionChain() {
        Helpers.log('Refreshing NSE option chain...');
        await this.fetchNSEOptionChain();
        this.updateDashboard();
    },

    async selectNSESymbol(symbol) {
        this.state.selectedNSESymbol = symbol;
        this.state.selectedNSEExpiry = null;
        this.state.nseOptionChainData = null;
        
        Helpers.log('Selected NSE symbol: ' + symbol);
        await this.fetchNSEOptionChain();
        this.updateDashboard();
    },

    async changeNSEExpiry(expiry) {
        this.state.selectedNSEExpiry = expiry;
        Helpers.log('Changed NSE expiry to: ' + expiry);
        await this.fetchNSEOptionChain();
        this.updateDashboard();
    },

    toggleOptionChain(target) {
        this.state.showOptionChain = target.checked;
        Helpers.log('Option chain: ' + (this.state.showOptionChain ? 'enabled' : 'disabled'));
        
        if (this.state.showOptionChain && !this.state.nseOptionChainData) {
            this.fetchNSEOptionChain().then(() => this.updateDashboard());
        } else {
            this.updateDashboard();
        }
    },

    updateDashboard() {
        const dashboard = document.getElementById('dashboardContent');
        if (dashboard) {
            const completeData = this.getCompleteBankNiftyData();
            const filteredData = this.filterBankNiftyData(completeData);
            
            let html = `${IndicesGrid.render(this.state.indicesData, this.state.indicesTimestamp)}`;
            
            if (this.state.showCurrency && this.state.currencyData) {
                html += CurrencyWidget.render(this.state.currencyData, this.state.currencyTimestamp);
            }

            if (this.state.showOptionChain && this.state.nseOptionChainData) {
                html += OptionChain.render(
                    this.state.nseOptionChainData,
                    this.state.selectedNSESymbol
                );
            }
            
            html += BankNiftyTable.render(filteredData, this.state.bankNiftyTimestamp);
            
            dashboard.innerHTML = html;
        }
    },

    getCompleteBankNiftyData() {
        const allBanks = [
            "HDFCBANK", "ICICIBANK", "AXISBANK", "KOTAKBANK", 
            "SBIN", "INDUSINDBK", "BANDHANBNK", "PNB", 
            "IDFCFIRSTB", "AUBANK", "FEDERALBNK", "BANKBARODA"
        ];
        
        const dataMap = {};
        if (this.state.bankNiftyData) {
            this.state.bankNiftyData.forEach(item => {
                dataMap[item.bank] = item;
            });
        }
        
        return allBanks.map(bank => {
            if (dataMap[bank]) {
                return dataMap[bank];
            } else {
                return {
                    bank: bank,
                    ltp: null,
                    volume: null,
                    changePercent: null,
                    status: "Data Not Fetched"
                };
            }
        });
    },

    filterBankNiftyData(data) {
        if (!data) return data;
        
        return data.filter(item => {
            if (item.status === 'Buying' && !this.state.filters.showBuying) return false;
            if (item.status === 'Selling' && !this.state.filters.showSelling) return false;
            if (item.status === 'Neutral' && !this.state.filters.showNeutral) return false;
            return true;
        });
    },

    async refreshBankNifty() {
        await this.fetchBankNiftyData();
        this.updateDashboard();
    },

    async refreshIndices() {
        await this.fetchIndicesData();
        this.updateDashboard();
    },

    async refreshCurrency() {
        Helpers.log('Refreshing currency data...');
        await this.fetchCurrencyData();
        this.updateDashboard();
    },

    toggleAutoRefresh(target) {
        this.state.autoRefreshEnabled = target.checked;
        
        const intervalSelect = document.getElementById('refreshIntervalSelect');
        if (intervalSelect) {
            intervalSelect.disabled = !target.checked;
        }
        
        if (this.state.autoRefreshEnabled) {
            this.startAutoRefresh();
            Helpers.log('Auto-refresh enabled with interval: ' + this.state.refreshIntervalTime + 'ms');
        } else {
            this.stopAutoRefresh();
            Helpers.log('Auto-refresh disabled');
        }
    },

    toggleCurrency(target) {
        this.state.showCurrency = target.checked;
        Helpers.log('Currency widget: ' + (this.state.showCurrency ? 'enabled' : 'disabled'));
        
        if (this.state.showCurrency && !this.state.currencyData) {
            this.fetchCurrencyData().then(() => this.updateDashboard());
        } else {
            this.updateDashboard();
        }
    },

    changeRefreshInterval(target) {
        this.state.refreshIntervalTime = parseInt(target.value);
        Helpers.log('Refresh interval changed to: ' + this.state.refreshIntervalTime + 'ms');
        
        if (this.state.autoRefreshEnabled) {
            this.stopAutoRefresh();
            this.startAutoRefresh();
        }
    },

    toggleFilter(target) {
        const filterType = target.dataset.filter;
        this.state.filters[filterType] = target.checked;
        this.updateDashboard();
    },

    changeInterval(target) {
        this.state.selectedInterval = target.value;
        Helpers.log('Interval changed to: ' + target.value);
    },

    startAutoRefresh() {
        if (this.state.autoRefreshEnabled && !this.state.refreshIntervalId) {
            this.state.refreshIntervalId = setInterval(() => {
                Helpers.log('Auto-refreshing data...');
                this.loadAllData();
            }, this.state.refreshIntervalTime);
        }
    },

    stopAutoRefresh() {
        if (this.state.refreshIntervalId) {
            clearInterval(this.state.refreshIntervalId);
            this.state.refreshIntervalId = null;
        }
    },

    exportToCSV() {
        const completeData = this.getCompleteBankNiftyData();
        if (!completeData) return;
        
        const headers = ['Bank', 'LTP', 'Volume', 'Change %', 'Status'];
        const rows = completeData.map(row => 
            [
                row.bank, 
                row.ltp || 'N/A', 
                row.volume || 'N/A', 
                row.changePercent || 'N/A', 
                row.status
            ]
        );
        
        const csv = [headers, ...rows]
            .map(row => row.join(','))
            .join('\n');
        
        this.downloadFile(csv, 'banknifty-data.csv', 'text/csv');
    },

    exportToJSON() {
        const data = {
            bankNifty: this.getCompleteBankNiftyData(),
            indices: this.state.indicesData,
            currency: this.state.currencyData,
            nseOptionChain: this.state.nseOptionChainData,
            timestamp: new Date().toISOString()
        };
        
        const json = JSON.stringify(data, null, 2);
        this.downloadFile(json, 'dashboard-data.json', 'application/json');
    },

    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
    },

    openSettings() {
        Helpers.log('Opening settings...');
    },

    saveSettings() {
        Helpers.log('Saving settings...');
    }
};

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});