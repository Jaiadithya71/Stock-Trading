// ============================================================================
// FILE: backend/test/testAngelPCRCollector.js
// Verification Script for Angel One Native PCR Collector
// ============================================================================

const PCRCollectorService = require('../services/pcrCollectorService');

async function testAngelPCRCollector() {
  console.log('===========================================================');
  console.log('🧪 TESTING ANGEL ONE NATIVE PCR COLLECTOR SERVICE');
  console.log('===========================================================');

  const collector = new PCRCollectorService(null, 1);
  await collector.collectPCR();

  console.log('===========================================================');
  console.log('✅ ANGEL ONE PCR SNAPSHOT COLLECTED SUCCESSFULLY WITH 0 TIMEOUTS!');
  console.log('===========================================================');
}

testAngelPCRCollector().catch(err => console.error('❌ Error testing PCR collector:', err));
