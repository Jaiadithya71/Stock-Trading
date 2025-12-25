// ============================================================================
// FILE: backend/test/optionChainTest.js
// SAVE AS: backend/test/optionChainTest.js
// RUN: node backend/test/optionChainTest.js <username>
// ============================================================================

const TradingDashboard = require("../services/tradingDashboard");
const { loadCredentials } = require("../services/credentialService");
const OptionService = require("../services/optionService");

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

function logWarning(message) {
    log(`⚠️  ${message}`, colors.yellow);
}

function logInfo(message) {
    log(`ℹ️  ${message}`, colors.blue);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// TEST FUNCTIONS
// ============================================================================

async function testAuthentication(username) {
    logHeader('TEST 1: Authentication');
    
    logInfo('Loading credentials...');
    const credentials = loadCredentials(username);
    
    if (!credentials) {
        logError(`User '${username}' not found`);
        logInfo('Please save credentials first using the dashboard');
        return null;
    }
    
    logSuccess('Credentials loaded');
    
    const dashboard = new TradingDashboard(credentials);
    const authResult = await dashboard.authenticate();
    
    if (!authResult.success) {
        logError(`Authentication failed: ${authResult.message}`);
        return null;
    }
    
    logSuccess(`Authenticated as: ${authResult.data.name}`);
    logInfo(`Client ID: ${authResult.data.clientId}`);
    
    return dashboard;
}

async function testSpotPrices(optionService) {
    logHeader('TEST 2: Spot Price Fetching');
    
    const symbols = ['NIFTY', 'BANKNIFTY', 'FINNIFTY'];
    const results = {};
    
    for (const symbol of symbols) {
        try {
            logInfo(`Fetching spot price for ${symbol}...`);
            const spotPrice = await optionService.getSpotPrice(symbol);
            
            logSuccess(`${symbol}: ₹${spotPrice.toFixed(2)}`);
            results[symbol] = spotPrice;
            
            await sleep(500);
        } catch (error) {
            logError(`${symbol}: ${error.message}`);
            results[symbol] = null;
        }
    }
    
    return results;
}

async function testExpiryDates(optionService) {
    logHeader('TEST 3: Expiry Dates Fetching');
    
    const symbols = ['NIFTY', 'BANKNIFTY', 'FINNIFTY'];
    const results = {};
    
    for (const symbol of symbols) {
        try {
            logInfo(`Fetching expiry dates for ${symbol}...`);
            const expiries = await optionService.getExpiryDates(symbol);
            
            logSuccess(`${symbol}: Found ${expiries.length} expiry dates`);
            
            console.log('\n' + '-'.repeat(80));
            console.log('Date'.padEnd(20) + 'Formatted'.padEnd(30) + 'Type');
            console.log('-'.repeat(80));
            
            expiries.forEach(exp => {
                const typeColor = exp.type === 'current' ? colors.green :
                                exp.type === 'monthly' ? colors.magenta : colors.reset;
                log(
                    exp.date.padEnd(20) + 
                    exp.formatted.padEnd(30) + 
                    exp.type.toUpperCase(),
                    typeColor
                );
            });
            console.log('-'.repeat(80) + '\n');
            
            results[symbol] = expiries;
            
            await sleep(500);
        } catch (error) {
            logError(`${symbol}: ${error.message}`);
            results[symbol] = null;
        }
    }
    
    return results;
}

async function testOptionChain(optionService, symbol, expiryDate, spotPrice) {
    logHeader(`TEST 4: Option Chain for ${symbol} - ${expiryDate}`);
    
    try {
        logInfo('Fetching option chain...');
        const optionChain = await optionService.getOptionChain(symbol, expiryDate);
        
        logSuccess(`Fetched ${optionChain.optionChain.length} strikes`);
        
        if (optionChain.isMockData) {
            logWarning('⚠️  Using MOCK DATA (Market is likely closed)');
            logInfo('This is demonstration data. Run during market hours for real data.');
        } else {
            logSuccess('✅ Using REAL MARKET DATA');
        }
        
        // Display summary
        console.log('\n' + '-'.repeat(100));
        log('📊 OPTION CHAIN SUMMARY', colors.bright + colors.cyan);
        console.log('-'.repeat(100));
        
        console.log(`Symbol:          ${optionChain.displayName}`);
        console.log(`Expiry:          ${optionChain.expiryDate}`);
        console.log(`Spot Price:      ₹${optionChain.spotPrice.toFixed(2)}`);
        console.log(`Lot Size:        ${optionChain.lotSize}`);
        console.log(`Total Strikes:   ${optionChain.optionChain.length}`);
        console.log(`Timestamp:       ${new Date(optionChain.timestamp).toLocaleString()}`);
        
        // Calculate statistics
        const stats = calculateStatistics(optionChain.optionChain);
        
        console.log('\n' + '-'.repeat(100));
        log('📈 MARKET STATISTICS', colors.bright + colors.magenta);
        console.log('-'.repeat(100));
        
        console.log(`Total Call OI:         ${formatNumber(stats.totalCallOI)}`);
        console.log(`Total Put OI:          ${formatNumber(stats.totalPutOI)}`);
        console.log(`Put-Call Ratio (PCR):  ${stats.pcr} ${getPCRIndicator(stats.pcr)}`);
        console.log(`Max Call OI Strike:    ${stats.maxCallOIStrike}`);
        console.log(`Max Put OI Strike:     ${stats.maxPutOIStrike}`);
        console.log(`Call Volume:           ${formatNumber(stats.totalCallVolume)}`);
        console.log(`Put Volume:            ${formatNumber(stats.totalPutVolume)}`);
        
        // Display detailed option chain table
        displayOptionChainTable(optionChain.optionChain, optionChain.spotPrice);
        
        // Display Greeks and Key Levels
        displayKeyLevels(optionChain.optionChain, optionChain.spotPrice, stats);
        
        return optionChain;
        
    } catch (error) {
        logError(`Failed to fetch option chain: ${error.message}`);
        console.error(error.stack);
        return null;
    }
}

function calculateStatistics(optionChain) {
    let totalCallOI = 0;
    let totalPutOI = 0;
    let totalCallVolume = 0;
    let totalPutVolume = 0;
    let maxCallOI = 0;
    let maxPutOI = 0;
    let maxCallOIStrike = 0;
    let maxPutOIStrike = 0;

    optionChain.forEach(row => {
        const callOI = row.call.oi || 0;
        const putOI = row.put.oi || 0;
        const callVol = row.call.volume || 0;
        const putVol = row.put.volume || 0;

        totalCallOI += callOI;
        totalPutOI += putOI;
        totalCallVolume += callVol;
        totalPutVolume += putVol;

        if (callOI > maxCallOI) {
            maxCallOI = callOI;
            maxCallOIStrike = row.strike;
        }

        if (putOI > maxPutOI) {
            maxPutOI = putOI;
            maxPutOIStrike = row.strike;
        }
    });

    const pcr = totalCallOI > 0 ? (totalPutOI / totalCallOI).toFixed(2) : '0.00';

    return {
        totalCallOI,
        totalPutOI,
        totalCallVolume,
        totalPutVolume,
        pcr,
        maxCallOIStrike,
        maxPutOIStrike
    };
}

function displayOptionChainTable(optionChain, spotPrice) {
    console.log('\n' + '='.repeat(140));
    log('📊 DETAILED OPTION CHAIN', colors.bright + colors.cyan);
    console.log('='.repeat(140));
    
    // Show strikes around ATM (±10 strikes)
    const atmIndex = optionChain.findIndex(row => row.isATM);
    const startIndex = Math.max(0, atmIndex - 10);
    const endIndex = Math.min(optionChain.length, atmIndex + 11);
    const visibleChain = optionChain.slice(startIndex, endIndex);
    
    // Header
    console.log(
        'CALLS'.padStart(65) + ' '.repeat(3) + 'STRIKE'.padStart(10) + ' '.repeat(3) + 'PUTS'.padStart(65)
    );
    console.log(
        'OI'.padStart(12) + 
        'Chng OI'.padStart(12) + 
        'Volume'.padStart(12) + 
        'IV'.padStart(10) + 
        'LTP'.padStart(12) + 
        'Chng%'.padStart(10) + 
        ' '.repeat(3) +
        'STRIKE'.padStart(10) + 
        ' '.repeat(3) +
        'Chng%'.padStart(10) + 
        'LTP'.padStart(12) + 
        'IV'.padStart(10) + 
        'Volume'.padStart(12) + 
        'Chng OI'.padStart(12) + 
        'OI'.padStart(12)
    );
    console.log('-'.repeat(140));
    
    visibleChain.forEach(row => {
        const { strike, isATM, call, put } = row;
        
        const callOI = formatNumber(call.oi).padStart(12);
        const callChngOI = formatChange(call.changeInOI).padStart(12);
        const callVol = formatNumber(call.volume).padStart(12);
        const callIV = (call.iv > 0 ? call.iv.toFixed(1) + '%' : '-').padStart(10);
        const callLTP = (call.ltp > 0 ? '₹' + call.ltp.toFixed(2) : '-').padStart(12);
        const callChng = (call.changePercent !== 0 ? call.changePercent.toFixed(2) + '%' : '-').padStart(10);
        
        const strikeStr = strike.toString().padStart(10);
        
        const putChng = (put.changePercent !== 0 ? put.changePercent.toFixed(2) + '%' : '-').padStart(10);
        const putLTP = (put.ltp > 0 ? '₹' + put.ltp.toFixed(2) : '-').padStart(12);
        const putIV = (put.iv > 0 ? put.iv.toFixed(1) + '%' : '-').padStart(10);
        const putVol = formatNumber(put.volume).padStart(12);
        const putChngOI = formatChange(put.changeInOI).padStart(12);
        const putOI = formatNumber(put.oi).padStart(12);
        
        const line = `${callOI}${callChngOI}${callVol}${callIV}${callLTP}${callChng}   ${strikeStr}   ${putChng}${putLTP}${putIV}${putVol}${putChngOI}${putOI}`;
        
        if (isATM) {
            log(line + ' ⭐ ATM', colors.yellow + colors.bright);
        } else {
            console.log(line);
        }
    });
    
    console.log('-'.repeat(140));
    logInfo(`Showing ${visibleChain.length} of ${optionChain.length} strikes (centered around ATM)`);
}

function displayKeyLevels(optionChain, spotPrice, stats) {
    console.log('\n' + '='.repeat(100));
    log('🎯 KEY LEVELS & ANALYSIS', colors.bright + colors.magenta);
    console.log('='.repeat(100));
    
    // Find support and resistance based on OI
    const sortedByCallOI = [...optionChain].sort((a, b) => b.call.oi - a.call.oi);
    const sortedByPutOI = [...optionChain].sort((a, b) => b.put.oi - a.put.oi);
    
    console.log('\n📊 Major Resistance Levels (High Call OI):');
    sortedByCallOI.slice(0, 3).forEach((row, i) => {
        console.log(`   ${i + 1}. Strike ${row.strike}: ${formatNumber(row.call.oi)} OI`);
    });
    
    console.log('\n📊 Major Support Levels (High Put OI):');
    sortedByPutOI.slice(0, 3).forEach((row, i) => {
        console.log(`   ${i + 1}. Strike ${row.strike}: ${formatNumber(row.put.oi)} OI`);
    });
    
    // Market sentiment based on PCR
    console.log('\n📈 Market Sentiment:');
    const pcr = parseFloat(stats.pcr);
    if (pcr > 1.2) {
        log('   ✅ BULLISH (High PCR - More Put buying)', colors.green);
    } else if (pcr < 0.8) {
        log('   ❌ BEARISH (Low PCR - More Call buying)', colors.red);
    } else {
        log('   ➖ NEUTRAL (Balanced PCR)', colors.yellow);
    }
    
    console.log(`   PCR Ratio: ${stats.pcr}`);
    console.log(`   Interpretation: ${getPCRInterpretation(pcr)}`);
}

function formatNumber(num) {
    if (!num || num === 0) return '-';
    if (num >= 10000000) return (num / 10000000).toFixed(2) + 'Cr';
    if (num >= 100000) return (num / 100000).toFixed(2) + 'L';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}

function formatChange(num) {
    if (!num || num === 0) return '-';
    const formatted = formatNumber(Math.abs(num));
    return num > 0 ? '+' + formatted : '-' + formatted;
}

function getPCRIndicator(pcr) {
    const pcrNum = parseFloat(pcr);
    if (pcrNum > 1.2) return '🟢 Bullish';
    if (pcrNum < 0.8) return '🔴 Bearish';
    return '🟡 Neutral';
}

function getPCRInterpretation(pcr) {
    if (pcr > 1.5) return 'Very Bullish - Heavy Put buying, expect upward movement';
    if (pcr > 1.2) return 'Bullish - More Puts than Calls, positive sentiment';
    if (pcr > 0.8) return 'Neutral - Balanced market, no clear direction';
    if (pcr > 0.5) return 'Bearish - More Calls than Puts, negative sentiment';
    return 'Very Bearish - Heavy Call buying, expect downward movement';
}

async function testCachePerformance(optionService, symbol, expiryDate) {
    logHeader('TEST 5: Cache Performance');
    
    logInfo('First fetch (no cache)...');
    const start1 = Date.now();
    await optionService.getOptionChain(symbol, expiryDate);
    const time1 = Date.now() - start1;
    logSuccess(`First fetch completed in: ${time1}ms`);
    
    await sleep(100);
    
    logInfo('Second fetch (from cache)...');
    const start2 = Date.now();
    await optionService.getOptionChain(symbol, expiryDate);
    const time2 = Date.now() - start2;
    logSuccess(`Cached fetch completed in: ${time2}ms`);
    
    const speedup = ((time1 / time2) - 1) * 100;
    logSuccess(`Cache speedup: ${speedup.toFixed(1)}% faster`);
    
    logInfo('Clearing cache...');
    optionService.clearCache();
    logSuccess('Cache cleared');
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

async function runTests() {
    console.clear();
    
    log('╔═══════════════════════════════════════════════════════════╗', colors.cyan + colors.bright);
    log('║       OPTION CHAIN API - COMPREHENSIVE TEST SUITE        ║', colors.cyan + colors.bright);
    log('╚═══════════════════════════════════════════════════════════╝', colors.cyan + colors.bright);
    
    const username = process.argv[2];
    
    if (!username) {
        logError('Username is required!');
        console.log('\n📖 Usage: node backend/test/optionChainTest.js <username>\n');
        console.log('📝 Example: node backend/test/optionChainTest.js myusername\n');
        process.exit(1);
    }
    
    logInfo(`Testing with username: ${username}`);
    logInfo(`Test Time: ${new Date().toLocaleString()}`);
    
    await sleep(1000);
    
    // Test 1: Authentication
    const dashboard = await testAuthentication(username);
    if (!dashboard) {
        logError('Cannot proceed without authentication!');
        process.exit(1);
    }
    
    await sleep(1000);
    
    const optionService = new OptionService(dashboard.smart_api);
    
    // Test 2: Spot Prices
    const spotPrices = await testSpotPrices(optionService);
    
    await sleep(1000);
    
    // Test 3: Expiry Dates
    const expiries = await testExpiryDates(optionService);
    
    await sleep(1000);
    
    // Test 4: Option Chain (BANKNIFTY)
    if (expiries.BANKNIFTY && expiries.BANKNIFTY.length > 0) {
        const firstExpiry = expiries.BANKNIFTY[0].date;
        await testOptionChain(optionService, 'BANKNIFTY', firstExpiry, spotPrices.BANKNIFTY);
        
        await sleep(1000);
        
        // Test 5: Cache Performance
        await testCachePerformance(optionService, 'BANKNIFTY', firstExpiry);
    } else {
        logWarning('Skipping option chain test - no expiries available');
    }
    
    // Summary
    logHeader('TEST SUMMARY');
    
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const currentTime = hours * 60 + minutes;
    const marketOpen = 9 * 60 + 15;
    const marketClose = 15 * 60 + 30;
    const isWeekday = now.getDay() >= 1 && now.getDay() <= 5;
    const isMarketOpen = isWeekday && currentTime >= marketOpen && currentTime <= marketClose;
    
    if (!isMarketOpen) {
        console.log('\n' + '='.repeat(100));
        log('⚠️  NOTE: Market is currently CLOSED', colors.yellow + colors.bright);
        console.log('='.repeat(100));
        log('   - Mock/demonstration data is being used for option chains', colors.yellow);
        log('   - Spot prices may be from last trading session', colors.yellow);
        log('   - For real-time data, run tests during market hours (9:15 AM - 3:30 PM IST, Mon-Fri)', colors.yellow);
        console.log('='.repeat(100));
    } else {
        logSuccess('✅ Market is OPEN - Using real-time data');
    }
    
    console.log('\n' + '='.repeat(100));
    log('✅ All tests completed successfully!', colors.green + colors.bright);
    console.log('='.repeat(100) + '\n');
}

// Run the tests
runTests().catch(error => {
    console.error('\n❌ Fatal error running tests:', error);
    console.error(error.stack);
    process.exit(1);
});