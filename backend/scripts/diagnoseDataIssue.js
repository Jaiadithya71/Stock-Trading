// backend/scripts/diagnoseDataIssue.js
// Run this to diagnose why you're getting "No data available"
// Usage: node backend/scripts/diagnoseDataIssue.js <username>

const TradingDashboard = require("../services/tradingDashboard");
const { loadCredentials } = require("../services/credentialService");
const { SYMBOL_TOKEN_MAP, INDICES_INSTRUMENTS } = require("../config/constants");

async function diagnose() {
  const username = process.argv[2];
  
  if (!username) {
    console.error("\n❌ Usage: node backend/scripts/diagnoseDataIssue.js <username>\n");
    process.exit(1);
  }
  
  console.log("\n" + "=".repeat(100));
  console.log("🔍 COMPREHENSIVE DIAGNOSTIC TOOL - ALL BANKS & INDICES");
  console.log("=".repeat(100));
  
  // Load credentials
  console.log("\n📋 Step 1: Loading credentials...");
  const credentials = loadCredentials(username);
  
  if (!credentials) {
    console.error(`❌ User '${username}' not found`);
    process.exit(1);
  }
  console.log("✅ Credentials loaded");
  
  // Authenticate
  console.log("\n📋 Step 2: Authenticating...");
  const dashboard = new TradingDashboard(credentials);
  const authResult = await dashboard.authenticate();
  
  if (!authResult.success) {
    console.error("❌ Authentication failed:", authResult.message);
    process.exit(1);
  }
  console.log("✅ Authentication successful");
  console.log(`   User: ${authResult.data.name}`);
  console.log(`   Client ID: ${authResult.data.clientId}`);
  
  // Check current time and market status
  console.log("\n📋 Step 3: Checking market status...");
  const now = new Date();
  const istTime = now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false });
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTime = currentHour * 60 + currentMinute;
  const marketOpen = 9 * 60 + 15; // 9:15 AM
  const marketClose = 15 * 60 + 30; // 3:30 PM
  const isWeekday = now.getDay() >= 1 && now.getDay() <= 5;
  const isMarketOpen = isWeekday && currentTime >= marketOpen && currentTime <= marketClose;
  
  console.log(`⏰ Current Time (IST): ${istTime}`);
  console.log(`📅 Day of Week: ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getDay()]}`);
  console.log(`🏪 Market Status: ${isMarketOpen ? '🟢 OPEN' : '🔴 CLOSED'}`);
  
  if (!isMarketOpen) {
    console.log("\n⚠️  WARNING: Market is currently CLOSED");
    console.log("   This is the most common reason for 'No data available'");
    console.log("   Market hours: Monday-Friday, 9:15 AM - 3:30 PM IST");
  }
  
  // Test all banks with ONE_MINUTE interval
  console.log("\n📋 Step 4: Testing ALL BANK NIFTY STOCKS (ONE_MINUTE interval)...");
  console.log("\n" + "-".repeat(100));
  console.log("SYMBOL".padEnd(15) + "TOKEN".padEnd(10) + "STATUS".padEnd(15) + "CANDLES".padEnd(10) + "LTP".padEnd(15) + "VOLUME".padEnd(15) + "DATE RANGE");
  console.log("-".repeat(100));
  
  const bankResults = [];
  
  for (const [symbol, token] of Object.entries(SYMBOL_TOKEN_MAP)) {
    try {
      // Calculate date range
      const toDate = new Date();
      const fromDate = new Date(toDate.getTime() - 60 * 60 * 1000); // 1 hour back
      
      const response = await dashboard.smart_api.getCandleData({
        exchange: "NSE",
        symboltoken: token,
        interval: "ONE_MINUTE",
        fromdate: formatDateTime(fromDate),
        todate: formatDateTime(toDate)
      });
      
      const status = response.status ? "✅ SUCCESS" : "❌ FAILED";
      const candleCount = response.data ? response.data.length : 0;
      const hasData = response.status && response.data && response.data.length > 0;
      const price = hasData ? `₹${response.data[response.data.length - 1][4].toFixed(2)}` : "N/A";
      const volume = hasData ? response.data[response.data.length - 1][5] : "N/A";
      const dateRange = `${formatDateTime(fromDate).substring(11)} → ${formatDateTime(toDate).substring(11)}`;
      
      console.log(
        symbol.padEnd(15) +
        String(token).padEnd(10) +
        status.padEnd(15) +
        String(candleCount).padStart(6).padEnd(10) +
        String(price).padEnd(15) +
        String(volume).padStart(10).padEnd(15) +
        dateRange
      );
      
      bankResults.push({
        symbol,
        token,
        success: hasData,
        candles: candleCount,
        message: response.message || (hasData ? 'OK' : 'No data')
      });
      
      if (!response.status && response.message) {
        console.log(`   └─ API Message: ${response.message}`);
      }
      
      // Delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 150));
      
    } catch (error) {
      console.log(
        symbol.padEnd(15) +
        String(token).padEnd(10) +
        "❌ ERROR".padEnd(15) +
        "0".padStart(6).padEnd(10) +
        "N/A".padEnd(15) +
        "N/A".padStart(10).padEnd(15) +
        error.message
      );
      
      bankResults.push({
        symbol,
        token,
        success: false,
        candles: 0,
        message: error.message
      });
    }
  }
  
  console.log("-".repeat(100));
  
  // Summary for banks
  const successfulBanks = bankResults.filter(r => r.success).length;
  const totalBanks = bankResults.length;
  console.log(`\n📊 Banks Summary: ${successfulBanks}/${totalBanks} successful (${((successfulBanks/totalBanks)*100).toFixed(1)}%)`);
  
  // Test all indices with ONE_MINUTE interval
  console.log("\n\n📋 Step 5: Testing ALL INDICES (ONE_MINUTE interval)...");
  console.log("\n" + "-".repeat(100));
  console.log("INDEX".padEnd(15) + "TOKEN".padEnd(10) + "EXCHANGE".padEnd(10) + "STATUS".padEnd(15) + "CANDLES".padEnd(10) + "LTP".padEnd(15) + "DATE RANGE");
  console.log("-".repeat(100));
  
  const indexResults = [];
  
  for (const [symbol, info] of Object.entries(INDICES_INSTRUMENTS)) {
    try {
      const toDate = new Date();
      const fromDate = new Date(toDate.getTime() - 60 * 60 * 1000); // 1 hour back
      
      const response = await dashboard.smart_api.getCandleData({
        exchange: info.exchange,
        symboltoken: info.token,
        interval: "ONE_MINUTE",
        fromdate: formatDateTime(fromDate),
        todate: formatDateTime(toDate)
      });
      
      const status = response.status ? "✅ SUCCESS" : "❌ FAILED";
      const candleCount = response.data ? response.data.length : 0;
      const hasData = response.status && response.data && response.data.length > 0;
      const price = hasData ? `₹${response.data[response.data.length - 1][4].toFixed(2)}` : "N/A";
      const dateRange = `${formatDateTime(fromDate).substring(11)} → ${formatDateTime(toDate).substring(11)}`;
      
      console.log(
        symbol.padEnd(15) +
        String(info.token).padEnd(10) +
        info.exchange.padEnd(10) +
        status.padEnd(15) +
        String(candleCount).padStart(6).padEnd(10) +
        String(price).padEnd(15) +
        dateRange
      );
      
      indexResults.push({
        symbol,
        token: info.token,
        success: hasData,
        candles: candleCount,
        message: response.message || (hasData ? 'OK' : 'No data')
      });
      
      if (!response.status && response.message) {
        console.log(`   └─ API Message: ${response.message}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 150));
      
    } catch (error) {
      console.log(
        symbol.padEnd(15) +
        String(info.token).padEnd(10) +
        info.exchange.padEnd(10) +
        "❌ ERROR".padEnd(15) +
        "0".padStart(6).padEnd(10) +
        "N/A".padEnd(15) +
        error.message
      );
      
      indexResults.push({
        symbol,
        token: info.token,
        success: false,
        candles: 0,
        message: error.message
      });
    }
  }
  
  console.log("-".repeat(100));
  
  // Summary for indices
  const successfulIndices = indexResults.filter(r => r.success).length;
  const totalIndices = indexResults.length;
  console.log(`\n📊 Indices Summary: ${successfulIndices}/${totalIndices} successful (${((successfulIndices/totalIndices)*100).toFixed(1)}%)`);
  
  // Test different time intervals for HDFCBANK
  console.log("\n\n📋 Step 6: Testing HDFCBANK across ALL TIME INTERVALS...");
  const testSymbol = "HDFCBANK";
  const testToken = SYMBOL_TOKEN_MAP[testSymbol];
  const intervals = ["ONE_MINUTE", "THREE_MINUTE", "FIVE_MINUTE", "FIFTEEN_MINUTE", "THIRTY_MINUTE", "ONE_HOUR"];
  
  console.log("\n" + "-".repeat(100));
  console.log("INTERVAL".padEnd(20) + "STATUS".padEnd(15) + "CANDLES".padEnd(10) + "LTP".padEnd(15) + "DATE RANGE");
  console.log("-".repeat(100));
  
  const intervalResults = [];
  
  for (const interval of intervals) {
    try {
      const toDate = new Date();
      let minutesBack;
      
      // Adjust lookback based on interval
      switch(interval) {
        case "ONE_MINUTE": minutesBack = 60; break;
        case "THREE_MINUTE": minutesBack = 90; break;
        case "FIVE_MINUTE": minutesBack = 120; break;
        case "FIFTEEN_MINUTE": minutesBack = 240; break;
        case "THIRTY_MINUTE": minutesBack = 360; break;
        case "ONE_HOUR": minutesBack = 480; break;
        default: minutesBack = 60;
      }
      
      const fromDate = new Date(toDate.getTime() - minutesBack * 60 * 1000);
      
      const response = await dashboard.smart_api.getCandleData({
        exchange: "NSE",
        symboltoken: testToken,
        interval,
        fromdate: formatDateTime(fromDate),
        todate: formatDateTime(toDate)
      });
      
      const status = response.status ? "✅ SUCCESS" : "❌ FAILED";
      const candleCount = response.data ? response.data.length : 0;
      const hasData = response.status && response.data && response.data.length > 0;
      const price = hasData ? `₹${response.data[response.data.length - 1][4].toFixed(2)}` : "N/A";
      const dateRange = `${formatDateTime(fromDate).substring(11)} → ${formatDateTime(toDate).substring(11)}`;
      
      console.log(
        interval.padEnd(20) +
        status.padEnd(15) +
        String(candleCount).padStart(6).padEnd(10) +
        String(price).padEnd(15) +
        dateRange
      );
      
      intervalResults.push({
        interval,
        success: hasData,
        candles: candleCount
      });
      
      if (!response.status && response.message) {
        console.log(`   └─ API Message: ${response.message}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 150));
      
    } catch (error) {
      console.log(
        interval.padEnd(20) +
        "❌ ERROR".padEnd(15) +
        "0".padStart(6).padEnd(10) +
        "N/A".padEnd(15) +
        error.message
      );
      
      intervalResults.push({
        interval,
        success: false,
        candles: 0
      });
    }
  }
  
  console.log("-".repeat(100));
  
  const successfulIntervals = intervalResults.filter(r => r.success).length;
  console.log(`\n📊 Intervals Summary: ${successfulIntervals}/${intervals.length} successful (${((successfulIntervals/intervals.length)*100).toFixed(1)}%)`);
  
  // Final summary and recommendations
  console.log("\n\n" + "=".repeat(100));
  console.log("📊 COMPREHENSIVE DIAGNOSIS SUMMARY");
  console.log("=".repeat(100));
  
  const totalTests = totalBanks + totalIndices + intervals.length;
  const totalSuccess = successfulBanks + successfulIndices + successfulIntervals;
  const overallSuccessRate = ((totalSuccess / totalTests) * 100).toFixed(1);
  
  console.log(`\n📈 Overall Success Rate: ${totalSuccess}/${totalTests} (${overallSuccessRate}%)`);
  console.log(`   🏦 Banks: ${successfulBanks}/${totalBanks} (${((successfulBanks/totalBanks)*100).toFixed(1)}%)`);
  console.log(`   📊 Indices: ${successfulIndices}/${totalIndices} (${((successfulIndices/totalIndices)*100).toFixed(1)}%)`);
  console.log(`   ⏱️  Intervals: ${successfulIntervals}/${intervals.length} (${((successfulIntervals/intervals.length)*100).toFixed(1)}%)`);
  
  console.log("\n" + "=".repeat(100));
  console.log("💡 RECOMMENDATIONS");
  console.log("=".repeat(100));
  
  if (!isMarketOpen) {
    console.log("\n🔴 PRIMARY ISSUE: Market is CLOSED");
    console.log("\n   Solutions:");
    console.log("   1. ⏰ Wait until market opens (Mon-Fri, 9:15 AM - 3:30 PM IST)");
    console.log("   2. 📅 Modify your date range logic to fetch last trading session");
    console.log("   3. 🧪 Test during market hours for real-time data validation");
    console.log("\n   📝 Note: Angel One API has limited historical data outside market hours");
    console.log("          Some brokers only provide intraday data during active sessions");
  } else {
    console.log("\n🟢 Market is OPEN - Analyzing patterns...\n");
    
    if (overallSuccessRate < 30) {
      console.log("❌ CRITICAL: Very low success rate (<30%)");
      console.log("\n   Likely causes:");
      console.log("   1. 🔑 API permissions issue - Your account may not have historical data access");
      console.log("   2. 🚫 Rate limiting - Too many rapid requests");
      console.log("   3. 🔐 Session expired - Try re-authenticating");
      console.log("   4. 🌐 Network issues - Check your internet connection");
      console.log("\n   Immediate actions:");
      console.log("   • Contact Angel One support to verify API data access");
      console.log("   • Check your API subscription plan");
      console.log("   • Increase delays between requests (500ms minimum)");
    } else if (overallSuccessRate < 60) {
      console.log("⚠️  WARNING: Moderate success rate (30-60%)");
      console.log("\n   Likely causes:");
      console.log("   1. ⚡ Rate limiting - Requests too frequent");
      console.log("   2. 📊 Data availability varies by symbol/interval");
      console.log("   3. ⏰ Testing at edge of market hours");
      console.log("\n   Recommended actions:");
      console.log("   • Increase delay between requests to 300-500ms");
      console.log("   • Use fallback intervals (FIVE_MINUTE, FIFTEEN_MINUTE)");
      console.log("   • Implement retry logic with exponential backoff");
    } else {
      console.log("✅ GOOD: Success rate is acceptable (>60%)");
      console.log("\n   Optimization tips:");
      console.log("   • Some symbols naturally have less data (lower liquidity)");
      console.log("   • Consider caching successful requests");
      console.log("   • Use batch requests where possible");
      console.log("   • Monitor rate limits proactively");
    }
  }
  
  // Failed symbols list
  const failedBanks = bankResults.filter(r => !r.success);
  const failedIndices = indexResults.filter(r => !r.success);
  const failedIntervals = intervalResults.filter(r => !r.success);
  
  if (failedBanks.length > 0) {
    console.log("\n\n📋 Failed Banks:");
    failedBanks.forEach(bank => {
      console.log(`   ❌ ${bank.symbol.padEnd(15)} (Token: ${bank.token}) - ${bank.message}`);
    });
  }
  
  if (failedIndices.length > 0) {
    console.log("\n📋 Failed Indices:");
    failedIndices.forEach(index => {
      console.log(`   ❌ ${index.symbol.padEnd(15)} (Token: ${index.token}) - ${index.message}`);
    });
  }
  
  if (failedIntervals.length > 0) {
    console.log("\n📋 Failed Intervals for HDFCBANK:");
    failedIntervals.forEach(interval => {
      console.log(`   ❌ ${interval.interval}`);
    });
  }
  
  console.log("\n" + "=".repeat(100));
  console.log("\n✅ Diagnostic complete! Check the results above for detailed analysis.\n");
}

function formatDateTime(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

diagnose().catch(error => {
  console.error("\n❌ Fatal error:", error);
  console.error(error.stack);
  process.exit(1);
});