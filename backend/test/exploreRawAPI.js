// ============================================================================
// FILE: backend/test/exploreRawAPI.js
// SAVE AS: backend/test/exploreRawAPI.js
// RUN: node backend/test/exploreRawAPI.js <username>
// ============================================================================
// This script explores the raw Angel One API responses for option chain data

const TradingDashboard = require("../services/tradingDashboard");
const { loadCredentials } = require("../services/credentialService");
const { OPTION_SYMBOLS } = require("../config/constants");

// Colors for console output
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

function logSuccess(message) {
    log(`✅ ${message}`, colors.green);
}

function logError(message) {
    log(`❌ ${message}`, colors.red);
}

function logInfo(message) {
    log(`ℹ️  ${message}`, colors.blue);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// RAW API EXPLORATION FUNCTIONS
// ============================================================================

/**
 * Test 1: Get LTP Data (Quote API)
 */
async function testGetLTP(smartAPI, symbol) {
    logHeader(`TEST 1: getLtpData() for ${symbol}`);
    
    const config = OPTION_SYMBOLS[symbol];
    
    try {
        logInfo(`Calling smartAPI.getLtpData()`);
        logInfo(`Parameters: exchange="${config.spotExchange}", tradingsymbol="${symbol}", symboltoken="${config.token}"`);
        
        const response = await smartAPI.getLtpData({
            exchange: config.spotExchange,
            tradingsymbol: symbol,
            symboltoken: config.token
        });
        
        logSuccess('Response received!');
        console.log('\n📦 RAW RESPONSE:');
        console.log(JSON.stringify(response, null, 2));
        
        return response;
    } catch (error) {
        logError(`Error: ${error.message}`);
        console.error(error);
        return null;
    }
}

/**
 * Test 2: Search Scrip (Find option contracts)
 */
async function testSearchScrip(smartAPI, symbol, searchString) {
    logHeader(`TEST 2: searchScrip() for ${symbol}`);
    
    const config = OPTION_SYMBOLS[symbol];
    
    try {
        logInfo(`Calling smartAPI.searchScrip()`);
        logInfo(`Parameters: exchange="${config.exchange}", searchscrip="${searchString}"`);
        
        const response = await smartAPI.searchScrip({
            exchange: config.exchange,
            searchscrip: searchString
        });
        
        logSuccess('Response received!');
        console.log('\n📦 RAW RESPONSE:');
        console.log(JSON.stringify(response, null, 2));
        
        if (response && response.data && response.data.length > 0) {
            logSuccess(`Found ${response.data.length} contracts`);
            
            console.log('\n📊 FIRST 5 CONTRACTS:');
            response.data.slice(0, 5).forEach((contract, idx) => {
                console.log(`\n${idx + 1}. ${contract.tradingsymbol || contract.symbol}`);
                console.log(`   Token: ${contract.symboltoken || contract.token}`);
                console.log(`   Exchange: ${contract.exch_seg || contract.exchange}`);
                console.log(`   Expiry: ${contract.expiry || 'N/A'}`);
                console.log(`   Strike: ${contract.strike || 'N/A'}`);
                console.log(`   Option Type: ${contract.instrumenttype || 'N/A'}`);
            });
        }
        
        return response;
    } catch (error) {
        logError(`Error: ${error.message}`);
        console.error(error);
        return null;
    }
}

/**
 * Test 3: Get Quote (Detailed market data)
 */
async function testGetQuote(smartAPI, symbol, token) {
    logHeader(`TEST 3: getMarketData() / getQuote()`);
    
    const config = OPTION_SYMBOLS[symbol];
    
    try {
        logInfo(`Calling smartAPI.getMarketData()`);
        logInfo(`Parameters: mode="FULL", exchangeTokens={"${config.spotExchange}": ["${token}"]}`);
        
        const response = await smartAPI.getMarketData({
            mode: "FULL",
            exchangeTokens: {
                [config.spotExchange]: [token]
            }
        });
        
        logSuccess('Response received!');
        console.log('\n📦 RAW RESPONSE:');
        console.log(JSON.stringify(response, null, 2));
        
        return response;
    } catch (error) {
        logError(`Error: ${error.message}`);
        console.error(error);
        return null;
    }
}

/**
 * Test 4: Get Candle Data (Historical OHLC)
 */
async function testGetCandleData(smartAPI, symbol) {
    logHeader(`TEST 4: getCandleData() for ${symbol}`);
    
    const config = OPTION_SYMBOLS[symbol];
    
    try {
        const now = new Date();
        const fromDate = new Date(now.getTime() - 2 * 60 * 60 * 1000); // 2 hours ago
        
        const fromDateStr = formatDateTime(fromDate);
        const toDateStr = formatDateTime(now);
        
        logInfo(`Calling smartAPI.getCandleData()`);
        logInfo(`Parameters:`);
        console.log(`   exchange: "${config.spotExchange}"`);
        console.log(`   symboltoken: "${config.token}"`);
        console.log(`   interval: "ONE_MINUTE"`);
        console.log(`   fromdate: "${fromDateStr}"`);
        console.log(`   todate: "${toDateStr}"`);
        
        const response = await smartAPI.getCandleData({
            exchange: config.spotExchange,
            symboltoken: config.token,
            interval: "ONE_MINUTE",
            fromdate: fromDateStr,
            todate: toDateStr
        });
        
        logSuccess('Response received!');
        console.log('\n📦 RAW RESPONSE:');
        console.log(JSON.stringify(response, null, 2));
        
        if (response && response.data && response.data.length > 0) {
            logSuccess(`Received ${response.data.length} candles`);
            
            console.log('\n📊 FIRST 3 CANDLES:');
            response.data.slice(0, 3).forEach((candle, idx) => {
                console.log(`\n${idx + 1}. Candle:`);
                console.log(`   [0] Timestamp: ${candle[0]}`);
                console.log(`   [1] Open:      ${candle[1]}`);
                console.log(`   [2] High:      ${candle[2]}`);
                console.log(`   [3] Low:       ${candle[3]}`);
                console.log(`   [4] Close:     ${candle[4]}`);
                console.log(`   [5] Volume:    ${candle[5]}`);
            });
            
            console.log('\n📊 LAST CANDLE (Most Recent):');
            const lastCandle = response.data[response.data.length - 1];
            console.log(`   Timestamp: ${lastCandle[0]}`);
            console.log(`   Open:      ₹${lastCandle[1]}`);
            console.log(`   High:      ₹${lastCandle[2]}`);
            console.log(`   Low:       ₹${lastCandle[3]}`);
            console.log(`   Close:     ₹${lastCandle[4]} (LTP)`);
            console.log(`   Volume:    ${lastCandle[5]}`);
        }
        
        return response;
    } catch (error) {
        logError(`Error: ${error.message}`);
        console.error(error);
        return null;
    }
}

/**
 * Test 5: Option Chain Specific Search
 */
async function testOptionChainSearch(smartAPI, symbol, expiryDate) {
    logHeader(`TEST 5: Option Chain Search for ${symbol} - ${expiryDate}`);
    
    const config = OPTION_SYMBOLS[symbol];
    
    // Format expiry for search
    const parts = expiryDate.split('-');
    if (parts.length !== 3) {
        logError('Invalid expiry date format. Use DD-MMM-YYYY (e.g., 26-DEC-2025)');
        return null;
    }
    
    const [day, month, year] = parts;
    const shortYear = year.slice(-2);
    const searchString = `${symbol}${day}${month}${shortYear}`;
    
    try {
        logInfo(`Formatted search string: "${searchString}"`);
        logInfo(`This will find all options for ${symbol} expiring on ${expiryDate}`);
        logInfo(`Calling smartAPI.searchScrip()`);
        
        const response = await smartAPI.searchScrip({
            exchange: config.exchange,
            searchscrip: searchString
        });
        
        logSuccess('Response received!');
        console.log('\n📦 RAW RESPONSE (showing status and count):');
        console.log(`   status: ${response?.status}`);
        console.log(`   message: ${response?.message}`);
        console.log(`   data length: ${response?.data?.length || 0}`);
        
        if (response && response.data && response.data.length > 0) {
            logSuccess(`Found ${response.data.length} option contracts`);
            
            // Separate calls and puts
            const calls = response.data.filter(c => 
                c.instrumenttype === 'OPTIDX' && 
                (c.tradingsymbol || '').includes('CE')
            );
            const puts = response.data.filter(c => 
                c.instrumenttype === 'OPTIDX' && 
                (c.tradingsymbol || '').includes('PE')
            );
            
            logInfo(`Calls: ${calls.length}, Puts: ${puts.length}`);
            
            // Show sample contracts
            console.log('\n📊 SAMPLE CALL OPTIONS (First 3):');
            calls.slice(0, 3).forEach((contract, idx) => {
                console.log(`\n${idx + 1}. ${contract.tradingsymbol}`);
                console.log(JSON.stringify(contract, null, 2));
            });
            
            console.log('\n📊 SAMPLE PUT OPTIONS (First 3):');
            puts.slice(0, 3).forEach((contract, idx) => {
                console.log(`\n${idx + 1}. ${contract.tradingsymbol}`);
                console.log(JSON.stringify(contract, null, 2));
            });
            
            // Save full response to file
            const fs = require('fs');
            const filename = `option_chain_${symbol}_${expiryDate.replace(/\-/g, '')}_${Date.now()}.json`;
            fs.writeFileSync(filename, JSON.stringify(response, null, 2));
            logSuccess(`Full response saved to: ${filename}`);
        } else {
            logError('No contracts found. Possible reasons:');
            console.log('   - Market is closed (limited data availability)');
            console.log('   - Expiry date is too far in future');
            console.log('   - Expiry date has passed');
            console.log('   - Incorrect date format');
        }
        
        return response;
    } catch (error) {
        logError(`Error: ${error.message}`);
        console.error(error);
        return null;
    }
}

/**
 * Test 6: Try getting option quote
 */
async function testOptionQuote(smartAPI, optionContract) {
    logHeader(`TEST 6: Get Option Quote for ${optionContract.tradingsymbol}`);
    
    try {
        logInfo('Trying Method 1: getLtpData()');
        const ltpResponse = await smartAPI.getLtpData({
            exchange: optionContract.exch_seg || optionContract.exchange,
            tradingsymbol: optionContract.tradingsymbol || optionContract.symbol,
            symboltoken: optionContract.symboltoken || optionContract.token
        });
        
        console.log('\n📦 LTP DATA:');
        console.log(JSON.stringify(ltpResponse, null, 2));
        
        await sleep(500);
        
        logInfo('Trying Method 2: getMarketData()');
        const marketResponse = await smartAPI.getMarketData({
            mode: "FULL",
            exchangeTokens: {
                [optionContract.exch_seg || optionContract.exchange]: [
                    optionContract.symboltoken || optionContract.token
                ]
            }
        });
        
        console.log('\n📦 MARKET DATA:');
        console.log(JSON.stringify(marketResponse, null, 2));
        
        await sleep(500);
        
        logInfo('Trying Method 3: getCandleData()');
        const now = new Date();
        const fromDate = new Date(now.getTime() - 2 * 60 * 60 * 1000);
        
        const candleResponse = await smartAPI.getCandleData({
            exchange: optionContract.exch_seg || optionContract.exchange,
            symboltoken: optionContract.symboltoken || optionContract.token,
            interval: "ONE_MINUTE",
            fromdate: formatDateTime(fromDate),
            todate: formatDateTime(now)
        });
        
        console.log('\n📦 CANDLE DATA:');
        console.log(JSON.stringify(candleResponse, null, 2));
        
        return { ltpResponse, marketResponse, candleResponse };
        
    } catch (error) {
        logError(`Error: ${error.message}`);
        console.error(error);
        return null;
    }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatDateTime(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function getCurrentExpiry() {
    const today = new Date();
    let nextThursday = new Date(today);
    const currentDay = today.getDay();
    
    if (currentDay === 4) {
        const currentHour = today.getHours();
        if (currentHour >= 15 && today.getMinutes() >= 30) {
            nextThursday.setDate(today.getDate() + 7);
        }
    } else if (currentDay < 4) {
        nextThursday.setDate(today.getDate() + (4 - currentDay));
    } else {
        nextThursday.setDate(today.getDate() + (11 - currentDay));
    }
    
    const day = String(nextThursday.getDate()).padStart(2, '0');
    const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 
                        'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const month = monthNames[nextThursday.getMonth()];
    const year = nextThursday.getFullYear();
    
    return `${day}-${month}-${year}`;
}

// ============================================================================
// MAIN RUNNER
// ============================================================================

async function main() {
    console.clear();
    
    log('╔═══════════════════════════════════════════════════════════╗', colors.cyan + colors.bright);
    log('║          ANGEL ONE RAW API RESPONSE EXPLORER             ║', colors.cyan + colors.bright);
    log('╚═══════════════════════════════════════════════════════════╝', colors.cyan + colors.bright);
    
    const username = process.argv[2];
    
    if (!username) {
        logError('Username is required!');
        console.log('\n📖 Usage: node backend/test/exploreRawAPI.js <username>\n');
        console.log('📝 Example: node backend/test/exploreRawAPI.js myusername\n');
        process.exit(1);
    }
    
    logInfo(`Loading credentials for: ${username}`);
    const credentials = loadCredentials(username);
    
    if (!credentials) {
        logError(`User '${username}' not found`);
        process.exit(1);
    }
    
    logSuccess('Credentials loaded');
    logInfo('Authenticating...');
    
    const dashboard = new TradingDashboard(credentials);
    const authResult = await dashboard.authenticate();
    
    if (!authResult.success) {
        logError(`Authentication failed: ${authResult.message}`);
        process.exit(1);
    }
    
    logSuccess(`Authenticated as: ${authResult.data.name}`);
    
    const smartAPI = dashboard.smart_api;
    const symbol = 'BANKNIFTY'; // Change to NIFTY or FINNIFTY if needed
    
    // Get current/next expiry
    const expiryDate = getCurrentExpiry();
    logInfo(`Using expiry date: ${expiryDate}`);
    
    await sleep(1000);
    
    // Run all tests
    await testGetLTP(smartAPI, symbol);
    await sleep(1000);
    
    await testGetCandleData(smartAPI, symbol);
    await sleep(1000);
    
    const token = OPTION_SYMBOLS[symbol].token;
    await testGetQuote(smartAPI, symbol, token);
    await sleep(1000);
    
    const searchResult = await testOptionChainSearch(smartAPI, symbol, expiryDate);
    await sleep(1000);
    
    // If we found contracts, test getting quote for one
    if (searchResult && searchResult.data && searchResult.data.length > 0) {
        const firstContract = searchResult.data[0];
        logInfo(`Testing quote for first contract: ${firstContract.tradingsymbol}`);
        await testOptionQuote(smartAPI, firstContract);
    }
    
    logHeader('EXPLORATION COMPLETE');
    
    console.log('\n📝 SUMMARY:');
    console.log('   ✅ All API methods have been tested');
    console.log('   📦 Raw responses are displayed above');
    console.log('   💾 Full option chain saved to JSON file (if found)');
    console.log('\n💡 TIP: Scroll up to see all the raw API responses!');
    console.log('💡 TIP: Check the JSON file for complete option chain data\n');
}

main().catch(error => {
    console.error('\n❌ Fatal error:', error);
    console.error(error.stack);
    process.exit(1);
});