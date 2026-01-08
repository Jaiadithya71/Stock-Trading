// Test script to verify NSE-based PCR collection
// Run: node backend/test/testNSEPCR.js

const NSEApiFetcher = require('../services/nseApiFetcher');
const InstrumentFetcher = require('../services/instrumentFetcher');

async function testNSEPCR() {
  console.log('='.repeat(80));
  console.log('TESTING NSE-BASED PCR CALCULATION');
  console.log('='.repeat(80));

  const nseFetcher = new NSEApiFetcher();
  const instrumentFetcher = new InstrumentFetcher();

  try {
    // Step 1: Get expiry dates
    console.log('\n📅 Step 1: Getting expiry dates for BANKNIFTY...');
    const expiries = await instrumentFetcher.getExpiryDates('BANKNIFTY');

    if (!expiries || expiries.length === 0) {
      throw new Error('No expiry dates found');
    }

    console.log(`   Found ${expiries.length} expiries`);
    console.log(`   Nearest expiry: ${expiries[0]}`);
    console.log(`   All expiries: ${expiries.slice(0, 5).join(', ')}...`);

    // Step 2: Fetch option chain from NSE
    console.log('\n🌐 Step 2: Fetching NSE option chain...');
    const optionChain = await nseFetcher.getOptionChain('BANKNIFTY', expiries[0]);

    if (!optionChain || !optionChain.strikes) {
      throw new Error('Failed to fetch option chain');
    }

    console.log(`   Underlying Value: ${optionChain.underlyingValue}`);
    console.log(`   Timestamp: ${optionChain.timestamp}`);
    console.log(`   Strike Count: ${Object.keys(optionChain.strikes).length}`);

    // Step 3: Calculate PCR
    console.log('\n📊 Step 3: Calculating PCR from OI data...');

    let totalCallOI = 0;
    let totalPutOI = 0;
    let totalCallVolume = 0;
    let totalPutVolume = 0;

    Object.values(optionChain.strikes).forEach(strike => {
      if (strike.CE) {
        totalCallOI += strike.CE.openInterest || 0;
        totalCallVolume += strike.CE.totalTradedVolume || 0;
      }
      if (strike.PE) {
        totalPutOI += strike.PE.openInterest || 0;
        totalPutVolume += strike.PE.totalTradedVolume || 0;
      }
    });

    const pcrOI = totalCallOI > 0 ? totalPutOI / totalCallOI : 0;
    const pcrVolume = totalCallVolume > 0 ? totalPutVolume / totalCallVolume : 0;

    console.log('\n' + '='.repeat(80));
    console.log('PCR CALCULATION RESULTS');
    console.log('='.repeat(80));
    console.log(`   📈 Total Call OI:     ${totalCallOI.toLocaleString()}`);
    console.log(`   📉 Total Put OI:      ${totalPutOI.toLocaleString()}`);
    console.log(`   📊 PCR (OI-based):    ${pcrOI.toFixed(4)}`);
    console.log('');
    console.log(`   📈 Total Call Volume: ${totalCallVolume.toLocaleString()}`);
    console.log(`   📉 Total Put Volume:  ${totalPutVolume.toLocaleString()}`);
    console.log(`   📊 PCR (Vol-based):   ${pcrVolume.toFixed(4)}`);
    console.log('');

    // Determine sentiment
    let sentiment;
    if (pcrOI > 1.2) {
      sentiment = 'Selling (Bearish)';
    } else if (pcrOI < 0.8) {
      sentiment = 'Buying (Bullish)';
    } else {
      sentiment = 'Neutral';
    }

    console.log(`   🎯 Sentiment:         ${sentiment}`);
    console.log('='.repeat(80));

    // Show sample strike data
    console.log('\n📋 Sample Strike Data (ATM region):');
    const strikes = Object.keys(optionChain.strikes).map(Number).sort((a, b) => a - b);
    const atmIndex = strikes.findIndex(s => s >= optionChain.underlyingValue);
    const sampleStrikes = strikes.slice(Math.max(0, atmIndex - 3), atmIndex + 4);

    console.log('-'.repeat(80));
    console.log('Strike    | Call OI       | Call Vol     | Put OI        | Put Vol');
    console.log('-'.repeat(80));

    sampleStrikes.forEach(strike => {
      const data = optionChain.strikes[strike];
      const callOI = data.CE?.openInterest || 0;
      const callVol = data.CE?.totalTradedVolume || 0;
      const putOI = data.PE?.openInterest || 0;
      const putVol = data.PE?.totalTradedVolume || 0;
      const isATM = strike === sampleStrikes[Math.floor(sampleStrikes.length / 2)] ? ' (ATM)' : '';

      console.log(
        `${strike.toString().padEnd(9)} | ` +
        `${callOI.toLocaleString().padStart(12)} | ` +
        `${callVol.toLocaleString().padStart(12)} | ` +
        `${putOI.toLocaleString().padStart(12)} | ` +
        `${putVol.toLocaleString()}${isATM}`
      );
    });
    console.log('-'.repeat(80));

    console.log('\n✅ NSE-based PCR calculation test completed successfully!');

  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    console.error(error.stack);
  }
}

testNSEPCR();
