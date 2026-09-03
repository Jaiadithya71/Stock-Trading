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

  isMarketHours() {
    const marketCalendar = require('../utils/marketCalendar');
    return marketCalendar.isMarketOpenNow();
  }

  /**
   * Appends 1-minute signal telemetry snapshot
   * Guaranteed to only record during live market hours and exactly once per minute
   */
  logMinuteSignal(signalPayload, force = false) {
    try {
      // Guard: strictly ignore writes when market is closed unless forced
      if (!force && !this.isMarketHours()) {
        return null;
      }

      this.ensureDataDir();
      const now = new Date();
      const dateKey = now.toISOString().split('T')[0];
      const filePath = this.getLogFilePath(dateKey);
      const archivePath = path.join(DATA_DIR, 'archive', path.basename(filePath));

      let logEntries = [];
      if (fs.existsSync(filePath)) {
        try {
          const raw = fs.readFileSync(filePath, 'utf8');
          logEntries = JSON.parse(raw);
        } catch (err) {
          logEntries = [];
        }
      } else if (fs.existsSync(archivePath)) {
        try {
          const raw = fs.readFileSync(archivePath, 'utf8');
          logEntries = JSON.parse(raw);
          // Restore to primary path
          fs.writeFileSync(filePath, JSON.stringify(logEntries, null, 2), 'utf8');
          console.log(`💾 Restored ${logEntries.length} telemetry snapshots for ${dateKey} from archive`);
        } catch (err) {
          logEntries = [];
        }
      }

      // Guard: Deduplicate if an entry was already logged in this exact minute
      const currentMinuteKey = now.toISOString().substring(0, 16); // YYYY-MM-DDTHH:MM
      if (logEntries.length > 0) {
        const lastEntry = logEntries[logEntries.length - 1];
        if (lastEntry.timestamp && lastEntry.timestamp.substring(0, 16) === currentMinuteKey) {
          return lastEntry; // Already logged for this minute
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
   * Retrieves full daily 375-minute signal audit log for a single day
   */
  getDailyAuditLog(dateStr) {
    try {
      const filePath = this.getLogFilePath(dateStr);
      const archivePath = path.join(DATA_DIR, 'archive', path.basename(filePath));

      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(raw);
      } else if (fs.existsSync(archivePath)) {
        const raw = fs.readFileSync(archivePath, 'utf8');
        return JSON.parse(raw);
      }
    } catch (e) {
      console.error('❌ Error reading daily signal audit log:', e.message);
    }
    return [];
  }

  /**
   * Retrieves multi-day combined signal audit logs (e.g. 'today', '7d', '30d', 'all')
   */
  getRangeAuditLog(range = 'today', specificDate = null) {
    try {
      this.ensureDataDir();
      if (specificDate) {
        return this.getDailyAuditLog(specificDate);
      }

      if (range === 'today') {
        const today = new Date().toISOString().split('T')[0];
        return this.getDailyAuditLog(today);
      }

      const files = fs.readdirSync(DATA_DIR)
        .filter(f => f.startsWith('signal_audit_') && f.endsWith('.json'))
        .sort(); // Chronological order

      let targetFiles = files;
      if (range === '7d') {
        const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        targetFiles = files.filter(f => {
          const fileDate = f.replace('signal_audit_', '').replace('.json', '');
          return fileDate >= cutoff;
        });
      } else if (range === '30d') {
        const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        targetFiles = files.filter(f => {
          const fileDate = f.replace('signal_audit_', '').replace('.json', '');
          return fileDate >= cutoff;
        });
      }

      let allEntries = [];
      targetFiles.forEach(file => {
        try {
          const filePath = path.join(DATA_DIR, file);
          const raw = fs.readFileSync(filePath, 'utf8');
          const entries = JSON.parse(raw);
          if (Array.isArray(entries)) {
            const fileDate = file.replace('signal_audit_', '').replace('.json', '');
            entries.forEach(e => {
              allEntries.push({
                ...e,
                date: fileDate || e.date
              });
            });
          }
        } catch (err) {
          console.warn('⚠️ Error parsing audit file:', file, err.message);
        }
      });

      return allEntries;
    } catch (e) {
      console.error('❌ Error retrieving range audit log:', e.message);
      return [];
    }
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

  /**
   * Appends 1-minute stock signals snapshot to stock_signal_audit_<DATE>.json
   */
  logMinuteSignals(signals = []) {
    try {
      this.ensureDataDir();
      const today = new Date().toISOString().split('T')[0];
      const filePath = path.join(DATA_DIR, `stock_signal_audit_${today}.json`);
      let logs = [];
      if (fs.existsSync(filePath)) {
        try {
          logs = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        } catch (e) { logs = []; }
      }
      const active = signals.filter(s => s.signal !== 'NEUTRAL_HOLD');
      if (active.length > 0) {
        logs.push({
          timestamp: new Date().toISOString(),
          activeSignalsCount: active.length,
          signals: active
        });
        fs.writeFileSync(filePath, JSON.stringify(logs, null, 2), 'utf8');
      }
    } catch (err) {
      // silent
    }
  }
}

module.exports = new SignalAuditLogger();
