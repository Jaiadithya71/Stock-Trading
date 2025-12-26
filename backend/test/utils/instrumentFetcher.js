// backend/test/utils/instrumentFetcher.js
// Download and filter OpenAPIScripMaster.json for NFO options

const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

class InstrumentFetcher {
  constructor(outputPath = path.join(__dirname, '../output')) {
    this.outputPath = outputPath;
    this.instrumentUrl = 'https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json';
    this.instrumentsFile = path.join(outputPath, 'instruments.json');
    this.logFile = path.join(outputPath, 'instrument_fetcher.log');
    
    // Ensure output directory exists
    if (!fs.existsSync(outputPath)) {
      fs.mkdirSync(outputPath, { recursive: true });
    }
  }

  log(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    console.log(message);
    fs.appendFileSync(this.logFile, logMessage);
  }

  /**
   * Download instrument file from Angel One
   */
  async downloadInstruments() {
    this.log('='.repeat(80));
    this.log('📥 DOWNLOADING INSTRUMENTS FILE');
    this.log('='.repeat(80));
    
    try {
      this.log(`Fetching from: ${this.instrumentUrl}`);
      
      const response = await fetch(this.instrumentUrl);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const instruments = await response.json();
      
      this.log(`✅ Downloaded ${instruments.length} instruments`);
      
      // Save to file
      fs.writeFileSync(this.instrumentsFile, JSON.stringify(instruments, null, 2));
      this.log(`💾 Saved to: ${this.instrumentsFile}`);
      
      return instruments;
      
    } catch (error) {
      this.log(`❌ Error downloading instruments: ${error.message}`);
      throw error;
    }
  }

  /**
   * Load instruments from local file
   */
  loadInstruments() {
    if (!fs.existsSync(this.instrumentsFile)) {
      this.log('⚠️  No cached instruments file found');
      return null;
    }
    
    try {
      this.log(`📂 Loading instruments from: ${this.instrumentsFile}`);
      
      const data = fs.readFileSync(this.instrumentsFile, 'utf8');
      
      // Check if file is empty
      if (!data || data.trim().length === 0) {
        this.log('⚠️  Instruments file is empty');
        return null;
      }
      
      // Parse JSON
      const instruments = JSON.parse(data);
      
      // Validate structure
      if (!Array.isArray(instruments)) {
        this.log('⚠️  Instruments file does not contain an array');
        return null;
      }
      
      if (instruments.length === 0) {
        this.log('⚠️  Instruments array is empty');
        return null;
      }
      
      this.log(`✅ Loaded ${instruments.length} instruments from cache`);
      return instruments;
      
    } catch (error) {
      this.log(`❌ Error loading cached instruments: ${error.message}`);
      this.log(`   File may be corrupted. Will re-download on next attempt.`);
      
      // Delete corrupted file
      try {
        fs.unlinkSync(this.instrumentsFile);
        this.log(`🗑️  Deleted corrupted instruments file`);
      } catch (unlinkError) {
        this.log(`⚠️  Could not delete corrupted file: ${unlinkError.message}`);
      }
      
      return null;
    }
  }

  /**
   * Get instruments (from cache or download)
   */
  async getInstruments(forceDownload = false) {
    if (!forceDownload) {
      const cached = this.loadInstruments();
      if (cached) {
        return cached;
      }
    }
    
    return await this.downloadInstruments();
  }

