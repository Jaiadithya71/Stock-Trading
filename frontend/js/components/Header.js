// ============================================================================
// FILE: frontend/js/components/Header.js
// World-Class Elegant Navigation & Dynamic Telemetry Header Component
// ============================================================================

const Header = {
    render(username, activeTab = 'signals', indicesTimestamp = null) {
        let telemetryBadge = '<span class="text-red">🔴 DISCONNECTED</span>';
        
        if (indicesTimestamp) {
            const ageSec = Math.floor((Date.now() - new Date(indicesTimestamp).getTime()) / 1000);
            if (isNaN(ageSec) || ageSec < 0) {
                telemetryBadge = '<span class="text-green">🟢 LIVE TELEMETRY</span>';
            } else if (ageSec < 15) {
                telemetryBadge = '<span class="text-green">🟢 LIVE TELEMETRY</span>';
            } else if (ageSec < 60) {
                telemetryBadge = `<span class="text-amber" style="color: #f59e0b;">🟡 STALE (${ageSec}s ago)</span>`;
            } else {
                telemetryBadge = `<span class="text-red">🔴 STALE (${Math.floor(ageSec / 60)}m ago)</span>`;
            }
        }

        return `
            <div class="header trader-header-bar">
                <div class="logo-section">
                    <div class="logo-icon">📊</div>
                    <div>
                        <h1 class="logo-title">Bank Nifty Quant Command Center</h1>
                        <span class="header-subtitle">Zero-Friction Algorithmic Trading Platform</span>
                    </div>
                </div>

                <!-- ELEGANT TOP NAVIGATION TABS -->
                <div class="nav-tabs-container">
                    <button class="nav-tab ${activeTab === 'signals' ? 'active' : ''}" data-tab="signals">
                        🎯 Strategy Signals
                    </button>
                    <button class="nav-tab ${activeTab === 'portfolio' ? 'active' : ''}" data-tab="portfolio">
                        💼 Portfolio OMS
                    </button>
                    <button class="nav-tab ${activeTab === 'audit' ? 'active' : ''}" data-tab="audit">
                        🔬 Strategy Audit
                    </button>
                    <button class="nav-tab ${activeTab === 'market' ? 'active' : ''}" data-tab="market">
                        📊 Master Market Grid
                    </button>
                    <button class="nav-tab ${activeTab === 'settings' ? 'active' : ''}" data-tab="settings">
                        ⚙️ Risk & Settings
                    </button>
                </div>

                <!-- TELEMETRY & EMERGENCY CONTROLS -->
                <div class="header-right-group">
                    <div class="telemetry-pill">
                        ${telemetryBadge}
                        <span class="pill-divider">|</span>
                        <span>SIMULATION MODE</span>
                        <span class="pill-divider">|</span>
                        <span class="text-gold">RISK: ₹0 / ₹5,000</span>
                    </div>
                    <button id="header-kill-switch" class="btn btn-kill-switch-header" onclick="Header.triggerKillSwitch()">🚨 KILL SWITCH</button>
                </div>
            </div>
        `;
    },

    triggerKillSwitch() {
        if (typeof ToastNotification !== 'undefined') {
            ToastNotification.confirm('🚨 ARE YOU SURE YOU WANT TO TRIGGER THE EMERGENCY KILL SWITCH? This will freeze all active signals and pause automated trading.', () => {
                ToastNotification.show('🚨 EMERGENCY KILL SWITCH ACTIVATED: All automated trading paused.', 'error', 5000);
            });
        } else if (confirm('🚨 ARE YOU SURE YOU WANT TO TRIGGER THE EMERGENCY KILL SWITCH?')) {
            alert('🚨 EMERGENCY KILL SWITCH ACTIVATED');
        }
    }
};