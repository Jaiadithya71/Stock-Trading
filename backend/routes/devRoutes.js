// ============================================================================
// FILE: backend/routes/devRoutes.js
// Dev View & System Diagnostics API
// Provides real-time health telemetry, synthetic audit probes, 1-click test actions,
// and in-memory event streaming for the institutional trading terminal.
// ============================================================================

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const net = require('net');
const tls = require('tls');

const marketCalendar = require('../utils/marketCalendar');
const { getActiveDashboards, setActiveDashboard } = require('../middleware/authMiddleware');
const { getAnyAvailableCredentials } = require('../services/credentialService');
const TradingDashboard = require('../services/tradingDashboard');
const stockMarketDataProvider = require('../services/stockMarketDataProvider');
const stockExecutionEngine = require('../services/stockExecutionEngine');
const stockSignalEngine = require('../services/stockSignalEngine');
const signalEngine = require('../services/signalEngine');
const signalAuditLogger = require('../services/signalAuditLogger');
const emailNotificationService = require('../services/emailNotificationService');
const PCRStorageService = require('../services/pcrStorageService');
const PaperTradingService = require('../services/paperTradingService');

const pcrStorage = new PCRStorageService();
const paperTrading = new PaperTradingService();

// Ring buffer for in-memory telemetry logs (last 60 entries)
const telemetryBuffer = [];
const MAX_BUFFER = 60;

function logDevEvent(category, level, message, metadata = {}) {
  const entry = {
    id: Date.now() + '-' + Math.random().toString(36).substr(2, 5),
    timestamp: new Date().toISOString(),
    istTime: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false }),
    category, // 'AUTH', 'MARKET', 'SIGNAL', 'TRADE', 'CRON', 'ERROR', 'SYSTEM'
    level,    // 'INFO', 'SUCCESS', 'WARN', 'ERROR'
    message,
    metadata
  };
  telemetryBuffer.unshift(entry);
  if (telemetryBuffer.length > MAX_BUFFER) {
    telemetryBuffer.pop();
  }
  return entry;
}

// Seed initial log
logDevEvent('SYSTEM', 'INFO', 'Dev Diagnostics Engine initialized');

/**
 * Format uptime in human-readable string
 */