  /**
   * Filter instruments for NFO options of a specific symbol
   */
  filterNFOOptions(instruments, symbol = 'BANKNIFTY') {
    this.log('\n' + '='.repeat(80));
    this.log(`🔍 FILTERING NFO OPTIONS FOR ${symbol}`);
    this.log('='.repeat(80));
    
    // Validate input
    if (!instruments || !Array.isArray(instruments) || instruments.length === 0) {
      this.log('❌ Error: Invalid instruments data provided');
      this.log('   Expected: Array of instruments');
      this.log(`   Received: ${instruments === null ? 'null' : typeof instruments}`);
      throw new Error('Invalid instruments data. Cannot filter options.');
    }
    
    this.log(`📊 Total instruments to filter: ${instruments.length}`);
    
    // IMPORTANT: Use 'name' field, not 'symbol' field
    // symbol = "BANKNIFTY30DEC2566500PE" (full option symbol)
    // name = "BANKNIFTY" (underlying)
    const filtered = instruments.filter(inst => {
      return inst.exch_seg === 'NFO' &&
             inst.instrumenttype === 'OPTIDX' &&
             inst.name === symbol;
    });
    
    this.log(`✅ Found ${filtered.length} ${symbol} option contracts`);
    
    // Group by expiry
    const byExpiry = {};
    filtered.forEach(inst => {
      const expiry = inst.expiry;
      if (!byExpiry[expiry]) {
        byExpiry[expiry] = [];
      }
      byExpiry[expiry].push(inst);
    });
    
    // Sort expiries chronologically
    const sortedExpiries = Object.keys(byExpiry).sort((a, b) => {
      // Parse dates in format: "30DEC2025"
      const parseDate = (dateStr) => {
        const day = dateStr.substring(0, 2);
        const month = dateStr.substring(2, 5);
        const year = dateStr.substring(5, 9);
        const monthMap = {
          'JAN': '01', 'FEB': '02', 'MAR': '03', 'APR': '04',
          'MAY': '05', 'JUN': '06', 'JUL': '07', 'AUG': '08',
          'SEP': '09', 'OCT': '10', 'NOV': '11', 'DEC': '12'
        };
        return new Date(`${year}-${monthMap[month]}-${day}`);
      };
      
      return parseDate(a) - parseDate(b);
    });
    
    this.log(`\n📅 Available expiry dates (sorted chronologically):`);
    sortedExpiries.forEach((expiry, idx) => {
      const count = byExpiry[expiry].length;
      const isCurrent = idx === 0 ? ' ← CURRENT/NEAREST' : '';
      this.log(`   ${idx + 1}. ${expiry} - ${count} contracts${isCurrent}`);
    });
    
    return { filtered, byExpiry, sortedExpiries };
  }

  /**
   * Get options for a specific expiry and strike range
   */
  getOptionsForStrikeRange(instruments, expiry, atmStrike, strikesAbove = 5, strikesBelow = 5, strikeInterval = 100) {
    this.log('\n' + '='.repeat(80));
    this.log(`🎯 GETTING OPTIONS AROUND ATM`);
    this.log('='.repeat(80));
    this.log(`Expiry: ${expiry}`);
    this.log(`ATM Strike: ${atmStrike}`);
    this.log(`Range: ${strikesBelow} below, ${strikesAbove} above`);
    this.log(`Strike Interval: ${strikeInterval}`);
    
    // Calculate strike range
    const minStrike = atmStrike - (strikesBelow * strikeInterval);
    const maxStrike = atmStrike + (strikesAbove * strikeInterval);
    
    this.log(`Strike Range: ${minStrike} to ${maxStrike}`);
    
    // IMPORTANT: Strike prices in API are stored as (price * 100)
    // e.g., 51200 strike is stored as "5120000.000000"
    const minStrikeAPI = minStrike * 100;
    const maxStrikeAPI = maxStrike * 100;
    
    this.log(`Strike Range (API format): ${minStrikeAPI} to ${maxStrikeAPI}`);
    
    // Filter instruments
    const filtered = instruments.filter(inst => {
      if (inst.exch_seg !== 'NFO' || inst.instrumenttype !== 'OPTIDX' || inst.expiry !== expiry) {
        return false;
      }
      
      // Parse strike (it's stored as string with decimals)
      const instStrike = parseFloat(inst.strike);
      
      return instStrike >= minStrikeAPI && instStrike <= maxStrikeAPI;
    });
    
    this.log(`✅ Found ${filtered.length} matching contracts`);
    
    // Debug: Show sample contracts
    if (filtered.length > 0) {
      this.log(`\n📋 Sample contracts found:`);
      filtered.slice(0, 3).forEach(inst => {
        const strikeDisplay = (parseFloat(inst.strike) / 100).toFixed(0);
        this.log(`   ${inst.symbol} - Strike: ${strikeDisplay} (API: ${inst.strike})`);
      });
    }
    
    // Organize by strike and option type
    const optionChain = {};
    
    // Create strike slots
    for (let strike = minStrike; strike <= maxStrike; strike += strikeInterval) {
      optionChain[strike] = {
        strike: strike,
        isATM: strike === atmStrike,
        CE: null,
        PE: null
      };
    }
    
    // Fill in the contracts
    filtered.forEach(inst => {
      // Convert API strike back to normal (divide by 100)
      const instStrike = parseFloat(inst.strike);
      const strike = Math.round(instStrike / 100);
      const optionType = inst.symbol.endsWith('CE') ? 'CE' : 'PE';
      
      if (optionChain[strike]) {
        optionChain[strike][optionType] = {
          token: inst.token,
          symbol: inst.symbol,
          tradingSymbol: inst.tradingsymbol || inst.symbol,
          name: inst.name,
          lotSize: parseInt(inst.lotsize)
        };
      } else {
        // Log if we have a strike that doesn't fit in our range (shouldn't happen)
        this.log(`⚠️  Skipping strike ${strike} (not in range ${minStrike}-${maxStrike})`);
      }
    });
    
    // Convert to array and sort by strike
    const chainArray = Object.values(optionChain).sort((a, b) => b.strike - a.strike);
    
    this.log(`\n✅ Found ${chainArray.length} strikes in range`);
    this.log('\n' + '-'.repeat(80));
    this.log('Strike'.padEnd(10) + ' | ' + 'Type'.padEnd(6) + ' | ' + 'Call Token'.padEnd(12) + ' | ' + 'Put Token'.padEnd(12) + ' | ' + 'Symbol');
    this.log('-'.repeat(80));
    
    chainArray.forEach(row => {
      const atmMarker = row.isATM ? '🎯' : '  ';
      const ceToken = row.CE ? row.CE.token : 'N/A';
      const peToken = row.PE ? row.PE.token : 'N/A';
      const ceSymbol = row.CE ? row.CE.tradingSymbol : 'N/A';
      
      this.log(
        `${atmMarker} ${String(row.strike).padEnd(8)} | ` +
        `ATM?=${row.isATM ? 'YES' : 'NO '} | ` +
        `${String(ceToken).padEnd(12)} | ` +
        `${String(peToken).padEnd(12)} | ` +
        `${ceSymbol}`
      );
    });
    
    this.log('-'.repeat(80));
    
    return chainArray;
  }

