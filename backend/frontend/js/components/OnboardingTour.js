// ============================================================================
// FILE: frontend/js/components/OnboardingTour.js
// Interactive Step-by-Step Onboarding Guided Tour Component
// Includes smart LocalStorage skip tracking and 1-click restart
// ============================================================================

const OnboardingTour = {
  currentStep: 1,

  steps: [
    {
      step: 1,
      title: "👋 Welcome to Bank Nifty Quant Command Center",
      badge: "Getting Started • Step 1 of 6",
      desc: "An institutional-grade, zero-friction quantitative trading platform designed for systematic options trading and paper simulation.",
      highlights: [
        "• <strong>Zero Streaming Table Noise</strong> on signal & portfolio pages",
        "• <strong>100% Transparency</strong> with step-by-step mathematical proofs",
        "• <strong>Capital Protection</strong> starting small with ₹1,000 capital allocation"
      ]
    },
    {
      step: 2,
      title: "🎯 Strategy Signals Hub",
      badge: "Core Feature • Step 2 of 6",
      desc: "View high-confluence trade signals emitted by our 3 quantitative algorithms (PCR Z-Score, Fib/CPR Bounce, Bank Stock Breadth).",
      highlights: [
        "• <strong>Dynamic ATM Strike</strong> calculated automatically from live spot price",
        "• <strong>Fib 0.618 Golden Levels</strong> & CPR Central Pivots computed in real-time",
        "• <strong>1-Click Trade Execution</strong> with pre-calculated lot sizing"
      ]
    },
    {
      step: 3,
      title: "💼 Portfolio Order Management System (OMS)",
      badge: "Trade Tracker • Step 3 of 6",
      desc: "Track active positions, entry prices, live P&L, stop-loss limits (-15%), and profit targets (+30%).",
      highlights: [
        "• <strong>Simulated Paper Execution</strong> with realistic 0.05% slippage",
        "• <strong>Virtual Account Balance</strong> tracking (Initial ₹100,000 allocation)",
        "• <strong>Manual Position Closure</strong> at any time with 1 tap"
      ]
    },
    {
      step: 4,
      title: "📅 Weekly Audit & Weekend Review",
      badge: "Performance Review • Step 4 of 6",
      desc: "Review your complete 7-day trade history, win rates, and profit metrics over the weekend.",
      highlights: [
        "• <strong>7-Day Performance Metrics</strong>: Total trades, win rate %, net P&L",
        "• <strong>Weekend Study Mode</strong>: Replay trades without active market noise",
        "• <strong>Automated Log Export</strong> for quantitative strategy refinement"
      ]
    },
    {
      step: 5,
      title: "🔬 Strategy Math Audit & Kindle E-Book Reader",
      badge: "Mathematical Proof • Step 5 of 6",
      desc: "Verify raw market feed inputs and read our interactive 6-chapter Kindle E-Book Masterclass.",
      highlights: [
        "• <strong>Step-by-Step Formulas</strong>: Z_{PCR} = (PCR_t - μ) / σ",
        "• <strong>Raw Input Inspection Grid</strong>: Inspect mean, std dev, and stock weights",
        "• <strong>Kindle Masterclass E-Book Modal</strong>: Learn F&O trading from ground-up"
      ]
    },
    {
      step: 6,
      title: "⚙️ Risk Settings & Emergency Kill Switch",
      badge: "Capital Safety • Step 6 of 6",
      desc: "Configure your initial trade capital, lot caps, and safety circuit breakers.",
      highlights: [
        "• <strong>Start Small</strong>: ₹1,000 / 1 Lot allocation for safe paper validation",
        "• <strong>₹5,000 Daily Stop Loss</strong>: Locks trading automatically if cap is hit",
        "• <strong>[🚨 KILL SWITCH] Button</strong> in header to freeze trading instantly"
      ]
    }
  ],

  init() {
    const hasSeen = localStorage.getItem('hasSeenOnboardingTour');
    if (!hasSeen) {
      setTimeout(() => this.startTour(), 1200);
    }
  },

  startTour() {
    this.currentStep = 1;
    this.showModal();
  },

  showModal() {
    let overlay = document.getElementById('onboarding-tour-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'onboarding-tour-overlay';
      overlay.className = 'onboarding-tour-overlay';
      document.body.appendChild(overlay);
    }
    overlay.innerHTML = this.renderStepHtml();
    overlay.style.display = 'flex';
  },

  closeTour() {
    localStorage.setItem('hasSeenOnboardingTour', 'true');
    const overlay = document.getElementById('onboarding-tour-overlay');
    if (overlay) {
      overlay.style.display = 'none';
    }
  },

  renderStepHtml() {
    const stepObj = this.steps.find(s => s.step === this.currentStep) || this.steps[0];
    const totalSteps = this.steps.length;

    return `
      <div class="onboarding-modal-card">
        <div class="onboarding-modal-header">
          <span class="ob-badge">${stepObj.badge}</span>
          <button class="btn-skip-tour" onclick="OnboardingTour.closeTour()">⏩ Skip Tour</button>
        </div>

        <div class="onboarding-modal-body">
          <h2 class="ob-title">${stepObj.title}</h2>
          <p class="ob-desc">${stepObj.desc}</p>

          <div class="ob-highlights-box">
            ${stepObj.highlights.map(h => `<div class="ob-h-item">${h}</div>`).join('')}
          </div>
        </div>

        <div class="onboarding-modal-footer">
          <div class="ob-dots">
            ${this.steps.map(s => `<span class="ob-dot ${s.step === this.currentStep ? 'active' : ''}"></span>`).join('')}
          </div>

          <div class="ob-actions">
            <button class="btn btn-ob-nav" ${this.currentStep === 1 ? 'disabled' : ''} onclick="OnboardingTour.prevStep()">
              ◀ Previous
            </button>

            ${this.currentStep < totalSteps ? `
              <button class="btn btn-ob-next" onclick="OnboardingTour.nextStep()">
                Next Step ▶
              </button>
            ` : `
              <button class="btn btn-ob-finish" onclick="OnboardingTour.closeTour()">
                🎉 Get Started!
              </button>
            `}
          </div>
        </div>
      </div>
    `;
  },

  nextStep() {
    if (this.currentStep < this.steps.length) {
      this.currentStep++;
      this.showModal();
    }
  },

  prevStep() {
    if (this.currentStep > 1) {
      this.currentStep--;
      this.showModal();
    }
  }
};
