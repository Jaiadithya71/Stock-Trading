// frontend/js/api/apiService.js - UPDATED
const ApiService = {
    async request(endpoint, data = null) {
        try {
            const options = {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            };
            
            if (data) {
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
    }
};