// ============================================================================
// COMPREHENSIVE OPTION SERVICE TEST WITH ENHANCED API
// Combines optionService with dual logging
// Shows ALL raw API responses from Angel One
// Usage: node testEnhancedOptionService.js <username>
// ============================================================================

const TradingDashboard = require("./tradingDashboard");
const { loadCredentials } = require("./credentialService");
const { OPTION_SYMBOLS } = require("../config/constants");
const fs = require("fs");
const path = require("path");

// ============================================================================
// DUAL LOGGER - Terminal (clean) + File (everything)
// ============================================================================

class DualLogger {
    constructor(username) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('.')[0];
        this.logFile = path.join(__dirname, `full_log_${username}_${timestamp}.txt`);
        this.outputFile = path.join(__dirname, `test_results_${username}_${timestamp}.txt`);
        
        this.fullLogs = [];
        this.outputLogs = [];
        
        this.fullLogs.push('='.repeat(120));
        this.fullLogs.push('FULL DETAILED LOG - ALL API CALLS AND RESPONSES');
        this.fullLogs.push('='.repeat(120));
        this.fullLogs.push(`Date: ${new Date().toLocaleString()}`);
        this.fullLogs.push(`User: ${username}`);
        this.fullLogs.push('='.repeat(120));
        this.fullLogs.push('');
        
