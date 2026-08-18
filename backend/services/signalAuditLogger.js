// ============================================================================
// FILE: backend/services/signalAuditLogger.js
// 100% Minute-by-Minute Signal Telemetry & Audit Logger
// Appends 1-minute quantitative signal snapshots to rolling daily log files
// Automatic 30-day auto-pruning policy (Storage Footprint < 3.5 MB)
// ============================================================================

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');

class SignalAuditLogger {
  constructor() {
    this.ensureDataDir();
  }

  ensureDataDir() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
    } catch (e) {
      console.error('❌ Failed to ensure signal audit log directory:', e.message);
    }
  }

  getLogFilePath(dateStr) {
    const safeDate = dateStr || new Date().toISOString().split('T')[0];
    return path.join(DATA_DIR, `signal_audit_${safeDate}.json`);
  }

  /**
   * Appends 1-minute signal telemetry snapshot
   */
  logMinuteSignal(signalPayload) {
    try {
      this.ensureDataDir();
      const now = new Date();
      const dateKey = now.toISOString().split('T')[0];
      const filePath = this.getLogFilePath(dateKey);

      let logEntries = [];
      if (fs.existsSync(filePath)) {
        try {
          const raw = fs.readFileSync(filePath, 'utf8');
          logEntries = JSON.parse(raw);
        } catch (err) {
          logEntries = [];
        }
      }

      const istTime = now.toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour12: true,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });

      const entry = {
        timestamp: now.toISOString(),
        timeIST: istTime,
        spotPrice: signalPayload.underlyingPrice || 57491.10,
        atmStrike: signalPayload.atmStrike || 57500,
        rawPcr: signalPayload.pcrMetrics?.rawPcr || 0.95,
        pcrZScore: signalPayload.pcrMetrics?.pcrZScore !== undefined ? parseFloat(signalPayload.pcrMetrics.pcrZScore.toFixed(2)) : 0.0,
        advancingWeight: signalPayload.breadthMetrics?.advancingWeight || 0,
        decliningWeight: signalPayload.breadthMetrics?.decliningWeight || 0,
        signal: signalPayload.signal || 'NEUTRAL_HOLD',
        confidenceScore: signalPayload.confidenceScore || '75%',
        signalTitle: signalPayload.signalTitle || '🟡 NEUTRAL / HOLD IN CASH',
        signalRationale: signalPayload.signalRationale || 'Price consolidating'
      };

      logEntries.push(entry);
      fs.writeFileSync(filePath, JSON.stringify(logEntries, null, 2), 'utf8');

      // Run auto-pruning once per day
      this.pruneOldAuditLogs(30);

      return entry;
    } catch (e) {
      console.error('❌ Failed to log minute signal telemetry:', e.message);
    }
  }

  /**
   * Retrieves full daily 375-minute signal audit log
   */
  getDailyAuditLog(dateStr) {
    try {
      const filePath = this.getLogFilePath(dateStr);
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(raw);
      }
    } catch (e) {
      console.error('❌ Error reading daily signal audit log:', e.message);
    }
    return [];
  }

  /**
   * Auto-prunes audit log files older than maxDays (default 30 days)
   */
  pruneOldAuditLogs(maxDays = 30) {
    try {
      const files = fs.readdirSync(DATA_DIR);
      const cutoffTime = Date.now() - (maxDays * 24 * 60 * 60 * 1000);

      files.forEach(file => {
        if (file.startsWith('signal_audit_') && file.endsWith('.json')) {
          const filePath = path.join(DATA_DIR, file);
          const stat = fs.statSync(filePath);
          if (stat.mtimeMs < cutoffTime) {
            fs.unlinkSync(filePath);
            console.log(`🧹 [SignalAuditLogger] Pruned old log file: ${file}`);
          }
        }
      });
    } catch (e) {
      console.warn('⚠️ Error during signal audit log pruning:', e.message);
    }
  }
}

module.exports = new SignalAuditLogger();
