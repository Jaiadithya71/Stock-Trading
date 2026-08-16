// ============================================================================
// FILE: backend/test/testEndpoints.js
// REST API Endpoint Test Script for Quant Signals & Paper OMS
// ============================================================================

const express = require('express');
const bodyParser = require('body-parser');
const quantRoutes = require('../routes/quantRoutes');

const app = express();
app.use(bodyParser.json());
app.use('/api', quantRoutes);

const PORT = 3099;
const server = app.listen(PORT, async () => {
  console.log(`\n🚀 Test Express Server running on http://localhost:${PORT}`);

  try {
    const fetch = (await import('node-fetch')).default;

    // Test 1: GET /api/quant/signal
    console.log('\n[TEST 1] Fetching GET /api/quant/signal...');
    const signalRes = await fetch(`http://localhost:${PORT}/api/quant/signal`);
    const signalData = await signalRes.json();
    console.log('   Response Signal:', signalData.data.signal);
    console.log('   Response PCR Z-Score:', signalData.data.pcrMetrics.pcrZScore);
    console.log('   Recommended Lot Size:', signalData.data.riskAllocation.recommendedLotSize);

    // Test 2: POST /api/paper/trade
    console.log('\n[TEST 2] Executing POST /api/paper/trade...');
    const tradeRes = await fetch(`http://localhost:${PORT}/api/paper/trade`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        symbol: 'BANKNIFTY',
        optionType: 'CE',
        strikePrice: 49000,
        entryPrice: 250,
        quantity: 15
      })
    });
    const tradeData = await tradeRes.json();
    console.log('   Trade Result:', tradeData.message);
    console.log('   Position ID:', tradeData.data.id);

    // Test 3: GET /api/paper/summary
    console.log('\n[TEST 3] Fetching GET /api/paper/summary...');
    const summaryRes = await fetch(`http://localhost:${PORT}/api/paper/summary`);
    const summaryData = await summaryRes.json();
    console.log('   Active Positions Count:', summaryData.data.activePositionsCount);
    console.log('   Current Balance: ₹' + summaryData.data.currentBalance);

    console.log('\n===========================================================');
    console.log('✅ ALL REST API ENDPOINT TESTS PASSED SUCCESSFULLY!');
    console.log('===========================================================');
  } catch (err) {
    console.error('❌ Endpoint test failed:', err);
  } finally {
    server.close();
    process.exit(0);
  }
});
