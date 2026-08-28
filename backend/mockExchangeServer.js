// ============================================================================
// FILE: backend/mockExchangeServer.js
// Dedicated Mock Market Exchange & Feed Generator Server (Stage 1 Local Testing)
// With Stress-Testing, Chaos Injection, and Variable Speed Multipliers
// ============================================================================

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.MOCK_PORT || 3001;

app.use(cors());
app.use(express.json());

const ARCHIVE_DIR = path.join(__dirname, 'data/archive');

class MockMarketState {
  constructor() {
    this.currentSpot = 57500.0;
    this.baseSpot = 57500.0;
    this.mode = 'IDLE'; // 'IDLE', 'MANUAL_SCENARIO', 'HISTORICAL_REPLAY', 'STRESS_TEST'
    this.scenarioName = 'IDLE';
    this.speedMultiplier = 1; // 1x, 5x, 10x, 60x
    this.tickIntervalMs = 1000;
    this.isRunning = true;
    this.currentStep = 0;
    this.totalSteps = 0;
    this.scenarioData = [];
    this.chaosOutageActive = false;
    
    // Constituent Bank Stocks
    this.stocks = {
      'HDFCBANK': { token: '1333', ltp: 1680.0, basePrice: 1680.0, pChange: 0.0 },
      'ICICIBANK': { token: '4963', ltp: 1250.0, basePrice: 1250.0, pChange: 0.0 },
      'SBIN':      { token: '1922', ltp: 820.0,  basePrice: 820.0,  pChange: 0.0 },
      'KOTAKBANK': { token: '5900', ltp: 1780.0, basePrice: 1780.0, pChange: 0.0 },
      'AXISBANK':  { token: '3045', ltp: 1190.0, basePrice: 1190.0, pChange: 0.0 }
    };

    this.rawPcr = 0.95;
    this.pcrZScore = 0.15;
    this.advancingWeight = 50.0;
    this.decliningWeight = 50.0;
    this.lastTickTime = new Date().toISOString();

    this.timerId = null;
    this.startTickLoop();
  }

  setSpeed(multiplier = 1) {
    this.speedMultiplier = Math.max(1, Math.min(100, multiplier));
    this.tickIntervalMs = Math.round(1000 / this.speedMultiplier);
    console.log(`⚡ [MockExchange] Speed changed to ${this.speedMultiplier}x (Tick every ${this.tickIntervalMs}ms)`);
    this.startTickLoop();
  }

  startTickLoop() {
    if (this.timerId) clearInterval(this.timerId);

    this.timerId = setInterval(() => {
      if (!this.isRunning) return;

      if (this.mode === 'MANUAL_SCENARIO' || this.mode === 'HISTORICAL_REPLAY' || this.mode === 'STRESS_TEST') {
        if (this.currentStep < this.scenarioData.length) {
          const item = this.scenarioData[this.currentStep];
          this.applySnapshot(item);
          this.currentStep++;
        } else {
          this.mode = 'IDLE';
          this.scenarioName = 'Completed (Idle)';
        }
      } else {
        // Idle gentle oscillation (+/- 3 pts)
        const jitter = (Math.random() - 0.5) * 4;
        this.currentSpot = parseFloat((this.currentSpot + jitter).toFixed(2));
        this.lastTickTime = new Date().toISOString();
      }
    }, this.tickIntervalMs);
  }

  applySnapshot(item) {
    this.currentSpot = parseFloat(item.spotPrice.toFixed(2));
    this.advancingWeight = parseFloat((item.advancingWeight || 50).toFixed(1));
    this.decliningWeight = parseFloat((item.decliningWeight || 50).toFixed(1));
    this.rawPcr = parseFloat((item.rawPcr || 0.95).toFixed(3));
    this.pcrZScore = parseFloat((item.pcrZScore !== undefined ? item.pcrZScore : 0.15).toFixed(2));
    this.lastTickTime = new Date().toISOString();

    if (item.bankStocks && Array.isArray(item.bankStocks)) {
      item.bankStocks.forEach(s => {
        if (this.stocks[s.symbol]) {
          this.stocks[s.symbol].pChange = parseFloat(s.pChange.toFixed(2));
          this.stocks[s.symbol].ltp = parseFloat((this.stocks[s.symbol].basePrice * (1 + s.pChange / 100)).toFixed(2));
        }
      });
    }
  }

