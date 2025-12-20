const LoadingSpinner = {
    render(message = 'Loading...') {
        return `
            <div class="loading">
                <div class="spinner"></div>
                <div>${message}</div>
            </div>
        `;
    }
};