  /**
   * Export tokens for WebSocket subscription
   */
  exportTokensForWebSocket(optionChain, optionType = 'BOTH') {
    const tokens = [];
    
    optionChain.forEach(row => {
      if ((optionType === 'BOTH' || optionType === 'CE') && row.CE) {
        tokens.push(row.CE.token);
      }
      if ((optionType === 'BOTH' || optionType === 'PE') && row.PE) {
        tokens.push(row.PE.token);
      }
    });
    
    this.log(`\n📊 Exported ${tokens.length} tokens for WebSocket (${optionType})`);
    
    return tokens;
  }

  /**
   * Generate summary report
   */
  generateReport(instruments, symbol, expiry, optionChain, tokens) {
    const reportFile = path.join(this.outputPath, 'instrument_report.txt');
    
    let report = '';
    report += '='.repeat(100) + '\n';
    report += 'INSTRUMENT ANALYSIS REPORT\n';
    report += '='.repeat(100) + '\n';
    report += `Generated: ${new Date().toISOString()}\n`;
    report += `Symbol: ${symbol}\n`;
    report += `Expiry: ${expiry}\n`;
    report += `Total Instruments: ${instruments.length}\n`;
    report += `Option Chain Strikes: ${optionChain.length}\n`;
    report += `WebSocket Tokens: ${tokens.length}\n`;
    report += '='.repeat(100) + '\n\n';
    
    report += 'OPTION CHAIN DETAILS\n';
    report += '-'.repeat(100) + '\n';
    report += 'Strike'.padEnd(10) + ' | ' + 'ATM?'.padEnd(6) + ' | ' + 'Call Token'.padEnd(12) + ' | ' + 'Put Token'.padEnd(12) + ' | ' + 'Call Symbol\n';
    report += '-'.repeat(100) + '\n';
    
    optionChain.forEach(row => {
      const atmMarker = row.isATM ? '🎯' : '  ';
      const ceToken = row.CE ? row.CE.token : 'N/A';
      const peToken = row.PE ? row.PE.token : 'N/A';
      const ceSymbol = row.CE ? row.CE.tradingSymbol : 'N/A';
      
      report += `${atmMarker} ${String(row.strike).padEnd(8)} | `;
      report += `${row.isATM ? 'YES' : 'NO '} | `;
      report += `${String(ceToken).padEnd(12)} | `;
      report += `${String(peToken).padEnd(12)} | `;
      report += `${ceSymbol}\n`;
    });
    
    report += '-'.repeat(100) + '\n\n';
    
    report += 'WEBSOCKET TOKENS (for subscription)\n';
    report += '-'.repeat(100) + '\n';
    report += `Total Tokens: ${tokens.length}\n`;
    report += `Tokens Array: ${JSON.stringify(tokens, null, 2)}\n`;
    report += '-'.repeat(100) + '\n';
    
    fs.writeFileSync(reportFile, report);
    this.log(`\n📄 Report saved to: ${reportFile}`);
    
    return reportFile;
  }
}

module.exports = InstrumentFetcher;