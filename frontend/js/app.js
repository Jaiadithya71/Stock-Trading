const App = {
    state: {
        currentUsername: '',
        bankNiftyData: null,
        indicesData: null,
        bankNiftyTimestamp: null,
        indicesTimestamp: null,
        refreshInterval: null
    },

    async init() {
        Helpers.log('Initializing app...');
        this.renderModals();
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
            dashboard.innerHTML = `
                ${BankNiftyTable.render(this.state.bankNiftyData, this.state.bankNiftyTimestamp)}
                ${IndicesGrid.render(this.state.indicesData, this.state.indicesTimestamp)}
            `;
        }
    },

    async refreshBankNifty() {
        await this.fetchBankNiftyData();
        this.updateDashboard();
    },

    async refreshIndices() {
        await this.fetchIndicesData();
        this.updateDashboard();
    },

    startAutoRefresh() {
        if (AppConfig.AUTO_REFRESH && !this.state.refreshInterval) {
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
    }
};