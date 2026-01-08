// frontend/js/app.js - ENHANCED WITH DEBUG LOGGING
const App = {
    state: {
        currentUsername: '',
        bankNiftyData: null,
        indicesData: null,
        currencyData: null,
        nseOptionChainData: null,
        pcrData: null,
        bankNiftyTimestamp: null,
        indicesTimestamp: null,
        currencyTimestamp: null,
        pcrTimestamp: null,
        refreshIntervalId: null,
        refreshIntervalTime: 60000,
        autoRefreshEnabled: true,
        selectedInterval: 'ONE_MINUTE',
        selectedNSESymbol: 'BANKNIFTY',
        selectedNSEExpiry: null,
        showCurrency: true,
        showOptionChain: false,
        showPCR: true,
        isLoading: false,
        filters: {
            showBuying: true,
            showSelling: true,
            showNeutral: true
        }
    },

    async init() {
        Helpers.log('🚀 Initializing app...');
        EventHandler.init();
        this.registerEventHandlers();
        this.renderModals();
    },

    registerEventHandlers() {
        // Authentication handlers
        EventHandler.on('check-user', () => this.checkUser());
        EventHandler.on('save-credentials', () => this.saveAndAuthenticate());

        // Session recovery handler
        document.addEventListener('session-expired', () => this.handleSessionExpired());

        // Dashboard handlers
        EventHandler.on('refresh-banknifty', () => this.refreshBankNifty());
        EventHandler.on('refresh-indices', () => this.refreshIndices());
        EventHandler.on('refresh-currency', () => this.refreshCurrency());
        EventHandler.on('refresh-pcr', () => this.refreshPCR());
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
        EventHandler.on('toggle-pcr', (e, target) => this.togglePCR(target));
        
        // Interval selectors
        EventHandler.on('change-interval', (e, target) => this.changeInterval(target));
        EventHandler.on('change-refresh-interval', (e, target) => this.changeRefreshInterval(target));
        
        // Export handlers
        EventHandler.on('export-csv', () => this.exportToCSV());
        EventHandler.on('export-json', () => this.exportToJSON());
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
                
                // Render dashboard immediately
                this.renderDashboard();
                
                // START PCR COLLECTOR IN BACKGROUND (non-blocking)
                console.log('🚀 Starting PCR Collector in background...');
                ApiService.startPCRCollector(this.state.currentUsername)
                    .then(pcrResult => {
                        if (pcrResult.success) {
                            console.log('✅ PCR Collector started');
                        }
                    })
                    .catch(error => {
                        console.warn('⚠️ PCR Collector failed to start:', error.message);
                    });
                
                // Load dashboard data (fast!)
                await this.loadAllData();
                this.startAutoRefresh();
            } else {
                Helpers.showError('loginError', result.message);
                LoginModal.show();
                CredentialsModal.hide();
            }
        } catch (error) {
            Helpers.showError('loginError', 'Authentication failed: ' + error.message);
        }
    },

    renderDashboard() {
        const app = document.getElementById('app');
        app.innerHTML = `
            ${Header.render(this.state.currentUsername)}
            ${Toolbar.render(this.state)}
            <div class="dashboard-container" id="dashboardContent">
                ${LoadingSpinner.render('Loading dashboard data...')}
            </div>
        `;
    },

    async loadAllData() {
        if (this.state.isLoading) {
            console.log('⏳ Already loading data, skipping...');
            return;
        }
        
        this.state.isLoading = true;
        const startTime = Date.now();
        console.log('🔄 Loading dashboard data...');
        
        try {
            // Load critical data first (parallel)
            const criticalPromises = [
                this.fetchBankNiftyData().catch(err => {
                    console.error('❌ Bank Nifty fetch failed:', err);
                    throw err; // Re-throw to see full error
                }),
                this.fetchIndicesData().catch(err => {
                    console.error('❌ Indices fetch failed:', err);
                    throw err; // Re-throw to see full error
                })
            ];
            
            // Load optional data
            if (this.state.showCurrency) {
                criticalPromises.push(
                    this.fetchCurrencyData().catch(err => {
                        console.warn('Currency fetch failed:', err.message);
                    })
                );
            }

            if (this.state.showOptionChain) {
                criticalPromises.push(
                    this.fetchNSEOptionChain().catch(err => {
                        console.warn('Option chain fetch failed:', err.message);
                    })
                );
            }

            // PCR is fetched separately - non-blocking
            if (this.state.showPCR) {
                criticalPromises.push(
                    this.fetchPCRData().catch(err => {
                        console.log('PCR data not ready yet:', err.message);
                        this.state.pcrData = null;
                    })
                );
            }
            
            // Wait for all with timeout
            await Promise.race([
                Promise.all(criticalPromises),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Data fetch timeout')), 20000)
                )
            ]);
            
            const loadTime = Date.now() - startTime;
            console.log(`✅ Dashboard loaded in ${(loadTime / 1000).toFixed(2)}s`);
            
        } catch (error) {
            console.error('❌ Error loading dashboard:', error.message);
        } finally {
            this.state.isLoading = false;
            this.updateDashboard();
        }
    },

    async fetchBankNiftyData() {
        try {
            const result = await ApiService.getBankNiftyData(this.state.currentUsername);
            if (result.success) {
                this.state.bankNiftyData = result.data;
                this.state.bankNiftyTimestamp = Helpers.getCurrentTime();
                console.log('✅ Bank Nifty data loaded');
            }
        } catch (error) {
            console.error('Error fetching Bank Nifty:', error.message);
            throw error;
        }
    },

    async fetchIndicesData() {
        try {
            console.log('🔄 Fetching indices data for user:', this.state.currentUsername);
            const result = await ApiService.getIndicesData(this.state.currentUsername);
            console.log('📨 Indices API response:', result);

            if (result.success) {
                this.state.indicesData = result.data;
                this.state.indicesTimestamp = Helpers.getCurrentTime();

                // DEBUG: Log the actual data structure received
                console.log('✅ Indices data loaded successfully');
                console.log('📊 DEBUG - Indices Data Structure:');
                console.log(JSON.stringify(result.data, null, 2));

                // Check if BANKNIFTY has LTP
                if (result.data.BANKNIFTY) {
                    console.log('🔍 BANKNIFTY data:', result.data.BANKNIFTY);
                    console.log('🔍 BANKNIFTY LTP:', result.data.BANKNIFTY.ltp || 'NOT FOUND');
                    console.log('🔍 BANKNIFTY intervals:', Object.keys(result.data.BANKNIFTY.intervals || {}));
                }
            } else {
                console.error('❌ Indices API returned success=false:', result.message || result);
            }
        } catch (error) {
            console.error('❌ Error fetching indices:', error);
            console.error('Error details:', error.message, error.stack);
            throw error;
        }
    },

    async fetchCurrencyData() {
        try {
            const result = await ApiService.getCurrencyRates(this.state.currentUsername);
            if (result.success) {
                this.state.currencyData = result;
                this.state.currencyTimestamp = Helpers.getCurrentTime();
                console.log('✅ Currency data loaded');
            }
        } catch (error) {
            console.error('Error fetching currency:', error.message);
            throw error;
        }
    },

    async fetchNSEOptionChain() {
        console.log('🔄 Fetching option chain for:', this.state.selectedNSESymbol, 'expiry:', this.state.selectedNSEExpiry);

        try {
            const result = await ApiService.getNSEOptionChain(
                this.state.selectedNSESymbol,
                this.state.selectedNSEExpiry
            );

            console.log('📨 Option chain API response:', result);

            if (result.success && result.data) {
                // Transform API response to component format
                const transformedData = this.transformOptionChainData(result.data);
                this.state.nseOptionChainData = transformedData;

                if (!this.state.selectedNSEExpiry && result.data.expiryDates?.length > 0) {
                    this.state.selectedNSEExpiry = result.data.expiryDates[0];
                }

                console.log('✅ Option chain loaded:', transformedData.strikeCount, 'strikes');
            } else {
                console.error('❌ Option chain API returned failure:', result.message);
                // Set error state so component can show error
                this.state.nseOptionChainData = {
                    error: result.message || 'Failed to load option chain',
                    optionChain: []
                };
            }
        } catch (error) {
            console.error('❌ Error fetching option chain:', error.message);
            // Set error state so component shows error instead of infinite loading
            this.state.nseOptionChainData = {
                error: error.message,
                optionChain: []
            };
            // Don't rethrow - we've handled the error by setting error state
        }
    },

    /**
     * Transform API response to OptionChain component format
     */
    transformOptionChainData(apiData) {
        const { symbol, expiry, underlyingValue, timestamp, expiryDates, strikes } = apiData;

        // Get spot price
        const spotPrice = underlyingValue || 0;

        // Calculate ATM strike (nearest to spot price)
        const strikeKeys = Object.keys(strikes || {}).map(Number).sort((a, b) => a - b);
        const atmStrike = strikeKeys.reduce((prev, curr) =>
            Math.abs(curr - spotPrice) < Math.abs(prev - spotPrice) ? curr : prev
        , strikeKeys[0] || 0);

        // Transform strikes object to array format expected by component
        const optionChain = strikeKeys.map(strike => ({
            strike: strike,
            isATM: strike === atmStrike,
            call: strikes[strike]?.CE || null,
            put: strikes[strike]?.PE || null
        }));

        // Get display name
        const displayNames = {
            'BANKNIFTY': 'Bank Nifty',
            'NIFTY': 'Nifty 50',
            'FINNIFTY': 'Fin Nifty',
            'MIDCPNIFTY': 'Midcap Nifty'
        };

        return {
            symbol: symbol,
            displayName: displayNames[symbol] || symbol,
            spotPrice: spotPrice,
            optionChain: optionChain,
            timestamp: timestamp || new Date().toISOString(),
            expiryDates: expiryDates || [],
            selectedExpiry: expiry,
            atmStrike: atmStrike,
            dataSource: 'NSE India',
            strikeCount: optionChain.length
        };
    },

    async fetchPCRData() {
        try {
            const result = await ApiService.getPCRHistorical(this.state.currentUsername);
            
            if (result.success && result.data) {
                this.state.pcrData = result.data;
                this.state.pcrTimestamp = Helpers.getCurrentTime();
                console.log('✅ PCR data loaded');
            } else {
                this.state.pcrData = null;
            }
        } catch (error) {
            this.state.pcrData = null;
            throw error;
        }
    },

    async refreshPCR() {
        console.log('🔄 Refreshing PCR...');
        try {
            await this.fetchPCRData();
        } catch (error) {
            console.warn('PCR refresh failed:', error.message);
        }
        this.updateDashboard();
    },

    async refreshNSEOptionChain() {
        console.log('🔄 Refreshing option chain...');
        // Clear previous data/error to show loading state
        this.state.nseOptionChainData = null;
        this.updateDashboard();

        await this.fetchNSEOptionChain();
        this.updateDashboard();
    },

    async selectNSESymbol(symbol) {
        this.state.selectedNSESymbol = symbol;
        this.state.selectedNSEExpiry = null;
        this.state.nseOptionChainData = null;

        // Show loading state immediately
        this.updateDashboard();

        await this.fetchNSEOptionChain();
        this.updateDashboard();
    },

    async changeNSEExpiry(expiry) {
        this.state.selectedNSEExpiry = expiry;
        this.state.nseOptionChainData = null;

        // Show loading state immediately
        this.updateDashboard();

        await this.fetchNSEOptionChain();
        this.updateDashboard();
    },

    toggleOptionChain(target) {
        this.state.showOptionChain = target.checked;

        // Always update immediately to show loading spinner or hide section
        this.updateDashboard();

        // Fetch if no data, or if previous fetch had an error
        const needsFetch = !this.state.nseOptionChainData || this.state.nseOptionChainData.error;

        if (this.state.showOptionChain && needsFetch) {
            // Clear any error state to show loading spinner
            this.state.nseOptionChainData = null;
            this.updateDashboard();

            // Fetch data, then update dashboard to show results or error
            this.fetchNSEOptionChain()
                .then(() => this.updateDashboard());
        }
    },

    togglePCR(target) {
        this.state.showPCR = target.checked;

        if (this.state.showPCR && !this.state.pcrData) {
            this.fetchPCRData()
                .then(() => this.updateDashboard())
                .catch(err => console.warn('PCR fetch failed:', err.message));
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
            
            if (this.state.showPCR) {
                html += PCRWidget.render(this.state.pcrData, this.state.pcrTimestamp);
            }
            
            if (this.state.showCurrency && this.state.currencyData) {
                html += CurrencyWidget.render(this.state.currencyData, this.state.currencyTimestamp);
            }

            if (this.state.showOptionChain) {
                // Always render when checkbox is checked - component handles loading state
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
        try {
            await this.fetchBankNiftyData();
        } catch (error) {
            this.showError('Failed to refresh Bank Nifty: ' + error.message);
        }
        this.updateDashboard();
    },

    async refreshIndices() {
        try {
            await this.fetchIndicesData();
        } catch (error) {
            this.showError('Failed to refresh indices: ' + error.message);
        }
        this.updateDashboard();
    },

    async refreshCurrency() {
        try {
            await this.fetchCurrencyData();
        } catch (error) {
            this.showError('Failed to refresh currency: ' + error.message);
        }
        this.updateDashboard();
    },

    // Handle session expiry - prompt user to re-login
    handleSessionExpired() {
        console.log('Session expired, showing login...');
        this.stopAutoRefresh();
        this.state.isLoading = false;
        alert('Your session has expired. Please log in again.');
        this.renderModals();
        LoginModal.show();
    },

    // Show error notification
    showError(message) {
        console.error(message);
        // Show a temporary error notification
        const notification = document.createElement('div');
        notification.className = 'error-notification';
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: rgba(239, 68, 68, 0.9);
            color: white;
            padding: 12px 20px;
            border-radius: 6px;
            z-index: 10000;
            font-size: 14px;
            max-width: 400px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 5000);
    },

    toggleAutoRefresh(target) {
        this.state.autoRefreshEnabled = target.checked;
        
        const intervalSelect = document.getElementById('refreshIntervalSelect');
        if (intervalSelect) {
            intervalSelect.disabled = !target.checked;
        }
        
        if (this.state.autoRefreshEnabled) {
            this.startAutoRefresh();
        } else {
            this.stopAutoRefresh();
        }
    },

    toggleCurrency(target) {
        this.state.showCurrency = target.checked;

        if (this.state.showCurrency && !this.state.currencyData) {
            this.fetchCurrencyData()
                .then(() => this.updateDashboard())
                .catch(err => console.warn('Currency fetch failed:', err.message));
        } else {
            this.updateDashboard();
        }
    },

    changeRefreshInterval(target) {
        this.state.refreshIntervalTime = parseInt(target.value);
        
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
    },

    startAutoRefresh() {
        if (this.state.autoRefreshEnabled && !this.state.refreshIntervalId) {
            this.state.refreshIntervalId = setInterval(() => {
                if (!this.state.isLoading) {
                    this.loadAllData();
                }
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
            pcr: this.state.pcrData,
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
    }
};

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});