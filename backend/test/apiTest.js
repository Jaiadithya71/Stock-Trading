// ============================================
// TESTING SUITE FOR TRADING DASHBOARD BACKEND
// ============================================
// Save this as: backend/test/apiTest.js
// Run with: node backend/test/apiTest.js

const readline = require('readline');

// Configuration
const BASE_URL = 'http://localhost:3000/api';

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

// Test results tracker
const testResults = {
    passed: 0,
    failed: 0,
    warnings: 0,
    tests: []
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

function log(message, color = colors.reset) {
    console.log(`${color}${message}${colors.reset}`);
}

function logHeader(message) {
    console.log('\n' + '='.repeat(60));
    log(message, colors.bright + colors.cyan);
    console.log('='.repeat(60));
}

function logSuccess(message) {
    log(`✅ ${message}`, colors.green);
    testResults.passed++;
}

function logError(message) {
    log(`❌ ${message}`, colors.red);
    testResults.failed++;
}

function logWarning(message) {
    log(`⚠️  ${message}`, colors.yellow);
    testResults.warnings++;
}

function logInfo(message) {
    log(`ℹ️  ${message}`, colors.blue);
}

async function makeRequest(endpoint, data = null) {
    try {
        const options = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        };
        
        if (data) {
            options.body = JSON.stringify(data);
        }

        const response = await fetch(`${BASE_URL}${endpoint}`, options);
        const result = await response.json();
        
        return {
            success: response.ok,
            status: response.status,
            data: result
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function getUserInput(question) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise(resolve => {
        rl.question(question, answer => {
            rl.close();
            resolve(answer.trim());
        });
    });
}

// ============================================
// TEST FUNCTIONS
// ============================================

async function testServerConnection() {
    logHeader('TEST 1: Server Connection');
    
    try {
        const response = await fetch(BASE_URL.replace('/api', '/'));
        if (response.ok) {
            logSuccess('Server is running and accessible');
            return true;
        } else {
            logError(`Server responded with status: ${response.status}`);
            return false;
        }
    } catch (error) {
        logError(`Cannot connect to server: ${error.message}`);
        logInfo('Make sure the server is running with: npm start');
        return false;
    }
}

async function testCheckUser(username) {
    logHeader('TEST 2: Check User Endpoint');
    
    const result = await makeRequest('/check-user', { username });
    
    if (result.success) {
        if (result.data.exists) {
            logSuccess(`User "${username}" exists in the system`);
            testResults.tests.push({ name: 'Check User Exists', status: 'PASSED' });
            return true;
        } else {
            logError(`User "${username}" not found in the system`);
            logInfo('Please save credentials first using the dashboard');
            testResults.tests.push({ name: 'Check User Exists', status: 'FAILED' });
            return false;
        }
    } else {
        logError('Check user endpoint not working correctly');
        testResults.tests.push({ name: 'Check User Exists', status: 'FAILED' });
        return false;
    }
}

async function testAuthentication(username) {
    logHeader('TEST 3: Authentication');
    
    logInfo('Authenticating using stored credentials...');
    const result = await makeRequest('/authenticate', { username });
    
    if (result.success && result.data.success) {
        logSuccess(`Authentication successful for user: ${result.data.data?.name || 'Unknown'}`);
        logInfo(`Client ID: ${result.data.data?.clientId || 'N/A'}`);
        testResults.tests.push({ name: 'Authentication', status: 'PASSED' });
        return true;
    } else {
        logError(`Authentication failed: ${result.data?.message || 'Unknown error'}`);
        testResults.tests.push({ name: 'Authentication', status: 'FAILED' });
        
        if (result.data?.message?.includes('TOTP')) {
            logInfo('This might be a TOTP/timing issue. TOTP codes change every 30 seconds.');
        }
        if (result.data?.message?.includes('not found')) {
            logInfo('User credentials not found. Please save them first using the dashboard.');
        }
        return false;
    }
}

async function testBankNiftyData(username) {
    logHeader('TEST 4: Bank Nifty Data Retrieval');
    
    const result = await makeRequest('/banknifty-data', { username });
    
    if (!result.success) {
        logError('Failed to fetch Bank Nifty data');
        testResults.tests.push({ name: 'Bank Nifty Data', status: 'FAILED' });
        return false;
    }
    
    if (!result.data.success || !result.data.data) {
        logError('Bank Nifty data response invalid');
        testResults.tests.push({ name: 'Bank Nifty Data', status: 'FAILED' });
        return false;
    }
    
    const banks = result.data.data;
    const expectedBanks = [
        "HDFCBANK", "ICICIBANK", "AXISBANK", "KOTAKBANK",
        "SBIN", "INDUSINDBK", "BANDHANBNK", "PNB",
        "IDFCFIRSTB", "AUBANK", "FEDERALBNK", "BANKBARODA"
    ];
    
    logInfo(`Total banks in response: ${banks.length}`);
    
    let banksWithData = 0;
    let banksWithoutData = 0;
    
    console.log('\n' + '-'.repeat(80));
    console.log('BANK NAME'.padEnd(15) + 'LTP'.padEnd(12) + 'VOLUME'.padEnd(15) + 'CHANGE %'.padEnd(12) + 'STATUS');
    console.log('-'.repeat(80));
    
    expectedBanks.forEach(bankName => {
        const bankData = banks.find(b => b.bank === bankName);
        
        if (bankData) {
            const ltp = bankData.ltp || 'N/A';
            const volume = bankData.volume || 'N/A';
            const change = bankData.changePercent || 'N/A';
            const status = bankData.status || 'Unknown';
            
            const hasData = bankData.ltp !== null && bankData.status !== 'No Data';
            
            if (hasData) {
                log(
                    bankName.padEnd(15) +
                    String(ltp).padEnd(12) +
                    String(volume).padEnd(15) +
                    String(change).padEnd(12) +
                    status,
                    colors.green
                );
                banksWithData++;
            } else {
                log(
                    bankName.padEnd(15) +
                    String(ltp).padEnd(12) +
                    String(volume).padEnd(15) +
                    String(change).padEnd(12) +
                    status,
                    colors.yellow
                );
                banksWithoutData++;
            }
        } else {
            log(bankName.padEnd(15) + 'MISSING FROM RESPONSE', colors.red);
            banksWithoutData++;
        }
    });
    
    console.log('-'.repeat(80));
    console.log();
    
    logInfo(`Banks with data: ${banksWithData}`);
    logInfo(`Banks without data: ${banksWithoutData}`);
    
    if (banksWithData > 0) {
        logSuccess(`Bank Nifty data retrieval working (${banksWithData}/${expectedBanks.length} banks have data)`);
        testResults.tests.push({ name: 'Bank Nifty Data', status: 'PASSED' });
        
        if (banksWithoutData > 0) {
            logWarning(`${banksWithoutData} banks have no data (this is normal if market is closed)`);
        }
        return true;
    } else {
        logError('No bank data retrieved - check if market is open or API is working');
        testResults.tests.push({ name: 'Bank Nifty Data', status: 'FAILED' });
        return false;
    }
}

async function testIndicesData(username) {
    logHeader('TEST 5: Indices Data Retrieval');
    
    const result = await makeRequest('/indices-data', { username });
    
    if (!result.success) {
        logError('Failed to fetch indices data');
        testResults.tests.push({ name: 'Indices Data', status: 'FAILED' });
        return false;
    }
    
    if (!result.data.success || !result.data.data) {
        logError('Indices data response invalid');
        testResults.tests.push({ name: 'Indices Data', status: 'FAILED' });
        return false;
    }
    
    const indices = result.data.data;
    const expectedIndices = ['BANKNIFTY', 'NIFTY', 'INDIA VIX'];
    const timeIntervals = ['ONE_MINUTE', 'THREE_MINUTE', 'FIVE_MINUTE', 'FIFTEEN_MINUTE', 'THIRTY_MINUTE', 'ONE_HOUR'];
    
    console.log('\n' + '-'.repeat(100));
    console.log('INDEX'.padEnd(15) + 'LTP'.padEnd(12) + timeIntervals.map(i => i.substring(0, 7)).join('  '));
    console.log('-'.repeat(100));
    
    let indicesWithData = 0;
    
    expectedIndices.forEach(indexName => {
        if (indices[indexName]) {
            const ltp = indices[indexName].ltp || 'N/A';
            const sentiments = timeIntervals.map(interval => {
                const sentiment = indices[indexName][interval] || 'N/A';
                return sentiment.substring(0, 7).padEnd(9);
            }).join('');
            
            const hasData = indices[indexName].ltp !== null;
            
            if (hasData) {
                log(indexName.padEnd(15) + String(ltp).padEnd(12) + sentiments, colors.green);
                indicesWithData++;
            } else {
                log(indexName.padEnd(15) + String(ltp).padEnd(12) + sentiments, colors.yellow);
            }
        } else {
            log(indexName.padEnd(15) + 'MISSING FROM RESPONSE', colors.red);
        }
    });
    
    console.log('-'.repeat(100));
    console.log();
    
    if (indicesWithData > 0) {
        logSuccess(`Indices data retrieval working (${indicesWithData}/${expectedIndices.length} indices have data)`);
        testResults.tests.push({ name: 'Indices Data', status: 'PASSED' });
        return true;
    } else {
        logError('No indices data retrieved');
        testResults.tests.push({ name: 'Indices Data', status: 'FAILED' });
        return false;
    }
}

async function testDataConsistency(username) {
    logHeader('TEST 6: Data Consistency Check');
    
    logInfo('Fetching Bank Nifty data twice to check consistency...');
    
    const result1 = await makeRequest('/banknifty-data', { username });
    await sleep(2000); // Wait 2 seconds
    const result2 = await makeRequest('/banknifty-data', { username });
    
    if (!result1.success || !result2.success) {
        logError('Failed to fetch data for consistency check');
        testResults.tests.push({ name: 'Data Consistency', status: 'FAILED' });
        return false;
    }
    
    const banks1 = result1.data.data;
    const banks2 = result2.data.data;
    
    if (banks1.length !== banks2.length) {
        logWarning(`Inconsistent number of banks: ${banks1.length} vs ${banks2.length}`);
    }
    
    let consistentCount = 0;
    let inconsistentCount = 0;
    
    banks1.forEach(bank1 => {
        const bank2 = banks2.find(b => b.bank === bank1.bank);
        if (bank2) {
            // Check if both have data or both have no data
            const both_have_data = (bank1.ltp !== null && bank2.ltp !== null);
            const both_no_data = (bank1.ltp === null && bank2.ltp === null);
            
            if (both_have_data || both_no_data) {
                consistentCount++;
            } else {
                inconsistentCount++;
                logWarning(`${bank1.bank}: Data availability changed between requests`);
            }
        }
    });
    
    logInfo(`Consistent: ${consistentCount}, Inconsistent: ${inconsistentCount}`);
    
    if (consistentCount >= banks1.length * 0.8) { // 80% consistency threshold
        logSuccess('Data consistency check passed');
        testResults.tests.push({ name: 'Data Consistency', status: 'PASSED' });
        return true;
    } else {
        logWarning('Data consistency lower than expected (might be normal during market volatility)');
        testResults.tests.push({ name: 'Data Consistency', status: 'WARNING' });
        return true;
    }
}

async function testResponseTimes(username) {
    logHeader('TEST 7: Response Time Analysis');
    
    const endpoints = [
        { name: 'Bank Nifty Data', endpoint: '/banknifty-data' },
        { name: 'Indices Data', endpoint: '/indices-data' }
    ];
    
    for (const endpoint of endpoints) {
        const startTime = Date.now();
        const result = await makeRequest(endpoint.endpoint, { username });
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        if (result.success) {
            if (duration < 5000) {
                logSuccess(`${endpoint.name}: ${duration}ms (Good)`);
            } else if (duration < 10000) {
                logWarning(`${endpoint.name}: ${duration}ms (Acceptable)`);
            } else {
                logError(`${endpoint.name}: ${duration}ms (Slow)`);
            }
        } else {
            logError(`${endpoint.name}: Failed to fetch`);
        }
    }
    
    testResults.tests.push({ name: 'Response Times', status: 'PASSED' });
    return true;
}

function printTestSummary() {
    logHeader('TEST SUMMARY');
    
    console.log('\nTest Results:');
    console.log('-'.repeat(60));
    testResults.tests.forEach(test => {
        const statusColor = test.status === 'PASSED' ? colors.green : 
                           test.status === 'WARNING' ? colors.yellow : colors.red;
        log(`${test.name.padEnd(40)} [${test.status}]`, statusColor);
    });
    console.log('-'.repeat(60));
    
    console.log();
    log(`✅ Tests Passed: ${testResults.passed}`, colors.green);
    log(`❌ Tests Failed: ${testResults.failed}`, colors.red);
    log(`⚠️  Warnings: ${testResults.warnings}`, colors.yellow);
    
    const totalTests = testResults.passed + testResults.failed;
    const successRate = totalTests > 0 ? ((testResults.passed / totalTests) * 100).toFixed(1) : 0;
    
    console.log();
    if (successRate >= 80) {
        log(`🎉 Overall Success Rate: ${successRate}%`, colors.green + colors.bright);
    } else if (successRate >= 50) {
        log(`⚠️  Overall Success Rate: ${successRate}%`, colors.yellow + colors.bright);
    } else {
        log(`❌ Overall Success Rate: ${successRate}%`, colors.red + colors.bright);
    }
    
    console.log('\n' + '='.repeat(60) + '\n');
}

// ============================================
// MAIN TEST RUNNER
// ============================================

async function runTests() {
    console.clear();
    log('╔═══════════════════════════════════════════════════════════╗', colors.cyan + colors.bright);
    log('║     TRADING DASHBOARD BACKEND - API TEST SUITE          ║', colors.cyan + colors.bright);
    log('╚═══════════════════════════════════════════════════════════╝', colors.cyan + colors.bright);
    
    console.log();
    logInfo(`Server URL: ${BASE_URL}`);
    logInfo(`Test Time: ${new Date().toLocaleString()}`);
    
    // Get username from user
    console.log();
    const username = await getUserInput('Enter your username: ');
    
    if (!username) {
        log('\n❌ Username is required to run the tests!', colors.red);
        process.exit(1);
    }
    
    console.log();
    logInfo(`Testing with username: ${username}`);
    logInfo('Using stored encrypted credentials from backend...');
    logInfo('Starting tests...');
    await sleep(1000);
    
    // Run tests in sequence
    const serverOk = await testServerConnection();
    if (!serverOk) {
        log('\n❌ Cannot proceed without server connection!', colors.red);
        process.exit(1);
    }
    
    await sleep(1000);
    const userExists = await testCheckUser(username);
    if (!userExists) {
        log('\n❌ User not found! Please save credentials first using the dashboard.', colors.red);
        printTestSummary();
        process.exit(1);
    }
    
    await sleep(1000);
    const authOk = await testAuthentication(username);
    if (!authOk) {
        log('\n❌ Cannot proceed without authentication!', colors.red);
        log('   Check if your credentials are correct and TOTP token is valid.', colors.yellow);
        printTestSummary();
        process.exit(1);
    }
    
    await sleep(2000);
    await testBankNiftyData(username);
    
    await sleep(2000);
    await testIndicesData(username);
    
    await sleep(2000);
    await testDataConsistency(username);
    
    await sleep(1000);
    await testResponseTimes(username);
    
    // Print summary
    printTestSummary();
    
    // Check if market is open
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const currentTime = hours * 60 + minutes;
    const marketOpen = 9 * 60 + 15; // 9:15 AM
    const marketClose = 15 * 60 + 30; // 3:30 PM
    const isWeekday = now.getDay() >= 1 && now.getDay() <= 5;
    
    if (!isWeekday || currentTime < marketOpen || currentTime > marketClose) {
        console.log();
        log('⚠️  NOTE: Market is currently CLOSED', colors.yellow + colors.bright);
        log('   Some "No Data" results are expected when market is closed.', colors.yellow);
        log('   For best results, run tests during market hours (9:15 AM - 3:30 PM IST, Mon-Fri)', colors.yellow);
    }
}

// Run the test suite
runTests().catch(error => {
    console.error('Fatal error running tests:', error);
    process.exit(1);
});