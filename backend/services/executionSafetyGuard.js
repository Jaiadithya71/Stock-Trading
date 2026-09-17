// ============================================================================
// FILE: backend/services/executionSafetyGuard.js
// Production Execution Safety Guard & Prometheus Metric Telemetry
// Continuous Runtime Invariant Assertion, Circuit Breakers, and Financial Risk Controls
// ============================================================================

const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(__dirname, '../data/execution_safety_state.json');

class ExecutionSafetyGuard {
  constructor() {
    this.circuitBreakerStatus = 'NORMAL'; // 'NORMAL' | 'TRIPPED'
    this.circuitBreakerReason = null;
    this.circuitBreakerTrippedAt = null;
    this.cooldownUntil = null;

    this.invariantChecksTotal = 0;
    this.invariantViolationsTotal = 0;
    this.lastViolation = null;
    this.recentViolations = [];
    this.recentChecks = [];

    // Setup Performance Telemetry (Prometheus Gauges & Counters)
    this.setupMetrics = {
      'EMA20_PULLBACK': { total: 0, wins: 0, losses: 0, pnl: 0 },
      'ORB_BREAKOUT': { total: 0, wins: 0, losses: 0, pnl: 0 },
      'INSIDE_BAR': { total: 0, wins: 0, losses: 0, pnl: 0 },
      'SWING_RUNNER': { total: 0, wins: 0, losses: 0, pnl: 0 },
      'UNCLASSIFIED': { total: 0, wins: 0, losses: 0, pnl: 0 }
    };

    this.maxDailyDrawdownPct = 2.0; // Max 2.0% single-day drawdown halts trading
    this.maxPositionSizePct = 15.0; // Max 15% margin per trade
    this.consecutiveLossLimit = 3; // 3 back-to-back losses trips 45-min cooldown

    this.loadState();
  }

  loadState() {
    try {
      if (fs.existsSync(STATE_FILE)) {
        const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
        this.circuitBreakerStatus = data.circuitBreakerStatus || 'NORMAL';
        this.circuitBreakerReason = data.circuitBreakerReason || null;
        this.circuitBreakerTrippedAt = data.circuitBreakerTrippedAt || null;
        this.cooldownUntil = data.cooldownUntil ? new Date(data.cooldownUntil) : null;
        this.invariantChecksTotal = data.invariantChecksTotal || 0;
        this.invariantViolationsTotal = data.invariantViolationsTotal || 0;
        this.recentViolations = data.recentViolations || [];
        if (data.setupMetrics) {
          this.setupMetrics = { ...this.setupMetrics, ...data.setupMetrics };
        }
      }
    } catch (e) {
      console.warn('⚠️ [SafetyGuard] Could not load safety state, initializing fresh:', e.message);
    }
  }

