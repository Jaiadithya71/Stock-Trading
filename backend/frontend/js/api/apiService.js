// frontend/js/api/apiService.js - UPDATED WITH SESSION RECOVERY
const ApiService = {
    // Track if we're currently re-authenticating to prevent loops
    _isReauthenticating: false,

    async request(endpoint, data = null, method = 'POST', skipAuthRetry = false) {
        try {
            const options = {
                method: method,
                headers: { 'Content-Type': 'application/json' }
            };

            if (data && method === 'POST') {
                options.body = JSON.stringify(data);
            }

            const response = await fetch(`${AppConfig.API_BASE_URL}${endpoint}`, options);
            const result = await response.json();

            // Check for authentication failure (401 or success:false with auth message)
            const isAuthError = response.status === 401 ||
                (!result.success && result.message &&
                 (result.message.includes('Not authenticated') ||
                  result.message.includes('not authenticated')));

            // If auth error and we have a username, try to re-authenticate
            if (isAuthError && !skipAuthRetry && !this._isReauthenticating) {
                const username = this._getCurrentUsername();
                if (username) {
                    console.log('Session expired, attempting re-authentication...');
                    const reAuthSuccess = await this._reAuthenticate(username);

                    if (reAuthSuccess) {
                        console.log('Re-authentication successful, retrying request...');
                        // Retry the original request (with skipAuthRetry to prevent infinite loop)
                        return await this.request(endpoint, data, method, true);
                    } else {
                        // Re-auth failed, trigger login prompt
                        this._triggerLoginRequired();
                        throw new Error('Session expired. Please log in again.');
                    }
                }
            }

            return result;
        } catch (error) {
            Helpers.log('API Request Error: ' + error.message, 'error');
            throw error;
        }
    },

    // Get current username from App state
    _getCurrentUsername() {
        return typeof App !== 'undefined' && App.state ? App.state.currentUsername : null;
    },

    // Attempt to re-authenticate
    async _reAuthenticate(username) {
        if (this._isReauthenticating) return false;

        this._isReauthenticating = true;
        try {
            const result = await this.authenticate(username);
            return result.success === true;
        } catch (error) {
            console.error('Re-authentication failed:', error.message);
            return false;
        } finally {
            this._isReauthenticating = false;
        }
    },

    // Trigger login required event
    _triggerLoginRequired() {
        if (typeof EventHandler !== 'undefined') {
            EventHandler.trigger('session-expired');
        }
    },

    async checkUser(username) {
        return await this.request('/check-user', { username });
    },

    async saveCredentials(username, credentials) {
        return await this.request('/save-credentials', { username, credentials });
    },

    async authenticate(username) {
        return await this.request('/authenticate', { username });
    },

    async getBankNiftyData(username) {
        return await this.request('/banknifty-data', { username });
    },

    async getIndicesData(username) {
        return await this.request('/indices-data', { username });
    },

    // Currency API methods
    async getCurrencyRates(username) {
        return await this.request('/currency-rates', { username });
    },

    async getCurrencyRate(username, code) {
        return await this.request(`/currency-rate/${code}`, { username });
    },

    async clearCurrencyCache(username) {
        return await this.request('/currency-clear-cache', { username });
    },

    async getCurrencyCacheStats(username) {
        return await this.request('/currency-cache-stats', { username });
    },

    // NSE Option Chain API methods (NO AUTH REQUIRED)
    async getNSESymbols() {
        return await this.request('/nse-symbols', null, 'GET');
    },

    async getNSEOptionChain(symbol, expiry = null) {
        let endpoint = `/nse-option-chain?symbol=${symbol}`;
        if (expiry) {
            endpoint += `&expiry=${encodeURIComponent(expiry)}`;
        }
        return await this.request(endpoint, null, 'GET');
    },

    async getNSEExpiryDates(symbol) {
        return await this.request(`/nse-expiry-dates?symbol=${symbol}`, null, 'GET');
    },

    // PCR API methods
    async getPCRHistorical(username) {
        return await this.request('/pcr-historical', { username });
    },

    async getPCRCurrent(username) {
        return await this.request('/pcr-current', { username });
    },

    async getPCRStats(username) {
        return await this.request('/pcr-stats', { username });
    },

    async clearPCRData(username, symbol = null) {
        return await this.request('/pcr-clear', { username, symbol });
    },

    async startPCRCollector(username) {
        return await this.request('/start-pcr-collector', { username });
    },

    async getPCRCollectorStatus() {
        return await this.request('/pcr-collector-status', null, 'GET');
    },

    async stopPCRCollector() {
        return await this.request('/stop-pcr-collector', {});
    }
};