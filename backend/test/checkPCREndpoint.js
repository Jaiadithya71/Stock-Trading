// ============================================================================
// FILE: backend/test/checkPCREndpoint.js
// Check if putCallRatio API endpoint exists in JavaScript SDK
// Usage: node backend/test/checkPCREndpoint.js <username>
// ============================================================================

const path = require("path");
const TradingDashboard = require(path.join(__dirname, "../services/tradingDashboard"));
const { loadCredentials } = require(path.join(__dirname, "../services/credentialService"));

async function main() {
  const username = process.argv[2];
  
  if (!username) {
    console.log('Usage: node backend/test/checkPCREndpoint.js <username>');
    process.exit(1);
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('CHECKING FOR PUT-CALL RATIO API ENDPOINT');
  console.log('='.repeat(80));
  
  // Authenticate
  const credentials = loadCredentials(username);
  const dashboard = new TradingDashboard(credentials);
  const authResult = await dashboard.authenticate();
  
  if (!authResult.success) {
    console.log('❌ Auth failed:', authResult.message);
    process.exit(1);
  }
  
  console.log('✅ Authenticated\n');
  
  const smartAPI = dashboard.smart_api;
  
  // Check what methods are available
  console.log('📋 Checking available methods on smartAPI object:\n');
  
  const methodsToCheck = [
    'putCallRatio',
    'getPutCallRatio',
    'optionGreek',
    'gainersLosers',
    'oIBuildup',
    'OIBuildup',
    'nseIntraday',
    'bseIntraday',
    'marketData',
    'getCandleData',
    'searchScrip'
  ];
  
  methodsToCheck.forEach(method => {
    const exists = typeof smartAPI[method] === 'function';
    const status = exists ? '✅ EXISTS' : '❌ NOT FOUND';
    console.log(`  ${method.padEnd(25)} ${status}`);
  });
  
  // Try to call putCallRatio if it exists
  if (typeof smartAPI.putCallRatio === 'function') {
    console.log('\n' + '='.repeat(80));
    console.log('TESTING putCallRatio API');
    console.log('='.repeat(80));
    
    try {
      // Based on Python SDK, it might need specific parameters
      const response = await smartAPI.putCallRatio({
        name: 'BANKNIFTY'
      });
      
      console.log('\n✅ SUCCESS! putCallRatio API works!');
      console.log('\nResponse:');
      console.log(JSON.stringify(response, null, 2));
    } catch (error) {
      console.log('\n❌ Error calling putCallRatio:', error.message);
    }
  } else {
    console.log('\n⚠️  putCallRatio API not found in JavaScript SDK');
    console.log('   This API exists in Python SDK but may not be implemented in JS SDK yet');
  }
  
  // Try optionGreek
  if (typeof smartAPI.optionGreek === 'function') {
    console.log('\n' + '='.repeat(80));
    console.log('TESTING optionGreek API');
    console.log('='.repeat(80));
    
    try {
      const response = await smartAPI.optionGreek({
        name: 'BANKNIFTY',
        expirydate: '24FEB2026' // Format: DDMMMYYYY
      });
      
      console.log('\n✅ SUCCESS! optionGreek API works!');
      console.log('\nResponse (first 500 chars):');
      const responseStr = JSON.stringify(response, null, 2);
      console.log(responseStr.substring(0, 500) + '...');
    } catch (error) {
      console.log('\n❌ Error calling optionGreek:', error.message);
    }
  }
  
  // Try OIBuildup  
  if (typeof smartAPI.oIBuildup === 'function' || typeof smartAPI.OIBuildup === 'function') {
    console.log('\n' + '='.repeat(80));
    console.log('TESTING OIBuildup API');
    console.log('='.repeat(80));
    
    try {
      const method = smartAPI.oIBuildup || smartAPI.OIBuildup;
      const response = await method();
      
      console.log('\n✅ SUCCESS! OIBuildup API works!');
      console.log('\nResponse (first 500 chars):');
      const responseStr = JSON.stringify(response, null, 2);
      console.log(responseStr.substring(0, 500) + '...');
    } catch (error) {
      console.log('\n❌ Error calling OIBuildup:', error.message);
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log('\nIf putCallRatio exists → We can use it directly for PCR!');
  console.log('If not → We need to calculate PCR manually from marketData\n');
  console.log('='.repeat(80) + '\n');
}

main().catch(console.error);