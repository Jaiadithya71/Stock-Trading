const LoginModal = {
    render() {
        return `
            <div id="loginModal" class="modal active">
                <div class="modal-content">
                    <div class="modal-header">Bank Nifty Dashboard</div>
                    <div id="loginError"></div>
                    <div class="form-group">
                        <label for="username">Username</label>
                        <input type="text" id="username" placeholder="Enter your username" />
                    </div>
                    <button class="btn-primary" onclick="App.checkUser()">Continue</button>
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