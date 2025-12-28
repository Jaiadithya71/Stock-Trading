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
                    console.error('Bank Nifty fetch failed:', err.message);
                }),
                this.fetchIndicesData().catch(err => {
                    console.error('Indices fetch failed:', err.message);
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
            const result = await ApiService.getIndicesData(this.state.currentUsername);
            if (result.success) {
                this.state.indicesData = result.data;
                this.state.indicesTimestamp = Helpers.getCurrentTime();
                
                // DEBUG: Log the actual data structure received
                console.log('✅ Indices data loaded');
                console.log('📊 DEBUG - Indices Data Structure:');
                console.log(JSON.stringify(result.data, null, 2));
                
                // Check if BANKNIFTY has LTP
                if (result.data.BANKNIFTY) {
                    console.log('🔍 BANKNIFTY data:', result.data.BANKNIFTY);
                    console.log('🔍 BANKNIFTY LTP:', result.data.BANKNIFTY.ltp || 'NOT FOUND');
                }
            }
        } catch (error) {
            console.error('Error fetching indices:', error.message);
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
        try {
            const result = await ApiService.getNSEOptionChain(
                this.state.selectedNSESymbol,
                this.state.selectedNSEExpiry
            );
            
            if (result.success) {
                this.state.nseOptionChainData = result.data;
                
                if (!this.state.selectedNSEExpiry && result.data.expiryDates?.length > 0) {
                    this.state.selectedNSEExpiry = result.data.expiryDates[0];
                }
                
                console.log('✅ Option chain loaded');
            }
        } catch (error) {
            console.error('Error fetching option chain:', error.message);
            throw error;
        }
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
        await this.fetchPCRData().catch(() => {});
        this.updateDashboard();
    },

    async refreshNSEOptionChain() {
        console.log('🔄 Refreshing option chain...');
        await this.fetchNSEOptionChain().catch(() => {});
        this.updateDashboard();
    },

    async selectNSESymbol(symbol) {
        this.state.selectedNSESymbol = symbol;
        this.state.selectedNSEExpiry = null;
        this.state.nseOptionChainData = null;
        
        await this.fetchNSEOptionChain().catch(() => {});
        this.updateDashboard();
    },

    async changeNSEExpiry(expiry) {
        this.state.selectedNSEExpiry = expiry;
        await this.fetchNSEOptionChain().catch(() => {});
        this.updateDashboard();
    },

    toggleOptionChain(target) {
        this.state.showOptionChain = target.checked;
        
        if (this.state.showOptionChain && !this.state.nseOptionChainData) {
            this.fetchNSEOptionChain().then(() => this.updateDashboard()).catch(() => {});
        } else {
            this.updateDashboard();
        }
    },

    togglePCR(target) {
        this.state.showPCR = target.checked;
        
        if (this.state.showPCR && !this.state.pcrData) {
            this.fetchPCRData().then(() => this.updateDashboard()).catch(() => {});
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
        await this.fetchBankNiftyData().catch(() => {});
        this.updateDashboard();
    },

    async refreshIndices() {
        await this.fetchIndicesData().catch(() => {});
        this.updateDashboard();
    },

    async refreshCurrency() {
        await this.fetchCurrencyData().catch(() => {});
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
        } else {
            this.stopAutoRefresh();
        }
    },

    toggleCurrency(target) {
        this.state.showCurrency = target.checked;
        
        if (this.state.showCurrency && !this.state.currencyData) {
            this.fetchCurrencyData().then(() => this.updateDashboard()).catch(() => {});
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