        this.interceptConsole();
    }
    
    interceptConsole() {
        const originalLog = console.log;
        const originalError = console.error;
        
        console.log = (...args) => {
            const message = args.map(arg => 
                typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
            ).join(' ');
            this.fullLogs.push(message);
        };
        
        console.error = (...args) => {
            const message = args.map(arg => 
                typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
            ).join(' ');
            this.fullLogs.push(`ERROR: ${message}`);
        };
        
        this.originalLog = originalLog;
        this.originalError = originalError;
    }
    
    terminal(message) {
        this.originalLog(message);
        this.outputLogs.push(message.replace(/\x1b\[[0-9;]*m/g, ''));
        this.fullLogs.push(message.replace(/\x1b\[[0-9;]*m/g, ''));
    }
    
    fileOnly(message) {
        this.fullLogs.push(message);
    }
    
    save() {
        fs.writeFileSync(this.logFile, this.fullLogs.join('\n'), 'utf8');
        fs.writeFileSync(this.outputFile, this.outputLogs.join('\n'), 'utf8');
        return { fullLog: this.logFile, output: this.outputFile };
    }
}

// ============================================================================
// ENHANCED OPTION SERVICE - INLINE
// ============================================================================

class EnhancedOptionService {
    constructor(smartAPI) {
        this.smartAPI = smartAPI;
        this.cache = new Map();
    }

    async getSpotPrice(symbol) {
        const config = OPTION_SYMBOLS[symbol];
        try {
            const now = new Date();
            const fromDate = new Date(now.getTime() - 4 * 60 * 60 * 1000);
            
            console.log(`\n🔍 API CALL: getCandleData for spot price`);
            console.log(`   Symbol: ${symbol}, Token: ${config.token}`);
            
            const response = await this.smartAPI.getCandleData({
                exchange: config.spotExchange,
                symboltoken: config.token,
                interval: "ONE_MINUTE",
                fromdate: this.formatDateTime(fromDate),
                todate: this.formatDateTime(now)
            });

            console.log(`\n📥 RAW RESPONSE - getCandleData (Spot):`);
            console.log(JSON.stringify(response, null, 2));

            if (response?.status && response.data?.length > 0) {
                const spotPrice = parseFloat(response.data[response.data.length - 1][4]);
                console.log(`✅ Spot price: ₹${spotPrice.toFixed(2)}`);
                return spotPrice;
            }
            return null;
        } catch (error) {
            console.error(`❌ Error: ${error.message}`);
            return null;
        }
    }

    async getExpiryDates(symbol) {
        console.log(`\n🔍 API CALL: searchScrip for expiry dates`);
        console.log(`   Symbol: ${symbol}, Exchange: ${OPTION_SYMBOLS[symbol].exchange}`);
        
        try {
            const searchResponse = await this.smartAPI.searchScrip({
                exchange: OPTION_SYMBOLS[symbol].exchange,
                searchscrip: symbol
            });

            console.log(`\n📥 RAW RESPONSE - searchScrip (first 5 contracts):`);
            const contracts = Array.isArray(searchResponse) ? searchResponse : searchResponse?.data;
            console.log(JSON.stringify(contracts?.slice(0, 5), null, 2));
            console.log(`... and ${contracts?.length - 5} more contracts`);

            if (!contracts || contracts.length === 0) {
                return [];
            }

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
                            type: 'monthly'
                        };
                    }
                }
            });

            const expiries = Object.values(expiryMap).sort((a, b) => {
                return this.parseExpiryDate(a.date) - this.parseExpiryDate(b.date);
            });

            const today = new Date();
            const futureExpiries = expiries.filter(exp => 
                this.parseExpiryDate(exp.date) >= today
            );

            console.log(`✅ Found ${futureExpiries.length} future expiries`);
            return futureExpiries;

        } catch (error) {
            console.error(`❌ Error: ${error.message}`);
            return [];
        }
    }

    async searchOptionContracts(symbol, expiryDate) {
        const config = OPTION_SYMBOLS[symbol];
        const pattern = `${symbol}${this.formatExpiryForSymbol(expiryDate)}`;
        
        console.log(`\n🔍 API CALL: searchScrip for contracts`);
        console.log(`   Pattern: ${pattern}`);
        
        try {
            const response = await this.smartAPI.searchScrip({
                exchange: config.exchange,
                searchscrip: pattern
            });

            const contractsList = Array.isArray(response) ? response : response?.data;

            console.log(`\n📥 RAW RESPONSE - searchScrip (filtered, first 5):`);
            console.log(JSON.stringify(contractsList?.slice(0, 5), null, 2));

            if (contractsList && contractsList.length > 0) {
                const expiryStr = this.formatExpiryForSymbol(expiryDate);
                const filtered = contractsList.filter(contract => {
                    const symbolName = contract.tradingsymbol || contract.symbol;
                    return symbolName.includes(expiryStr);
                });

                console.log(`✅ Found ${filtered.length} contracts for ${expiryDate}`);
                return filtered;
            }
            
            return [];
        } catch (error) {
            console.error(`❌ Error: ${error.message}`);
            return [];
        }
    }

    async getMarketDataBatch(contracts, exchange) {
        try {
            const params = {
                mode: "FULL",
                exchangeTokens: {}
            };
            
            params.exchangeTokens[exchange] = contracts.map(c => 
                c.symboltoken || c.token
            );
            
            console.log(`\n🔍 API CALL: marketData (batch)`);
            console.log(`   Contracts: ${contracts.length}`);
            console.log(`   Params: ${JSON.stringify(params, null, 2)}`);
            
            const response = await this.smartAPI.marketData(params);
            
            console.log(`\n📥 RAW RESPONSE - marketData (first 3 contracts):`);
            if (response?.data?.fetched) {
                console.log(JSON.stringify(response.data.fetched.slice(0, 3), null, 2));
                console.log(`... and ${response.data.fetched.length - 3} more`);
            } else {
                console.log(JSON.stringify(response, null, 2));
            }
            
            if (response?.status && response.data?.fetched) {
                const dataMap = {};
                response.data.fetched.forEach(item => {
                    const token = item.symbolToken || item.token;
                    dataMap[token] = {
                        ltp: parseFloat(item.ltp || item.close || 0),
                        open: parseFloat(item.open || 0),
                        high: parseFloat(item.high || 0),
                        low: parseFloat(item.low || 0),
                        close: parseFloat(item.close || 0),
                        volume: parseInt(item.volume || item.totVolume || 0),
                        oi: parseInt(item.oi || item.opnInterest || 0),
                        oiChange: parseFloat(item.oiChange || item.oichangepercent || 0),
                        bidPrice: parseFloat(item.bidPrice || 0),
                        bidQty: parseInt(item.bidQty || 0),
                        askPrice: parseFloat(item.askPrice || 0),
                        askQty: parseInt(item.askQty || 0)
                    };
                });
                
                console.log(`✅ Parsed ${Object.keys(dataMap).length} market data items`);
                return dataMap;
            }
            
            return null;
        } catch (error) {
            console.error(`❌ marketData error: ${error.message}`);
            return null;
        }
    }

    async getOptionGreeksBatch(symbol, expiryDate) {
        try {
            const formattedExpiry = this.formatExpiryForGreeks(expiryDate);
            const params = {
                name: symbol,
                expirydate: formattedExpiry
            };
            
            console.log(`\n🔍 API CALL: optionGreek`);
            console.log(`   Params: ${JSON.stringify(params, null, 2)}`);
            
            const response = await this.smartAPI.optionGreek(params);
            
            console.log(`\n📥 RAW RESPONSE - optionGreek:`);
            console.log(JSON.stringify(response, null, 2));
            
            if (response?.status && response.data) {
                console.log(`✅ Got Greeks data`);
                return response.data;
            }
            
            return null;
        } catch (error) {
            console.error(`⚠️  optionGreek unavailable: ${error.message}`);
            return null;
        }
    }

    async getOptionChain(symbol, expiryDate) {
        console.log(`\n${'='.repeat(80)}`);
        console.log(`📊 Fetching option chain: ${symbol} - ${expiryDate}`);
        console.log('='.repeat(80));
        
        const results = {
            success: false,
            symbol,
            expiryDate,
            spotPrice: null,
            optionChain: [],
            errors: [],
            warnings: []
        };
        
        try {
            // Get spot
            results.spotPrice = await this.getSpotPrice(symbol);
            if (!results.spotPrice) {
                results.errors.push('Spot price unavailable');
                return results;
            }
            
            // Get expiries
            const expiries = await this.getExpiryDates(symbol);
            if (expiries.length === 0) {
                results.errors.push('No expiries available');
                return results;
            }
            
            if (!expiries.find(e => e.date === expiryDate)) {
                expiryDate = expiries[0].date;
                results.expiryDate = expiryDate;
            }
            
            // Search contracts
            const contracts = await this.searchOptionContracts(symbol, expiryDate);
            if (!contracts || contracts.length === 0) {
                results.errors.push('No contracts found');
                return results;
            }
            
            // Calculate strikes
            const strikes = this.calculateStrikes(results.spotPrice, symbol);
            const config = OPTION_SYMBOLS[symbol];
            
            const contractsToFetch = [];
            const contractMap = {};
            
            contracts.forEach(c => {
                const symbolName = c.tradingsymbol || c.symbol;
                contractMap[symbolName] = c;
            });
            
            strikes.forEach(strike => {
                const ceSymbol = this.buildTradingSymbol(symbol, expiryDate, strike, 'CE');
                const peSymbol = this.buildTradingSymbol(symbol, expiryDate, strike, 'PE');
                
                if (contractMap[ceSymbol]) contractsToFetch.push(contractMap[ceSymbol]);
                if (contractMap[peSymbol]) contractsToFetch.push(contractMap[peSymbol]);
            });
            
            if (contractsToFetch.length === 0) {
                results.errors.push('No matching contracts');
                return results;
            }
            
            // Fetch market data
            const marketDataMap = await this.getMarketDataBatch(contractsToFetch, config.exchange);
            
            // Fetch Greeks
            const greeksData = await this.getOptionGreeksBatch(symbol, expiryDate);
            
            // Build chain
            strikes.forEach(strike => {
                const ceSymbol = this.buildTradingSymbol(symbol, expiryDate, strike, 'CE');
                const peSymbol = this.buildTradingSymbol(symbol, expiryDate, strike, 'PE');
                
                const ceToken = contractMap[ceSymbol]?.symboltoken || contractMap[ceSymbol]?.token;
                const peToken = contractMap[peSymbol]?.symboltoken || contractMap[peSymbol]?.token;
                
                const callData = marketDataMap?.[ceToken];
                const putData = marketDataMap?.[peToken];
                
                if (callData || putData) {
                    results.optionChain.push({
                        strike,
                        isATM: Math.abs(strike - results.spotPrice) < config.strikeInterval / 2,
                        call: callData,
                        put: putData,
                        callSymbol: ceSymbol,
                        putSymbol: peSymbol
                    });
                }
            });
            
            results.success = true;
            results.lotSize = config.lotSize;
            results.greeksData = greeksData;
            
            console.log(`\n✅ Option chain built: ${results.optionChain.length} strikes`);
            
            return results;
            
        } catch (error) {
            results.errors.push(error.message);
            return results;
        }
    }

    // Helper functions
    calculateStrikes(spotPrice, symbol) {
        const config = OPTION_SYMBOLS[symbol];
        const interval = config.strikeInterval;
        const baseStrike = Math.round(spotPrice / interval) * interval;
        const strikes = [];
        for (let i = -15; i <= 15; i++) {
            strikes.push(baseStrike + (i * interval));
        }
        return strikes;
    }

    buildTradingSymbol(symbol, expiryDate, strikePrice, optionType) {
        const dateStr = this.formatExpiryForSymbol(expiryDate);
        return `${symbol}${dateStr}${strikePrice}${optionType}`;
    }

    formatExpiryForSymbol(expiryDate) {
        if (typeof expiryDate === 'string') {
            const parts = expiryDate.split('-');
            if (parts.length === 3) {
                const [day, month, year] = parts;
                return `${day}${month}${year.slice(-2)}`;
            }
        }
        return expiryDate;
    }

    formatExpiryForGreeks(expiryDate) {
        if (typeof expiryDate === 'string') {
            const parts = expiryDate.split('-');
            if (parts.length === 3) {
                const [day, month, year] = parts;
                return `${day}${month}${year}`;
            }
        }
        return expiryDate;
    }

    parseExpiryDate(dateStr) {
        const [day, month, year] = dateStr.split('-');
        const monthMap = {
            'JAN': 0, 'FEB': 1, 'MAR': 2, 'APR': 3, 'MAY': 4, 'JUN': 5,
            'JUL': 6, 'AUG': 7, 'SEP': 8, 'OCT': 9, 'NOV': 10, 'DEC': 11
        };
        return new Date(parseInt(year), monthMap[month], parseInt(day));
    }

    formatDateTime(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        const hours = String(date.getHours()).padStart(2, "0");
        const minutes = String(date.getMinutes()).padStart(2, "0");
        return `${year}-${month}-${day} ${hours}:${minutes}`;
    }
}