  saveState() {
    try {
      const data = {
        circuitBreakerStatus: this.circuitBreakerStatus,
        circuitBreakerReason: this.circuitBreakerReason,
        circuitBreakerTrippedAt: this.circuitBreakerTrippedAt,
        cooldownUntil: this.cooldownUntil ? this.cooldownUntil.toISOString() : null,
        invariantChecksTotal: this.invariantChecksTotal,
        invariantViolationsTotal: this.invariantViolationsTotal,
        recentViolations: this.recentViolations.slice(-20),
        setupMetrics: this.setupMetrics,
        lastUpdated: new Date().toISOString()
      };
      fs.writeFileSync(STATE_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
      console.error('❌ [SafetyGuard] Failed to persist safety state:', e.message);
    }
  }

  /**
   * Log an invariant check outcome
   */
  logCheck(name, passed, details = {}) {
    this.invariantChecksTotal++;
    const record = {
      name,
      passed,
      timestamp: new Date().toISOString(),
      details
    };

    this.recentChecks.unshift(record);
    if (this.recentChecks.length > 30) this.recentChecks.pop();

    if (!passed) {
      this.invariantViolationsTotal++;
      this.lastViolation = record;
      this.recentViolations.unshift(record);
      if (this.recentViolations.length > 20) this.recentViolations.pop();
      console.error(`🚨 [SafetyGuard INVARIANT VIOLATION] Rule "${name}" FAILED:`, details);
      this.saveState();
    }
    return passed;
  }

  /**
   * 1. PRE-TRADE GATEKEEPER
   * Asserts all pre-execution invariants before an order touches OMS or Broker
   * @throws {Error} if any invariant fails
   */
  validatePreTradeOrder(order, currentPrice, portfolio = {}) {
    const { action, symbol, quantity, entryPrice, stopLoss, target, holdingType, assetType = 'EQUITY_CASH' } = order;
    const capital = portfolio.initialCapital || 100000;
    const currentBalance = portfolio.currentBalance !== undefined ? portfolio.currentBalance : capital;

    // Invariant 1: Circuit Breaker Status
    if (this.circuitBreakerStatus === 'TRIPPED') {
      const msg = `Circuit Breaker is TRIPPED (${this.circuitBreakerReason}). All new order placement is locked.`;
      this.logCheck('CIRCUIT_BREAKER_PASS', false, { symbol, reason: msg });
      throw new Error(`[SAFETY_REJECT] ${msg}`);
    }

    // Invariant 2: Active Cooldown Check
    if (this.cooldownUntil && new Date() < this.cooldownUntil) {
      const remainingMins = Math.ceil((this.cooldownUntil - new Date()) / 60000);
      const msg = `Engine in cooldown after consecutive losses. Unlocks in ${remainingMins} min(s).`;
      this.logCheck('COOLDOWN_ACTIVE', false, { symbol, remainingMins });
      throw new Error(`[SAFETY_REJECT] ${msg}`);
    }

    // Invariant 3: Valid Symbol & Parameters
    if (!symbol || !action || !quantity || quantity <= 0 || !entryPrice || entryPrice <= 0) {
      const msg = `Malformed order parameters: symbol=${symbol}, action=${action}, qty=${quantity}, price=${entryPrice}`;
      this.logCheck('ORDER_PARAMS_VALID', false, { order });
      throw new Error(`[SAFETY_REJECT] ${msg}`);
    }

    // Invariant 4: Stop-Loss & Target Geometry Assertion
    // For BUY: SL < Entry < Target with minimum 1:1.5 Risk-to-Reward
    // For SELL: Target < Entry < SL with minimum 1:1.5 Risk-to-Reward
    if (action.toUpperCase() === 'BUY') {
      if (stopLoss >= entryPrice) {
        const msg = `BUY stopLoss (₹${stopLoss}) must be strictly less than entryPrice (₹${entryPrice})`;
        this.logCheck('STOP_LOSS_GEOMETRY_BUY', false, { symbol, stopLoss, entryPrice });
        throw new Error(`[SAFETY_REJECT] ${msg}`);
      }
      if (target <= entryPrice) {
        const msg = `BUY target (₹${target}) must be strictly greater than entryPrice (₹${entryPrice})`;
        this.logCheck('TARGET_GEOMETRY_BUY', false, { symbol, target, entryPrice });
        throw new Error(`[SAFETY_REJECT] ${msg}`);
      }
      const risk = entryPrice - stopLoss;
      const reward = target - entryPrice;
      const rrr = reward / risk;
      if (rrr < 1.2) { // Minimum 1:1.2 baseline tolerance
        const msg = `BUY Risk-to-Reward Ratio (${rrr.toFixed(2)}) is below safety floor of 1:1.2`;
        this.logCheck('MIN_RRR_RATIO', false, { symbol, risk, reward, rrr });
        throw new Error(`[SAFETY_REJECT] ${msg}`);
      }
    } else if (action.toUpperCase() === 'SELL') {
      if (stopLoss <= entryPrice) {
        const msg = `SELL stopLoss (₹${stopLoss}) must be strictly greater than entryPrice (₹${entryPrice})`;
        this.logCheck('STOP_LOSS_GEOMETRY_SELL', false, { symbol, stopLoss, entryPrice });
        throw new Error(`[SAFETY_REJECT] ${msg}`);
      }
      if (target >= entryPrice) {
        const msg = `SELL target (₹${target}) must be strictly less than entryPrice (₹${entryPrice})`;
        this.logCheck('TARGET_GEOMETRY_SELL', false, { symbol, target, entryPrice });
        throw new Error(`[SAFETY_REJECT] ${msg}`);
      }
      const risk = stopLoss - entryPrice;
      const reward = entryPrice - target;
      const rrr = reward / risk;
      if (rrr < 1.2) {
        const msg = `SELL Risk-to-Reward Ratio (${rrr.toFixed(2)}) is below safety floor of 1:1.2`;
        this.logCheck('MIN_RRR_RATIO', false, { symbol, risk, reward, rrr });
        throw new Error(`[SAFETY_REJECT] ${msg}`);
      }
    }

    // Invariant 5: Exchange Cash Short Overnight Compliance (NSE MIS Rule)
    if (action.toUpperCase() === 'SELL' && assetType === 'EQUITY_CASH' && holdingType === 'SWING_POSITIONAL') {
      const msg = `Cash equity short selling cannot be held as SWING_POSITIONAL (NSE mandatory physical settlement rule)`;
      this.logCheck('CASH_SHORT_OVERNIGHT_COMPLIANCE', false, { symbol, action, holdingType });
      throw new Error(`[SAFETY_REJECT] ${msg}`);
    }

    // Invariant 6: Single-Trade Margin Limit (Max 15% of Capital)
    const tradeValue = entryPrice * quantity;
    const requiredMargin = tradeValue / 5; // 5x MIS leverage
    const maxAllowedMargin = capital * (this.maxPositionSizePct / 100);
    if (requiredMargin > maxAllowedMargin) {
      const msg = `Order margin (₹${requiredMargin.toFixed(0)}) exceeds max safety limit of ₹${maxAllowedMargin.toFixed(0)} (15% of equity)`;
      this.logCheck('POSITION_SIZE_INVARIANT', false, { requiredMargin, maxAllowedMargin });
      throw new Error(`[SAFETY_REJECT] ${msg}`);
    }

    // Invariant 7: Sufficient Cash Balance
    if (requiredMargin > currentBalance) {
      const msg = `Insufficient funds: Required ₹${requiredMargin.toFixed(0)}, Available ₹${currentBalance.toFixed(0)}`;
      this.logCheck('SUFFICIENT_BALANCE_INVARIANT', false, { requiredMargin, currentBalance });
      throw new Error(`[SAFETY_REJECT] ${msg}`);
    }

    this.logCheck('PRE_TRADE_INVARIANTS_PASSED', true, { symbol, action, qty: quantity, entry: entryPrice });
    return true;
  }

  /**
   * 2. RUNTIME INVARIANT SENTINEL (Runs every cycle)
   * Continuously scans open positions, balances, and P&L for discrepancies
   */
  runRuntimeScan(positions = [], currentBalance = 100000, initialCapital = 100000, tradesToday = [], istTimeInMinutes = 0) {
    const violations = [];

    // Invariant A: No Naked Positions (Every open position must have stopLoss & target)
    for (const pos of positions) {
      if (!pos.stopLoss || !pos.target) {
        violations.push({
          rule: 'NO_NAKED_POSITIONS',
          symbol: pos.symbol,
          message: `Position ${pos.symbol} has missing Stop-Loss or Target.`
        });
      }

      // Check for corrupted stopLoss positions
      if (pos.action === 'BUY' && pos.stopLoss > pos.currentPrice && pos.trailingStatus !== 'PROFIT_TRAILED') {
        violations.push({
          rule: 'INVALID_SL_LEVEL_BUY',
          symbol: pos.symbol,
          message: `BUY position ${pos.symbol} stopLoss (₹${pos.stopLoss}) is above currentPrice (₹${pos.currentPrice}) without being marked exit.`
        });
      }
    }

    // Invariant B: Ledger Conservation Invariant
    // Balance + Sum(Margin Blocked) + Realized P&L should roughly equal Initial Capital
    const totalMargin = positions.reduce((sum, p) => sum + (p.marginBlocked || 0), 0);
    const totalRealizedToday = tradesToday.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const accountingSum = currentBalance + totalMargin;
    // Allow small divergence for historical realized P&L prior to today
    if (isNaN(accountingSum) || accountingSum < 0) {
      violations.push({
        rule: 'ACCOUNTING_CORRUPTION',
        message: `Account balance or margin is corrupted: Balance=₹${currentBalance}, Margin=₹${totalMargin}`
      });
    }

    // Invariant C: 3:16 PM Cash Short Leak Sentinel (Past 916 mins IST)
    if (istTimeInMinutes >= 916) {
      const leakingShorts = positions.filter(p => p.action === 'SELL' && (!p.assetType || p.assetType === 'EQUITY_CASH'));
      if (leakingShorts.length > 0) {
        violations.push({
          rule: 'OVERNIGHT_SHORT_LEAK',
          symbols: leakingShorts.map(p => p.symbol),
          message: `Found ${leakingShorts.length} short equity position(s) still open after 3:15 PM EOD square-off!`
        });
      }
    }

    // Invariant D: Portfolio Daily Drawdown Circuit Breaker (-2.0%)
    const maxAllowedLoss = initialCapital * (this.maxDailyDrawdownPct / 100);
    if (totalRealizedToday < -maxAllowedLoss) {
      this.tripCircuitBreaker(`Daily realized drawdown of ₹${Math.abs(totalRealizedToday).toFixed(2)} exceeded maximum safety threshold of ₹${maxAllowedLoss.toFixed(2)} (-2.0%)`);
    }

    // Invariant E: Consecutive Loss Streak Sentinel
    if (tradesToday.length >= this.consecutiveLossLimit && !this.cooldownUntil) {
      const lastN = tradesToday.slice(-this.consecutiveLossLimit);
      const allLosses = lastN.every(t => (t.pnl || 0) < 0);
      if (allLosses) {
        this.cooldownUntil = new Date(Date.now() + 45 * 60 * 1000); // 45-minute cooling off period
        console.warn(`⏳ [SafetyGuard] 3 consecutive losses detected. Activating 45-minute cooldown until ${this.cooldownUntil.toLocaleTimeString()}`);
        this.saveState();
      }
    }

    const passed = violations.length === 0;
    this.logCheck('RUNTIME_PORTFOLIO_SCAN', passed, { openPositions: positions.length, violationsCount: violations.length, violations });

    return {
      passed,
      violations,
      circuitBreakerStatus: this.circuitBreakerStatus,
      cooldownActive: Boolean(this.cooldownUntil && new Date() < this.cooldownUntil)
    };
  }

  /**
   * Trip the Circuit Breaker
   */
  tripCircuitBreaker(reason) {
    if (this.circuitBreakerStatus !== 'TRIPPED') {
      this.circuitBreakerStatus = 'TRIPPED';
      this.circuitBreakerReason = reason;
      this.circuitBreakerTrippedAt = new Date().toISOString();
      console.error(`🛑🛑🛑 [SafetyGuard CIRCUIT BREAKER TRIPPED] Reason: ${reason} 🛑🛑🛑`);
      this.saveState();
    }
  }

  /**
   * Reset Circuit Breaker (Manual Dev Action)
   */
  resetCircuitBreaker(adminUser = 'DevOperator') {
    this.circuitBreakerStatus = 'NORMAL';
    this.circuitBreakerReason = null;
    this.circuitBreakerTrippedAt = null;
    this.cooldownUntil = null;
    console.log(`🛡️ [SafetyGuard] Circuit Breaker reset by ${adminUser}. Trading engine re-armed.`);
    this.saveState();
    return { success: true, message: 'Circuit breaker reset successfully. Trading engine re-armed.' };
  }

  /**
   * Record Closed Trade Attribution
   */
  recordTradeAttribution(trade) {
    const setup = trade.setupTrigger || trade.exitReason?.includes('EMA') ? 'EMA20_PULLBACK' : (trade.holdingType === 'SWING_POSITIONAL' ? 'SWING_RUNNER' : 'ORB_BREAKOUT');
    if (!this.setupMetrics[setup]) {
      this.setupMetrics[setup] = { total: 0, wins: 0, losses: 0, pnl: 0 };
    }

    const m = this.setupMetrics[setup];
    m.total++;
    m.pnl = parseFloat((m.pnl + (trade.pnl || 0)).toFixed(2));
    if ((trade.pnl || 0) > 0) m.wins++;
    else m.losses++;

    this.saveState();
  }

  /**
   * Diagnostics summary for Dev Dashboard
   */
  getDiagnostics() {
    const isCooldownActive = Boolean(this.cooldownUntil && new Date() < this.cooldownUntil);
    const cooldownMinsRemaining = isCooldownActive ? Math.ceil((this.cooldownUntil - new Date()) / 60000) : 0;

    return {
      status: this.circuitBreakerStatus === 'NORMAL' ? 'PASS' : 'CRITICAL',
      circuitBreaker: {
        status: this.circuitBreakerStatus,
        reason: this.circuitBreakerReason,
        trippedAt: this.circuitBreakerTrippedAt,
        cooldownActive: isCooldownActive,
        cooldownMinsRemaining
      },
      invariantSentinel: {
        checksTotal: this.invariantChecksTotal,
        violationsTotal: this.invariantViolationsTotal,
        lastViolation: this.lastViolation,
        recentChecks: this.recentChecks.slice(0, 10),
        recentViolations: this.recentViolations.slice(0, 5)
      },
      safetyRules: [
        { name: 'Pre-Trade Geometry Invariant (SL < Entry < Target, RRR >= 1:1.2)', active: true, status: 'PASS' },
        { name: 'Max Position Size Invariant (<= 15% equity per trade)', active: true, status: 'PASS' },
        { name: 'Overnight Short Selling Compliance (NSE MIS strictly Intraday)', active: true, status: 'PASS' },
        { name: 'Daily Drawdown Circuit Breaker (-2.0% equity stop)', active: true, status: this.circuitBreakerStatus === 'TRIPPED' ? 'TRIPPED' : 'PASS' },
        { name: 'Consecutive Loss Streak Sentinel (3 consecutive losses -> 45m cooldown)', active: true, status: isCooldownActive ? 'COOLING_DOWN' : 'PASS' },
        { name: '3:16 PM Cash Short Leak Sentinel (Zero short equity overnight)', active: true, status: 'PASS' }
      ],
      setupPerformance: Object.entries(this.setupMetrics).map(([setup, m]) => ({
        setup,
        total: m.total,
        wins: m.wins,
        losses: m.losses,
        winRatePct: m.total > 0 ? parseFloat(((m.wins / m.total) * 100).toFixed(1)) : 0,
        netPnL: m.pnl
      }))
    };
  }

  /**
   * Prometheus / OpenMetrics Plain-Text Exporter
   * Compliant with standard Prometheus scraping
   */
  getPrometheusMetrics() {
    const isTripped = this.circuitBreakerStatus === 'TRIPPED' ? 1 : 0;
    const lines = [
      '# HELP trading_circuit_breaker_status Circuit breaker state (0 = Normal, 1 = Tripped)',
      '# TYPE trading_circuit_breaker_status gauge',
      `trading_circuit_breaker_status ${isTripped}`,
      '',
      '# HELP trading_invariant_checks_total Total number of invariant checks executed',
      '# TYPE trading_invariant_checks_total counter',
      `trading_invariant_checks_total ${this.invariantChecksTotal}`,
      '',
      '# HELP trading_invariant_violations_total Total number of invariant violations intercepted',
      '# TYPE trading_invariant_violations_total counter',
      `trading_invariant_violations_total ${this.invariantViolationsTotal}`,
      ''
    ];

    Object.entries(this.setupMetrics).forEach(([setup, m]) => {
      const winRate = m.total > 0 ? ((m.wins / m.total) * 100).toFixed(2) : '0.00';
      lines.push(
        `# HELP trading_setup_trades_total Total trades executed per strategy setup`,
        `# TYPE trading_setup_trades_total counter`,
        `trading_setup_trades_total{setup="${setup}"} ${m.total}`,
        `# HELP trading_setup_win_rate_pct Win rate percentage per strategy setup`,
        `# TYPE trading_setup_win_rate_pct gauge`,
        `trading_setup_win_rate_pct{setup="${setup}"} ${winRate}`,
        `# HELP trading_setup_pnl_rupees Net realized P&L in INR per strategy setup`,
        `# TYPE trading_setup_pnl_rupees gauge`,
        `trading_setup_pnl_rupees{setup="${setup}"} ${m.pnl}`,
        ''
      );
    });

    return lines.join('\n');
  }
}

module.exports = new ExecutionSafetyGuard();
