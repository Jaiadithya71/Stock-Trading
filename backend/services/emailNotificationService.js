// ============================================================================
// FILE: backend/services/emailNotificationService.js
// Automated Market Close Daily Performance & Portfolio Executive Summary
// Dispatches structured P&L reports to jaiadithya2020@gmail.com at Market Close
// ============================================================================

const fs = require('fs');
const path = require('path');
const tls = require('tls');
const net = require('net');
const PaperTradingService = require('./paperTradingService');
const paperTrading = new PaperTradingService();
const marketCalendar = require('../utils/marketCalendar');

const DATA_DIR = path.join(__dirname, '../data');
const SETTINGS_FILE = path.join(DATA_DIR, 'risk_settings.json');
const REPORTS_DIR = path.join(DATA_DIR, 'email_reports');

class EmailNotificationService {
  constructor() {
    if (!fs.existsSync(REPORTS_DIR)) {
      try { fs.mkdirSync(REPORTS_DIR, { recursive: true }); } catch (e) {}
    }
    this.defaultRecipient = 'jaiadithya2020@gmail.com';
    this.lastSentDate = null;
  }

  getSettings() {
    let settings = {};
    if (fs.existsSync(SETTINGS_FILE)) {
      try {
        settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
      } catch (e) {
        settings = {};
      }
    }

    const emailConfig = settings.emailNotification || {};
    return {
      enabled: emailConfig.enabled !== false,
      recipientEmail: emailConfig.recipientEmail || process.env.EMAIL_TO || this.defaultRecipient,
      sendAtMarketClose: emailConfig.sendAtMarketClose !== false,
      smtpHost: emailConfig.smtpHost || process.env.SMTP_HOST || 'smtp.gmail.com',
      smtpPort: Number(emailConfig.smtpPort || process.env.SMTP_PORT || 465),
      smtpSecure: emailConfig.smtpSecure !== undefined ? emailConfig.smtpSecure : true,
      smtpUser: emailConfig.smtpUser || process.env.EMAIL_USER || process.env.SMTP_USER || '',
      smtpPass: emailConfig.smtpPass || process.env.EMAIL_PASS || process.env.SMTP_PASS || '',
      senderName: emailConfig.senderName || 'Google Antigravity Quant Terminal'
    };
  }

  saveEmailSettings(newConfig = {}) {
    let settings = {};
    if (fs.existsSync(SETTINGS_FILE)) {
      try {
        settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
      } catch (e) { settings = {}; }
    }

    settings.emailNotification = {
      ...this.getSettings(),
      ...newConfig
    };

    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8');
    return settings.emailNotification;
  }

