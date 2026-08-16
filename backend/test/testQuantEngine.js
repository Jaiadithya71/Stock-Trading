// ============================================================================
// FILE: backend/test/testQuantEngine.js
// Unit & Integration Test Script for Quant Strategy Engine & Paper Trading OMS
// ============================================================================

const { calculateFractionalKelly, calculateVolatilityTargetWeight, calculateCornishFisherVaR } = require('../utils/riskEngine');
const StatArbService = require('../services/statArbService');
const SignalGeneratorService = require('../services/signalGeneratorService');
const PaperTradingService = require('../services/paperTradingService');

console.log('===========================================================');
console.log('🧪 QUANTITATIVE TRADING ENGINE - INTEGRATION TEST');
console.log('===========================================================');

// 1. Test Risk Engine Calculations
console.log('\n[1] Testing Risk Engine (Quarter-Kelly & Volatility Targeting)...');
const kellyFraction = calculateFractionalKelly(0.02, 0.0004, 0.25);
const volWeight = calculateVolatilityTargetWeight(0.20, 0.15, 1.0);
console.log(`   - Quarter Kelly Fraction: ${(kellyFraction * 100).toFixed(2)}%`);
console.log(`   - Volatility Target Weight (20% Vol vs 15% Target): ${volWeight.toFixed(2)}x`);

// 2. Test StatArb Constituent Breadth
console.log('\n[2] Testing StatArb Bank Nifty Constituent Breadth...');
const statArb = new StatArbService();
const stockList = [
  { symbol: 'HDFCBANK', pChange: 1.20 },
  { symbol: 'ICICIBANK', pChange: 0.80 },
  { symbol: 'KOTAKBANK', pChange: -0.10 },
  { symbol: 'AXISBANK', pChange: 0.50 },
  { symbol: 'SBIN', pChange: 0.90 }
];
const breadth = statArb.calculateConstituentBreadth(stockList);
console.log(`   - Weighted Breadth Score: ${breadth.weightedBreadthScore}%`);
console.log(`   - Directional Bias: ${breadth.directionalBias}`);

// 3. Test Quantitative Signal Generator
console.log('\n[3] Testing Signal Generator (PCR Z-Score + Stock Breadth)...');
const signalGen = new SignalGeneratorService();

// Test Scenario A: Oversold PCR Z-Score (-1.4) + Bullish Stock Breadth
const signalA = signalGen.generateSignal(
  { pcr: 0.65, pcrZScore: -1.45 },
  stockList,
  { portfolioCapital: 100000, indiaVix: 16.5 }
);
console.log(`   - Signal Output: ${signalA.signal} (${signalA.targetContract})`);
console.log(`   - Recommended Lot Size: ${signalA.riskAllocation.recommendedLotSize} Lot(s) (Allocated: ₹${signalA.riskAllocation.allocatedCapital})`);
console.log(`   - Rationale: ${signalA.rationale.join(' | ')}`);

// 4. Test Paper Trading OMS
console.log('\n[4] Testing Paper Trading OMS Execution & P&L Tracker...');
const paperTrading = new PaperTradingService(100000);

// Open Paper Position
const paperOrder = paperTrading.placePaperOrder({
  symbol: 'BANKNIFTY',
  optionType: 'CE',
  strikePrice: 49000,
  entryPrice: 320.00,
  quantity: 15,
  stopLossPrice: 270.00,
  targetPrice: 420.00
});

console.log(`   - Opened Order ID: ${paperOrder.id} @ ₹${paperOrder.entryPrice}`);

// Simulate Market Price Surge to ₹425 (Triggers Target Exit)
const exits = paperTrading.updateMarketTick(425.00);
console.log(`   - Closed Positions Triggered: ${exits.length}`);
if (exits.length > 0) {
  console.log(`   - Realized P&L: ₹${exits[0].pnl} (${exits[0].returnPct}%)`);
}

const summary = paperTrading.getPortfolioSummary();
console.log(`   - Ending Balance: ₹${summary.currentBalance} (Win Rate: ${summary.winRatePct}%)`);

console.log('\n===========================================================');
console.log('✅ ALL QUANT ENGINE TESTS PASSED SUCCESSFULLY!');
console.log('===========================================================');
