// frontend/js/utils/formatters.js - UPDATED WITH VALUE DIRECTION HELPER
const Formatters = {
    formatNumber(num) {
        if (num >= 10000000) return (num / 10000000).toFixed(2) + 'Cr';
        if (num >= 100000) return (num / 100000).toFixed(2) + 'L';
        if (num >= 1000) return (num / 1000).toFixed(2) + 'K';
        return num.toString();
    },

    formatCurrency(num) {
        return '₹' + parseFloat(num).toFixed(2);
    },

    formatPercentage(num) {
        const formatted = parseFloat(num).toFixed(2);
        return num > 0 ? '+' + formatted + '%' : formatted + '%';
    },

    getStatusClass(status) {
        return 'status-' + status.toLowerCase();
    },

    getChangeClass(value) {
        return value >= 0 ? 'change-positive' : 'change-negative';
    },

    getSentimentClass(sentiment) {
        return 'sentiment-' + sentiment.toLowerCase();
    },

    /**
     * Get CSS class based on value direction
     * @param {string} direction - 'up', 'down', or 'neutral'
     * @returns {string} CSS class name
     */
    getValueDirectionClass(direction) {
        if (direction === 'up') return 'value-positive';
        if (direction === 'down') return 'value-negative';
        return 'value-neutral';
    },

    formatInterval(interval) {
        return interval.replace('_', ' ');
    },

    /**
     * Calculate and format the age of data
     * @param {string} timestamp - ISO timestamp or timestamp string from data
     * @returns {string} Formatted age string (e.g., "2m ago", "45s ago", "1h ago")
     */
    formatDataAge(timestamp) {
        if (!timestamp) return '';
        
        try {
            const dataTime = new Date(timestamp);
            const now = new Date();
            const diffMs = now - dataTime;
            const diffSeconds = Math.floor(diffMs / 1000);
            const diffMinutes = Math.floor(diffSeconds / 60);
            const diffHours = Math.floor(diffMinutes / 60);
            
            if (diffSeconds < 60) {
                return `${diffSeconds}s ago`;
            } else if (diffMinutes < 60) {
                return `${diffMinutes}m ago`;
            } else if (diffHours < 24) {
                return `${diffHours}h ago`;
            } else {
                const diffDays = Math.floor(diffHours / 24);
                return `${diffDays}d ago`;
            }
        } catch (error) {
            console.error('Error formatting data age:', error);
            return '';
        }
    },

    /**
     * Get color class based on data age
     * @param {string} timestamp - ISO timestamp or timestamp string
     * @returns {string} CSS class for age color coding
     */
    getDataAgeClass(timestamp) {
        if (!timestamp) return 'age-unknown';
        
        try {
            const dataTime = new Date(timestamp);
            const now = new Date();
            const diffMs = now - dataTime;
            const diffSeconds = Math.floor(diffMs / 1000);
            
            if (diffSeconds < 60) {
                return 'age-fresh'; // < 1 minute - green
            } else if (diffSeconds < 300) {
                return 'age-recent'; // 1-5 minutes - yellow
            } else {
                return 'age-stale'; // > 5 minutes - red
            }
        } catch (error) {
            return 'age-unknown';
        }
    }
};