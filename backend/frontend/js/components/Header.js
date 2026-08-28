// ============================================================================
// FILE: frontend/js/components/Header.js
// Single-Row Ultra-Compact Bento Topbar (52px Viewport-Optimized Header)
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
            '<span class="apple-status-badge open">🟢 OPEN</span>' : 
            '<span class="apple-status-badge closed">🌙 CLOSED</span>';

        let telemetryBadge = '<span class="text-red">🔴 DISCONNECTED</span>';
        
        if (indicesTimestamp) {
            const ageSec = Math.floor((Date.now() - new Date(indicesTimestamp).getTime()) / 1000);
            if (isNaN(ageSec) || ageSec < 0 || ageSec < 15) {
                telemetryBadge = '<span class="text-green">🟢 LIVE STREAM</span>';
            } else if (ageSec < 60) {
                telemetryBadge = `<span class="text-amber" style="color: #f59e0b;">🟡 ${ageSec}s ago</span>`;
            } else {
                telemetryBadge = `<span class="text-red">🔴 ${Math.floor(ageSec / 60)}m ago</span>`;
            }
        }

        return `
            <div class="apple-header-wrapper trader-header-bar" style="padding: 8px 18px; margin-bottom: 12px; border-radius: 12px; gap: 0;">
                <div class="apple-header-top" style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                    
                    <!-- BRAND SECTION -->
                    <div class="apple-brand-section" style="gap: 10px; min-width: 260px;">
                        <div class="apple-logo-box" style="width: 34px; height: 34px; font-size: 17px; border-radius: 8px;">📊</div>
                        <div>
                            <div class="apple-title-row" style="gap: 8px;">
                                <h1 class="apple-logo-title" style="font-size: 15px; font-weight: 700;">Bank Nifty Quant</h1>
                                ${marketStatusBadge}
                            </div>
                        </div>
                    </div>

                    <!-- CENTER SEGMENTED NAVIGATION -->
                    <div class="apple-nav-bar" style="flex: 1; max-width: 760px; margin: 0 16px;">
                        <div class="apple-segmented-control" style="padding: 3px; border-radius: 10px; background: rgba(0,0,0,0.5);">
                            <button class="apple-nav-tab ${activeTab === 'signals' ? 'active' : ''}" data-tab="signals" style="padding: 6px 12px; font-size: 12px;">
                                🎯 Signals
                            </button>
                            <button class="apple-nav-tab ${activeTab === 'portfolio' ? 'active' : ''}" data-tab="portfolio" style="padding: 6px 12px; font-size: 12px;">
                                💼 Portfolio
                            </button>
                            <button class="apple-nav-tab ${activeTab === 'market' ? 'active' : ''}" data-tab="market" style="padding: 6px 12px; font-size: 12px;">
                                📊 Market Grid
                            </button>
                            <button class="apple-nav-tab ${activeTab === 'weekly' ? 'active' : ''}" data-tab="weekly" style="padding: 6px 12px; font-size: 12px;">
                                📅 Audit
                            </button>
                            <button class="apple-nav-tab ${activeTab === 'audit' ? 'active' : ''}" data-tab="audit" style="padding: 6px 12px; font-size: 12px;">
                                🔬 Quant Math
                            </button>
                            <button class="apple-nav-tab ${activeTab === 'settings' ? 'active' : ''}" data-tab="settings" style="padding: 6px 12px; font-size: 12px;">
                                ⚙️ Risk
                            </button>
                        </div>
                    </div>

                    <!-- RIGHT TELEMETRY CONTROLS -->
                    <div class="apple-header-controls" style="gap: 10px;">
                        <div class="apple-telemetry-capsule" style="padding: 5px 12px; font-size: 11px; border-radius: 20px;">
                            <span id="header-telemetry-badge">${telemetryBadge}</span>
                            <span class="capsule-divider"></span>
                            <span class="capsule-gold">RISK: ₹0 / ₹5k</span>
                        </div>

                        <button id="header-kill-switch" class="apple-btn-kill" onclick="Header.triggerKillSwitch()" style="padding: 6px 14px; font-size: 11px; border-radius: 16px;">
                            🚨 KILL
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
    },

    updateTelemetryBadge(indicesTimestamp) {
        const badgeEl = document.getElementById('header-telemetry-badge');
        if (!badgeEl) return;

        if (!indicesTimestamp) {
            badgeEl.innerHTML = '<span class="text-red">🔴 DISCONNECTED</span>';
            return;
        }

        const ageSec = Math.floor((Date.now() - new Date(indicesTimestamp).getTime()) / 1000);
        if (isNaN(ageSec) || ageSec < 0 || ageSec < 15) {
            badgeEl.innerHTML = '<span class="text-green" style="color: #34d399; font-weight: 600;">🟢 LIVE STREAM</span>';
        } else if (ageSec < 60) {
            badgeEl.innerHTML = `<span class="text-amber" style="color: #f59e0b; font-weight: 600;">🟡 ${ageSec}s ago</span>`;
        } else {
            badgeEl.innerHTML = `<span class="text-red" style="color: #f43f5e; font-weight: 600;">🔴 ${Math.floor(ageSec / 60)}m ago</span>`;
        }
    }
};