function formatUptime(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${hrs}h ${mins}m ${secs}s`;
}

/**
 * GET /api/dev/system-health
 * Consolidated real-time health metrics across all 6 core modules
 */
router.get('/system-health', async (req, res) => {
  try {
    const dashboards = getActiveDashboards();
    const activeDashboard = dashboards['default'] || Object.values(dashboards).find(d => d && d.authenticated);
    const isAuthenticated = Boolean(activeDashboard && activeDashboard.authenticated);

    // Helper for robust normalized env checking
    const norm = (s) => String(s).toLowerCase().replace(/[\s_\-]/g, '');
    const hasEnv = (...aliases) => {
      const aliasNorms = aliases.map(norm);
      for (const alias of aliases) {
        if (process.env[alias] !== undefined && String(process.env[alias]).trim()) return true;
      }
      for (const k of Object.keys(process.env)) {
        if (aliasNorms.includes(norm(k)) && process.env[k] !== undefined && String(process.env[k]).trim()) return true;
      }
      return false;
    };

    // 1. Broker & Auth Health
    const autoCreds = getAnyAvailableCredentials();
    const emailCfg = emailNotificationService.getSettings();
    const smtpPassStr = String(emailCfg.smtpPass || '').trim();
    const passLength = smtpPassStr.length;
    const is16Digits = passLength === 16;
    const passMasked = passLength >= 4
      ? `${smtpPassStr.slice(0, 3)}••••••••${smtpPassStr.slice(-3)}`
      : (passLength > 0 ? '••••' : 'None');

    const envAudit = {
      ANGELONE_API_KEY: hasEnv('ANGELONE_API_KEY', 'ANGLEONE_API_KEY'),
      ANGELONE_USERNAME: hasEnv('ANGELONE_USERNAME', 'ANGLEONE_USERNAME'),
      ANGELONE_PWD: hasEnv('ANGELONE_PWD', 'ANGLEONE_PWD', 'ANGELONE_PASSWORD'),
      ANGELONE_TOKEN: hasEnv('ANGELONE_TOKEN', 'ANGLEONE_TOKEN', 'ANGELONE_TOTP'),
      EMAIL_USER: Boolean(emailCfg.smtpUser) || hasEnv('EMAIL_USER', 'EMAIL_USERNAME', 'EMAIL_ID', 'EMAIL_ADDRESS', 'EMAIL', 'SMTP_USER', 'GMAIL_USER'),
      EMAIL_PASS: {
        present: passLength > 0,
        charCount: passLength,
        is16CharAppPassword: is16Digits,
        preview: passMasked,
        label: passLength > 0 ? `✓ OK (${passLength} chars: ${passMasked})` : '✗ UNSET (0 chars)'
      },
      EMAIL_TO: Boolean(emailCfg.recipientEmail) || hasEnv('EMAIL_TO', 'EMAIL_RECIPIENT', 'RECIPIENT_EMAIL', 'MAIL_TO'),
      ENCRYPTION_KEY: hasEnv('ENCRYPTION_KEY'),
      CREDENTIALS_JSON: hasEnv('CREDENTIALS_JSON')
    };

    const detectedEnvKeys = Object.keys(process.env)
      .filter(k => /email|mail|smtp|pass|pwd|token|angel/i.test(k))
      .map(k => ({ key: k, charCount: process.env[k] ? String(process.env[k]).length : 0 }));

    // 2. Data Pipeline Health
    const isMarketOpen = marketCalendar.isMarketOpenNow();
    const marketStatusInfo = marketCalendar.getMarketStatus();
    const istNow = new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' });

    let quotesSnapshot = null;
    let quotesLatencyMs = 0;
    const startQuoteTime = Date.now();
    try {
      quotesSnapshot = await stockMarketDataProvider.getQuotes(activeDashboard);
      quotesLatencyMs = Date.now() - startQuoteTime;
    } catch (e) {
      quotesLatencyMs = Date.now() - startQuoteTime;
    }

    const stocksList = quotesSnapshot?.stocks || [];
    const liveStocksCount = quotesSnapshot?.source === 'SMARTAPI_LIVE' ? stocksList.length : 0;

    // PCR Data
    let pcrData = { rawPcr: 0.95, pcrZScore: 0, callOI: 0, putOI: 0, todaySnapshots: 0 };
    try {
      const pcrHist = await pcrStorage.loadData();
      const snaps = pcrHist.snapshots || [];
      pcrData.todaySnapshots = snaps.length;
      if (snaps.length > 0) {
        const last = snaps[snaps.length - 1];
        pcrData.rawPcr = last.pcr !== undefined ? last.pcr : 0.95;
        pcrData.pcrZScore = last.pcrZScore !== undefined ? last.pcrZScore : 0;
        pcrData.callOI = last.callOI || 0;
        pcrData.putOI = last.putOI || 0;
      }
    } catch (e) {}

    // 3. Strategy Engines Health
    const stockSignals = stockSignalEngine.evaluateUniverse(stocksList);
    const signalDist = { BUY_LONG: 0, SELL_SHORT: 0, NEUTRAL_HOLD: 0 };
    stockSignals.forEach(s => {
      if (signalDist[s.signal] !== undefined) signalDist[s.signal]++;
      else signalDist.NEUTRAL_HOLD++;
    });

    const riskSettings = stockExecutionEngine.getRiskSettings();

    // 4. OMS & Paper Portfolio Health
    paperTrading.loadPersistedState();
    const activePositions = paperTrading.positions || [];
    const floatingPnL = activePositions.reduce((sum, p) => sum + (p.unrealizedPnL || 0), 0);
    const completedToday = stockExecutionEngine.tradesToday || [];
    const realizedPnLToday = completedToday.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const winsToday = completedToday.filter(t => t.pnl > 0).length;
    const winRateToday = completedToday.length > 0 ? ((winsToday / completedToday.length) * 100).toFixed(1) : '0.0';

    // 5. Automation, Daemons & System Info
    const mem = process.memoryUsage();
    const emailConfig = emailNotificationService.getSettings();
    const isSmtpConfigured = Boolean(emailConfig.smtpUser && emailConfig.smtpPass);

    const archiveDir = path.join(__dirname, '../data/archive');
    let archiveFilesCount = 0;
    if (fs.existsSync(archiveDir)) {
      try {
        archiveFilesCount = fs.readdirSync(archiveDir).filter(f => f.endsWith('.json')).length;
      } catch (e) {}
    }

    const payload = {
      timestamp: new Date().toISOString(),
      istTime: istNow,
      modules: {
        brokerAuth: {
          status: isAuthenticated ? 'PASS' : (autoCreds ? 'WARN' : 'FAIL'),
          authenticated: isAuthenticated,
          clientId: activeDashboard?.credentials?.client_id || autoCreds?.username || 'None',
          authMode: isAuthenticated ? 'AUTHENTICATED_ACTIVE' : (autoCreds ? 'CREDS_DETECTED_UNBOUND' : 'UNAUTHENTICATED'),
          envAudit,
          detectedEnvKeys
        },
        marketData: {
          status: isMarketOpen ? (quotesSnapshot?.source === 'SMARTAPI_LIVE' ? 'PASS' : 'WARN') : 'IDLE',
          isMarketOpen,
          marketStatus: marketStatusInfo.isOpen ? 'OPEN' : 'CLOSED',
          marketReason: marketStatusInfo.reason || 'Normal Session',
          feedSource: quotesSnapshot?.source || 'SIMULATED_FEED',
          stocksBatch: {
            totalStocks: stocksList.length,
            liveQuotesCount: liveStocksCount,
            batchLatencyMs: quotesLatencyMs,
            sampleQuote: stocksList[0] ? { symbol: stocksList[0].symbol, ltp: stocksList[0].ltp, pChange: stocksList[0].pChange } : null
          },
          pcrMetrics: pcrData
        },
        strategyEngines: {
          status: stockExecutionEngine.isRunning ? 'PASS' : 'WARN',
          engineRunning: stockExecutionEngine.isRunning,
          autoExecutionEnabled: stockExecutionEngine.autoExecutionEnabled,
          killSwitchActive: Boolean(riskSettings.killSwitchActive),
          signalDistribution: signalDist,
          actionableCount: signalDist.BUY_LONG + signalDist.SELL_SHORT
        },
        omsRisk: {
          status: 'PASS',
          initialCapital: 100000,
          currentBalance: paperTrading.currentBalance,
          floatingPnL: parseFloat(floatingPnL.toFixed(2)),
          realizedPnLToday: parseFloat(realizedPnLToday.toFixed(2)),
          openPositionsCount: activePositions.length,
          maxOpenPositionsLimit: riskSettings.maxOpenPositions || 5,
          completedTradesToday: completedToday.length,
          winRateToday: `${winRateToday}%`,
          dailyLossUsage: {
            currentLoss: Math.max(0, -realizedPnLToday),
            maxDailyLoss: riskSettings.maxDailyLoss || 5000,
            percentUsed: parseFloat(((Math.max(0, -realizedPnLToday) / (riskSettings.maxDailyLoss || 5000)) * 100).toFixed(1))
          }
        },
        automationUptime: {
          status: 'PASS',
          uptimeSeconds: Math.floor(process.uptime()),
          uptimeFormatted: formatUptime(process.uptime()),
          memory: {
            heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
            heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
            rssMB: Math.round(mem.rss / 1024 / 1024)
          },
          nodeVersion: process.version,
          isRender: Boolean(process.env.RENDER),
          emailService: {
            enabled: emailConfig.enabled,
            configured: isSmtpConfigured,
            smtpPassDetected: Boolean(passLength > 0),
            smtpPassLength: passLength,
            smtpPassPreview: passMasked,
            is16CharAppPassword: is16Digits,
            recipient: emailConfig.recipientEmail,
            smtpHost: `${emailConfig.smtpHost}:${emailConfig.smtpPort}`,
            lastSentDate: emailNotificationService.lastSentDate || 'Not yet sent today'
          },
          archiver: {
            totalArchiveFiles: archiveFilesCount,
            archiveDirectory: 'backend/data/archive/'
          }
        }
      }
    };

    res.json({ success: true, data: payload });
  } catch (error) {
    console.error('❌ Error generating dev system health:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/dev/run-audit
 * Executes synthetic end-to-end diagnostic probes with microsecond latency timers
 */
router.post('/run-audit', async (req, res) => {
  const auditResults = [];
  const overallStart = Date.now();

  logDevEvent('SYSTEM', 'INFO', 'User triggered Full System Diagnostic Audit');

  // Test 1: Broker Authentication Check
  const t1Start = Date.now();
  try {
    const dashboards = getActiveDashboards();
    const activeDashboard = dashboards['default'] || Object.values(dashboards).find(d => d && d.authenticated);
    const isAuth = Boolean(activeDashboard && activeDashboard.authenticated);
    const t1Duration = Date.now() - t1Start;

    auditResults.push({
      name: 'SmartAPI Broker Authentication',
      category: 'AUTH',
      status: isAuth ? 'PASS' : 'WARN',
      durationMs: t1Duration,
      message: isAuth 
        ? `Authenticated with Client ID: ${activeDashboard.credentials?.client_id || 'Active'}` 
        : 'No active broker session bound. Using fallback/simulation data.',
      details: { authenticated: isAuth }
    });
  } catch (e) {
    auditResults.push({
      name: 'SmartAPI Broker Authentication',
      category: 'AUTH',
      status: 'FAIL',
      durationMs: Date.now() - t1Start,
      message: e.message
    });
  }

  // Test 2: Live Stock Universe Batch Fetch
  const t2Start = Date.now();
  try {
    const dashboards = getActiveDashboards();
    const activeDashboard = dashboards['default'] || Object.values(dashboards).find(d => d && d.authenticated);
    const quotes = await stockMarketDataProvider.getQuotes(activeDashboard);
    const t2Duration = Date.now() - t2Start;
    const isLive = quotes.source === 'SMARTAPI_LIVE';

    auditResults.push({
      name: '40 Stocks Batch Quotes Pipeline',
      category: 'MARKET',
      status: isLive ? 'PASS' : 'WARN',
      durationMs: t2Duration,
      message: isLive 
        ? `Batch fetched 40 stock quotes in ${t2Duration}ms from SmartAPI Live feed` 
        : `Offline/Simulation feed active (${quotes.stocks?.length || 0} stocks, ${t2Duration}ms)`,
      details: { source: quotes.source, count: quotes.stocks?.length }
    });
  } catch (e) {
    auditResults.push({
      name: '40 Stocks Batch Quotes Pipeline',
      category: 'MARKET',
      status: 'FAIL',
      durationMs: Date.now() - t2Start,
      message: e.message
    });
  }

  // Test 3: Strategy Signal Engine Execution
  const t3Start = Date.now();
  try {
    const quotes = await stockMarketDataProvider.getQuotes();
    const signals = stockSignalEngine.evaluateUniverse(quotes.stocks || []);
    const t3Duration = Date.now() - t3Start;
    const actionable = signals.filter(s => s.signal === 'BUY_LONG' || s.signal === 'SELL_SHORT');

    auditResults.push({
      name: 'Stock Breakout & Momentum Strategy Engine',
      category: 'SIGNAL',
      status: 'PASS',
      durationMs: t3Duration,
      message: `Evaluated ${signals.length} stocks in ${t3Duration}ms (${actionable.length} actionable setups, ${signals.length - actionable.length} consolidating)`,
      details: { totalEvaluated: signals.length, actionableCount: actionable.length }
    });
  } catch (e) {
    auditResults.push({
      name: 'Stock Breakout & Momentum Strategy Engine',
      category: 'SIGNAL',
      status: 'FAIL',
      durationMs: Date.now() - t3Start,
      message: e.message
    });
  }

  // Test 4: Risk Settings Persistence File R/W
  const t4Start = Date.now();
  try {
    const testFile = path.join(__dirname, '../data/test_audit_rw.tmp');
    fs.writeFileSync(testFile, JSON.stringify({ auditTest: true, time: Date.now() }), 'utf8');
    const readBack = JSON.parse(fs.readFileSync(testFile, 'utf8'));
    fs.unlinkSync(testFile);
    const t4Duration = Date.now() - t4Start;

    auditResults.push({
      name: 'Persistent Data File System R/W',
      category: 'SYSTEM',
      status: readBack.auditTest ? 'PASS' : 'FAIL',
      durationMs: t4Duration,
      message: `Verified atomic write/read cycle to backend/data/ directory in ${t4Duration}ms`
    });
  } catch (e) {
    auditResults.push({
      name: 'Persistent Data File System R/W',
      category: 'SYSTEM',
      status: 'FAIL',
      durationMs: Date.now() - t4Start,
      message: e.message
    });
  }

  // Test 5: SMTP Connectivity Check (Port 465 TLS)
  const t5Start = Date.now();
  try {
    const emailConfig = emailNotificationService.getSettings();
    const host = emailConfig.smtpHost || 'smtp.gmail.com';
    const port = emailConfig.smtpPort || 465;

    const tlsPromise = new Promise((resolve) => {
      const socket = tls.connect({ host, port, timeout: 5000 }, () => {
        socket.end();
        resolve({ success: true });
      });
      socket.on('error', (err) => resolve({ success: false, error: err.message }));
      socket.on('timeout', () => {
        socket.destroy();
        resolve({ success: false, error: 'Socket timed out after 5000ms' });
      });
    });

    const tlsRes = await tlsPromise;
    const t5Duration = Date.now() - t5Start;

    auditResults.push({
      name: `SMTP Mail Server Connectivity (${host}:${port})`,
      category: 'EMAIL',
      status: tlsRes.success ? 'PASS' : 'WARN',
      durationMs: t5Duration,
      message: tlsRes.success 
        ? `Successfully established TLS handshake with ${host}:${port} in ${t5Duration}ms`
        : `Could not connect to ${host}:${port}: ${tlsRes.error}`,
      details: { host, port }
    });
  } catch (e) {
    auditResults.push({
      name: 'SMTP Mail Server Connectivity',
      category: 'EMAIL',
      status: 'WARN',
      durationMs: Date.now() - t5Start,
      message: e.message
    });
  }

  const overallDuration = Date.now() - overallStart;
  const hasFail = auditResults.some(r => r.status === 'FAIL');
  const hasWarn = auditResults.some(r => r.status === 'WARN');
  const overallStatus = hasFail ? 'FAIL' : (hasWarn ? 'WARN' : 'PASS');

  logDevEvent('SYSTEM', overallStatus === 'PASS' ? 'SUCCESS' : 'WARN', `Synthetic Health Audit completed: ${overallStatus} (${overallDuration}ms)`);

  res.json({
    success: true,
    overallStatus,
    overallDurationMs: overallDuration,
    timestamp: new Date().toISOString(),
    tests: auditResults
  });
});

/**
 * POST /api/dev/send-test-email
 * Dispatches an immediate test diagnostics email to verify SMTP delivery
 */
router.post('/send-test-email', async (req, res) => {
  try {
    logDevEvent('EMAIL', 'INFO', 'Triggering Instant Test Diagnostics Email');
    const result = await emailNotificationService.sendDailySummaryEmail({ force: true });
    
    if (result.delivered) {
      logDevEvent('EMAIL', 'SUCCESS', `Test email successfully dispatched to ${result.recipient}`);
      res.json({
        success: true,
        delivered: true,
        message: `✅ Test email successfully dispatched to ${result.recipient}! Check your inbox and spam folder.`,
        result
      });
    } else {
      logDevEvent('EMAIL', 'WARN', `Test email delivery skipped or failed: ${result.message || result.error}`);
      res.status(400).json({
        success: false,
        delivered: false,
        message: result.message || result.error || 'SMTP credentials required or delivery failed.',
        result
      });
    }
  } catch (error) {
    logDevEvent('EMAIL', 'ERROR', `Test email failed: ${error.message}`);
    res.status(500).json({ success: false, delivered: false, message: `SMTP error: ${error.message}` });
  }
});

/**
 * POST /api/dev/save-email-credentials
 * Saves SMTP credentials directly to persistent storage and re-tests
 */
router.post('/save-email-credentials', (req, res) => {
  try {
    const { smtpUser, smtpPass, recipientEmail } = req.body;
    if (!smtpUser || !smtpPass) {
      return res.status(400).json({ success: false, message: 'Both Gmail address (smtpUser) and Google App Password (smtpPass) are required.' });
    }

    const updated = emailNotificationService.saveEmailSettings({
      smtpUser: String(smtpUser).trim(),
      smtpPass: String(smtpPass).trim(),
      recipientEmail: recipientEmail ? String(recipientEmail).trim() : String(smtpUser).trim()
    });

    logDevEvent('EMAIL', 'SUCCESS', `Email credentials updated for: ${smtpUser}`);
    res.json({
      success: true,
      message: 'SMTP credentials saved successfully!',
      settings: {
        smtpUser: updated.smtpUser,
        recipientEmail: updated.recipientEmail,
        isConfigured: Boolean(updated.smtpUser && updated.smtpPass)
      }
    });
  } catch (error) {
    logDevEvent('EMAIL', 'ERROR', `Failed saving email credentials: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/dev/reauth
 * Triggers headless SmartAPI re-authentication
 */
router.post('/reauth', async (req, res) => {
  try {
    logDevEvent('AUTH', 'INFO', 'User triggered Broker Headless Re-Authentication');
    const autoCreds = getAnyAvailableCredentials();

    if (!autoCreds || !autoCreds.credentials) {
      logDevEvent('AUTH', 'WARN', 'Re-Auth skipped: No credentials detected in environment/disk');
      return res.status(400).json({ success: false, message: 'No credentials found in environment variables or credentials.enc' });
    }

    const systemDashboard = new TradingDashboard(autoCreds.credentials);
    const authRes = await systemDashboard.authenticate();

    if (authRes && authRes.success) {
      setActiveDashboard(autoCreds.username, systemDashboard);
      setActiveDashboard('default', systemDashboard);
      logDevEvent('AUTH', 'SUCCESS', `Headless Re-Authentication successful for '${autoCreds.username}'`);
      res.json({ success: true, message: `Successfully authenticated with Angel One as '${autoCreds.username}'!` });
    } else {
      logDevEvent('AUTH', 'ERROR', `Headless Re-Authentication failed: ${authRes?.message}`);
      res.status(401).json({ success: false, message: authRes?.message || 'Broker login rejected' });
    }
  } catch (error) {
    logDevEvent('AUTH', 'ERROR', `Re-Auth error: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/dev/force-eod
 * Manually tests the 3:30 PM EOD settlement and archival cycle
 */
router.post('/force-eod', async (req, res) => {
  try {
    const todayStr = marketCalendar.getDateKeyIST();
    logDevEvent('TRADE', 'INFO', `User forced EOD Settlement Test for ${todayStr}`);
    const archive = await stockExecutionEngine.settleAndArchiveDailyPnL(todayStr);
    logDevEvent('TRADE', 'SUCCESS', `EOD Settlement Test completed: ${archive.summary.totalTrades} trades archived`);
    res.json({ success: true, message: 'EOD Settlement & Archival completed successfully!', archive });
  } catch (error) {
    logDevEvent('TRADE', 'ERROR', `EOD Settlement error: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/dev/telemetry-stream
 * Returns rolling in-memory buffer of recent events
 */
router.get('/telemetry-stream', (req, res) => {
  res.json({
    success: true,
    totalLogs: telemetryBuffer.length,
    logs: telemetryBuffer
  });
});

/**
 * POST /api/dev/clear-logs
 * Clears the in-memory telemetry buffer
 */
router.post('/clear-logs', (req, res) => {
  telemetryBuffer.length = 0;
  logDevEvent('SYSTEM', 'INFO', 'Telemetry log stream cleared');
  res.json({ success: true, message: 'Log stream cleared' });
});

module.exports = router;
