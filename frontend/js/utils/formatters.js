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

    formatInterval(interval) {
        return interval.replace('_', ' ');
    }
};