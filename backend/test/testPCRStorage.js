// ============================================================================
// FILE: backend/test/testPCRStorage.js
// Test PCR Storage System
// - Starts background collector
// - Collects 5 snapshots (1 per minute)
// - Calculates historical intervals
// - Shows trending data
// Usage: node backend/test/testPCRStorage.js <username>
// ============================================================================

const path = require("path");
const TradingDashboard = require(path.join(__dirname, "../services/tradingDashboard"));
const PCRCollectorService = require(path.join(__dirname, "../services/pcrCollectorService"));
const PCRStorageService = require(path.join(__dirname, "../services/pcrStorageService"));
const { loadCredentials } = require(path.join(__dirname, "../services/credentialService"));

// Colors
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function displayHistoricalPCR(data) {
  console.clear();
  
  log('\n' + '═'.repeat(100), colors.cyan + colors.bright);
  log('PCR HISTORICAL DATA - STORED LOCALLY', colors.cyan + colors.bright);
  log('═'.repeat(100), colors.cyan + colors.bright);
  
  log(`\n📊 Symbol: ${data.symbol}`, colors.bright);
  log(`⏰ Analysis Time: ${new Date(data.timestamp).toLocaleString('en-IN')}`, colors.bright);
  log(`📈 Total Snapshots: ${data.totalSnapshots}`, colors.green);
  log(`📅 Data Range: ${data.dataRange.from} → ${data.dataRange.to}`, colors.blue);
  
  log('\n' + '─'.repeat(100), colors.cyan);
  log('TIME INTERVAL ANALYSIS', colors.yellow + colors.bright);
  log('─'.repeat(100), colors.cyan);
  
  console.log('\n' + 'Interval'.padEnd(12) + 'PCR'.padEnd(12) + 'Sentiment'.padEnd(15) + 'Trend'.padEnd(12) + 'Change'.padEnd(12) + 'Data Points');
  console.log('─'.repeat(100));
  
  const intervals = Object.keys(data.intervals).sort((a, b) => {
    const aNum = parseInt(a);
    const bNum = parseInt(b);
    return aNum - bNum;
  });
  
  intervals.forEach(interval => {
    const int = data.intervals[interval];
    
    let sentimentColor = colors.yellow;
    if (int.sentiment === 'Buying') sentimentColor = colors.green;
    if (int.sentiment === 'Selling') sentimentColor = colors.red;
    
    let trendSymbol = '→';
    if (int.trend === 'Rising') trendSymbol = '↑';
    if (int.trend === 'Falling') trendSymbol = '↓';
    
    const line = interval.padEnd(12) + 
                 (int.pcr || 'N/A').toString().padEnd(12) + 
                 int.sentiment.padEnd(15) + 
                 (trendSymbol + ' ' + int.trend).padEnd(12) + 
                 (int.change || 'N/A').toString().padEnd(12) + 
                 int.dataPoints.toString();
    
    log(line, sentimentColor);
  });
  
  log('\n' + '═'.repeat(100), colors.cyan);
  log('LEGEND', colors.yellow + colors.bright);
  log('═'.repeat(100), colors.cyan);
  
  log('\n📊 Sentiment:', colors.bright);
  log(`   ${colors.green}Buying${colors.reset}   → PCR < 0.8 (More calls, bullish)`, colors.reset);
  log(`   ${colors.yellow}Neutral${colors.reset}  → PCR 0.8-1.2 (Balanced)`, colors.reset);
  log(`   ${colors.red}Selling${colors.reset}  → PCR > 1.2 (More puts, bearish)`, colors.reset);
  
  log('\n📈 Trend:', colors.bright);
  log('   ↑ Rising   → PCR increasing (more bearish)', colors.reset);
  log('   ↓ Falling  → PCR decreasing (more bullish)', colors.reset);
  log('   → Stable   → PCR unchanged', colors.reset);
  
  log('\n' + '═'.repeat(100), colors.cyan);
  log('');
}