  loadScenario(type) {
    this.scenarioName = type;
    this.currentStep = 0;
    this.scenarioData = [];

    const base = this.baseSpot;

    // 1. STANDARD SCENARIOS
    if (type === 'BULLISH_BREAKOUT') {
      this.mode = 'MANUAL_SCENARIO';
      for (let s = 0; s < 20; s++) {
        let delta = s < 4 ? s * 5 : (s < 12 ? 20 + (s - 4) * 16 : 148 + (s - 12) * 2);
        let adv = s < 4 ? 60 : (s < 12 ? 85 : 88);
        this.scenarioData.push({
          spotPrice: base + delta,
          advancingWeight: adv,
          decliningWeight: 100 - adv,
          rawPcr: 0.95,
          pcrZScore: 0.30,
          bankStocks: [
            { symbol: 'HDFCBANK', pChange: adv > 75 ? 1.4 : 0.4 },
            { symbol: 'ICICIBANK', pChange: adv > 75 ? 1.8 : 0.5 },
            { symbol: 'SBIN', pChange: 0.9 },
            { symbol: 'KOTAKBANK', pChange: 0.6 },
            { symbol: 'AXISBANK', pChange: 0.5 }
          ]
        });
      }
    } else if (type === 'BEARISH_WATERFALL') {
      this.mode = 'MANUAL_SCENARIO';
      for (let s = 0; s < 20; s++) {
        let delta = s < 4 ? -s * 5 : (s < 12 ? -20 - (s - 4) * 17 : -156 - (s - 12) * 2);
        let dec = s < 4 ? 60 : (s < 12 ? 88 : 92);
        this.scenarioData.push({
          spotPrice: base + delta,
          advancingWeight: 100 - dec,
          decliningWeight: dec,
          rawPcr: 0.95,
          pcrZScore: 0.30,
          bankStocks: [
            { symbol: 'HDFCBANK', pChange: -1.6 },
            { symbol: 'ICICIBANK', pChange: -2.1 },
            { symbol: 'SBIN', pChange: -1.2 },
            { symbol: 'KOTAKBANK', pChange: -0.9 },
            { symbol: 'AXISBANK', pChange: -0.8 }
          ]
        });
      }
    } else if (type === 'CHOPPY_RANGE') {
      this.mode = 'MANUAL_SCENARIO';
      for (let s = 0; s < 25; s++) {
        this.scenarioData.push({
          spotPrice: base + Math.sin(s * 0.8) * 12,
          advancingWeight: 48,
          decliningWeight: 52,
          rawPcr: 0.95,
          pcrZScore: 0.10,
          bankStocks: [
            { symbol: 'HDFCBANK', pChange: 0.1 },
            { symbol: 'ICICIBANK', pChange: -0.1 },
            { symbol: 'SBIN', pChange: 0.0 },
            { symbol: 'KOTAKBANK', pChange: 0.1 },
            { symbol: 'AXISBANK', pChange: -0.1 }
          ]
        });
      }
    } else if (type === 'OVERSOLD_CONTRARIAN') {
      this.mode = 'MANUAL_SCENARIO';
      for (let s = 0; s < 20; s++) {
        let isBounce = s >= 5;
        let delta = isBounce ? (s - 5) * 14 : -25;
        this.scenarioData.push({
          spotPrice: base + delta,
          advancingWeight: isBounce ? 72 : 40,
          decliningWeight: isBounce ? 28 : 60,
          rawPcr: isBounce ? 0.72 : 0.65,
          pcrZScore: -1.45,
          bankStocks: [
            { symbol: 'HDFCBANK', pChange: isBounce ? 0.9 : -0.8 },
            { symbol: 'ICICIBANK', pChange: isBounce ? 1.1 : -0.9 }
          ]
        });
      }
    }
    // 2. STRESS TEST SCENARIOS
    else if (type === 'STRESS_FLASH_CRASH') {
      this.mode = 'STRESS_TEST';
      // Instant -500 pt flash crash over 10 seconds
      for (let s = 0; s < 15; s++) {
        let drop = s * 50; // -50 pts every second
        this.scenarioData.push({
          spotPrice: base - drop,
          advancingWeight: 5,
          decliningWeight: 95,
          rawPcr: 1.45,
          pcrZScore: 2.10,
          bankStocks: [
            { symbol: 'HDFCBANK', pChange: -4.5 },
            { symbol: 'ICICIBANK', pChange: -5.2 },
            { symbol: 'SBIN', pChange: -3.8 },
            { symbol: 'KOTAKBANK', pChange: -3.2 },
            { symbol: 'AXISBANK', pChange: -4.0 }
          ]
        });
      }
    } else if (type === 'STRESS_V_SHAPE_WHIPSAW') {
      this.mode = 'STRESS_TEST';
      // +180 pt bull trap in 8s followed by -350 pt collapse in 10s
      for (let s = 0; s < 25; s++) {
        let delta = s <= 8 ? s * 22.5 : 180 - (s - 8) * 35;
        let adv = s <= 8 ? 85 : 12;
        this.scenarioData.push({
          spotPrice: base + delta,
          advancingWeight: adv,
          decliningWeight: 100 - adv,
          rawPcr: s <= 8 ? 0.90 : 1.35,
          pcrZScore: s <= 8 ? 0.40 : 1.80,
          bankStocks: [
            { symbol: 'HDFCBANK', pChange: s <= 8 ? 1.8 : -3.5 },
            { symbol: 'ICICIBANK', pChange: s <= 8 ? 2.1 : -4.0 }
          ]
        });
      }
    }

    this.totalSteps = this.scenarioData.length;
    console.log(`🎬 [MockExchange] Loaded scenario '${type}' (${this.totalSteps} steps)`);
  }

