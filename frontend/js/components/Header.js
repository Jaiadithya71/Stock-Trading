// ============================================================================
// FILE: frontend/js/components/Header.js
// Apple-Grade Modern Translucent Navigation & Dynamic Telemetry Header Component
// Includes Level-1 Brand & Telemetry Bar + Level-2 Segmented Navigation Control
// ============================================================================

const Header = {
    isMarketOpenNow() {
        const now = new Date();
        const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
        const ist = new Date(utc + (3600000 * 5.5)); // IST is UTC+5.5
        
        const day = ist.getDay(); // 0 = Sun, 6 = Sat
        if (day === 0 || day === 6) return false;
        
        const hours = ist.getHours();
        const minutes = ist.getMinutes();
        const timeInMinutes = hours * 60 + minutes;
        
        // NSE Market Hours: 9:15 AM (555 min) to 3:30 PM (930 min)
        return timeInMinutes >= 555 && timeInMinutes <= 930;
    },

    render(username, activeTab = 'signals', indicesTimestamp = null) {
        const marketOpen = this.isMarketOpenNow();
        const marketStatusBadge = marketOpen ? 
            '<span class="apple-status-badge open">🟢 MARKET OPEN</span>' : 
            '<span class="apple-status-badge closed">🌙 MARKET CLOSED</span>';

        let telemetryBadge = '<span class="text-red">🔴 DISCONNECTED</span>';
        
        if (indicesTimestamp) {
            const ageSec = Math.floor((Date.now() - new Date(indicesTimestamp).getTime()) / 1000);
            if (isNaN(ageSec) || ageSec < 0 || ageSec < 15) {
                telemetryBadge = '<span class="text-green">🟢 LIVE TELEMETRY</span>';
            } else if (ageSec < 60) {
                telemetryBadge = `<span class="text-amber" style="color: #f59e0b;">🟡 STALE (${ageSec}s ago)</span>`;
            } else {
                telemetryBadge = `<span class="text-red">🔴 STALE (${Math.floor(ageSec / 60)}m ago)</span>`;
            }
        }

        return `
            <div class="apple-header-wrapper trader-header-bar">
                <!-- LEVEL 1: BRAND & TELEMETRY CONTROLS -->
                <div class="apple-header-top">
                    <div class="apple-brand-section">
                        <div class="apple-logo-box">📊</div>
                        <div>
                            <div class="apple-title-row">
                                <h1 class="apple-logo-title">Bank Nifty Quant Command Center</h1>
                                ${marketStatusBadge}
                            </div>
                            <span class="apple-header-subtitle">Zero-Friction Algorithmic Trading Platform</span>
                        </div>
                    </div>

                    <!-- TELEMETRY & EMERGENCY ACTIONS -->
                    <div class="apple-header-controls">
                        <div class="apple-telemetry-capsule">
                            ${telemetryBadge}
                            <span class="capsule-divider"></span>
                            <span class="capsule-text">SIMULATION MODE</span>
                            <span class="capsule-divider"></span>
                            <span class="capsule-gold">RISK: ₹0 / ₹5,000</span>
                        </div>

                        <button class="apple-btn-tour" onclick="OnboardingTour.startTour()">
                            ❓ Tour
                        </button>
                        
                        <button id="header-kill-switch" class="apple-btn-kill" onclick="Header.triggerKillSwitch()">
                            🚨 KILL SWITCH
                        </button>
                    </div>
                </div>

                <!-- LEVEL 2: APPLE SEGMENTED CONTROL NAVIGATION TABS -->
                <div class="apple-nav-bar">
                    <div class="apple-segmented-control">
                        <button class="apple-nav-tab ${activeTab === 'signals' ? 'active' : ''}" data-tab="signals">
                            🎯 Strategy Signals
                        </button>
                        <button class="apple-nav-tab ${activeTab === 'portfolio' ? 'active' : ''}" data-tab="portfolio">
                            💼 Portfolio OMS
                        </button>
                        <button class="apple-nav-tab ${activeTab === 'weekly' ? 'active' : ''}" data-tab="weekly">
                            📅 Weekly Audit
                        </button>
                        <button class="apple-nav-tab ${activeTab === 'audit' ? 'active' : ''}" data-tab="audit">
                            🔬 Strategy Audit
                        </button>
                        <button class="apple-nav-tab ${activeTab === 'market' ? 'active' : ''}" data-tab="market">
                            📊 Master Market Grid
                        </button>
                        <button class="apple-nav-tab ${activeTab === 'settings' ? 'active' : ''}" data-tab="settings">
                            ⚙️ Risk & Settings
                        </button>
                    </div>
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