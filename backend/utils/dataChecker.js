// backend/utils/dataChecker.js
const { SYMBOL_TOKEN_MAP, INDICES_INSTRUMENTS, TIME_INTERVALS } = require("../config/constants");

/**
 * Comprehensive data availability checker
 * Tests what data is available for each symbol across all time intervals
 */
async function checkDataAvailability(dashboard) {
  console.log("\n" + "=".repeat(100));
  console.log("📊 DATA AVAILABILITY CHECK - COMPREHENSIVE REPORT");
  console.log("=".repeat(100));
  console.log(`🕐 Timestamp: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
  console.log("=".repeat(100) + "\n");

  const results = {
    banks: {},
    indices: {},
    summary: {
      totalChecks: 0,
      successfulChecks: 0,
      failedChecks: 0
    }
  };

  // Check Bank Nifty stocks
  console.log("🏦 CHECKING BANK NIFTY STOCKS");
  console.log("=".repeat(100));
  
  for (const [symbol, token] of Object.entries(SYMBOL_TOKEN_MAP)) {
    console.log(`\n📈 ${symbol} (Token: ${token})`);
    console.log("-".repeat(100));
    results.banks[symbol] = {};
    
    for (const interval of TIME_INTERVALS) {
      const response = await dashboard.getCandleData("NSE", token, interval);
      results.summary.totalChecks++;
      
      if (response.status && response.data && response.data.length > 0) {
        results.summary.successfulChecks++;
        const candleCount = response.data.length;
        const latestCandle = response.data[response.data.length - 1];
        const ltp = latestCandle[4];
        const volume = latestCandle[5];
        const change = ((latestCandle[4] - latestCandle[1]) / latestCandle[1] * 100).toFixed(2);
        
        results.banks[symbol][interval] = {
          status: "SUCCESS",
          candleCount,
          ltp: ltp.toFixed(2),
          timestamp: latestCandle[0],
          volume
        };
        
        console.log(`   ✅ ${interval.padEnd(20)} | Candles: ${String(candleCount).padStart(4)} | LTP: ₹${String(ltp.toFixed(2)).padStart(10)} | Volume: ${String(volume).padStart(10)} | Change: ${String(change).padStart(6)}%`);
      } else {
        results.summary.failedChecks++;
        results.banks[symbol][interval] = {
          status: "NO_DATA",
          candleCount: 0,
          ltp: null,
          timestamp: null
        };
        
        console.log(`   ❌ ${interval.padEnd(20)} | NO DATA AVAILABLE`);
      }
      
      // Small delay to avoid rate limiting
      await sleep(100);
    }
  }

  // Check Indices
  console.log("\n\n📊 CHECKING INDICES");
  console.log("=".repeat(100));
  
  for (const [symbol, info] of Object.entries(INDICES_INSTRUMENTS)) {
    console.log(`\n📉 ${symbol} (Token: ${info.token})`);
    console.log("-".repeat(100));
    results.indices[symbol] = {};
    
    for (const interval of TIME_INTERVALS) {
      const response = await dashboard.getCandleData(info.exchange, info.token, interval);
      results.summary.totalChecks++;
      
      if (response.status && response.data && response.data.length > 0) {
        results.summary.successfulChecks++;
        const candleCount = response.data.length;
        const latestCandle = response.data[response.data.length - 1];
        const ltp = latestCandle[4];
        const volume = latestCandle[5];
        const change = ((latestCandle[4] - latestCandle[1]) / latestCandle[1] * 100).toFixed(2);
        
        results.indices[symbol][interval] = {
          status: "SUCCESS",
          candleCount,
          ltp: ltp.toFixed(2),
          timestamp: latestCandle[0],
          volume
        };
        
        console.log(`   ✅ ${interval.padEnd(20)} | Candles: ${String(candleCount).padStart(4)} | LTP: ₹${String(ltp.toFixed(2)).padStart(10)} | Volume: ${String(volume).padStart(10)} | Change: ${String(change).padStart(6)}%`);
      } else {
        results.summary.failedChecks++;
        results.indices[symbol][interval] = {
          status: "NO_DATA",
          candleCount: 0,
          ltp: null,
          timestamp: null
        };
        
        console.log(`   ❌ ${interval.padEnd(20)} | NO DATA AVAILABLE`);
      }
      
      await sleep(100);
    }
  }

  // Print Summary
  console.log("\n\n" + "=".repeat(100));
  console.log("📊 OVERALL SUMMARY");
  console.log("=".repeat(100));
  const successRate = (results.summary.successfulChecks / results.summary.totalChecks * 100).toFixed(1);
  const failRate = (results.summary.failedChecks / results.summary.totalChecks * 100).toFixed(1);
  
  console.log(`Total Checks Performed:    ${results.summary.totalChecks}`);
  console.log(`✅ Successful Checks:      ${results.summary.successfulChecks} (${successRate}%)`);
  console.log(`❌ Failed Checks (No Data): ${results.summary.failedChecks} (${failRate}%)`);
  console.log("=".repeat(100));

  // Generate Matrix View
  generateAvailabilityMatrix(results);
  
  // Analyze Best Intervals
  const intervalAnalysis = analyzeBestIntervals(results);

  return { results, intervalAnalysis };
}

/**
 * Check data for a specific symbol and interval with detailed output
 */
async function checkSpecificData(dashboard, exchange, token, symbol, interval) {
  console.log("\n" + "=".repeat(100));
  console.log(`🔍 DETAILED CHECK: ${symbol} - ${interval}`);
  console.log("=".repeat(100));
  
  const response = await dashboard.getCandleData(exchange, token, interval);
  
  if (response.status && response.data && response.data.length > 0) {
    console.log(`✅ Status: DATA AVAILABLE`);
    console.log(`📊 Total Candles: ${response.data.length}`);
    console.log(`\n📈 Latest 10 Candles:`);
    console.log("-".repeat(100));
    console.log("Time".padEnd(20) + " | " + "Open".padStart(10) + " | " + "High".padStart(10) + " | " + "Low".padStart(10) + " | " + "Close".padStart(10) + " | " + "Volume".padStart(12));
    console.log("-".repeat(100));
    
    const latestCandles = response.data.slice(-10);
    latestCandles.reverse().forEach((candle, idx) => {
      const time = candle[0];
      const open = `₹${candle[1].toFixed(2)}`;
      const high = `₹${candle[2].toFixed(2)}`;
      const low = `₹${candle[3].toFixed(2)}`;
      const close = `₹${candle[4].toFixed(2)}`;
      const volume = candle[5];
      
      console.log(`${time.padEnd(20)} | ${open.padStart(10)} | ${high.padStart(10)} | ${low.padStart(10)} | ${close.padStart(10)} | ${String(volume).padStart(12)}`);
    });
    
    console.log("-".repeat(100));
    
    // Calculate statistics
    const prices = response.data.map(c => c[4]);
    const volumes = response.data.map(c => c[5]);
    const maxPrice = Math.max(...prices);
    const minPrice = Math.min(...prices);
    const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
    const totalVolume = volumes.reduce((a, b) => a + b, 0);
    
    console.log("\n📊 Statistics:");
    console.log(`   Highest Price:  ₹${maxPrice.toFixed(2)}`);
    console.log(`   Lowest Price:   ₹${minPrice.toFixed(2)}`);
    console.log(`   Average Price:  ₹${avgPrice.toFixed(2)}`);
    console.log(`   Total Volume:   ${totalVolume}`);
    console.log(`   Price Range:    ₹${(maxPrice - minPrice).toFixed(2)}`);
    
  } else {
    console.log(`❌ Status: NO DATA AVAILABLE`);
    console.log(`\n📋 Response Details:`);
    console.log(JSON.stringify(response, null, 2));
  }
  
  console.log("=".repeat(100) + "\n");
}

/**
 * Generate a data availability matrix report
 */
function generateAvailabilityMatrix(results) {
  console.log("\n" + "=".repeat(120));
  console.log("📊 DATA AVAILABILITY MATRIX");
  console.log("=".repeat(120));
  
  // Header
  const intervals = ["1MIN", "3MIN", "5MIN", "15MIN", "30MIN", "1HR"];
  const header = "SYMBOL".padEnd(18) + " | " + intervals.map(i => i.padEnd(15)).join(" | ");
  console.log(header);
  console.log("=".repeat(120));
  
  // Banks
  console.log("\n🏦 BANK NIFTY STOCKS:");
  console.log("-".repeat(120));
  for (const [symbol, data] of Object.entries(results.banks)) {
    const row = symbol.padEnd(18) + " | " +
      TIME_INTERVALS.map(interval => {
        const info = data[interval];
        const status = info.status === "SUCCESS" ? "✅" : "❌";
        const count = info.candleCount || 0;
        return `${status} ${String(count).padStart(4)} candles`.padEnd(15);
      }).join(" | ");
    console.log(row);
  }
  
  // Indices
  console.log("\n\n📊 INDICES:");
  console.log("-".repeat(120));
  for (const [symbol, data] of Object.entries(results.indices)) {
    const row = symbol.padEnd(18) + " | " +
      TIME_INTERVALS.map(interval => {
        const info = data[interval];
        const status = info.status === "SUCCESS" ? "✅" : "❌";
        const count = info.candleCount || 0;
        return `${status} ${String(count).padStart(4)} candles`.padEnd(15);
      }).join(" | ");
    console.log(row);
  }
  
  console.log("=".repeat(120));
}

/**
 * Check which intervals have the most complete data
 */
function analyzeBestIntervals(results) {
  console.log("\n" + "=".repeat(100));
  console.log("📈 INTERVAL RELIABILITY ANALYSIS");
  console.log("=".repeat(100));
  
  const intervalStats = {};
  
  TIME_INTERVALS.forEach(interval => {
    intervalStats[interval] = {
      total: 0,
      success: 0,
      failed: 0,
      totalCandles: 0,
      avgCandles: 0
    };
  });
  
  // Analyze banks
  for (const bankData of Object.values(results.banks)) {
    for (const interval of TIME_INTERVALS) {
      intervalStats[interval].total++;
      if (bankData[interval].status === "SUCCESS") {
        intervalStats[interval].success++;
        intervalStats[interval].totalCandles += bankData[interval].candleCount;
      } else {
        intervalStats[interval].failed++;
      }
    }
  }
  
  // Analyze indices
  for (const indexData of Object.values(results.indices)) {
    for (const interval of TIME_INTERVALS) {
      intervalStats[interval].total++;
      if (indexData[interval].status === "SUCCESS") {
        intervalStats[interval].success++;
        intervalStats[interval].totalCandles += indexData[interval].candleCount;
      } else {
        intervalStats[interval].failed++;
      }
    }
  }
  
  // Calculate averages
  for (const interval of TIME_INTERVALS) {
    if (intervalStats[interval].success > 0) {
      intervalStats[interval].avgCandles = Math.round(
        intervalStats[interval].totalCandles / intervalStats[interval].success
      );
    }
  }
  
  // Sort by success rate
  const sortedIntervals = Object.entries(intervalStats)
    .map(([interval, stats]) => ({
      interval,
      ...stats,
      successRate: (stats.success / stats.total * 100).toFixed(1)
    }))
    .sort((a, b) => b.successRate - a.successRate);
  
  console.log("\nInterval".padEnd(20) + " | " + "Total".padStart(7) + " | " + "Success".padStart(7) + " | " + "Failed".padStart(7) + " | " + "Success%".padStart(10) + " | " + "Avg Candles".padStart(12));
  console.log("-".repeat(100));
  
  sortedIntervals.forEach(stat => {
    console.log(
      `${stat.interval.padEnd(20)} | ${String(stat.total).padStart(7)} | ${String(stat.success).padStart(7)} | ${String(stat.failed).padStart(7)} | ${String(stat.successRate).padStart(10)}% | ${String(stat.avgCandles).padStart(12)}`
    );
  });
  
  console.log("=".repeat(100));
  
  // Print recommendations
  console.log("\n💡 RECOMMENDATIONS:");
  console.log("-".repeat(100));
  
  const bestInterval = sortedIntervals[0];
  const worstInterval = sortedIntervals[sortedIntervals.length - 1];
  
  console.log(`✅ Best Interval: ${bestInterval.interval} (${bestInterval.successRate}% success rate, avg ${bestInterval.avgCandles} candles)`);
  console.log(`⚠️  Worst Interval: ${worstInterval.interval} (${worstInterval.successRate}% success rate, avg ${worstInterval.avgCandles} candles)`);
  
  if (parseFloat(worstInterval.successRate) < 50) {
    console.log(`\n🔧 Suggestion: Consider using ${bestInterval.interval} as fallback for intervals with low success rates.`);
  }
  
  console.log("=".repeat(100) + "\n");
  
  return sortedIntervals;
}

/**
 * Quick check of a single symbol across all intervals
 */
async function quickCheck(dashboard, symbol = "HDFCBANK") {
  const token = SYMBOL_TOKEN_MAP[symbol];
  
  console.log("\n" + "=".repeat(100));
  console.log(`⚡ QUICK DATA CHECK: ${symbol}`);
  console.log("=".repeat(100));
  console.log(`🕐 Timestamp: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
  console.log("=".repeat(100) + "\n");
  
  console.log("Interval".padEnd(20) + " | " + "Status".padEnd(15) + " | " + "Candles".padStart(8) + " | " + "Latest Price".padStart(15) + " | " + "Volume".padStart(12));
  console.log("-".repeat(100));
  
  for (const interval of TIME_INTERVALS) {
    const response = await dashboard.getCandleData("NSE", token, interval);
    
    if (response.status && response.data && response.data.length > 0) {
      const latestCandle = response.data[response.data.length - 1];
      const price = `₹${latestCandle[4].toFixed(2)}`;
      const volume = latestCandle[5];
      
      console.log(
        `${interval.padEnd(20)} | ${"✅ SUCCESS".padEnd(15)} | ${String(response.data.length).padStart(8)} | ${price.padStart(15)} | ${String(volume).padStart(12)}`
      );
    } else {
      console.log(
        `${interval.padEnd(20)} | ${"❌ NO DATA".padEnd(15)} | ${String(0).padStart(8)} | ${"-".padStart(15)} | ${"-".padStart(12)}`
      );
    }
    
    await sleep(100);
  }
  
  console.log("=".repeat(100) + "\n");
}

// Helper function
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  checkDataAvailability,
  checkSpecificData,
  generateAvailabilityMatrix,
  analyzeBestIntervals,
  quickCheck
};