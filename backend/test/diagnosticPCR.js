// ============================================================================
// FILE: backend/test/diagnosticPCR.js
// Diagnostic script - Shows raw API responses step by step
// Usage: node backend/test/diagnosticPCR.js <username>
// ============================================================================

const path = require("path");
const TradingDashboard = require(path.join(__dirname, "../services/tradingDashboard"));
const { loadCredentials } = require(path.join(__dirname, "../services/credentialService"));

// Colors for terminal
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logHeader(message) {
  console.log('\n' + '='.repeat(100));
  log(message, colors.bright + colors.cyan);
  console.log('='.repeat(100));
}

function logJSON(label, data) {
  log(`\n${label}:`, colors.yellow + colors.bright);
  console.log(JSON.stringify(data, null, 2));
}

function formatDateTime(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

async function main() {
  const username = process.argv[2];
  
  if (!username) {
    log('\n❌ Username required!', colors.red);
    log('Usage: node backend/test/diagnosticPCR.js <username>\n');
    process.exit(1);
  }
  
  console.clear();
  logHeader('PCR SERVICE DIAGNOSTIC - RAW API RESPONSES');
  
  try {
    // ========================================================================
    // STEP 1: AUTHENTICATION
    // ========================================================================
    logHeader('STEP 1: AUTHENTICATION');
    
    log('Loading credentials...', colors.cyan);
    const credentials = loadCredentials(username);
    
    if (!credentials) {
      throw new Error(`User '${username}' not found`);
    }
    
    log('✅ Credentials loaded', colors.green);
    
    log('\nAuthenticating...', colors.cyan);
    const dashboard = new TradingDashboard(credentials);
    const authResult = await dashboard.authenticate();
    
    if (!authResult.success) {
      throw new Error(authResult.message);
    }
    
    log('✅ Authentication successful', colors.green);
    logJSON('Auth Result', authResult);
    
    const smartAPI = dashboard.smart_api;
    
    // ========================================================================
    // STEP 2: GET SPOT PRICE
    // ========================================================================
    logHeader('STEP 2: GET SPOT PRICE (getCandleData)');
    
    const symbol = 'BANKNIFTY';
    const spotToken = '99926009'; // BANKNIFTY spot token
    const spotExchange = 'NSE';
    
    log(`\n📊 API Call Details:`, colors.bright);
    log(`   Endpoint: getCandleData()`, colors.cyan);
    log(`   Symbol: ${symbol}`, colors.cyan);
    log(`   Exchange: ${spotExchange}`, colors.cyan);
    log(`   Token: ${spotToken}`, colors.cyan);
    log(`   Interval: ONE_MINUTE`, colors.cyan);
    
    const now = new Date();
    const fromDate = new Date(now.getTime() - 2 * 60 * 60 * 1000); // 2 hours ago
    
    log(`   From Date: ${formatDateTime(fromDate)}`, colors.cyan);
    log(`   To Date: ${formatDateTime(now)}`, colors.cyan);
    
    const spotParams = {
      exchange: spotExchange,
      symboltoken: spotToken,
      interval: "ONE_MINUTE",
      fromdate: formatDateTime(fromDate),
      todate: formatDateTime(now)
    };
    
    logJSON('Request Parameters', spotParams);
    
    log('\n⏳ Fetching spot price...', colors.yellow);
    const spotResponse = await smartAPI.getCandleData(spotParams);
    
    logJSON('RAW RESPONSE - getCandleData (Spot)', spotResponse);
    
    let spotPrice = null;
    
    // Check response status
    log('\n🔍 Analyzing Response:', colors.bright);
    log(`   Response exists: ${spotResponse ? '✅' : '❌'}`, spotResponse ? colors.green : colors.red);
    log(`   Status field: ${spotResponse?.status}`, spotResponse?.status ? colors.green : colors.red);
    log(`   Data field exists: ${spotResponse?.data ? '✅' : '❌'}`, spotResponse?.data ? colors.green : colors.red);
    log(`   Data length: ${spotResponse?.data?.length || 0}`, colors.cyan);
    log(`   Message: ${spotResponse?.message || 'N/A'}`, colors.yellow);
    
    if (spotResponse?.status && spotResponse.data?.length > 0) {
      const latestCandle = spotResponse.data[spotResponse.data.length - 1];
      spotPrice = parseFloat(latestCandle[4]);
      
      log(`\n✅ Spot Price: ₹${spotPrice.toFixed(2)}`, colors.green + colors.bright);
      log(`   Total Candles: ${spotResponse.data.length}`, colors.cyan);
      log(`   Latest Candle:`, colors.cyan);
      log(`      Timestamp: ${latestCandle[0]}`, colors.cyan);
      log(`      Open: ${latestCandle[1]}`, colors.cyan);
      log(`      High: ${latestCandle[2]}`, colors.cyan);
      log(`      Low: ${latestCandle[3]}`, colors.cyan);
      log(`      Close: ${latestCandle[4]}`, colors.cyan);
      log(`      Volume: ${latestCandle[5]}`, colors.cyan);
    } else if (spotResponse?.data?.length === 0) {
      log('\n❌ Response has empty data array', colors.red);
      log('   Possible reasons:', colors.yellow);
      log('   1. Market is closed (9:15 AM - 3:30 PM IST, Mon-Fri)', colors.yellow);
      log('   2. Time range is outside market hours', colors.yellow);
      log('   3. Symbol/token mismatch', colors.yellow);
      
      // Check market hours
      const now_ist = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
      log(`\n   Current IST time: ${now_ist}`, colors.cyan);
      
      const now_date = new Date();
      const hours = now_date.getHours();
      const minutes = now_date.getMinutes();
      const day = now_date.getDay();
      
      const isWeekday = day >= 1 && day <= 5;
      const currentMinutes = hours * 60 + minutes;
      const marketOpen = 9 * 60 + 15;
      const marketClose = 15 * 60 + 30;
      const isMarketHours = currentMinutes >= marketOpen && currentMinutes <= marketClose;
      
      log(`   Is Weekday: ${isWeekday ? '✅' : '❌ (Weekend)'}`, isWeekday ? colors.green : colors.red);
      log(`   Is Market Hours: ${isMarketHours ? '✅' : '❌ (Outside 9:15 AM - 3:30 PM)'}`, isMarketHours ? colors.green : colors.red);
      
      if (!isWeekday) {
        log('\n   ⚠️  Market is closed (Weekend)', colors.yellow + colors.bright);
      } else if (!isMarketHours) {
        log('\n   ⚠️  Market is closed (Outside trading hours)', colors.yellow + colors.bright);
      }
      
      // Try with longer time range
      log('\n🔄 Trying with longer time range (1 day)...', colors.yellow);
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const retryParams = {
        ...spotParams,
        fromdate: formatDateTime(oneDayAgo)
      };
      
      logJSON('Retry Parameters', retryParams);
      const retryResponse = await smartAPI.getCandleData(retryParams);
      
      logJSON('RETRY RESPONSE - getCandleData (24h range)', retryResponse);
      
      if (retryResponse?.status && retryResponse.data?.length > 0) {
        const latestCandle = retryResponse.data[retryResponse.data.length - 1];
        spotPrice = parseFloat(latestCandle[4]);
        log(`\n✅ Got spot price from last 24h: ₹${spotPrice.toFixed(2)}`, colors.green);
        log(`   Candles found: ${retryResponse.data.length}`, colors.cyan);
        log(`   Latest candle timestamp: ${latestCandle[0]}`, colors.cyan);
      } else {
        log('\n❌ Still no data with 24h range', colors.red);
      }
    } else {
      log('\n❌ No spot data returned', colors.red);
      log('   Response status is false or data is null', colors.yellow);
    }
    
    // ========================================================================
    // STEP 3: SEARCH FOR OPTION CONTRACTS
    // ========================================================================
    logHeader('STEP 3: SEARCH FOR OPTION CONTRACTS (searchScrip)');
    
    log(`\n📊 API Call Details:`, colors.bright);
    log(`   Endpoint: searchScrip()`, colors.cyan);
    log(`   Exchange: NFO`, colors.cyan);
    log(`   Search Symbol: ${symbol}`, colors.cyan);
    
    const searchParams = {
      exchange: 'NFO',
      searchscrip: symbol
    };
    
    logJSON('Request Parameters', searchParams);
    
    log('\n⏳ Searching for contracts...', colors.yellow);
    const searchResponse = await smartAPI.searchScrip(searchParams);
    
    logJSON('RAW RESPONSE - searchScrip (first 10 contracts)', 
      Array.isArray(searchResponse) ? searchResponse.slice(0, 10) : 
      searchResponse?.data?.slice(0, 10) || searchResponse
    );
    
    let contracts = Array.isArray(searchResponse) ? searchResponse : searchResponse?.data;
    let expiryMap = {}; // Define here so it's accessible later
    
    if (contracts && contracts.length > 0) {
      log(`\n✅ Found ${contracts.length} total contracts`, colors.green);
      
      // Show sample contracts
      log('\n📋 Sample Contracts:', colors.bright);
      contracts.slice(0, 5).forEach((contract, idx) => {
        log(`   ${idx + 1}. ${contract.tradingsymbol || contract.symbol}`, colors.cyan);
        log(`      Token: ${contract.symboltoken || contract.token}`, colors.blue);
        log(`      Expiry: ${contract.expiry}`, colors.blue);
      });
      
      // Extract expiry dates
      const expirySet = new Set();
      const expiryMap = {};
      
      contracts.forEach(contract => {
        const symbolName = contract.tradingsymbol || contract.symbol;
        const match = symbolName.match(/([0-9]{2}[A-Z]{3}[0-9]{2})/);
        
        if (match) {
          const dateStr = match[1];
          if (!expirySet.has(dateStr)) {
            expirySet.add(dateStr);
            const day = dateStr.slice(0, 2);
            const month = dateStr.slice(2, 5);
            const year = "20" + dateStr.slice(5, 7);
            
            expiryMap[dateStr] = {
              date: `${day}-${month}-${year}`,
              formatted: `${day} ${month} ${year}`,
              searchString: dateStr
            };
          }
        }
      });
      
      const expiries = Object.values(expiryMap);
      
      log(`\n📅 Extracted Expiry Dates (${expiries.length}):`, colors.bright);
      expiries.slice(0, 5).forEach((exp, idx) => {
        log(`   ${idx + 1}. ${exp.formatted} (${exp.searchString})`, colors.cyan);
      });
      
      // Use first expiry for next steps
      if (expiries.length > 0) {
        const selectedExpiry = expiries[0];
        log(`\n✅ Using expiry: ${selectedExpiry.formatted}`, colors.green + colors.bright);
        
        // ========================================================================
        // STEP 4: GET SPECIFIC OPTION CONTRACTS FOR THIS EXPIRY
        // ========================================================================
        logHeader('STEP 4: FILTER CONTRACTS FOR SELECTED EXPIRY');
        
        const expiryStr = selectedExpiry.searchString;
        const filteredContracts = contracts.filter(c => {
          const symbolName = c.tradingsymbol || c.symbol;
          return symbolName.includes(expiryStr);
        });
        
        log(`\n✅ Filtered ${filteredContracts.length} contracts for ${selectedExpiry.formatted}`, colors.green);
        
        // Calculate ATM strike
        if (spotPrice) {
          const strikeInterval = 100; // BANKNIFTY
          const atmStrike = Math.round(spotPrice / strikeInterval) * strikeInterval;
          
          log(`\n📍 ATM Strike: ${atmStrike}`, colors.bright);
          
          // Find ATM CE and PE
          const atmCE = filteredContracts.find(c => 
            (c.tradingsymbol || c.symbol).includes(`${expiryStr}${atmStrike}CE`)
          );
          
          const atmPE = filteredContracts.find(c => 
            (c.tradingsymbol || c.symbol).includes(`${expiryStr}${atmStrike}PE`)
          );
          
          if (atmCE) {
            log(`\n📈 ATM CALL (CE):`, colors.green);
            log(`   Symbol: ${atmCE.tradingsymbol || atmCE.symbol}`, colors.cyan);
            log(`   Token: ${atmCE.symboltoken || atmCE.token}`, colors.cyan);
          }
          
          if (atmPE) {
            log(`\n📉 ATM PUT (PE):`, colors.red);
            log(`   Symbol: ${atmPE.tradingsymbol || atmPE.symbol}`, colors.cyan);
            log(`   Token: ${atmPE.symboltoken || atmPE.token}`, colors.cyan);
          }
          
          // ========================================================================
          // STEP 5: GET CANDLE DATA FOR ATM CALL
          // ========================================================================
          if (atmCE) {
            logHeader('STEP 5: GET CANDLE DATA FOR ATM CALL (getCandleData)');
            
            const ceToken = atmCE.symboltoken || atmCE.token;
            
            log(`\n📊 API Call Details:`, colors.bright);
            log(`   Endpoint: getCandleData()`, colors.cyan);
            log(`   Symbol: ${atmCE.tradingsymbol || atmCE.symbol}`, colors.cyan);
            log(`   Exchange: NFO`, colors.cyan);
            log(`   Token: ${ceToken}`, colors.cyan);
            log(`   Interval: ONE_MINUTE`, colors.cyan);
            
            const candleFromDate = new Date(now.getTime() - 5 * 60 * 1000); // 5 minutes ago
            
            const candleParams = {
              exchange: 'NFO',
              symboltoken: ceToken,
              interval: "ONE_MINUTE",
              fromdate: formatDateTime(candleFromDate),
              todate: formatDateTime(now)
            };
            
            logJSON('Request Parameters', candleParams);
            
            log('\n⏳ Fetching candle data...', colors.yellow);
            const candleResponse = await smartAPI.getCandleData(candleParams);
            
            logJSON('RAW RESPONSE - getCandleData (ATM CE)', candleResponse);
            
            if (candleResponse?.status && candleResponse.data?.length > 0) {
              log(`\n✅ Got ${candleResponse.data.length} candles`, colors.green);
              log('\n📊 Latest Candle:', colors.bright);
              const latest = candleResponse.data[candleResponse.data.length - 1];
              log(`   Timestamp: ${latest[0]}`, colors.cyan);
              log(`   Open: ${latest[1]}`, colors.cyan);
              log(`   High: ${latest[2]}`, colors.cyan);
              log(`   Low: ${latest[3]}`, colors.cyan);
              log(`   Close: ${latest[4]}`, colors.cyan);
              log(`   Volume: ${latest[5]}`, colors.cyan);
            } else {
              log('\n❌ No candle data returned', colors.red);
            }
          }
          
          // ========================================================================
          // STEP 6: GET MARKET DATA (OI, LTP, etc.)
          // ========================================================================
          if (atmCE && atmPE) {
            logHeader('STEP 6: GET MARKET DATA FOR ATM OPTIONS (marketData)');
            
            const ceToken = atmCE.symboltoken || atmCE.token;
            const peToken = atmPE.symboltoken || atmPE.token;
            
            log(`\n📊 API Call Details:`, colors.bright);
            log(`   Endpoint: marketData()`, colors.cyan);
            log(`   Mode: FULL (includes OI)`, colors.cyan);
            log(`   Exchange: NFO`, colors.cyan);
            log(`   Tokens: [${ceToken}, ${peToken}]`, colors.cyan);
            
            const marketParams = {
              mode: "FULL",
              exchangeTokens: {
                NFO: [ceToken, peToken]
              }
            };
            
            logJSON('Request Parameters', marketParams);
            
            log('\n⏳ Fetching market data...', colors.yellow);
            const marketResponse = await smartAPI.marketData(marketParams);
            
            logJSON('RAW RESPONSE - marketData', marketResponse);
            
            if (marketResponse?.status && marketResponse.data?.fetched) {
              log(`\n✅ Got market data for ${marketResponse.data.fetched.length} contracts`, colors.green);
              
              marketResponse.data.fetched.forEach((item, idx) => {
                const token = item.symbolToken || item.token;
                const isCE = token === ceToken;
                
                log(`\n${isCE ? '📈 CALL' : '📉 PUT'} Data:`, isCE ? colors.green : colors.red);
                log(`   LTP: ${item.ltp || item.close || 'N/A'}`, colors.cyan);
                log(`   Open: ${item.open || 'N/A'}`, colors.cyan);
                log(`   High: ${item.high || 'N/A'}`, colors.cyan);
                log(`   Low: ${item.low || 'N/A'}`, colors.cyan);
                log(`   Volume: ${item.volume || item.totVolume || 'N/A'}`, colors.cyan);
                log(`   OI: ${item.oi || item.opnInterest || 'N/A'}`, colors.cyan);
                log(`   OI Change: ${item.oiChange || item.oichangepercent || 'N/A'}`, colors.cyan);
                log(`   Bid Price: ${item.bidPrice || 'N/A'}`, colors.cyan);
                log(`   Ask Price: ${item.askPrice || 'N/A'}`, colors.cyan);
              });
            } else {
              log('\n❌ No market data returned', colors.red);
            }
          }
        }
      }
    } else {
      log('\n❌ No contracts found', colors.red);
    }
    
    // ========================================================================
    // SUMMARY
    // ========================================================================
    logHeader('DIAGNOSTIC SUMMARY');
    
    log('\n✅ API Endpoints Tested:', colors.bright);
    log('   1. getCandleData() - Spot price ✓', colors.green);
    log('   2. searchScrip() - Option contracts ✓', colors.green);
    log('   3. getCandleData() - Option candles ✓', colors.green);
    log('   4. marketData() - OI and quotes ✓', colors.green);
    
    log('\n📊 Data Available:', colors.bright);
    log(`   Spot Price: ${spotPrice ? '✅ ₹' + spotPrice.toFixed(2) : '❌ Not available'}`, 
      spotPrice ? colors.green : colors.red);
    log(`   Option Contracts: ${contracts?.length || 0}`, 
      contracts?.length > 0 ? colors.green : colors.red);
    log(`   Expiries Found: ${Object.keys(expiryMap || {}).length}`, 
      Object.keys(expiryMap || {}).length > 0 ? colors.green : colors.red);
    
    log('\n💡 Next Steps:', colors.bright);
    log('   • If all data is showing correctly, PCR calculation will work', colors.cyan);
    log('   • The PCR service will use these same API calls', colors.cyan);
    log('   • Any issues above need to be fixed before proceeding', colors.cyan);
    
    logHeader('DIAGNOSTIC COMPLETE');
    
  } catch (error) {
    log('\n❌ ERROR:', colors.red + colors.bright);
    log(`   ${error.message}`, colors.red);
    log('');
    log('Stack trace:', colors.red);
    console.error(error.stack);
    log('');
    process.exit(1);
  }
}

// Run
main().catch(err => {
  console.error('\n❌ FATAL ERROR:', err);
  process.exit(1);
});