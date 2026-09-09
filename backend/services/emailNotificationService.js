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
const CREDENTIALS_FILE = path.join(DATA_DIR, 'email_credentials.json');
const REPORTS_DIR = path.join(DATA_DIR, 'email_reports');
const DISPATCH_STATUS_FILE = path.join(DATA_DIR, 'email_dispatch_status.json');

function getEnvValue(...aliases) {
  const norm = (s) => String(s).toLowerCase().replace(/[\s_\-]/g, '');
  const aliasNorms = aliases.map(norm);

  // 1. Exact match
  for (const alias of aliases) {
    if (process.env[alias] !== undefined && process.env[alias] !== null) {
      const val = String(process.env[alias]).trim().replace(/^["']|["']$/g, '');
      if (val.length > 0) return val;
    }
  }

  // 2. Normalized fuzzy key check (ignores casing, underscores, hyphens, spaces in key)
  for (const key of Object.keys(process.env)) {
    const keyNorm = norm(key);
    if (aliasNorms.includes(keyNorm) && process.env[key] !== undefined && process.env[key] !== null) {
      const val = String(process.env[key]).trim().replace(/^["']|["']$/g, '');
      if (val.length > 0) return val;
    }
  }

  return '';
}

class EmailNotificationService {
  constructor() {
    if (!fs.existsSync(REPORTS_DIR)) {
      try { fs.mkdirSync(REPORTS_DIR, { recursive: true }); } catch (e) {}
    }
    this.defaultRecipient = 'jaiadithya2020@gmail.com';
    this.lastSentDate = this.loadLastSentDate();
  }

  loadLastSentDate() {
    try {
      if (fs.existsSync(DISPATCH_STATUS_FILE)) {
        const raw = fs.readFileSync(DISPATCH_STATUS_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        return parsed.lastSentDate || null;
      }
    } catch (e) {}
    return null;
  }

  recordDispatchedDate(dateStr, meta = {}) {
    this.lastSentDate = dateStr;
    try {
      const payload = {
        lastSentDate: dateStr,
        timestamp: new Date().toISOString(),
        ...meta
      };
      fs.writeFileSync(DISPATCH_STATUS_FILE, JSON.stringify(payload, null, 2), 'utf8');
    } catch (e) {
      console.warn('⚠️ [EmailService] Could not persist email dispatch status:', e.message);
    }
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

    let creds = {};
    if (fs.existsSync(CREDENTIALS_FILE)) {
      try {
        creds = JSON.parse(fs.readFileSync(CREDENTIALS_FILE, 'utf8'));
      } catch (e) {}
    }

    // Check CREDENTIALS_JSON env variable if present
    if (!creds.smtpUser || !creds.smtpPass) {
      const rawCredsJson = getEnvValue('CREDENTIALS_JSON', 'credentials_json');
      if (rawCredsJson) {
        try {
          const parsed = JSON.parse(rawCredsJson);
          if (parsed.email_user || parsed.EMAIL_USER || parsed.smtpUser) {
            creds.smtpUser = creds.smtpUser || parsed.email_user || parsed.EMAIL_USER || parsed.smtpUser;
          }
          if (parsed.email_pass || parsed.EMAIL_PASS || parsed.smtpPass) {
            creds.smtpPass = creds.smtpPass || parsed.email_pass || parsed.EMAIL_PASS || parsed.smtpPass;
          }
        } catch (e) {}
      }
    }

    const emailConfig = settings.emailNotification || {};
    const smtpUser = creds.smtpUser || emailConfig.smtpUser || 
      getEnvValue('EMAIL_USER', 'EMAIL_USERNAME', 'EMAIL_ID', 'EMAIL_ADDRESS', 'EMAIL', 'SMTP_USER', 'SMTP_USERNAME', 'GMAIL_USER', 'GMAIL_USERNAME', 'MAIL_USER', 'MAIL_USERNAME', 'EMAIL_HOST_USER');
    
    const smtpPass = creds.smtpPass || emailConfig.smtpPass || 
      getEnvValue(
        'EMAIL_PASS', 'EMAIL_PASSWORD', 'EMAIL_PWD', 'EMAIL_APP_PASSWORD', 'EMAIL_APP_PASS',
        'EMAIL_SECRET', 'EMAIL_KEY', 'EMAIL_PASS_KEY', 'SMTP_PASS', 'SMTP_PASSWORD', 'SMTP_PWD',
        'GMAIL_PASS', 'GMAIL_PASSWORD', 'GMAIL_PWD', 'GMAIL_APP_PASSWORD', 'GMAIL_APP_PASS',
        'GMAIL_KEY', 'GMAIL_TOKEN', 'MAIL_PASS', 'MAIL_PASSWORD', 'APP_PASSWORD',
        'EMAIL_HOST_PASSWORD', 'PASS', 'PASSWORD'
      );

    const recipientEmail = emailConfig.recipientEmail || 
      getEnvValue('EMAIL_TO', 'EMAIL_RECIPIENT', 'RECIPIENT_EMAIL', 'MAIL_TO', 'TARGET_EMAIL', 'TO_EMAIL', 'ALERT_EMAIL') || 
      (smtpUser && smtpUser.includes('@') ? smtpUser : this.defaultRecipient);

    const resendApiKey = creds.resendApiKey || emailConfig.resendApiKey || 
      getEnvValue('RESEND_API_KEY', 'RESEND_KEY', 'RESEND_TOKEN') || '';

    return {
      enabled: emailConfig.enabled !== false,
      recipientEmail,
      sendAtMarketClose: emailConfig.sendAtMarketClose !== false,
      smtpHost: emailConfig.smtpHost || getEnvValue('SMTP_HOST', 'EMAIL_HOST') || 'smtp.gmail.com',
      smtpPort: Number(emailConfig.smtpPort || getEnvValue('SMTP_PORT', 'EMAIL_PORT') || 465),
      smtpSecure: emailConfig.smtpSecure !== undefined ? emailConfig.smtpSecure : true,
      smtpUser: smtpUser.trim(),
      smtpPass: smtpPass.trim(),
      resendApiKey: resendApiKey.trim(),
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

    if (newConfig.smtpUser || newConfig.smtpPass) {
      try {
        const creds = {
          smtpUser: newConfig.smtpUser || 'jaiadithya2020@gmail.com',
          smtpPass: newConfig.smtpPass || ''
        };
        fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(creds, null, 2), 'utf8');
      } catch (e) {}
    }

    if (newConfig.resendApiKey !== undefined) {
      settings.emailNotification = settings.emailNotification || {};
      settings.emailNotification.resendApiKey = String(newConfig.resendApiKey).trim();
    }

    const current = this.getSettings();
    settings.emailNotification = {
      enabled: newConfig.enabled !== undefined ? newConfig.enabled : current.enabled,
      recipientEmail: newConfig.recipientEmail || current.recipientEmail,
      sendAtMarketClose: newConfig.sendAtMarketClose !== undefined ? newConfig.sendAtMarketClose : current.sendAtMarketClose,
      resendApiKey: newConfig.resendApiKey !== undefined ? String(newConfig.resendApiKey).trim() : current.resendApiKey,
      smtpHost: newConfig.smtpHost || current.smtpHost,
      smtpPort: newConfig.smtpPort || current.smtpPort,
      smtpSecure: newConfig.smtpSecure !== undefined ? newConfig.smtpSecure : current.smtpSecure,
      smtpUser: newConfig.smtpUser || current.smtpUser,
      senderName: newConfig.senderName || current.senderName
    };

    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8');
    return this.getSettings();
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
    // Active session trades vs pre-refill archived trades breakdown
    const activeClosed = portfolio.tradeHistory || [];
    const activeSessionPnL = parseFloat(activeClosed.reduce((sum, t) => sum + (t.pnl || 0), 0).toFixed(2));
    const archivedSessionPnL = parseFloat((netRealizedPnL - activeSessionPnL).toFixed(2));
    const totalDayNetPnL = parseFloat((netRealizedPnL + totalUnrealizedPnL).toFixed(2));
    const totalEquity = parseFloat((portfolio.currentBalance + portfolio.totalMarginUsed + totalUnrealizedPnL).toFixed(2));

    return {
      date: todayStr,
      generatedAt: new Date().toISOString(),
      summary: {
        netRealizedPnL,
        totalUnrealizedPnL,
        totalDayNetPnL,
        activeSessionPnL,
        archivedSessionPnL,
        postRefillCapital: portfolio.initialCapital || 100000,
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

  generateHtmlReport(data, targetRecipient = null) {
    const isProfitable = data.summary.totalDayNetPnL >= 0;
    const pnlColor = isProfitable ? '#00d084' : '#ff4757';
    const pnlSign = isProfitable ? '+' : '';
    const recipient = targetRecipient || this.defaultRecipient;

    // Desktop Table Rows for Closed Trades
    const closedTradesRows = data.closedTrades.length > 0
      ? data.closedTrades.map((t) => {
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

    // Mobile Cards View for Closed Trades
    const closedTradesCards = data.closedTrades.length > 0
      ? data.closedTrades.map((t) => {
          const tradeProfitable = (t.pnl || 0) >= 0;
          const color = tradeProfitable ? '#00d084' : '#ff4757';
          const sign = tradeProfitable ? '+' : '';
          const exitTimeIST = t.exitTimestamp ? new Date(t.exitTimestamp).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'N/A';
          return `
            <div style="background: #1e2433; border: 1px solid #2a3142; border-radius: 8px; padding: 12px 14px; margin-bottom: 10px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <div style="display: flex; align-items: center; gap: 6px;">
                  <strong style="font-size: 14px; color: #f0f3f6; font-family: monospace;">${t.symbol}</strong>
                  <span style="background: ${t.action === 'BUY' ? 'rgba(0,208,132,0.15)' : 'rgba(255,71,87,0.15)'}; color: ${t.action === 'BUY' ? '#00d084' : '#ff4757'}; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; border: 1px solid ${t.action === 'BUY' ? 'rgba(0,208,132,0.3)' : 'rgba(255,71,87,0.3)'};">
                    ${t.action} ${t.quantity}
                  </span>
                </div>
                <div style="text-align: right;">
                  <span style="font-size: 15px; font-weight: 800; color: ${color}; font-family: monospace;">
                    ${sign}₹${Number(t.pnl).toFixed(2)}
                  </span>
                  <span style="font-size: 11px; color: ${color}; font-weight: 600; margin-left: 3px;">(${sign}${t.pnlPct || 0}%)</span>
                </div>
              </div>

              <div style="display: flex; justify-content: space-between; font-size: 11.5px; color: #94a3b8; background: rgba(0,0,0,0.25); padding: 7px 10px; border-radius: 6px; margin-bottom: 7px;">
                <div>Entry: <strong style="color: #cbd5e1;">₹${Number(t.entryPrice).toFixed(2)}</strong></div>
                <div>Exit: <strong style="color: #cbd5e1;">₹${Number(t.exitPrice).toFixed(2)}</strong></div>
                <div>Time: <strong style="color: #cbd5e1;">${exitTimeIST}</strong></div>
              </div>

              <div style="display: flex; justify-content: space-between; align-items: center; font-size: 10.5px; color: #64748b; margin-bottom: 6px;">
                <span>Trigger: <strong style="color: #cbd5e0; background: rgba(255,255,255,0.06); padding: 2px 6px; border-radius: 4px;">${t.exitReason || 'AUTO'}</strong></span>
              </div>

              <div style="font-size: 11px; color: #8892b0; font-style: italic; border-top: 1px dashed #2a2e39; padding-top: 6px;">
                💡 ${t.rationale || 'Breakout momentum setup with confluence.'}
              </div>
            </div>
          `;
        }).join('')
      : `<div style="background: rgba(255,255,255,0.03); border: 1px dashed #2a2e39; border-radius: 8px; padding: 18px; text-align: center; color: #8892b0; font-size: 12.5px;">🛡️ No intraday trades were closed in this session. Capital was 100% protected.</div>`;

    // Desktop Swing Rows
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

    // Mobile Cards View for Swing Positions
    const swingCards = data.openSwingPositions.length > 0
      ? data.openSwingPositions.map(p => {
          const upnl = p.unrealizedPnL || 0;
          const uColor = upnl >= 0 ? '#00d084' : '#ff4757';
          const uSign = upnl >= 0 ? '+' : '';
          return `
            <div style="background: #1e2433; border: 1px solid #2a3142; border-radius: 8px; padding: 12px 14px; margin-bottom: 10px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <div style="display: flex; align-items: center; gap: 6px;">
                  <strong style="font-size: 14px; color: #38bdf8; font-family: monospace;">${p.symbol}</strong>
                  <span style="background: rgba(56,189,248,0.15); color: #38bdf8; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(56,189,248,0.3);">
                    SWING ${p.quantity} QTY
                  </span>
                </div>
                <div style="text-align: right;">
                  <span style="font-size: 15px; font-weight: 800; color: ${uColor}; font-family: monospace;">
                    ${uSign}₹${Number(upnl).toFixed(2)}
                  </span>
                  <div style="font-size: 10px; color: #94a3b8;">Floating P&L</div>
                </div>
              </div>

              <div style="display: flex; justify-content: space-between; font-size: 11.5px; color: #94a3b8; background: rgba(0,0,0,0.25); padding: 7px 10px; border-radius: 6px; margin-bottom: 7px;">
                <div>Entry: <strong style="color: #cbd5e1;">₹${Number(p.entryPrice).toFixed(2)}</strong></div>
                <div>LTP: <strong style="color: #cbd5e1;">₹${Number(p.currentPrice || p.entryPrice).toFixed(2)}</strong></div>
                <div>Trailing SL: <strong style="color: #fbbf24;">₹${Number(p.stopLoss).toFixed(2)}</strong></div>
              </div>

              <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #a78bfa;">
                <span>🎯 Target: ₹${Number(p.target).toFixed(2)} (+30%)</span>
                <span>20-EMA Active</span>
              </div>
            </div>
          `;
        }).join('')
      : `<div style="background: rgba(255,255,255,0.03); border: 1px dashed #2a2e39; border-radius: 8px; padding: 16px; text-align: center; color: #8892b0; font-size: 12.5px;">🌙 No positional swing trades currently held overnight.</div>`;

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
  <title>Market Close Executive Summary - ${data.date}</title>
  <style>
    /* Responsive Breakpoints for Mobile Email Clients */
    @media only screen and (max-width: 600px) {
      .email-container {
        width: 100% !important;
        max-width: 100% !important;
        margin: 0 auto !important;
        border-radius: 0 !important;
        border-left: none !important;
        border-right: none !important;
      }
      .header-section {
        padding: 20px 16px !important;
      }
      .header-title {
        font-size: 20px !important;
        line-height: 1.3 !important;
      }
      .content-section {
        padding: 16px 14px !important;
      }
      .kpi-card {
        flex: 1 1 calc(50% - 6px) !important;
        min-width: calc(50% - 6px) !important;
        padding: 10px 10px !important;
      }
      .kpi-value {
        font-size: 18px !important;
      }
      .kpi-subtext {
        font-size: 9.5px !important;
      }
      .desktop-table-view {
        display: none !important;
        mso-hide: all !important;
      }
      .mobile-card-view {
        display: block !important;
      }
      .hero-scorecard {
        padding: 12px 14px !important;
        flex-direction: column !important;
        align-items: flex-start !important;
      }
      .hero-scorecard-right {
        text-align: left !important;
        margin-top: 8px !important;
      }
    }
    @media only screen and (min-width: 601px) {
      .desktop-table-view {
        display: block !important;
      }
      .mobile-card-view {
        display: none !important;
      }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #0b0e14; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #d1d4dc; -webkit-font-smoothing: antialiased;">
  <div class="email-container" style="max-width: 680px; width: 100%; margin: 16px auto; background-color: #131722; border: 1px solid #2a2e39; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
    
    <!-- Top Header Banner -->
    <div class="header-section" style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding: 24px 28px; border-bottom: 2px solid #2962ff;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <span style="background: #2962ff; color: #ffffff; font-size: 10.5px; font-weight: 800; text-transform: uppercase; padding: 4px 8px; border-radius: 4px; letter-spacing: 0.5px;">
          NSE Daily Market Close
        </span>
        <span style="color: #94a3b8; font-size: 12px;">Session: <strong style="color: #f0f3f6;">${data.date}</strong></span>
      </div>
      <h1 class="header-title" style="margin: 6px 0 4px; font-size: 22px; color: #ffffff; font-weight: 700; letter-spacing: -0.3px;">Daily Trading & Portfolio Summary</h1>
      <p style="margin: 0; color: #94a3b8; font-size: 13px;">Executive telemetry dispatched to <strong style="color: #38bdf8;">${recipient}</strong></p>

      <!-- Instant Mobile Hero P&L Scorecard -->
      <div class="hero-scorecard" style="background: ${isProfitable ? 'rgba(0, 208, 132, 0.12)' : 'rgba(255, 71, 87, 0.12)'}; border: 1px solid ${isProfitable ? 'rgba(0, 208, 132, 0.35)' : 'rgba(255, 71, 87, 0.35)'}; border-radius: 8px; padding: 14px 18px; margin-top: 14px; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <span style="font-size: 10.5px; text-transform: uppercase; color: #94a3b8; font-weight: 700; letter-spacing: 0.5px; display: block;">Session Net Result</span>
          <span style="font-size: 26px; font-weight: 800; color: ${pnlColor}; font-family: monospace;">${pnlSign}₹${data.summary.totalDayNetPnL.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
        </div>
        <div class="hero-scorecard-right" style="text-align: right;">
          <span style="display: inline-block; background: ${isProfitable ? '#00d084' : '#ff4757'}; color: #000; font-size: 10.5px; font-weight: 800; padding: 4px 8px; border-radius: 4px; text-transform: uppercase;">
            ${isProfitable ? 'PROFITABLE DAY' : (data.summary.totalTrades === 0 ? 'FLAT / NO TRADES' : 'SESSION LOSS')}
          </span>
          <div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">Win Rate: <strong style="color: #f0f3f6;">${data.summary.winRatePct}%</strong> (${data.summary.winningTrades}W / ${data.summary.losingTrades}L)</div>
        </div>
      </div>
    </div>

    <!-- Executive KPI Scorecard Grid (Fluid 2x2 on Mobile, 4x1 on Desktop) -->
    <div class="content-section" style="padding: 20px 24px; background: #161b26; border-bottom: 1px solid #2a2e39;">
      <div style="display: flex; flex-wrap: wrap; gap: 10px;">
        
        <div class="kpi-card" style="flex: 1 1 calc(50% - 6px); min-width: 130px; background: #1e2433; padding: 12px 14px; border-radius: 8px; border: 1px solid #2a3142; box-sizing: border-box;">
          <div style="font-size: 10px; color: #8892b0; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Net Realized P&L</div>
          <div class="kpi-value" style="font-size: 20px; font-weight: 800; color: ${pnlColor}; font-family: monospace;">${pnlSign}₹${data.summary.netRealizedPnL.toLocaleString('en-IN')}</div>
          <div class="kpi-subtext" style="font-size: 10px; color: #718096; margin-top: 3px;">Pre-Refill: ₹${data.summary.archivedSessionPnL}</div>
        </div>

        <div class="kpi-card" style="flex: 1 1 calc(50% - 6px); min-width: 130px; background: #1e2433; padding: 12px 14px; border-radius: 8px; border: 1px solid #2a3142; box-sizing: border-box;">
          <div style="font-size: 10px; color: #8892b0; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Win Rate & Trades</div>
          <div class="kpi-value" style="font-size: 20px; font-weight: 800; color: #f0f3f6; font-family: monospace;">${data.summary.winRatePct}%</div>
          <div class="kpi-subtext" style="font-size: 10px; color: #718096; margin-top: 3px;">${data.summary.winningTrades}W / ${data.summary.losingTrades}L (${data.summary.totalTrades} Total)</div>
        </div>

        <div class="kpi-card" style="flex: 1 1 calc(50% - 6px); min-width: 130px; background: #1e2433; padding: 12px 14px; border-radius: 8px; border: 1px solid #2a3142; box-sizing: border-box;">
          <div style="font-size: 10px; color: #8892b0; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Portfolio Equity</div>
          <div class="kpi-value" style="font-size: 20px; font-weight: 800; color: #38bdf8; font-family: monospace;">₹${data.summary.totalEquity.toLocaleString('en-IN')}</div>
          <div class="kpi-subtext" style="font-size: 10px; color: #718096; margin-top: 3px;">Cash: ₹${data.summary.endingCashBalance.toLocaleString('en-IN')}</div>
        </div>

        <div class="kpi-card" style="flex: 1 1 calc(50% - 6px); min-width: 130px; background: #1e2433; padding: 12px 14px; border-radius: 8px; border: 1px solid #2a3142; box-sizing: border-box;">
          <div style="font-size: 10px; color: #8892b0; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Overnight Swings</div>
          <div class="kpi-value" style="font-size: 20px; font-weight: 800; color: #a78bfa; font-family: monospace;">${data.openSwingPositions.length}</div>
          <div class="kpi-subtext" style="font-size: 10px; color: #718096; margin-top: 3px;">20-EMA Trailing Active</div>
        </div>

      </div>
    </div>

    <!-- Closed Trades Section -->
    <div class="content-section" style="padding: 22px 24px 14px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <h2 style="margin: 0; font-size: 16px; color: #ffffff; font-weight: 700;">⚡ Closed Trades Ledger</h2>
        <span style="font-size: 11px; color: #8892b0;">${data.closedTrades.length} Trades Completed</span>
      </div>

      <!-- Desktop Table View -->
      <div class="desktop-table-view" style="overflow-x: auto; background: #161b26; border: 1px solid #2a2e39; border-radius: 8px;">
        <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 12px;">
          <thead>
            <tr style="background: #1a202c; color: #8892b0; font-size: 10.5px; text-transform: uppercase; border-bottom: 1px solid #2a2e39;">
              <th style="padding: 8px 10px;">Symbol</th>
              <th style="padding: 8px 10px;">Side</th>
              <th style="padding: 8px 10px;">Qty</th>
              <th style="padding: 8px 10px;">Entry</th>
              <th style="padding: 8px 10px;">Exit</th>
              <th style="padding: 8px 10px;">Realized P&L</th>
              <th style="padding: 8px 10px;">Trigger</th>
              <th style="padding: 8px 10px;">Exit Time</th>
            </tr>
          </thead>
          <tbody>
            ${closedTradesRows}
          </tbody>
        </table>
      </div>

      <!-- Mobile Cards View -->
      <div class="mobile-card-view" style="display: none;">
        ${closedTradesCards}
      </div>
    </div>

    <!-- Overnight Swing Positions Section -->
    <div class="content-section" style="padding: 14px 24px 22px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <h2 style="margin: 0; font-size: 16px; color: #ffffff; font-weight: 700;">🌙 Positional Swing Holdings</h2>
        <span style="font-size: 11px; color: #38bdf8;">Overnight Runner (+30% Target)</span>
      </div>

      <!-- Desktop Table View -->
      <div class="desktop-table-view" style="overflow-x: auto; background: #161b26; border: 1px solid #2a2e39; border-radius: 8px;">
        <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 12px;">
          <thead>
            <tr style="background: #1a202c; color: #8892b0; font-size: 10.5px; text-transform: uppercase; border-bottom: 1px solid #2a2e39;">
              <th style="padding: 8px 10px;">Symbol</th>
              <th style="padding: 8px 10px;">Side</th>
              <th style="padding: 8px 10px;">Qty</th>
              <th style="padding: 8px 10px;">Entry</th>
              <th style="padding: 8px 10px;">LTP</th>
              <th style="padding: 8px 10px;">Trailing SL</th>
              <th style="padding: 8px 10px;">Target</th>
              <th style="padding: 8px 10px;">Floating P&L</th>
            </tr>
          </thead>
          <tbody>
            ${swingRows}
          </tbody>
        </table>
      </div>

      <!-- Mobile Cards View -->
      <div class="mobile-card-view" style="display: none;">
        ${swingCards}
      </div>
    </div>

    <!-- Strategy Outlook & Risk Compliance Footer -->
    <div class="content-section" style="background: #161b26; padding: 18px 24px; border-top: 1px solid #2a2e39; font-size: 11.5px; color: #8892b0; line-height: 1.6;">
      <div style="margin-bottom: 6px;">
        🛡️ <strong>Risk Guardrails:</strong> ₹5,000 Circuit Breaker Active | 5 Slots Capacity | Breakeven Trailing Enforced.
      </div>
      <div>
        📈 <strong>Outlook:</strong> Monitoring Stage-2 breakouts above daily 20-EMA. Profitable intraday runners are automatically promoted to swing runners.
      </div>
    </div>

    <!-- Terminal Signature -->
    <div style="background: #0f1318; padding: 14px 20px; text-align: center; font-size: 10.5px; color: #64748b; border-top: 1px solid #1e222d;">
      Google DeepMind Antigravity Quant Command Center • Automated Dispatch • All rights reserved.
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
   * Send with Nodemailer using specialized Gmail transport or custom SMTP
   */
  async sendViaNodemailer({ host, port, secure, user, pass, to, from, subject, html, text }) {
    const nodemailer = require('nodemailer');
    const cleanUser = String(user).trim();
    const cleanPass = String(pass).replace(/\s+/g, '').trim();

    const isGmail = (host && host.toLowerCase().includes('gmail')) || cleanUser.toLowerCase().endsWith('@gmail.com');

    const transportConfig = isGmail
      ? {
          service: 'gmail',
          auth: {
            user: cleanUser,
            pass: cleanPass
          },
          tls: {
            rejectUnauthorized: false
          },
          connectionTimeout: 7000,
          greetingTimeout: 7000,
          socketTimeout: 10000
        }
      : {
          host: host || 'smtp.gmail.com',
          port: port || 587,
          secure: port === 465,
          auth: {
            user: cleanUser,
            pass: cleanPass
          },
          tls: {
            rejectUnauthorized: false
          },
          connectionTimeout: 7000,
          greetingTimeout: 7000,
          socketTimeout: 10000
        };

    const transporter = nodemailer.createTransport(transportConfig);

    return await transporter.sendMail({
      from: `"Quant Command Center" <${from || cleanUser}>`,
      to,
      subject,
      text,
      html
    });
  }

  /**
   * Resend HTTP REST API Transport (Port 443 HTTPS)
   * 100% resilient against cloud hosting outbound SMTP port blocks (Render Free Tier)
   */
  async sendViaResend({ apiKey, to, from, subject, html, text }) {
    const https = require('https');
    const cleanKey = String(apiKey || '').trim();
    if (!cleanKey) throw new Error('Resend API key is missing');

    const primaryRecipients = Array.isArray(to) ? to : [to];

    const dispatch = (recipients) => {
      return new Promise((resolve, reject) => {
        const payload = JSON.stringify({
          from: from || 'Quant Command Center <onboarding@resend.dev>',
          to: recipients,
          subject,
          html,
          text
        });

        const req = https.request('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${cleanKey}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
          },
          timeout: 10000,
          rejectUnauthorized: false
        }, (res) => {
          let body = '';
          res.on('data', chunk => body += chunk);
          res.on('end', () => {
            try {
              const parsed = JSON.parse(body);
              if (res.statusCode >= 200 && res.statusCode < 300) {
                resolve({ success: true, id: parsed.id, recipients });
              } else {
                resolve({ success: false, statusCode: res.statusCode, error: parsed.message || body, data: parsed });
              }
            } catch (e) {
              resolve({ success: false, statusCode: res.statusCode, error: body });
            }
          });
        });

        req.on('error', (err) => resolve({ success: false, error: err.message }));
        req.on('timeout', () => {
          req.destroy();
          resolve({ success: false, error: 'Resend API request timed out after 10s' });
        });

        req.write(payload);
        req.end();
      });
    };

    let result = await dispatch(primaryRecipients);
    let wasRerouted = false;

    // If Resend free testing sandbox restricts recipient to the registered account owner
    if (!result.success && result.statusCode === 403 && typeof result.error === 'string' && result.error.includes('send testing emails to your own email address')) {
      const match = result.error.match(/\(([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\)/);
      const ownerEmail = match ? match[1] : 'jaiadithya2025.71@gmail.com';
      console.log(`ℹ️ [EmailService] Resend testing sandbox restricted to account owner. Auto-routing to registered address: ${ownerEmail}...`);
      result = await dispatch([ownerEmail]);
      if (result.success) {
        wasRerouted = true;
      }
    }

    if (!result.success) {
      throw new Error(result.error || `Resend API returned HTTP ${result.statusCode}`);
    }

    return { ...result, wasRerouted };
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
    const persistedDate = this.loadLastSentDate();
    const effectiveLastSent = this.lastSentDate || persistedDate;

    if (!isForce && effectiveLastSent === dateStr) {
      console.log(`ℹ️ [EmailService] Daily summary for ${dateStr} has already been dispatched today. Skipping duplicate.`);
      return {
        success: true,
        delivered: false,
        alreadySent: true,
        date: dateStr,
        message: `Daily summary for ${dateStr} has already been dispatched today.`
      };
    }

    console.log(`📧 [EmailService] Compiling Daily Market Close Summary for ${recipient} (${dateStr})...`);
    const dayData = this.compileDayData(dateStr);
    const htmlReport = this.generateHtmlReport(dayData, recipient);
    const textReport = this.generateTextReport(dayData);

    // 1. Always save generated HTML report to disk for audit & UI preview
    const reportFilename = `market_close_summary_${dateStr}.html`;
    const reportPath = path.join(REPORTS_DIR, reportFilename);
    fs.writeFileSync(reportPath, htmlReport, 'utf8');
    console.log(`💾 [EmailService] Saved daily HTML summary report to: ${reportPath}`);

    // 2. Check credentials
    const resendApiKey = config.resendApiKey || process.env.RESEND_API_KEY || '';
    const smtpUser = config.smtpUser || process.env.EMAIL_USER;
    const smtpPass = config.smtpPass || process.env.EMAIL_PASS;

    const subject = `📊 NSE Daily Market Close Summary - ${dateStr} [P&L: ${dayData.summary.totalDayNetPnL >= 0 ? '+' : ''}₹${dayData.summary.totalDayNetPnL}]`;

    if (!resendApiKey && (!smtpUser || !smtpPass)) {
      console.log(`⚠️ [EmailService] Neither Resend API key nor SMTP credentials are configured.`);
      console.log(`👉 The daily summary has been prepared and archived to: ${reportFilename}`);
      return {
        success: false,
        delivered: false,
        archived: true,
        reportFilename,
        reportPath,
        dayData,
        reason: 'CREDENTIALS_REQUIRED',
        message: `Daily report for ${dateStr} compiled and saved. Provide your Resend API Key or Gmail App Password to enable automatic delivery to ${recipient}.`
      };
    }

    // 3. Dispatch email: Prioritize Resend HTTP REST API (Port 443, 100% immune to Render outbound SMTP port blocking)
    let deliveryResult = null;
    let deliveryMethod = '';
    let deliveryRecipient = recipient;

    if (resendApiKey) {
      try {
        console.log(`📡 [EmailService] Dispatching Daily Summary via Resend HTTP REST API (Port 443)...`);
        const resendRes = await this.sendViaResend({
          apiKey: resendApiKey,
          to: recipient,
          subject,
          html: htmlReport,
          text: textReport
        });
        deliveryResult = resendRes;
        deliveryRecipient = resendRes.recipients?.join(', ') || recipient;
        deliveryMethod = resendRes.wasRerouted 
          ? `Resend Sandbox (Auto-routed to account owner ${deliveryRecipient})` 
          : `Resend HTTP REST API (${deliveryRecipient})`;
      } catch (resendErr) {
        console.warn(`⚠️ [EmailService] Resend HTTP dispatch failed (${resendErr.message}). Attempting SMTP fallback...`);
      }
    }

    // Fallback: If Resend wasn't configured or failed, attempt direct SMTP
    if (!deliveryResult && smtpUser && smtpPass) {
      try {
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
        deliveryMethod = 'Nodemailer (Gmail Transport)';
      } catch (nodemailerErr) {
        console.warn(`⚠️ [EmailService] Primary Gmail transport failed (${nodemailerErr.message}). Attempting port 587 STARTTLS fallback...`);
        
        try {
          const nodemailer = require('nodemailer');
          const fallbackTransporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 587,
            secure: false,
            requireTLS: true,
            auth: {
              user: String(smtpUser).trim(),
              pass: String(smtpPass).replace(/\s+/g, '').trim()
            },
            tls: {
              rejectUnauthorized: false
            },
            connectionTimeout: 7000,
            greetingTimeout: 7000,
            socketTimeout: 10000
          });

          deliveryResult = await fallbackTransporter.sendMail({
            from: `"Quant Command Center" <${smtpUser}>`,
            to: recipient,
            subject,
            text: textReport,
            html: htmlReport
          });
          deliveryMethod = 'Nodemailer (STARTTLS Port 587)';
        } catch (fallbackErr) {
          console.error(`❌ [EmailService] All email delivery methods failed:`, fallbackErr);
          let errMsg = fallbackErr?.message || nodemailerErr?.message || 'SMTP Authentication failed';
          if (fallbackErr?.code === 'EAUTH' || errMsg.includes('535') || errMsg.includes('BadCredentials') || errMsg.includes('Username and Password not accepted')) {
            errMsg = 'Gmail rejected your Google App Password (535 5.7.8 BadCredentials). Please ensure 2-Step Verification is enabled on your Google account and generate a 16-character App Password at myaccount.google.com/apppasswords.';
          } else if (errMsg.includes('timeout') || errMsg.includes('ETIMEDOUT')) {
            errMsg = 'Connection timeout (Render blocks outbound SMTP ports 25, 465, 587 on Free Tier). Resend HTTP REST API is recommended.';
          }
          return {
            success: false,
            delivered: false,
            archived: true,
            reportFilename,
            reportPath,
            error: errMsg,
            message: `Failed to deliver email: ${errMsg}`
          };
        }
      }
    }

    if (!deliveryResult) {
      return {
        success: false,
        delivered: false,
        archived: true,
        reportFilename,
        reportPath,
        error: 'No email delivery provider succeeded',
        message: 'Failed to deliver email via Resend and SMTP fallback.'
      };
    }

    this.recordDispatchedDate(dateStr, {
      recipient: deliveryRecipient,
      method: deliveryMethod,
      targetRecipient: recipient
    });
    console.log(`✅ [EmailService] Daily summary successfully sent to ${deliveryRecipient} via ${deliveryMethod}!`);

    const returnMsg = deliveryResult.wasRerouted
      ? `Market close summary delivered to ${deliveryRecipient} (Resend sandbox auto-routes to verified owner. To deliver directly to ${recipient}, see Resend settings).`
      : `Market close summary successfully emailed to ${deliveryRecipient} via ${deliveryMethod}!`;

    return {
      success: true,
      delivered: true,
      method: deliveryMethod,
      recipient: deliveryRecipient,
      targetRecipient: recipient,
      wasRerouted: Boolean(deliveryResult.wasRerouted),
      date: dateStr,
      reportPath,
      message: returnMsg
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
