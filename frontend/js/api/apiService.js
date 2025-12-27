// frontend/js/api/apiService.js - UPDATED
const ApiService = {
    async request(endpoint, data = null, method = 'POST') {
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
            
            return result;
        } catch (error) {
            Helpers.log('API Request Error: ' + error.message, 'error');
            throw error;
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
    }
};