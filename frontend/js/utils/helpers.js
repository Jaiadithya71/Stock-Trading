const Helpers = {
    showError(elementId, message) {
        const element = document.getElementById(elementId);
        if (element) {
            element.innerHTML = `<div class="error-message">${message}</div>`;
        }
    },

    showSuccess(elementId, message) {
        const element = document.getElementById(elementId);
        if (element) {
            element.innerHTML = `<div class="success-message">${message}</div>`;
        }
    },

    clearMessage(elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            element.innerHTML = '';
        }
    },

    getCurrentTime() {
        return new Date().toLocaleTimeString();
    },

    getCurrentDateTime() {
        const now = new Date();
        return `${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;
    },

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    log(message, type = 'info') {
        if (AppConfig.DEBUG) {
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    }
};