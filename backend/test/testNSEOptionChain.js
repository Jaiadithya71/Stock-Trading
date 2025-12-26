// backend/test/testNSEOptionChain.js
// Simple option chain display using NSE API with Angel One expiry dates

const path = require('path');
const InstrumentFetcher = require('./utils/instrumentFetcher');
const NSEApiFetcher = require('./utils/nseApiFetcher');
const OptionChainDisplay = require('./utils/optionChainDisplay');

const OUTPUT_DIR = path.join(__dirname, 'output');

/**
 * Main function
 */
async function main() {
  console.clear();
  console.log('╔══════════════════════════════════════════════════════════════════════════╗');
  console.log('║              NSE OPTION CHAIN - COMPLETE DATA WITH IV                   ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════╝');
  console.log('');

  try {
    // Step 1: Get expiry dates from Angel One instruments
    console.log('📋 Step 1: Fetching expiry dates from Angel One...');
    console.log('─'.repeat(80));
    
    const instrumentFetcher = new InstrumentFetcher(OUTPUT_DIR);
    
    // Check if instruments cached
    let instruments = instrumentFetcher.loadInstruments();
    
    if (!instruments) {
      console.log('📥 Downloading instruments from Angel One (this may take 1-2 minutes)...');
      instruments = await instrumentFetcher.downloadInstruments();
    } else {
      console.log(`✅ Loaded ${instruments.length} instruments from cache`);
    }
    
    // Filter for BANKNIFTY options
    const symbol = 'BANKNIFTY';
    console.log(`\n🔍 Filtering ${symbol} options...`);
    const { filtered, byExpiry, sortedExpiries } = instrumentFetcher.filterNFOOptions(instruments, symbol);
    
    console.log(`✅ Found ${filtered.length} ${symbol} option contracts`);
    console.log('');
    
    // Display available expiries
    console.log('📅 Available Expiry Dates:');
    sortedExpiries.forEach((expiry, idx) => {
      const count = byExpiry[expiry].length;
      const marker = idx === 0 ? ' ← NEAREST' : '';
      console.log(`   ${idx + 1}. ${expiry} (${count} contracts)${marker}`);
    });
    console.log('');
    
    // Select expiry (use first by default)
    const selectedExpiry = sortedExpiries[0];
    console.log(`✅ Selected expiry: ${selectedExpiry}`);
    console.log('');

    // Step 2: Fetch complete data from NSE API
    console.log('─'.repeat(80));
    console.log('📊 Step 2: Fetching complete option chain from NSE...');
    console.log('─'.repeat(80));
    console.log('');
    
    const nseFetcher = new NSEApiFetcher(OUTPUT_DIR);
    const optionChain = await nseFetcher.getOptionChain(symbol, selectedExpiry);
    
    if (!optionChain) {
      console.error('❌ Failed to fetch data from NSE');
      console.log('');
      console.log('Possible reasons:');
      console.log('  1. NSE API is blocking requests (Cloudflare protection)');
      console.log('  2. Network issues');
      console.log('  3. NSE API structure changed');
      console.log('  4. Rate limit exceeded');
      console.log('');
      console.log('💡 Try again in a few minutes or check your internet connection.');
      process.exit(1);
    }
    
    console.log('✅ Successfully fetched option chain from NSE');
    console.log('');

    // Step 3: Display option chain in terminal
    console.log('─'.repeat(80));
    console.log('📺 Step 3: Displaying option chain...');
    console.log('─'.repeat(80));
    console.log('');
    
    // Wait a moment for effect
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const display = new OptionChainDisplay();
    
    // Calculate ATM
    const atmStrike = Math.round(optionChain.underlyingValue / 100) * 100;
    
    // Get strikes around ATM (±10 strikes)
    const allStrikes = Object.keys(optionChain.strikes).map(Number).sort((a, b) => a - b);
    const atmIndex = allStrikes.indexOf(atmStrike);
    const startIndex = Math.max(0, atmIndex - 10);
    const endIndex = Math.min(allStrikes.length, atmIndex + 11);
    const displayStrikes = allStrikes.slice(startIndex, endIndex);
    
    // Filter option chain to display strikes only
    const filteredChain = {
      symbol: optionChain.symbol,
      underlyingValue: optionChain.underlyingValue,
      expiry: optionChain.expiry,
      timestamp: optionChain.timestamp,
      strikes: {}
    };
    
    displayStrikes.forEach(strike => {
      filteredChain.strikes[strike] = optionChain.strikes[strike];
    });
    
    // Display header
    display.displayHeader(symbol, optionChain.underlyingValue, atmStrike, selectedExpiry);
    
    // Display column headers
    display.displayColumnHeaders();
    
    // Display each strike with NSE data
    displayStrikes.reverse().forEach(strike => {
      const strikeData = optionChain.strikes[strike];
      
      // Convert NSE data format to display format
      const callData = strikeData.CE ? {
        oi: strikeData.CE.openInterest,
        oiChange: strikeData.CE.changeinOpenInterest,
        volume: strikeData.CE.totalTradedVolume,
        iv: strikeData.CE.impliedVolatility,
        ltp: strikeData.CE.lastPrice,
        change: strikeData.CE.change,
        bidQty: strikeData.CE.bidQty,
        bidPrice: strikeData.CE.bidprice,
        askPrice: strikeData.CE.askPrice,
        askQty: strikeData.CE.askQty
      } : null;
      
      const putData = strikeData.PE ? {
        oi: strikeData.PE.openInterest,
        oiChange: strikeData.PE.changeinOpenInterest,
        volume: strikeData.PE.totalTradedVolume,
        iv: strikeData.PE.impliedVolatility,
        ltp: strikeData.PE.lastPrice,
        change: strikeData.PE.change,
        bidQty: strikeData.PE.bidQty,
        bidPrice: strikeData.PE.bidprice,
        askPrice: strikeData.PE.askPrice,
        askQty: strikeData.PE.askQty
      } : null;
      
      display.displayStrikeRow(strike, callData, putData, atmStrike);
    });
    
    // Display footer
    display.displayFooter(0, optionChain.timestamp);
    
    // Display summary statistics
    const totalCallOI = displayStrikes.reduce((sum, strike) => {
      return sum + (optionChain.strikes[strike].CE?.openInterest || 0);
    }, 0);
    
    const totalPutOI = displayStrikes.reduce((sum, strike) => {
      return sum + (optionChain.strikes[strike].PE?.openInterest || 0);
    }, 0);
    
    const pcr = totalCallOI > 0 ? (totalPutOI / totalCallOI).toFixed(2) : 'N/A';
    
    console.log('═'.repeat(180));
    console.log('                                        SUMMARY');
    console.log('═'.repeat(180));
    console.log('');
    console.log(`  Total Call OI: ${totalCallOI.toLocaleString()}`);
    console.log(`  Total Put OI: ${totalPutOI.toLocaleString()}`);
    console.log(`  Put-Call Ratio (PCR): ${pcr}`);
    console.log('');
    console.log('✨ Note: This data includes IMPLIED VOLATILITY (IV) from NSE!');
    console.log('');
    console.log('═'.repeat(180));
    console.log('');
    
    console.log('✅ Option chain displayed successfully!');
    console.log('');
    console.log('💡 Tips:');
    console.log('   - Data is fetched from NSE (not real-time streaming)');
    console.log('   - Run this script again to refresh data');
    console.log('   - All fields including IV are available');
    console.log('   - No authentication required for NSE API');
    console.log('');

  } catch (error) {
    console.error('');
    console.error('❌ Error:', error.message);
    console.error('');
    console.error('Stack trace:');
    console.error(error.stack);
    console.error('');
    process.exit(1);
  }
}

// Run
main().catch(console.error);