// backend/test/utils/optionChainDisplay.js
// Beautiful terminal display for option chain (NSE-style)

const chalk = require('chalk');

class OptionChainDisplay {
  constructor() {
    // ANSI colors
    this.colors = {
      green: text => `\x1b[32m${text}\x1b[0m`,
      red: text => `\x1b[31m${text}\x1b[0m`,
      yellow: text => `\x1b[33m${text}\x1b[0m`,
      blue: text => `\x1b[34m${text}\x1b[0m`,
      cyan: text => `\x1b[36m${text}\x1b[0m`,
      magenta: text => `\x1b[35m${text}\x1b[0m`,
      bold: text => `\x1b[1m${text}\x1b[0m`,
      bgGreen: text => `\x1b[42m\x1b[30m${text}\x1b[0m`,
      bgRed: text => `\x1b[41m\x1b[37m${text}\x1b[0m`,
      bgYellow: text => `\x1b[43m\x1b[30m${text}\x1b[0m`
    };
  }

  /**
   * Format number with proper padding
   */
  pad(value, width, align = 'right') {
    const str = String(value);
    if (align === 'right') {
      return str.padStart(width, ' ');
    } else if (align === 'center') {
      const leftPad = Math.floor((width - str.length) / 2);
      const rightPad = width - str.length - leftPad;
      return ' '.repeat(leftPad) + str + ' '.repeat(rightPad);
    } else {
      return str.padEnd(width, ' ');
    }
  }

  /**
   * Format number with K/M suffix
   */
  formatNumber(num) {
    if (num === 0 || num === null || num === undefined) return '-';
    if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toFixed(0);
  }

  /**
   * Format price
   */
  formatPrice(price) {
    if (price === 0 || price === null || price === undefined) return '-';
    return price.toFixed(2);
  }

  /**
   * Format change with color
   */
  formatChange(change) {
    if (change === 0 || change === null || change === undefined) return this.pad('-', 8);
    const formatted = change.toFixed(2);
    if (change > 0) {
      return this.colors.green(this.pad('+' + formatted, 8));
    } else {
      return this.colors.red(this.pad(formatted, 8));
    }
  }

  /**
   * Display header with spot price
   */
  displayHeader(symbol, spotPrice, atmStrike, expiry) {
    console.clear();
    console.log('\n');
    console.log(this.colors.bold('═'.repeat(180)));
    console.log(this.colors.bold(this.pad('OPTION CHAIN - LIVE STREAMING', 180, 'center')));
    console.log(this.colors.bold('═'.repeat(180)));
    console.log('');
    console.log(this.colors.cyan(`  Underlying: ${this.colors.bold(symbol)}   Spot: ${this.colors.bold('₹' + spotPrice.toFixed(2))}   ATM: ${this.colors.bold(atmStrike)}   Expiry: ${this.colors.bold(expiry)}`));
    console.log('');
  }

  /**
   * Display column headers
   */
  displayColumnHeaders() {
    const header1 = [
      this.pad('', 120, 'center') + '|' + this.pad('CALLS', 59, 'center'),
      this.pad('PUTS', 59, 'center')
    ].join('|');

    const header2 = [
      // CALLS columns
      this.pad('OI', 10),
      this.pad('CHG OI', 10),
      this.pad('VOLUME', 10),
      this.pad('IV', 8),
      this.pad('LTP', 10),
      this.pad('CHNG', 8),
      this.pad('BID QTY', 10),
      this.pad('BID', 10),
      this.pad('ASK', 10),
      this.pad('ASK QTY', 10),
      this.pad('STRIKE', 10, 'center'),
      // PUTS columns
      this.pad('BID QTY', 10),
      this.pad('BID', 10),
      this.pad('ASK', 10),
      this.pad('ASK QTY', 10),
      this.pad('CHNG', 8),
      this.pad('LTP', 10),
      this.pad('IV', 8),
      this.pad('VOLUME', 10),
      this.pad('CHG OI', 10),
      this.pad('OI', 10)
    ];

    console.log(this.colors.bold(this.colors.bgYellow(header1)));
    console.log(this.colors.bold('─'.repeat(180)));
    console.log(this.colors.bold(header2.join('│')));
    console.log(this.colors.bold('─'.repeat(180)));
  }

