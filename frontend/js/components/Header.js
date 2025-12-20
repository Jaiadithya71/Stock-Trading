const Header = {
    render(username) {
        return `
            <div class="header">
                <div class="logo">
                    <div class="logo-icon">📊</div>
                    <h1 class="logo-title">Bank Nifty Trading Dashboard</h1>
                </div>
                <div class="user-info">
                    <div class="status-indicator"></div>
                    <span>${username}</span>
                </div>
            </div>
        `;
    }
};