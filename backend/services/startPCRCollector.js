// ============================================================================
// FILE: backend/services/startPCRCollector.js
// Standalone PCR Collector - Runs continuously
// Usage: node backend/services/startPCRCollector.js <username>
// Keep this running in the background to continuously collect PCR data
// ============================================================================

const path = require("path");
const TradingDashboard = require("./tradingDashboard");
const PCRCollectorService = require("./pcrCollectorService");
const { loadCredentials } = require("./credentialService");

async function main() {
  const username = process.argv[2];
  
  if (!username) {
    console.log('\n❌ Username required!');
    console.log('Usage: node backend/services/startPCRCollector.js <username>\n');
    process.exit(1);
  }
  
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║              PCR BACKGROUND COLLECTOR SERVICE                  ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  
  try {
    // Authenticate
    console.log('\n🔐 Authenticating...');
    
    const credentials = loadCredentials(username);
    if (!credentials) {
      throw new Error(`User '${username}' not found`);
    }
    
    const dashboard = new TradingDashboard(credentials);
    const authResult = await dashboard.authenticate();
    
    if (!authResult.success) {
      throw new Error(authResult.message);
    }
    
    console.log(`✅ Authenticated as: ${authResult.data.name}`);
    console.log(`🆔 Client ID: ${authResult.data.clientId}`);
    
    // Start collector
    console.log('\n📊 Starting PCR Collector...');
    const collector = new PCRCollectorService(dashboard.smart_api, 1); // Every 1 minute
    collector.start();
    
    console.log('\n✅ Collector is now running!');
    console.log('   PCR data will be collected every 1 minute');
    console.log('   Press Ctrl+C to stop\n');
    
    // Show status every 5 minutes
    setInterval(() => {
      const status = collector.getStatus();
      console.log('─'.repeat(80));
      console.log(`📊 Status Update: ${new Date().toLocaleString('en-IN')}`);
      console.log(`   Running: ${status.isRunning ? '✅ Yes' : '❌ No'}`);
      console.log(`   Snapshots Collected: ${status.collectCount}`);
      console.log(`   Next Collection: ${status.nextCollection}`);
      console.log('─'.repeat(80) + '\n');
    }, 5 * 60 * 1000);
    
    // Keep the process running
    process.stdin.resume();
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Shutting down PCR Collector...');
  console.log('   Snapshot data saved in backend/data/pcr_snapshots.json');
  console.log('   You can restart the collector anytime\n');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n🛑 Received SIGTERM, shutting down...\n');
  process.exit(0);
});

main().catch(err => {
  console.error('\n❌ FATAL ERROR:', err);
  process.exit(1);
});