const App = {
    state: {
        currentUsername: '',
        bankNiftyData: null,
        indicesData: null,
        bankNiftyTimestamp: null,
        indicesTimestamp: null,
        refreshInterval: null,
        autoRefreshEnabled: true,
        selectedInterval: 'ONE_MINUTE',
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
        EventHandler.on('refresh-all', () => this.loadAllData());
        
        // Toggle handlers
        EventHandler.on('toggle-autorefresh', (e, target) => this.toggleAutoRefresh(target));
        EventHandler.on('toggle-filter', (e, target) => this.toggleFilter(target));
        
        // Interval selector
        EventHandler.on('change-interval', (e, target) => this.changeInterval(target));
        
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
        await Promise.all([
            this.fetchBankNiftyData(),
            this.fetchIndicesData()
        ]);
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

    updateDashboard() {
        const dashboard = document.getElementById('dashboardContent');
        if (dashboard) {
            // Filter data based on current filters
            const filteredData = this.filterBankNiftyData(this.state.bankNiftyData);
            
            dashboard.innerHTML = `
                ${IndicesGrid.render(this.state.indicesData, this.state.indicesTimestamp)}
                ${BankNiftyTable.render(filteredData, this.state.bankNiftyTimestamp)}
            `;
        }
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

    toggleAutoRefresh(target) {
        this.state.autoRefreshEnabled = target.checked;
        
        if (this.state.autoRefreshEnabled) {
            this.startAutoRefresh();
            Helpers.log('Auto-refresh enabled');
        } else {
            this.stopAutoRefresh();
            Helpers.log('Auto-refresh disabled');
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
        // You can implement interval-specific data fetching here
    },

    startAutoRefresh() {
        if (this.state.autoRefreshEnabled && !this.state.refreshInterval) {
            this.state.refreshInterval = setInterval(() => {
                Helpers.log('Auto-refreshing data...');
                this.loadAllData();
            }, AppConfig.REFRESH_INTERVAL);
        }
    },

    stopAutoRefresh() {
        if (this.state.refreshInterval) {
            clearInterval(this.state.refreshInterval);
            this.state.refreshInterval = null;
        }
    },

    exportToCSV() {
        if (!this.state.bankNiftyData) return;
        
        const headers = ['Bank', 'LTP', 'Volume', 'Change %', 'Status'];
        const rows = this.state.bankNiftyData.map(row => 
            [row.bank, row.ltp, row.volume, row.changePercent, row.status]
        );
        
        const csv = [headers, ...rows]
            .map(row => row.join(','))
            .join('\n');
        
        this.downloadFile(csv, 'banknifty-data.csv', 'text/csv');
    },

    exportToJSON() {
        const data = {
            bankNifty: this.state.bankNiftyData,
            indices: this.state.indicesData,
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
        // Implement settings modal
        Helpers.log('Opening settings...');
    },

    saveSettings() {
        // Implement settings save
        Helpers.log('Saving settings...');
    }
};

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});