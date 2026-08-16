const LoginModal = {
    render() {
        return `
            <div id="loginModal" class="modal">
                <div class="modal-content">
                    <div class="modal-header">Bank Nifty Quant Command Center</div>
                    <div id="loginError"></div>
                    <form data-submit-action="check-user" onsubmit="return false;">
                        <div class="form-group">
                            <label for="username">Username</label>
                            <input type="text" id="username" placeholder="Enter your username (e.g. demo)" value="demo" />
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 16px;">
                            <button class="btn-primary" data-action="check-user" type="button">Continue to Login</button>
                            <button class="btn-secondary" onclick="App.launchDemoMode()" type="button" style="background: rgba(16, 185, 129, 0.2); border: 1px solid #10b981; color: #34d399; font-weight: 600; padding: 10px; border-radius: 8px; cursor: pointer;">
                              ⚡ Launch Simulation Mode (No Credentials Required)
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
    },

    show() {
        const modal = document.getElementById('loginModal');
        if (modal) modal.classList.add('active');
    },

    hide() {
        const modal = document.getElementById('loginModal');
        if (modal) modal.classList.remove('active');
    }
};