  loadHistoricalDate(dateStr) {
    const file = path.join(ARCHIVE_DIR, `signal_audit_${dateStr}.json`);
    if (!fs.existsSync(file)) {
      throw new Error(`Historical audit file for date ${dateStr} not found`);
    }

    const raw = fs.readFileSync(file, 'utf8');
    const data = JSON.parse(raw);
    const entries = Array.isArray(data) ? data : (data.data || []);

    if (entries.length === 0) {
      throw new Error(`Historical file for ${dateStr} has 0 entries`);
    }

    this.scenarioName = `Replay: ${dateStr}`;
    this.mode = 'HISTORICAL_REPLAY';
    this.currentStep = 0;
    this.scenarioData = entries;
    this.totalSteps = entries.length;
    this.baseSpot = entries[0].spotPrice;

    console.log(`📜 [MockExchange] Loaded historical session '${dateStr}' (${this.totalSteps} 1-min snapshots)`);
  }
}

const mockState = new MockMarketState();

// -------------------------------------------------------------
// REST API ENDPOINTS FOR MAIN SERVER (Port 3000)
// -------------------------------------------------------------

app.get('/mock/market-data', (req, res) => {
  if (mockState.chaosOutageActive) {
    return res.status(503).json({ success: false, message: 'CHAOS_SIMULATION: Broker Service Unavailable (503)' });
  }

  const atmStrike = Math.round(mockState.currentSpot / 100) * 100;
  
  const bankStocksArray = Object.entries(mockState.stocks).map(([symbol, data]) => ({
    symbol,
    token: data.token,
    ltp: data.ltp,
    pChange: data.pChange
  }));

  res.json({
    success: true,
    data: {
      spotPrice: mockState.currentSpot,
      atmStrike,
      advancingWeight: mockState.advancingWeight,
      decliningWeight: mockState.decliningWeight,
      rawPcr: mockState.rawPcr,
      pcrZScore: mockState.pcrZScore,
      stocks: mockState.stocks,
      bankStocks: bankStocksArray,
      lastTickTime: mockState.lastTickTime,
      simulationState: {
        mode: mockState.mode,
        scenarioName: mockState.scenarioName,
        step: mockState.currentStep,
        totalSteps: mockState.totalSteps,
        speedMultiplier: mockState.speedMultiplier
      }
    }
  });
});

