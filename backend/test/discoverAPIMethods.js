// ============================================================================
// FILE: backend/test/discoverAPIMethods.js
// SAVE AS: backend/test/discoverAPIMethods.js
// RUN: node backend/test/discoverAPIMethods.js <username>
// ============================================================================
// This script discovers what methods are ACTUALLY available in the SmartAPI instance

const TradingDashboard = require("../services/tradingDashboard");
const { loadCredentials } = require("../services/credentialService");

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

async function main() {
    console.clear();
    
    // Setup file logging
    const fs = require('fs');
    const outputFile = `api_discovery_${Date.now()}.txt`;
    const logToFile = (message) => {
        // Remove color codes for file
        const cleanMessage = message.replace(/\x1b\[[0-9;]*m/g, '');
        fs.appendFileSync(outputFile, cleanMessage + '\n');
    };
    
    const logBoth = (message, color = colors.reset) => {
        log(message, color);
        logToFile(message);
    };
    
    logBoth('╔═══════════════════════════════════════════════════════════╗', colors.cyan + colors.bright);
    logBoth('║         DISCOVER AVAILABLE SMARTAPI METHODS              ║', colors.cyan + colors.bright);
    logBoth('╚═══════════════════════════════════════════════════════════╝', colors.cyan + colors.bright);
    logBoth(`\nOutput will be saved to: ${outputFile}\n`, colors.yellow);
    
    const username = process.argv[2];
    
    if (!username) {
        logBoth('❌ Username is required!', colors.red);
        logBoth('\n📖 Usage: node backend/test/discoverAPIMethods.js <username>\n');
        process.exit(1);
    }
    
    logBoth(`ℹ️  Loading credentials for: ${username}`, colors.blue);
    const credentials = loadCredentials(username);
    
    if (!credentials) {
        logBoth(`❌ User '${username}' not found`, colors.red);
        process.exit(1);
    }
    
    logBoth('✅ Credentials loaded', colors.green);
    logBoth('ℹ️  Authenticating...', colors.blue);
    
    const dashboard = new TradingDashboard(credentials);
    const authResult = await dashboard.authenticate();
    
    if (!authResult.success) {
        logBoth(`❌ Authentication failed: ${authResult.message}`, colors.red);
        process.exit(1);
    }
    
    logBoth(`✅ Authenticated as: ${authResult.data.name}`, colors.green);
    
    const smartAPI = dashboard.smart_api;
    
    const logHeaderBoth = (message) => {
        const line = '\n' + '='.repeat(100);
        logBoth(line);
        logBoth(message, colors.bright + colors.cyan);
        logBoth('='.repeat(100));
    };
    
    logHeaderBoth('DISCOVERING ALL AVAILABLE METHODS');
    
    logBoth('\n📋 Listing all methods and properties on smartAPI object:\n');
    
    const allMethods = [];
    const allProperties = [];
    
    // Get all properties and methods
    for (let key in smartAPI) {
        if (typeof smartAPI[key] === 'function') {
            allMethods.push(key);
        } else {
            allProperties.push(key);
        }
    }
    
    // Also check prototype
    const proto = Object.getPrototypeOf(smartAPI);
    for (let key of Object.getOwnPropertyNames(proto)) {
        if (key !== 'constructor' && typeof proto[key] === 'function') {
            if (!allMethods.includes(key)) {
                allMethods.push(key);
            }
        }
    }
    
    // Sort alphabetically
    allMethods.sort();
    allProperties.sort();
    
    logBoth(`✅ Found ${allMethods.length} methods`, colors.green);
    logBoth(`ℹ️  Found ${allProperties.length} properties`, colors.blue);
    
    logBoth('\n' + '='.repeat(100));
    logBoth('🔧 AVAILABLE METHODS:', colors.green + colors.bright);
    logBoth('='.repeat(100));
    
    allMethods.forEach((method, index) => {
        logBoth(`${(index + 1).toString().padStart(3)}. ${method}`);
    });
    
    if (allProperties.length > 0) {
        logBoth('\n' + '='.repeat(100));
        logBoth('📦 AVAILABLE PROPERTIES:', colors.blue + colors.bright);
        logBoth('='.repeat(100));
        
        allProperties.forEach((prop, index) => {
            const value = smartAPI[prop];
            const type = typeof value;
            const preview = type === 'string' ? ` = "${value}"` : 
                          type === 'number' ? ` = ${value}` :
                          type === 'boolean' ? ` = ${value}` :
                          type === 'object' && value === null ? ' = null' :
                          '';
            logBoth(`${(index + 1).toString().padStart(3)}. ${prop} (${type})${preview}`);
        });
    }
    
    // Now test the methods we expect for options
    logHeaderBoth('TESTING KEY METHODS FOR OPTION CHAIN');
    
    const methodsToTest = [
        'getCandleData',
        'searchScrip',
        'getMarketData',
        'getLtpData',
        'getQuote',
        'placeOrder',
        'getProfile',
        'getRMS',
        'getHolding',
        'getPosition',
        'convertPosition',
        'getOrderBook',
        'getTradeBook',
        'cancelOrder',
        'modifyOrder'
    ];
    
    logBoth('\n📊 Testing if key methods exist:\n');
    
    methodsToTest.forEach(method => {
        const exists = typeof smartAPI[method] === 'function';
        if (exists) {
            logBoth(`${method.padEnd(30)} ✅ EXISTS`, colors.green);
        } else {
            logBoth(`${method.padEnd(30)} ❌ NOT FOUND`, colors.red);
        }
    });
    
    // Test getCandleData since we know it works
    logHeaderBoth('TESTING getCandleData() WITH DIFFERENT PARAMETERS');
    
    try {
        const now = new Date();
        const fromDate = new Date(now.getTime() - 1 * 60 * 60 * 1000); // 1 hour ago
        
        const formatDateTime = (date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, "0");
            const day = String(date.getDate()).padStart(2, "0");
            const hours = String(date.getHours()).padStart(2, "0");
            const minutes = String(date.getMinutes()).padStart(2, "0");
            return `${year}-${month}-${day} ${hours}:${minutes}`;
        };
        
        logBoth('ℹ️  Testing with BANKNIFTY spot token...', colors.blue);
        const response = await smartAPI.getCandleData({
            exchange: "NSE",
            symboltoken: "99926009", // BANKNIFTY
            interval: "FIVE_MINUTE",
            fromdate: formatDateTime(fromDate),
            todate: formatDateTime(now)
        });
        
        logBoth('\n📦 Response:');
        logBoth(`   status: ${response?.status}`);
        logBoth(`   message: ${response?.message}`);
        logBoth(`   data length: ${response?.data?.length || 0}`);
        
        if (response?.data?.length > 0) {
            logBoth('✅ Got data! Market has some activity.', colors.green);
            logBoth('\n   Latest candle:');
            const last = response.data[response.data.length - 1];
            logBoth(`   Time:  ${last[0]}`);
            logBoth(`   Close: ₹${last[4]}`);
        } else {
            logBoth('ℹ️  No data returned (market is closed)', colors.blue);
        }
        
    } catch (error) {
        logBoth(`❌ Error: ${error.message}`, colors.red);
    }
    
    // Test searchScrip
    logHeaderBoth('TESTING searchScrip() WITH DIFFERENT FORMATS');
    
    const searchTests = [
        { desc: 'Just symbol', search: 'BANKNIFTY' },
        { desc: 'With expiry (standard)', search: 'BANKNIFTY26DEC25' },
        { desc: 'With full date', search: 'BANKNIFTY26DEC2025' },
        { desc: 'Next week', search: 'BANKNIFTY02JAN26' },
        { desc: 'NIFTY', search: 'NIFTY26DEC25' },
        { desc: 'Specific strike', search: 'BANKNIFTY26DEC2551000' }
    ];
    
    for (const test of searchTests) {
        try {
            logBoth(`\nℹ️  Testing: "${test.search}" (${test.desc})`, colors.blue);
            
            const response = await smartAPI.searchScrip({
                exchange: "NFO",
                searchscrip: test.search
            });
            
            // Log full response structure for debugging
            logBoth(`   Response type: ${typeof response}`);
            logBoth(`   Response: ${JSON.stringify(response)}`);
            
            // Check response structure
            if (response && response.data && response.data.length > 0) {
                logBoth(`✅ Found ${response.data.length} results`, colors.green);
                logBoth(`   First result: ${response.data[0].tradingsymbol || response.data[0].symbol}`);
            } else if (response && typeof response === 'string') {
                logBoth(`ℹ️  String response: ${response}`, colors.blue);
            } else {
                logBoth('ℹ️  No results found', colors.blue);
            }
            
            await new Promise(resolve => setTimeout(resolve, 500));
            
        } catch (error) {
            logBoth(`❌ Error: ${error.message}`, colors.red);
        }
    }
    
    logHeaderBoth('DISCOVERY COMPLETE');
    
    logBoth('\n💡 RECOMMENDATIONS:');
    logBoth('   1. Check which methods actually exist above');
    logBoth('   2. Use getCandleData() - it works!');
    logBoth('   3. searchScrip() format needs investigation');
    logBoth('   4. Some methods from GitHub docs might not be in your SDK version');
    logBoth(`\n📝 Complete output saved to: ${outputFile}`);
    logBoth('📝 Next step: Update code to use only the methods that exist!\n');
    
    log(`\n✅ Output file created: ${outputFile}`, colors.green + colors.bright);
}

main().catch(error => {
    console.error('\n❌ Fatal error:', error);
    console.error(error.stack);
    process.exit(1);
});