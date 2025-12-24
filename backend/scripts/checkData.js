// backend/scripts/checkData.js
// Run this script directly to check data availability in terminal
// Usage: node backend/scripts/checkData.js [command] [username]
// Commands: quick, full, specific

const TradingDashboard = require("../services/tradingDashboard");
const { loadCredentials } = require("../services/credentialService");
const { 
  checkDataAvailability, 
  checkSpecificData,
  quickCheck
} = require("../utils/dataChecker");
const { SYMBOL_TOKEN_MAP, INDICES_INSTRUMENTS } = require("../config/constants");

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || "quick";
  const username = args[1];
  
  if (!username) {
    console.error("\n❌ Error: Username is required");
    console.log("\n📖 Usage:");
    console.log("   node backend/scripts/checkData.js <command> <username>");
    console.log("\n📋 Commands:");
    console.log("   quick     - Quick check of HDFCBANK across all intervals");
    console.log("   full      - Comprehensive check of all symbols and intervals");
    console.log("   specific  - Check specific symbol and interval (requires additional args)");
    console.log("\n📝 Examples:");
    console.log("   node backend/scripts/checkData.js quick myusername");
    console.log("   node backend/scripts/checkData.js full myusername");
    console.log("   node backend/scripts/checkData.js specific myusername HDFCBANK ONE_MINUTE");
    console.log("");
    process.exit(1);
  }
  
  console.log("\n🔐 Loading credentials for user:", username);
  const credentials = loadCredentials(username);
  
  if (!credentials) {
    console.error(`❌ Error: User '${username}' not found`);
    console.log("💡 Tip: Make sure you've saved credentials for this user first.");
    process.exit(1);
  }
  
  console.log("✅ Credentials loaded");
  console.log("🔄 Authenticating...");
  
  const dashboard = new TradingDashboard(credentials);
  const authResult = await dashboard.authenticate();
  
  if (!authResult.success) {
    console.error("❌ Authentication failed:", authResult.message);
    process.exit(1);
  }
  
  console.log("✅ Authentication successful");
  console.log("👤 User:", authResult.data.name);
  console.log("🆔 Client ID:", authResult.data.clientId);
  
  // Execute command
  switch (command.toLowerCase()) {
    case "quick":
      console.log("\n⚡ Running quick check...\n");
      await quickCheck(dashboard);
      break;
      
    case "full":
      console.log("\n🔍 Running full comprehensive check...\n");
      await checkDataAvailability(dashboard);
      break;
      
    case "specific":
      const symbol = args[2];
      const interval = args[3];
      
      if (!symbol || !interval) {
        console.error("\n❌ Error: Symbol and interval required for specific check");
        console.log("📝 Example: node backend/scripts/checkData.js specific myusername HDFCBANK ONE_MINUTE");
        process.exit(1);
      }
      
      // Determine exchange and token
      let exchange, token;
      if (SYMBOL_TOKEN_MAP[symbol]) {
        exchange = "NSE";
        token = SYMBOL_TOKEN_MAP[symbol];
      } else if (INDICES_INSTRUMENTS[symbol]) {
        exchange = INDICES_INSTRUMENTS[symbol].exchange;
        token = INDICES_INSTRUMENTS[symbol].token;
      } else {
        console.error(`\n❌ Error: Symbol '${symbol}' not found`);
        console.log("\n📋 Available symbols:");
        console.log("Banks:", Object.keys(SYMBOL_TOKEN_MAP).join(", "));
        console.log("Indices:", Object.keys(INDICES_INSTRUMENTS).join(", "));
        process.exit(1);
      }
      
      console.log(`\n🔍 Checking ${symbol} - ${interval}...\n`);
      await checkSpecificData(dashboard, exchange, token, symbol, interval);
      break;
      
    default:
      console.error(`\n❌ Error: Unknown command '${command}'`);
      console.log("\n📋 Available commands: quick, full, specific");
      process.exit(1);
  }
  
  console.log("\n✅ Check completed!");
  process.exit(0);
}

// Run the script
main().catch(error => {
  console.error("\n❌ Error:", error.message);
  console.error(error);
  process.exit(1);
});