  /**
   * Display a single strike row
   */
  displayStrikeRow(strike, callData, putData, atmStrike) {
    const isATM = strike === atmStrike;

    // Format CALL data
    const callOI = this.pad(this.formatNumber(callData?.oi), 10);
    const callOIChange = this.pad(this.formatNumber(callData?.oiChange), 10);
    const callVolume = this.pad(this.formatNumber(callData?.volume), 10);
    const callIV = this.pad(callData?.iv ? callData.iv.toFixed(2) : '-', 8);  // Show IV from NSE
    const callLTP = this.pad(this.formatPrice(callData?.ltp), 10);
    const callChange = this.formatChange(callData?.change);
    const callBidQty = this.pad(this.formatNumber(callData?.bidQty), 10);
    const callBid = this.pad(this.formatPrice(callData?.bidPrice), 10);
    const callAsk = this.pad(this.formatPrice(callData?.askPrice), 10);
    const callAskQty = this.pad(this.formatNumber(callData?.askQty), 10);

    // Format PUT data
    const putBidQty = this.pad(this.formatNumber(putData?.bidQty), 10);
    const putBid = this.pad(this.formatPrice(putData?.bidPrice), 10);
    const putAsk = this.pad(this.formatPrice(putData?.askPrice), 10);
    const putAskQty = this.pad(this.formatNumber(putData?.askQty), 10);
    const putChange = this.formatChange(putData?.change);
    const putLTP = this.pad(this.formatPrice(putData?.ltp), 10);
    const putIV = this.pad(putData?.iv ? putData.iv.toFixed(2) : '-', 8);  // Show IV from NSE
    const putVolume = this.pad(this.formatNumber(putData?.volume), 10);
    const putOIChange = this.pad(this.formatNumber(putData?.oiChange), 10);
    const putOI = this.pad(this.formatNumber(putData?.oi), 10);

    // Strike column (highlighted if ATM)
    let strikeCol = this.pad(strike.toLocaleString(), 10, 'center');
    if (isATM) {
      strikeCol = this.colors.bgGreen(strikeCol);
    }

    const row = [
      callOI,
      callOIChange,
      callVolume,
      callIV,
      callLTP,
      callChange,
      callBidQty,
      callBid,
      callAsk,
      callAskQty,
      strikeCol,
      putBidQty,
      putBid,
      putAsk,
      putAskQty,
      putChange,
      putLTP,
      putIV,
      putVolume,
      putOIChange,
      putOI
    ];

    console.log(row.join('│'));
  }

  /**
   * Display footer
   */
  displayFooter(tickCount, lastUpdate) {
    console.log(this.colors.bold('─'.repeat(180)));
    console.log('');
    console.log(this.colors.cyan(`  Total Ticks: ${this.colors.bold(tickCount)}   Last Update: ${this.colors.bold(lastUpdate)}`));
    console.log('');
    console.log(this.colors.yellow('  Legend: ') + this.colors.green('Green = Positive') + '  ' + this.colors.red('Red = Negative') + '  ' + this.colors.bgGreen(' ATM Strike '));
    console.log('');
  }

  /**
   * Display complete option chain
   */
  displayOptionChain(optionChain, tickData, spotPrice, atmStrike, expiry, tickCount) {
    // Clear and show header
    this.displayHeader(optionChain.symbol || 'BANKNIFTY', spotPrice, atmStrike, expiry);
    
    // Show column headers
    this.displayColumnHeaders();

    // Display each strike
    const strikes = Object.keys(optionChain.strikes).map(Number).sort((a, b) => b - a);
    
    strikes.forEach(strike => {
      const strikeData = optionChain.strikes[strike];
      
      // Get latest tick data
      const callToken = strikeData.CE?.token;
      const putToken = strikeData.PE?.token;
      
      const callData = callToken ? tickData[callToken]?.latestTick : null;
      const putData = putToken ? tickData[putToken]?.latestTick : null;
      
      this.displayStrikeRow(strike, callData, putData, atmStrike);
    });

    // Show footer
    const lastUpdate = new Date().toLocaleTimeString('en-IN');
    this.displayFooter(tickCount, lastUpdate);
  }

  /**
   * Display summary statistics
   */
  displaySummary(tickData, optionChain) {
    console.log(this.colors.bold('═'.repeat(180)));
    console.log(this.colors.bold(this.pad('SUMMARY STATISTICS', 180, 'center')));
    console.log(this.colors.bold('═'.repeat(180)));
    console.log('');

    let totalCallOI = 0, totalPutOI = 0;
    let totalCallVolume = 0, totalPutVolume = 0;
    let totalCallOIChange = 0, totalPutOIChange = 0;

    Object.keys(optionChain.strikes).forEach(strike => {
      const strikeData = optionChain.strikes[strike];
      
      if (strikeData.CE?.token) {
        const callTick = tickData[strikeData.CE.token]?.latestTick;
        if (callTick) {
          totalCallOI += callTick.oi || 0;
          totalCallVolume += callTick.volume || 0;
          totalCallOIChange += callTick.oiChange || 0;
        }
      }
      
      if (strikeData.PE?.token) {
        const putTick = tickData[strikeData.PE.token]?.latestTick;
        if (putTick) {
          totalPutOI += putTick.oi || 0;
          totalPutVolume += putTick.volume || 0;
          totalPutOIChange += putTick.oiChange || 0;
        }
      }
    });

    const pcr = totalCallOI > 0 ? (totalPutOI / totalCallOI).toFixed(2) : 'N/A';

    console.log(this.colors.cyan('  CALLS:'));
    console.log(`    Total OI: ${this.colors.bold(this.formatNumber(totalCallOI))}`);
    console.log(`    Total Volume: ${this.colors.bold(this.formatNumber(totalCallVolume))}`);
    console.log(`    OI Change: ${totalCallOIChange >= 0 ? this.colors.green('+' + this.formatNumber(totalCallOIChange)) : this.colors.red(this.formatNumber(totalCallOIChange))}`);
    console.log('');
    
    console.log(this.colors.magenta('  PUTS:'));
    console.log(`    Total OI: ${this.colors.bold(this.formatNumber(totalPutOI))}`);
    console.log(`    Total Volume: ${this.colors.bold(this.formatNumber(totalPutVolume))}`);
    console.log(`    OI Change: ${totalPutOIChange >= 0 ? this.colors.green('+' + this.formatNumber(totalPutOIChange)) : this.colors.red(this.formatNumber(totalPutOIChange))}`);
    console.log('');
    
    console.log(this.colors.yellow(`  Put-Call Ratio (PCR): ${this.colors.bold(pcr)}`));
    console.log('');
  }
}

module.exports = OptionChainDisplay;