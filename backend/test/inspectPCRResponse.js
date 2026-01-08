// Test script to inspect the raw putCallRatio API response
// Run: node backend/test/inspectPCRResponse.js

const path = require('path');
const fs = require('fs');

// Load credentials and services
const { loadCredentials } = require('../services/credentialService');
const { generateTOTP } = require('../services/authService');
const { SmartAPI } = require('smartapi-javascript');
const { CREDENTIALS_FILE } = require('../config/constants');

async function inspectPCRResponse() {
  console.log('='.repeat(80));
  console.log('INSPECTING putCallRatio API RESPONSE');
  console.log('='.repeat(80));

  try {
    // Get first available username from credentials file
    if (!fs.existsSync(CREDENTIALS_FILE)) {
      throw new Error('Credentials file not found');
    }

    const allCreds = JSON.parse(fs.readFileSync(CREDENTIALS_FILE, 'utf8'));
    const usernames = Object.keys(allCreds);

    if (usernames.length === 0) {
      throw new Error('No credentials found');
    }

    const username = usernames[0];
    const creds = loadCredentials(username);

    console.log(`\nUsing credentials for: ${username}`);

    // Generate TOTP
    const totp = generateTOTP(creds.totp_token);
    console.log(`TOTP generated: ${totp}`);

    // Create SmartAPI instance
    const smartAPI = new SmartAPI({
      api_key: creds.api_key,
      debug: false
    });

    // Authenticate
    console.log('\nAuthenticating...');
    const session = await smartAPI.generateSession(creds.client_id, creds.password, totp);

    if (!session.status) {
      throw new Error(`Authentication failed: ${session.message}`);
    }

    console.log('Authentication successful!');

    // Call putCallRatio API
    console.log('\nCalling putCallRatio API...');
    const response = await smartAPI.putCallRatio();

    console.log('\n' + '='.repeat(80));
    console.log('RAW API RESPONSE');
    console.log('='.repeat(80));
    console.log(JSON.stringify(response, null, 2));

    if (response && response.data) {
      console.log('\n' + '='.repeat(80));
      console.log('ANALYZING RESPONSE DATA');
      console.log('='.repeat(80));

      console.log(`\nTotal items in response: ${response.data.length}`);

      // Group by type (FUT vs Options)
      const futures = response.data.filter(item =>
        (item.tradingSymbol || '').includes('FUT')
      );
      const options = response.data.filter(item =>
        (item.tradingSymbol || '').includes('CE') ||
        (item.tradingSymbol || '').includes('PE')
      );
      const other = response.data.filter(item => {
        const ts = item.tradingSymbol || '';
        return !ts.includes('FUT') && !ts.includes('CE') && !ts.includes('PE');
      });

      console.log(`\nFutures contracts: ${futures.length}`);
      console.log(`Options contracts: ${options.length}`);
      console.log(`Other: ${other.length}`);

      // Show BANKNIFTY related items
      console.log('\n' + '-'.repeat(80));
      console.log('BANKNIFTY RELATED ITEMS:');
      console.log('-'.repeat(80));

      const bankniftyItems = response.data.filter(item =>
        (item.tradingSymbol || '').includes('BANKNIFTY')
      );

      if (bankniftyItems.length === 0) {
        console.log('No BANKNIFTY items found!');
      } else {
        bankniftyItems.forEach((item, idx) => {
          console.log(`\n[${idx + 1}] ${item.tradingSymbol}`);
          console.log(`    PCR: ${item.pcr}`);
          console.log(`    All properties: ${JSON.stringify(item)}`);
        });
      }

      // Show all unique symbols
      console.log('\n' + '-'.repeat(80));
      console.log('ALL UNIQUE TRADING SYMBOLS:');
      console.log('-'.repeat(80));

      response.data.forEach((item, idx) => {
        console.log(`[${idx + 1}] ${item.tradingSymbol} - PCR: ${item.pcr}`);
      });
    }

  } catch (error) {
    console.error(`\nError: ${error.message}`);
    console.error(error.stack);
  }
}

inspectPCRResponse();
