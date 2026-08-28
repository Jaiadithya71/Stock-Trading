// ============================================================================
// FILE: backend/test/cliController.js
// Interactive CLI Controller & Verification Tool for Stage 1 Local Testing
// Allows triggering market scenarios from the terminal and verifying server reactions
// ============================================================================

const http = require('http');

function post(port, path, body) {
  return new Promise((resolve) => {
    const data = JSON.stringify(body);
    const req = http.request({
      hostname: '127.0.0.1',
      port: port,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, res => {
      let resp = '';
      res.on('data', c => resp += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(resp) }); }
        catch(e) { resolve({ status: res.statusCode, raw: resp }); }
      });
    });
    req.on('error', err => resolve({ error: err.message }));
    req.write(data);
    req.end();
  });
}

function get(port, path) {
  return new Promise((resolve) => {
    http.get({ hostname: '127.0.0.1', port, path }, res => {
      let resp = '';
      res.on('data', c => resp += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(resp) }); }
        catch(e) { resolve({ status: res.statusCode, raw: resp }); }
      });
    }).on('error', err => resolve({ error: err.message }));
  });
}

const COMMAND_MAP = {
  'bullish': { scenario: 'BULLISH_BREAKOUT', speed: 5, label: '🚀 Bullish Momentum Breakout (+150 pts)' },
  'bearish': { scenario: 'BEARISH_WATERFALL', speed: 5, label: '🔻 Bearish Waterfall Breakdown (-160 pts)' },
  'crash':   { scenario: 'STRESS_FLASH_CRASH', speed: 5, label: '💥 Flash Crash (-500 pts)' },
  'whip':    { scenario: 'STRESS_V_SHAPE_WHIPSAW', speed: 5, label: '🎢 Violent V-Shape Whipsaw (+180pt -> -350pt)' },
  'chop':    { scenario: 'CHOPPY_RANGE', speed: 2, label: '🟡 Sideways Consolidation Range' },
  'reversal':{ scenario: 'OVERSOLD_CONTRARIAN', speed: 5, label: '🟢 Oversold Fib + PCR Reversal Bounce' }
};

async function executeCommand() {
  const args = process.argv.slice(2);
  const cmd = (args[0] || 'status').toLowerCase();

  console.log('======================================================================');
  console.log('🎮 PRO_T TERMINAL COMMAND CONTROLLER & QUANT VERIFICATION');
  console.log('======================================================================');

  if (cmd === 'help') {
    console.log('\nAvailable Terminal Commands:');
    console.log('  node backend/test/cliController.js bullish   -> Trigger Bullish Breakout');
    console.log('  node backend/test/cliController.js bearish   -> Trigger Bearish Waterfall');
    console.log('  node backend/test/cliController.js crash     -> Trigger Flash Crash');
    console.log('  node backend/test/cliController.js whip      -> Trigger V-Shape Whipsaw');
    console.log('  node backend/test/cliController.js chop      -> Trigger Sideways Consolidation');
    console.log('  node backend/test/cliController.js reversal  -> Trigger Oversold Reversal');
    console.log('  node backend/test/cliController.js outage    -> Inject Broker Outage (503)');
    console.log('  node backend/test/cliController.js restore   -> Restore Broker Connection');
    console.log('  node backend/test/cliController.js reset     -> Reset Spot to ₹57,500');
    console.log('  node backend/test/cliController.js status    -> Inspect Current State');
    return;
  }

  if (cmd === 'reset') {
    console.log('\n🔄 Resetting Mock Exchange state to base spot ₹57,500...');
    const r = await post(3001, '/mock/reset', { baseSpot: 57500 });
    console.log('   Response:', r.data?.message || r);
  } else if (cmd === 'outage') {
    console.log('\n🔌 Injecting Broker Outage (Chaos 503) on Mock Exchange (:3001)...');
    await post(3001, '/mock/chaos-toggle', { enableOutage: true });
  } else if (cmd === 'restore') {
    console.log('\n🟢 Restoring Broker Connection on Mock Exchange (:3001)...');
    await post(3001, '/mock/chaos-toggle', { enableOutage: false });
  } else if (COMMAND_MAP[cmd]) {
    const config = COMMAND_MAP[cmd];
    console.log(`\n📡 Transmitting Scenario: ${config.label}...`);
    const triggerRes = await post(3001, '/mock/set-scenario', { 
      scenario: config.scenario, 
      speedMultiplier: config.speed 
    });
    console.log('   Mock Exchange Acknowledged:', triggerRes.data?.message || triggerRes);
    
    console.log('⏳ Waiting 2 seconds for price action ticks to propagate to Main Server (:3000)...');
    await new Promise(r => setTimeout(r, 2000));
  } else if (cmd !== 'status') {
    console.log(`❌ Unknown command '${cmd}'. Run with 'help' to see options.`);
    return;
  }

  // Inspect Live Reaction on Main Dashboard Server (:3000)
  console.log('\n🔍 INSPECTING LIVE REACTION ON MAIN SERVER (:3000):');
  console.log('----------------------------------------------------------------------');

  const [indicesRes, signalRes, paperRes] = await Promise.all([
    post(3000, '/api/indices-data', { username: 'default' }),
    get(3000, '/api/quant/signal'),
    get(3000, '/api/paper/summary')
  ]);

  if (indicesRes.status === 503) {
    console.log('🔴 CONNECTION STATUS: 🔴 DISCONNECTED (Broker Outage Active)');
    console.log('   Response Message:  ', indicesRes.data?.message || '503 Service Unavailable');
    return;
  }

  const bnf = indicesRes.data?.data?.BANKNIFTY;
  const sig = signalRes.data?.data;
  const paper = paperRes.data?.data;

  console.log(`🟢 CONNECTION STATUS: 🟢 LIVE TELEMETRY (Data Source: ${indicesRes.data?.meta?.dataSource || 'mockExchange'})`);
  console.log(`📈 Bank Nifty Spot:   ₹${bnf?.ltp?.toLocaleString('en-IN', {minimumFractionDigits: 2}) || 'N/A'}`);
  console.log(`🎯 Quant Signal:      ${sig?.signal || 'NEUTRAL_HOLD'}`);
  console.log(`📝 Signal Title:       ${sig?.signalTitle || 'N/A'}`);
  console.log(`🎯 Target Contract:   ${sig?.targetContract || 'N/A'}`);
  console.log(`💡 Confidence Score:  ${sig?.confidenceScore || 'N/A'}`);
  console.log(`📊 Advancing Breadth: ${sig?.breadthMetrics?.advancingWeight || 50}% | Declining: ${sig?.breadthMetrics?.decliningWeight || 50}%`);
  console.log(`💼 Paper Balance:     ₹${paper?.currentBalance?.toLocaleString('en-IN', {minimumFractionDigits: 2}) || '1,00,000.00'}`);
  console.log(`💰 Realized P&L:      ₹${paper?.totalRealizedPnL || 0} (Win Rate: ${paper?.winRatePct || 0}%)`);
  console.log(`📋 Active Positions:  ${paper?.activePositionsCount || 0}`);
  console.log('----------------------------------------------------------------------\n');
}

executeCommand();