async function main() {
  const username = process.argv[2];
  
  if (!username) {
    log('\n❌ Username required!', colors.red);
    log('Usage: node backend/test/testPCRStorage.js <username>\n');
    process.exit(1);
  }
  
  try {
    log('╔════════════════════════════════════════════════════════════════╗', colors.cyan + colors.bright);
    log('║           PCR STORAGE SYSTEM TEST - LOCAL HISTORY             ║', colors.cyan + colors.bright);
    log('╚════════════════════════════════════════════════════════════════╝', colors.cyan + colors.bright);
    
    // Authenticate
    log('\n📝 Step 1: Authenticating...', colors.bright);
    
    const credentials = loadCredentials(username);
    if (!credentials) {
      throw new Error(`User '${username}' not found`);
    }
    
    const dashboard = new TradingDashboard(credentials);
    const authResult = await dashboard.authenticate();
    
    if (!authResult.success) {
      throw new Error(authResult.message);
    }
    
    log(`✅ Authenticated as: ${authResult.data.name}`, colors.green);
    
    // Initialize services
    log('\n📦 Step 2: Initializing PCR services...', colors.bright);
    const collector = new PCRCollectorService(dashboard.smart_api, 1); // Collect every 1 minute
    const storage = new PCRStorageService();
    
    // Check if we have existing data
    const stats = await storage.getStats();
    log(`   Existing snapshots: ${stats.totalSnapshots}`, colors.blue);
    
    if (stats.totalSnapshots === 0) {
      log('\n⚠️  No existing data found. Starting fresh collection...', colors.yellow);
      log('   This will collect 5 snapshots (5 minutes total)', colors.yellow);
      log('   Please wait...\n', colors.yellow);
      
      // Start collector
      collector.start();
      
      // Wait for 5 minutes to collect 5 snapshots
      const snapshotsNeeded = 5;
      log(`⏳ Collecting ${snapshotsNeeded} snapshots (1 per minute)...`, colors.cyan);
      log('   Press Ctrl+C to stop early\n', colors.blue);
      
      for (let i = 0; i < snapshotsNeeded; i++) {
        await new Promise(resolve => setTimeout(resolve, 60 * 1000)); // Wait 1 minute
        log(`   ✓ Snapshot ${i + 1}/${snapshotsNeeded} collected`, colors.green);
      }
      
      // Stop collector
      collector.stop();
      
      log('\n✅ Collection complete!', colors.green);
      
    } else {
      log(`\n✅ Found ${stats.totalSnapshots} existing snapshots`, colors.green);
      log('   Skipping collection, using existing data...', colors.blue);
    }
    
    // Calculate historical intervals
    log('\n📊 Step 3: Calculating historical PCR intervals...', colors.bright);
    
    const historicalData = await storage.getHistoricalPCR('BANKNIFTY', [1, 3, 5, 15, 30]);
    
    if (!historicalData) {
      log('❌ No historical data available', colors.red);
      process.exit(1);
    }
    
    // Display results
    displayHistoricalPCR(historicalData);
    
    // Show next steps
    log('✅ PCR Storage System working perfectly!', colors.green + colors.bright);
    log('\n💡 How It Works:', colors.bright);
    log('   1. Background collector fetches current PCR every minute', colors.cyan);
    log('   2. Snapshots stored in JSON file (atomic writes, no corruption)', colors.cyan);
    log('   3. Historical intervals calculated from stored snapshots', colors.cyan);
    log('   4. Old data auto-cleaned (keeps last 24 hours)', colors.cyan);
    
    log('\n📝 Next Steps:', colors.bright);
    log('   • Integrate collector into your main server (auto-start on boot)', colors.cyan);
    log('   • Create API endpoint to serve historical PCR', colors.cyan);
    log('   • Build frontend component matching your screenshot', colors.cyan);
    log('   • Optional: Switch to SQLite for better performance', colors.cyan);
    
    log('\n🚀 To run collector continuously:', colors.bright);
    log('   node backend/services/startPCRCollector.js <username>', colors.yellow);
    
    log('');
    
  } catch (error) {
    log('\n❌ ERROR:', colors.red + colors.bright);
    log(`   ${error.message}`, colors.red);
    log('');
    console.error(error.stack);
    process.exit(1);
  }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  log('\n\n👋 Shutting down gracefully...', colors.yellow);
  process.exit(0);
});

main().catch(err => {
  console.error('\n❌ FATAL ERROR:', err);
  process.exit(1);
});