  /**
   * Aggregate all trading activity from today (active trade history + any archived today)
   */
  compileDayData(dateString = null) {
    const todayStr = dateString || marketCalendar.getDateKeyIST();
    const portfolio = paperTrading.getPortfolioSummary();

    // 1. Gather closed trades from active session
    let allClosedToday = (portfolio.tradeHistory || []).filter(t => {
      const exitTime = t.exitTimestamp || t.timestamp;
      return exitTime && exitTime.includes(todayStr);
    });

    // 2. Also inspect any archived trade files from today to ensure complete daily reporting
    try {
      const files = fs.readdirSync(DATA_DIR);
      for (const file of files) {
        if (file.startsWith(`paper_archive_${todayStr}`) && file.endsWith('.json')) {
          try {
            const raw = fs.readFileSync(path.join(DATA_DIR, file), 'utf8');
            const archive = JSON.parse(raw);
            if (Array.isArray(archive.tradeHistory)) {
              archive.tradeHistory.forEach(archivedTrade => {
                if (!allClosedToday.some(t => t.id === archivedTrade.id)) {
                  allClosedToday.push(archivedTrade);
                }
              });
            }
          } catch (err) {}
        }
      }
    } catch (e) {}

    // Sort chronologically by exit time
    allClosedToday.sort((a, b) => new Date(a.exitTimestamp || a.timestamp) - new Date(b.exitTimestamp || b.timestamp));

    // Performance Calculations
    const wins = allClosedToday.filter(t => (t.pnl || 0) > 0);
    const losses = allClosedToday.filter(t => (t.pnl || 0) < 0);
    const grossProfit = wins.reduce((sum, t) => sum + t.pnl, 0);
    const grossLoss = Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0));
    const netRealizedPnL = parseFloat((grossProfit - grossLoss).toFixed(2));
    const winRatePct = allClosedToday.length > 0 ? parseFloat(((wins.length / allClosedToday.length) * 100).toFixed(1)) : 0;
    const profitFactor = grossLoss > 0 ? parseFloat((grossProfit / grossLoss).toFixed(2)) : (grossProfit > 0 ? 'Infinite' : '0.00');

    // Swing / Positional Holdings carried overnight
    const openPositions = portfolio.positions || [];
    const swingHoldings = openPositions.filter(p => p.holdingType === 'SWING_POSITIONAL');
    const intradayRemaining = openPositions.filter(p => p.holdingType !== 'SWING_POSITIONAL');
    const totalUnrealizedPnL = parseFloat(openPositions.reduce((sum, p) => sum + (p.unrealizedPnL || 0), 0).toFixed(2));
    const totalDayNetPnL = parseFloat((netRealizedPnL + totalUnrealizedPnL).toFixed(2));

    const totalEquity = parseFloat((portfolio.currentBalance + portfolio.totalMarginUsed + totalUnrealizedPnL).toFixed(2));

    return {
      date: todayStr,
      generatedAt: new Date().toISOString(),
      summary: {
        netRealizedPnL,
        totalUnrealizedPnL,
        totalDayNetPnL,
        totalTrades: allClosedToday.length,
        winningTrades: wins.length,
        losingTrades: losses.length,
        winRatePct,
        profitFactor,
        grossProfit: parseFloat(grossProfit.toFixed(2)),
        grossLoss: parseFloat(grossLoss.toFixed(2)),
        endingCashBalance: portfolio.currentBalance,
        totalMarginBlocked: portfolio.totalMarginUsed,
        totalEquity
      },
      closedTrades: allClosedToday,
      openSwingPositions: swingHoldings,
      openIntradayPositions: intradayRemaining
    };
  }

  generateHtmlReport(data) {
    const isProfitable = data.summary.totalDayNetPnL >= 0;
    const pnlColor = isProfitable ? '#00d084' : '#ff4757';
    const pnlSign = isProfitable ? '+' : '';

    const closedTradesRows = data.closedTrades.length > 0
      ? data.closedTrades.map((t, idx) => {
          const tradeProfitable = (t.pnl || 0) >= 0;
          const color = tradeProfitable ? '#00d084' : '#ff4757';
          const sign = tradeProfitable ? '+' : '';
          const exitTimeIST = t.exitTimestamp ? new Date(t.exitTimestamp).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'N/A';
          return `
            <tr style="border-bottom: 1px solid #2a2e39;">
              <td style="padding: 10px 12px; font-weight: bold; color: #f0f3f6;">${t.symbol}</td>
              <td style="padding: 10px 12px; color: ${t.action === 'BUY' ? '#00d084' : '#ff4757'}; font-weight: 600;">${t.action}</td>
              <td style="padding: 10px 12px; color: #a0aec0;">${t.quantity}</td>
              <td style="padding: 10px 12px; color: #cbd5e0;">₹${Number(t.entryPrice).toFixed(2)}</td>
              <td style="padding: 10px 12px; color: #cbd5e0;">₹${Number(t.exitPrice).toFixed(2)}</td>
              <td style="padding: 10px 12px; font-weight: bold; color: ${color};">${sign}₹${Number(t.pnl).toFixed(2)} (${sign}${t.pnlPct || 0}%)</td>
              <td style="padding: 10px 12px;"><span style="background: rgba(255,255,255,0.06); color: #cbd5e0; padding: 3px 8px; border-radius: 4px; font-size: 11px;">${t.exitReason || 'AUTO'}</span></td>
              <td style="padding: 10px 12px; color: #718096; font-size: 12px;">${exitTimeIST}</td>
            </tr>
            <tr style="border-bottom: 1px solid #1e222d;">
              <td colspan="8" style="padding: 4px 12px 10px; color: #8892b0; font-size: 11px; font-style: italic;">
                💡 <strong>Rationale:</strong> ${t.rationale || 'Breakout momentum setup with confluence.'}
              </td>
            </tr>
          `;
        }).join('')
      : `<tr><td colspan="8" style="padding: 20px; text-align: center; color: #718096;">No trades executed or closed in this session.</td></tr>`;

    const swingRows = data.openSwingPositions.length > 0
      ? data.openSwingPositions.map(p => {
          const upnl = p.unrealizedPnL || 0;
          const uColor = upnl >= 0 ? '#00d084' : '#ff4757';
          const uSign = upnl >= 0 ? '+' : '';
          return `
            <tr style="border-bottom: 1px solid #2a2e39;">
              <td style="padding: 10px 12px; font-weight: bold; color: #38bdf8;">${p.symbol}</td>
              <td style="padding: 10px 12px; color: ${p.action === 'BUY' ? '#00d084' : '#ff4757'}; font-weight: 600;">${p.action}</td>
              <td style="padding: 10px 12px; color: #a0aec0;">${p.quantity}</td>
              <td style="padding: 10px 12px; color: #cbd5e0;">₹${Number(p.entryPrice).toFixed(2)}</td>
              <td style="padding: 10px 12px; color: #cbd5e0;">₹${Number(p.currentPrice || p.entryPrice).toFixed(2)}</td>
              <td style="padding: 10px 12px; color: #fbbf24; font-weight: 600;">₹${Number(p.stopLoss).toFixed(2)}</td>
              <td style="padding: 10px 12px; color: #a78bfa; font-weight: 600;">₹${Number(p.target).toFixed(2)} (+30%)</td>
              <td style="padding: 10px 12px; font-weight: bold; color: ${uColor};">${uSign}₹${Number(upnl).toFixed(2)}</td>
            </tr>
          `;
        }).join('')
      : `<tr><td colspan="8" style="padding: 16px; text-align: center; color: #718096;">No positional swing trades currently held overnight.</td></tr>`;

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Market Close Executive Summary - ${data.date}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0f1318; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #d1d4dc;">
  <div style="max-width: 820px; margin: 24px auto; background-color: #131722; border: 1px solid #2a2e39; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
    
    <!-- Top Header Banner -->
    <div style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding: 28px 32px; border-bottom: 2px solid #2962ff;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <span style="background: #2962ff; color: #ffffff; font-size: 11px; font-weight: bold; text-transform: uppercase; padding: 4px 10px; border-radius: 4px; letter-spacing: 0.5px;">
          NSE Daily Market Close Report
        </span>
        <span style="color: #94a3b8; font-size: 12px;">Session Date: <strong>${data.date}</strong></span>
      </div>
      <h1 style="margin: 6px 0 4px; font-size: 24px; color: #ffffff; font-weight: 700;">Daily Trading & Portfolio Summary</h1>
      <p style="margin: 0; color: #94a3b8; font-size: 14px;">Automated executive telemetry dispatched to <strong style="color: #38bdf8;">${this.defaultRecipient}</strong></p>
    </div>

    <!-- Executive KPI Scorecard Grid -->
    <div style="padding: 24px 32px; background: #161b26; border-bottom: 1px solid #2a2e39;">
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px;">
        
        <div style="background: #1e2433; padding: 16px; border-radius: 8px; border: 1px solid #2a3142;">
          <div style="font-size: 11px; color: #8892b0; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">Net Total Day P&L</div>
          <div style="font-size: 24px; font-weight: bold; color: ${pnlColor};">${pnlSign}₹${data.summary.totalDayNetPnL.toLocaleString('en-IN')}</div>
          <div style="font-size: 11px; color: #718096; margin-top: 4px;">Realized: ₹${data.summary.netRealizedPnL} | Unrealized: ₹${data.summary.totalUnrealizedPnL}</div>
        </div>

        <div style="background: #1e2433; padding: 16px; border-radius: 8px; border: 1px solid #2a3142;">
          <div style="font-size: 11px; color: #8892b0; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">Win Rate & Record</div>
          <div style="font-size: 24px; font-weight: bold; color: #f0f3f6;">${data.summary.winRatePct}%</div>
          <div style="font-size: 11px; color: #718096; margin-top: 4px;">${data.summary.winningTrades}W / ${data.summary.losingTrades}L (${data.summary.totalTrades} Total)</div>
        </div>

        <div style="background: #1e2433; padding: 16px; border-radius: 8px; border: 1px solid #2a3142;">
          <div style="font-size: 11px; color: #8892b0; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">Total Portfolio Equity</div>
          <div style="font-size: 24px; font-weight: bold; color: #38bdf8;">₹${data.summary.totalEquity.toLocaleString('en-IN')}</div>
          <div style="font-size: 11px; color: #718096; margin-top: 4px;">Cash: ₹${data.summary.endingCashBalance.toLocaleString('en-IN')}</div>
        </div>

        <div style="background: #1e2433; padding: 16px; border-radius: 8px; border: 1px solid #2a3142;">
          <div style="font-size: 11px; color: #8892b0; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">Overnight Swing Trades</div>
          <div style="font-size: 24px; font-weight: bold; color: #a78bfa;">${data.openSwingPositions.length}</div>
          <div style="font-size: 11px; color: #718096; margin-top: 4px;">Carried with 20-EMA Trailing Stop</div>
        </div>

      </div>
    </div>

    <!-- Closed Trades Table Section -->
    <div style="padding: 28px 32px 16px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
        <h2 style="margin: 0; font-size: 17px; color: #ffffff; font-weight: 600;">⚡ Closed Trades Ledger (Today)</h2>
        <span style="font-size: 12px; color: #8892b0;">${data.closedTrades.length} Completed Trades</span>
      </div>

      <div style="overflow-x: auto; background: #161b26; border: 1px solid #2a2e39; border-radius: 8px;">
        <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
          <thead>
            <tr style="background: #1a202c; color: #8892b0; font-size: 11px; text-transform: uppercase; border-bottom: 1px solid #2a2e39;">
              <th style="padding: 10px 12px;">Symbol</th>
              <th style="padding: 10px 12px;">Side</th>
              <th style="padding: 10px 12px;">Qty</th>
              <th style="padding: 10px 12px;">Entry</th>
              <th style="padding: 10px 12px;">Exit</th>
              <th style="padding: 10px 12px;">Realized P&L</th>
              <th style="padding: 10px 12px;">Trigger</th>
              <th style="padding: 10px 12px;">Exit Time</th>
            </tr>
          </thead>
          <tbody>
            ${closedTradesRows}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Overnight Swing Positions Section -->
    <div style="padding: 16px 32px 28px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
        <h2 style="margin: 0; font-size: 17px; color: #ffffff; font-weight: 600;">🌙 Multi-Week Positional Holdings (Carried Overnight)</h2>
        <span style="font-size: 12px; color: #38bdf8;">Protected from EOD Liquidation (30% Target)</span>
      </div>

      <div style="overflow-x: auto; background: #161b26; border: 1px solid #2a2e39; border-radius: 8px;">
        <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
          <thead>
            <tr style="background: #1a202c; color: #8892b0; font-size: 11px; text-transform: uppercase; border-bottom: 1px solid #2a2e39;">
              <th style="padding: 10px 12px;">Symbol</th>
              <th style="padding: 10px 12px;">Side</th>
              <th style="padding: 10px 12px;">Qty</th>
              <th style="padding: 10px 12px;">Entry</th>
              <th style="padding: 10px 12px;">LTP</th>
              <th style="padding: 10px 12px;">Trailing SL</th>
              <th style="padding: 10px 12px;">Target (30%)</th>
              <th style="padding: 10px 12px;">Floating P&L</th>
            </tr>
          </thead>
          <tbody>
            ${swingRows}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Strategy Outlook & Risk Compliance Footer -->
    <div style="background: #161b26; padding: 20px 32px; border-top: 1px solid #2a2e39; font-size: 12px; color: #8892b0; line-height: 1.6;">
      <div style="margin-bottom: 8px;">
        🛡️ <strong>Risk & Capital Guardrails:</strong> ₹5,000 Daily Circuit Breaker Active | 5 Concurrent Slot Capacity | Strict Breakeven Trailing on Swing Runners.
      </div>
      <div>
        📈 <strong>Next Session Outlook:</strong> Monitoring Stage-2 breakouts above daily 20-EMA. High-momentum runners will automatically be promoted to swing positions with breakeven stops locked.
      </div>
    </div>

    <!-- Terminal Signature -->
    <div style="background: #0f1318; padding: 14px 32px; text-align: center; font-size: 11px; color: #4a5568; border-top: 1px solid #1e222d;">
      Google DeepMind Antigravity Quant Command Center • Automated End-of-Day Dispatch • All rights reserved.
    </div>

  </div>
</body>
</html>
    `;
  }

  generateTextReport(data) {
    const isProfitable = data.summary.totalDayNetPnL >= 0;
    const sign = isProfitable ? '+' : '';
    let text = `=========================================================\n`;
    text += `  QUANT TRADING TERMINAL - DAILY MARKET CLOSE SUMMARY\n`;
    text += `  Date: ${data.date} | Recipient: ${this.defaultRecipient}\n`;
    text += `=========================================================\n\n`;

    text += `EXECUTIVE KPI SUMMARY:\n`;
    text += `---------------------------------------------------------\n`;
    text += `• Net Total Day P&L:   ${sign}₹${data.summary.totalDayNetPnL}\n`;
    text += `• Realized P&L:        ₹${data.summary.netRealizedPnL}\n`;
    text += `• Unrealized P&L:      ₹${data.summary.totalUnrealizedPnL}\n`;
    text += `• Win Rate:            ${data.summary.winRatePct}% (${data.summary.winningTrades}W / ${data.summary.losingTrades}L)\n`;
    text += `• Total Closed Trades: ${data.summary.totalTrades}\n`;
    text += `• Ending Cash Balance: ₹${data.summary.endingCashBalance}\n`;
    text += `• Total Equity:        ₹${data.summary.totalEquity}\n`;
    text += `• Overnight Swings:    ${data.openSwingPositions.length} positions carried\n\n`;

    text += `CLOSED TRADES TODAY (${data.closedTrades.length}):\n`;
    text += `---------------------------------------------------------\n`;
    data.closedTrades.forEach((t, i) => {
      text += `${i + 1}. ${t.symbol} | ${t.action} ${t.quantity} shares | Entry: ₹${t.entryPrice} -> Exit: ₹${t.exitPrice} | P&L: ₹${t.pnl} (${t.pnlPct}%) | Reason: ${t.exitReason}\n`;
      if (t.rationale) text += `   Rationale: ${t.rationale}\n`;
    });

    if (data.openSwingPositions.length > 0) {
      text += `\nOVERNIGHT SWING POSITIONS (${data.openSwingPositions.length}):\n`;
      text += `---------------------------------------------------------\n`;
      data.openSwingPositions.forEach((p, i) => {
        text += `${i + 1}. ${p.symbol} | ${p.action} ${p.quantity} shares | Entry: ₹${p.entryPrice} | Trailing SL: ₹${p.stopLoss} | Target: ₹${p.target} (+30%)\n`;
      });
    }

    text += `\n=========================================================\n`;
    return text;
  }

  /**
   * Native TLS SMTP Transport (Port 465 SSL or Port 587 STARTTLS)
   * Zero external dependencies, connects directly to smtp.gmail.com
   */
  async sendViaNativeSmtp({ host, port, user, pass, to, from, subject, html, text }) {
    return new Promise((resolve, reject) => {
      const socket = tls.connect(port, host, { rejectUnauthorized: false, timeout: 15000 }, () => {
        // Connected
      });

      let buffer = '';
      let step = 0;

      const sendCommand = (cmd) => {
        socket.write(cmd + '\r\n');
      };

      socket.on('data', (data) => {
        buffer += data.toString();
        const lines = buffer.split('\r\n');
        const lastLine = lines[lines.length - 2] || lines[lines.length - 1];

        if (step === 0 && lastLine.startsWith('220')) {
          step = 1;
          sendCommand(`EHLO quant.terminal`);
        } else if (step === 1 && lastLine.startsWith('250')) {
          step = 2;
          sendCommand('AUTH LOGIN');
        } else if (step === 2 && lastLine.startsWith('334')) {
          step = 3;
          sendCommand(Buffer.from(user).toString('base64'));
        } else if (step === 3 && lastLine.startsWith('334')) {
          step = 4;
          sendCommand(Buffer.from(pass.replace(/\s+/g, '')).toString('base64'));
        } else if (step === 4 && lastLine.startsWith('235')) {
          step = 5;
          sendCommand(`MAIL FROM:<${from || user}>`);
        } else if (step === 5 && lastLine.startsWith('250')) {
          step = 6;
          sendCommand(`RCPT TO:<${to}>`);
        } else if (step === 6 && lastLine.startsWith('250')) {
          step = 7;
          sendCommand('DATA');
        } else if (step === 7 && lastLine.startsWith('354')) {
          step = 8;
          const mime = [
            `From: "Quant Command Center" <${from || user}>`,
            `To: <${to}>`,
            `Subject: ${subject}`,
            `MIME-Version: 1.0`,
            `Content-Type: text/html; charset=UTF-8`,
            ``,
            html,
            `.`
          ].join('\r\n');
          sendCommand(mime);
        } else if (step === 8 && lastLine.startsWith('250')) {
          step = 9;
          sendCommand('QUIT');
          socket.end();
          resolve({ success: true, message: 'Delivered via Native TLS SMTP' });
        } else if (lastLine.startsWith('5') || lastLine.startsWith('4')) {
          socket.end();
          reject(new Error(`SMTP Rejected at step ${step}: ${lastLine}`));
        }
      });

      socket.on('error', (err) => {
        reject(err);
      });

      socket.on('timeout', () => {
        socket.destroy();
        reject(new Error('SMTP connection timed out after 15s'));
      });
    });
  }

  /**
   * Send with Nodemailer if available
   */
  async sendViaNodemailer({ host, port, secure, user, pass, to, from, subject, html, text }) {
    let nodemailer;
    try {
      nodemailer = require('nodemailer');
    } catch (e) {
      throw new Error('Nodemailer not installed in runtime');
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user,
        pass: pass.replace(/\s+/g, '')
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    return await transporter.sendMail({
      from: `"Quant Command Center" <${from || user}>`,
      to,
      subject,
      text,
      html
    });
  }

  /**
   * Main Dispatch Method: Sends or archives the daily summary email
   */
  async sendDailySummaryEmail(options = {}) {
    const config = this.getSettings();
    const recipient = options.recipient || config.recipientEmail || this.defaultRecipient;
    const dateStr = options.date || marketCalendar.getDateKeyIST();
    const isForce = options.force === true;

    // Guard against duplicate sending on the same day unless forced
    if (!isForce && this.lastSentDate === dateStr) {
      console.log(`ℹ️ [EmailService] Daily summary for ${dateStr} has already been dispatched.`);
      return { success: true, alreadySent: true, message: `Already dispatched today (${dateStr})` };
    }

    console.log(`📧 [EmailService] Compiling Daily Market Close Summary for ${recipient} (${dateStr})...`);
    const dayData = this.compileDayData(dateStr);
    const htmlReport = this.generateHtmlReport(dayData);
    const textReport = this.generateTextReport(dayData);

    // 1. Always save generated HTML report to disk for audit & UI preview
    const reportFilename = `market_close_summary_${dateStr}.html`;
    const reportPath = path.join(REPORTS_DIR, reportFilename);
    fs.writeFileSync(reportPath, htmlReport, 'utf8');
    console.log(`💾 [EmailService] Saved daily HTML summary report to: ${reportPath}`);

    // 2. Check credentials
    const smtpUser = config.smtpUser || process.env.EMAIL_USER;
    const smtpPass = config.smtpPass || process.env.EMAIL_PASS;

    const subject = `📊 NSE Daily Market Close Summary - ${dateStr} [P&L: ${dayData.summary.totalDayNetPnL >= 0 ? '+' : ''}₹${dayData.summary.totalDayNetPnL}]`;

    if (!smtpUser || !smtpPass) {
      console.log(`⚠️ [EmailService] SMTP credentials (smtpUser / smtpPass) not yet configured.`);
      console.log(`👉 The daily summary has been prepared and archived to: ${reportFilename}`);
      console.log(`👉 To deliver directly to your Gmail inbox, provide your Gmail App Password in Risk Settings.`);
      return {
        success: false,
        archived: true,
        reportFilename,
        reportPath,
        dayData,
        reason: 'CREDENTIALS_REQUIRED',
        message: `Daily report for ${dateStr} compiled and saved. Add your Gmail App Password in Risk Settings to enable automatic delivery to ${recipient}.`
      };
    }

    // 3. Dispatch email via Nodemailer or Native SMTP
    let deliveryResult = null;
    let deliveryMethod = '';

    try {
      // Attempt nodemailer first
      deliveryResult = await this.sendViaNodemailer({
        host: config.smtpHost,
        port: config.smtpPort,
        secure: config.smtpSecure,
        user: smtpUser,
        pass: smtpPass,
        to: recipient,
        from: smtpUser,
        subject,
        html: htmlReport,
        text: textReport
      });
      deliveryMethod = 'Nodemailer';
    } catch (nodemailerErr) {
      console.warn(`⚠️ [EmailService] Nodemailer dispatch failed (${nodemailerErr.message}). Falling back to Native TLS SMTP...`);
      try {
        deliveryResult = await this.sendViaNativeSmtp({
          host: config.smtpHost,
          port: config.smtpPort,
          user: smtpUser,
          pass: smtpPass,
          to: recipient,
          from: smtpUser,
          subject,
          html: htmlReport,
          text: textReport
        });
        deliveryMethod = 'Native TLS SMTP';
      } catch (nativeErr) {
        console.error(`❌ [EmailService] Native SMTP failed:`, nativeErr.message);
        return {
          success: false,
          archived: true,
          reportFilename,
          reportPath,
          error: nativeErr.message,
          message: `Failed to deliver email: ${nativeErr.message}. The report is safely saved to disk.`
        };
      }
    }

    this.lastSentDate = dateStr;
    console.log(`✅ [EmailService] Daily summary successfully sent to ${recipient} via ${deliveryMethod}!`);

    return {
      success: true,
      delivered: true,
      method: deliveryMethod,
      recipient,
      date: dateStr,
      reportPath,
      message: `Market close summary successfully emailed to ${recipient}!`
    };
  }

  getLatestReport() {
    try {
      if (!fs.existsSync(REPORTS_DIR)) return null;
      const files = fs.readdirSync(REPORTS_DIR)
        .filter(f => f.startsWith('market_close_summary_') && f.endsWith('.html'))
        .sort()
        .reverse();

      if (files.length === 0) return null;
      const latestFile = files[0];
      const filePath = path.join(REPORTS_DIR, latestFile);
      const html = fs.readFileSync(filePath, 'utf8');
      return {
        filename: latestFile,
        filePath,
        html
      };
    } catch (e) {
      return null;
    }
  }
}

module.exports = new EmailNotificationService();