app.post('/mock/set-scenario', (req, res) => {
  const { scenario, historicalDate, speedMultiplier } = req.body;

  try {
    if (speedMultiplier) {
      mockState.setSpeed(speedMultiplier);
    }

    if (historicalDate) {
      mockState.loadHistoricalDate(historicalDate);
    } else if (scenario) {
      mockState.loadScenario(scenario);
    }

    res.json({
      success: true,
      message: `Scenario '${mockState.scenarioName}' loaded`,
      state: {
        mode: mockState.mode,
        scenarioName: mockState.scenarioName,
        totalSteps: mockState.totalSteps,
        speedMultiplier: mockState.speedMultiplier
      }
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

app.post('/mock/chaos-toggle', (req, res) => {
  const { enableOutage } = req.body;
  mockState.chaosOutageActive = !!enableOutage;
  console.log(`🔌 [MockExchange] Chaos Outage Active: ${mockState.chaosOutageActive}`);
  res.json({ success: true, chaosOutageActive: mockState.chaosOutageActive });
});

app.post('/mock/reset', (req, res) => {
  const { baseSpot = 57500 } = req.body;
  mockState.baseSpot = baseSpot;
  mockState.currentSpot = baseSpot;
  mockState.mode = 'IDLE';
  mockState.scenarioName = 'IDLE';
  mockState.currentStep = 0;
  mockState.totalSteps = 0;
  mockState.chaosOutageActive = false;
  mockState.setSpeed(1);

  res.json({ success: true, message: 'Mock state reset to base spot', baseSpot });
});

// -------------------------------------------------------------
// INTERACTIVE WEB CONTROL PANEL (http://localhost:3001/control)
// -------------------------------------------------------------
app.get(['/', '/control'], (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Mock Exchange & Stress Testing Controller (Port 3001)</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }
        .card { background: #1e293b; border-radius: 14px; padding: 24px; max-width: 840px; margin: 0 auto; box-shadow: 0 10px 25px rgba(0,0,0,0.5); border: 1px solid #334155; }
        h1 { margin-top: 0; color: #38bdf8; font-size: 24px; display: flex; align-items: center; justify-content: space-between; }
        .ticker { background: #0f172a; border-radius: 10px; padding: 18px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; border: 1px solid #334155; margin-bottom: 20px; }
        .ticker-item { text-align: center; }
        .ticker-label { font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; }
        .ticker-value { font-size: 20px; font-weight: 700; color: #38bdf8; margin-top: 4px; font-family: monospace; }
        .section-title { font-size: 14px; font-weight: 600; color: #cbd5e1; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
        .btn-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 20px; }
        button { border: none; border-radius: 10px; padding: 13px 16px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.15s ease; display: flex; align-items: center; justify-content: center; gap: 8px; }
        button:hover { transform: translateY(-2px); opacity: 0.95; }
        .btn-bull { background: #10b981; color: white; }
        .btn-bear { background: #ef4444; color: white; }
        .btn-chop { background: #f59e0b; color: white; }
        .btn-reversal { background: #8b5cf6; color: white; }
        .btn-stress { background: linear-gradient(135deg, #dc2626, #991b1b); color: white; border: 1px solid #f87171; }
        .btn-whip { background: linear-gradient(135deg, #d97706, #b45309); color: white; border: 1px solid #fbbf24; }
        .btn-chaos { background: #334155; color: #f87171; border: 1px solid #ef4444; }
        .btn-reset { background: #475569; color: white; width: 100%; margin-top: 15px; }
        .speed-box { background: #0f172a; padding: 14px 18px; border-radius: 10px; border: 1px solid #334155; margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between; }
        .speed-btns { display: flex; gap: 8px; }
        .btn-spd { background: #1e293b; color: #94a3b8; padding: 6px 14px; font-size: 12px; border: 1px solid #475569; }
        .btn-spd.active { background: #0284c7; color: white; border-color: #38bdf8; }
        .history-box { background: #0f172a; padding: 14px; border-radius: 10px; border: 1px solid #334155; display: flex; gap: 10px; align-items: center; margin-bottom: 20px; }
        select { background: #1e293b; color: white; border: 1px solid #475569; border-radius: 8px; padding: 10px 14px; flex-grow: 1; font-size: 13px; }
        .btn-replay { background: #0284c7; color: white; padding: 10px 20px; }
        .status-badge { display: inline-block; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; background: #0369a1; color: #e0f2fe; }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>
          <span>📊 Mock Exchange & Stress Controller</span>
          <span class="status-badge" id="statusBadge">PORT :3001</span>
        </h1>
        <p style="color: #94a3b8; font-size: 13px; margin-top: -6px;">Stage 1 Local Testing • Live Scenario Injection & Chaos Stress Suite</p>

        <div class="ticker">
          <div class="ticker-item">
            <div class="ticker-label">Spot Price</div>
            <div class="ticker-value" id="spotVal">₹57,500.00</div>
          </div>
          <div class="ticker-item">
            <div class="ticker-label">Advancing Weight</div>
            <div class="ticker-value" style="color: #10b981;" id="advVal">50.0%</div>
          </div>
          <div class="ticker-item">
            <div class="ticker-label">Scenario Mode</div>
            <div class="ticker-value" style="font-size: 14px; color: #f59e0b;" id="scenVal">IDLE</div>
          </div>
          <div class="ticker-item">
            <div class="ticker-label">Speed</div>
            <div class="ticker-value" style="font-size: 16px; color: #38bdf8;" id="spdVal">1x</div>
          </div>
        </div>

        <div class="speed-box">
          <span style="font-size: 13px; font-weight: 600; color: #cbd5e1;">⚡ Simulation Speed:</span>
          <div class="speed-btns">
            <button class="btn-spd active" id="spd1" onclick="setSpeed(1)">1x (Realtime)</button>
            <button class="btn-spd" id="spd5" onclick="setSpeed(5)">5x Speed</button>
            <button class="btn-spd" id="spd10" onclick="setSpeed(10)">10x Speed</button>
            <button class="btn-spd" id="spd30" onclick="setSpeed(30)">30x Turbo</button>
          </div>
        </div>

        <div class="section-title">🔥 Stress Testing & Chaos Suite</div>
        <div class="btn-grid">
          <button class="btn-stress" onclick="triggerScenario('STRESS_FLASH_CRASH')">💥 Flash Crash (-500 pts in 10s)</button>
          <button class="btn-whip" onclick="triggerScenario('STRESS_V_SHAPE_WHIPSAW')">🎢 Violent Whipsaw (+180pt &rarr; -350pt)</button>
          <button class="btn-chaos" id="btnOutage" onclick="toggleOutage()">🔌 Inject Broker Disconnect / Outage</button>
          <button class="btn-chop" onclick="triggerScenario('CHOPPY_RANGE')">🟡 Sideways Chop (Theta Stress)</button>
        </div>

        <div class="section-title">🎯 Standard Strategy Scenarios</div>
        <div class="btn-grid">
          <button class="btn-bull" onclick="triggerScenario('BULLISH_BREAKOUT')">🚀 Bullish Breakout (+150 pts)</button>
          <button class="btn-bear" onclick="triggerScenario('BEARISH_WATERFALL')">🔻 Bearish Waterfall (-160 pts)</button>
          <button class="btn-reversal" onclick="triggerScenario('OVERSOLD_CONTRARIAN')">🟢 Oversold Reversal (Fib + PCR)</button>
        </div>

        <div class="section-title">📜 Historical Day Replay</div>
        <div class="history-box">
          <select id="histSelect">
            <option value="2026-08-26">Aug 26, 2026 (Wednesday Bullish Rally - 354 mins)</option>
            <option value="2026-08-25">Aug 25, 2026 (Tuesday Sideways Chop - 357 mins)</option>
            <option value="2026-08-24">Aug 24, 2026 (Monday Consolidating - 350 mins)</option>
            <option value="2026-08-21">Aug 21, 2026 (Friday Trend - 355 mins)</option>
          </select>
          <button class="btn-replay" onclick="replayHistorical()">▶️ Replay Day</button>
        </div>

        <button class="btn-reset" onclick="resetState()">🔄 Reset Mock State & Center Spot (₹57,500)</button>
      </div>

      <script>
        let currentOutage = false;

        async function fetchStatus() {
          try {
            const res = await fetch('/mock/market-data');
            if (res.status === 503) {
              document.getElementById('statusBadge').innerText = 'BROKER OUTAGE ACTIVE';
              document.getElementById('statusBadge').style.background = '#dc2626';
              return;
            }
            const data = await res.json();
            if (data.success) {
              const d = data.data;
              document.getElementById('statusBadge').innerText = 'PORT :3001';
              document.getElementById('statusBadge').style.background = '#0369a1';
              document.getElementById('spotVal').innerText = '₹' + d.spotPrice.toLocaleString('en-IN', {minimumFractionDigits: 2});
              document.getElementById('advVal').innerText = d.advancingWeight + '%';
              document.getElementById('scenVal').innerText = d.simulationState.scenarioName + (d.simulationState.totalSteps ? ' (' + d.simulationState.step + '/' + d.simulationState.totalSteps + ')' : '');
              document.getElementById('spdVal').innerText = (d.simulationState.speedMultiplier || 1) + 'x';
            }
          } catch(e) {}
        }
        setInterval(fetchStatus, 800);
        fetchStatus();

        async function setSpeed(spd) {
          document.querySelectorAll('.btn-spd').forEach(b => b.classList.remove('active'));
          const btn = document.getElementById('spd' + spd);
          if (btn) btn.classList.add('active');

          await fetch('/mock/set-scenario', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ speedMultiplier: spd })
          });
          fetchStatus();
        }

        async function triggerScenario(name) {
          await fetch('/mock/set-scenario', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ scenario: name })
          });
          fetchStatus();
        }

        async function toggleOutage() {
          currentOutage = !currentOutage;
          const btn = document.getElementById('btnOutage');
          btn.innerText = currentOutage ? '🟢 Restore Broker Connection' : '🔌 Inject Broker Disconnect / Outage';
          btn.style.background = currentOutage ? '#10b981' : '#334155';
          btn.style.color = currentOutage ? 'white' : '#f87171';

          await fetch('/mock/chaos-toggle', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ enableOutage: currentOutage })
          });
          fetchStatus();
        }

        async function replayHistorical() {
          const date = document.getElementById('histSelect').value;
          await fetch('/mock/set-scenario', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ historicalDate: date })
          });
          fetchStatus();
        }

        async function resetState() {
          currentOutage = false;
          await fetch('/mock/reset', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ baseSpot: 57500 })
          });
          fetchStatus();
        }
      </script>
    </body>
    </html>
  `);
});

app.listen(PORT, () => {
  console.log('================================================================');
  console.log(`🚀 Mock Market Exchange Server running on http://localhost:${PORT}`);
  console.log(`🎛️ Interactive Control Panel: http://localhost:${PORT}/control`);
  console.log('================================================================');
});