// ============================================================================
// MAIN TEST
// ============================================================================

async function main() {
    const username = process.argv[2];
    
    if (!username) {
        console.log('\n❌ Username required!');
        console.log('Usage: node testEnhancedOptionService.js <username>\n');
        process.exit(1);
    }
    
    const logger = new DualLogger(username);
    
    logger.terminal('\n' + '='.repeat(100));
    logger.terminal('ENHANCED OPTION SERVICE TEST - RAW API RESPONSES');
    logger.terminal('='.repeat(100));
    logger.terminal('  Terminal: Clean output');
    logger.terminal('  Full Log: ALL raw API responses from Angel One');
    logger.terminal('='.repeat(100));
    
    try {
        // Authenticate
        logger.terminal('\n📝 Authenticating...');
        
        const credentials = loadCredentials(username);
        if (!credentials) throw new Error('User not found');
        
        const dashboard = new TradingDashboard(credentials);
        const authResult = await dashboard.authenticate();
        
        if (!authResult.success) throw new Error(authResult.message);
        
        logger.terminal(`✅ Authenticated as: ${authResult.data.name}`);
        
        const optionService = new EnhancedOptionService(dashboard.smart_api);
        
        // Test Option Chain
        logger.terminal('\n' + '='.repeat(100));
        logger.terminal('FETCHING OPTION CHAIN WITH ENHANCED APIs');
        logger.terminal('='.repeat(100));
        logger.terminal('\n⏳ This will call:');
        logger.terminal('  1. getCandleData - for spot price');
        logger.terminal('  2. searchScrip - for contracts (2x)');
        logger.terminal('  3. marketData - for quotes (batch)');
        logger.terminal('  4. optionGreek - for Greeks & IV');
        logger.terminal('\nAll raw responses saved to log file!\n');
        
        const expiries = await optionService.getExpiryDates('BANKNIFTY');
        
        if (expiries.length > 0) {
            const firstExpiry = expiries[0];
            logger.terminal(`\n📊 Using expiry: ${firstExpiry.formatted}`);
            
            const chainData = await optionService.getOptionChain('BANKNIFTY', firstExpiry.date);
            
            if (chainData.success) {
                logger.terminal('\n✅ SUCCESS!');
                logger.terminal(`   Spot: ₹${chainData.spotPrice.toFixed(2)}`);
                logger.terminal(`   Strikes: ${chainData.optionChain.length}`);
                logger.terminal(`   Lot Size: ${chainData.lotSize}`);
                
                // Sample data
                const atmIndex = chainData.optionChain.findIndex(o => o.isATM);
                if (atmIndex >= 0) {
                    const sample = chainData.optionChain[atmIndex];
                    logger.terminal('\n📋 ATM Strike Sample:');
                    logger.terminal(`   Strike: ${sample.strike}`);
                    if (sample.call) {
                        logger.terminal(`   CALL - LTP: ₹${sample.call.ltp}, OI: ${sample.call.oi}, Vol: ${sample.call.volume}`);
                    }
                    if (sample.put) {
                        logger.terminal(`   PUT  - LTP: ₹${sample.put.ltp}, OI: ${sample.put.oi}, Vol: ${sample.put.volume}`);
                    }
                }
            } else {
                logger.terminal('\n❌ Failed:');
                chainData.errors.forEach(e => logger.terminal(`   - ${e}`));
            }
        } else {
            logger.terminal('\n⚠️  No expiries found (market closed?)');
        }
        
        // Save files
        const files = logger.save();
        logger.terminal('\n' + '='.repeat(100));
        logger.terminal('FILES SAVED');
        logger.terminal('='.repeat(100));
        logger.terminal(`📄 Clean Output: ${path.basename(files.output)}`);
        logger.terminal(`📋 Full Log with RAW API responses: ${path.basename(files.fullLog)}`);
        logger.terminal('='.repeat(100));
        logger.terminal('');
        
    } catch (error) {
        logger.terminal(`\n❌ ERROR: ${error.message}`);
        logger.save();
        process.exit(1);
    }
}

main().catch(err => {
    console.error('\n❌ FATAL ERROR:', err);
    process.exit(1);
});