const CredentialsModal = {
    render() {
        return `
            <div id="credentialsModal" class="modal">
                <div class="modal-content">
                    <div class="modal-header">Setup Credentials</div>
                    <div id="credError"></div>
                    <div class="form-group">
                        <label for="apiKey">API Key</label>
                        <input type="text" id="apiKey" placeholder="Your Angel One API Key" />
                    </div>
                    <div class="form-group">
                        <label for="clientId">Client ID</label>
                        <input type="text" id="clientId" placeholder="Your Angel One Client ID" />
                    </div>
                    <div class="form-group">
                        <label for="password">Password</label>
                        <input type="password" id="password" placeholder="Your Angel One Password" />
                    </div>
                    <div class="form-group">
                        <label for="totpToken">TOTP Token</label>
                        <input type="text" id="totpToken" placeholder="Your TOTP Secret Key" />
                    </div>
                    <button class="btn-primary" onclick="App.saveAndAuthenticate()">Save & Login</button>
                </div>
            </div>
        `;
    },

    show() {
        const modal = document.getElementById('credentialsModal');
        if (modal) modal.classList.add('active');
    },

    hide() {
        const modal = document.getElementById('credentialsModal');
        if (modal) modal.classList.remove('active');
    }
};