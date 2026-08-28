// backend/server.js - FIXED VERSION (PCR collector starts after auth)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const routes = require("./routes/routes");
const PCRCollectorService = require("./services/pcrCollectorService");
const TradingDashboard = require("./services/tradingDashboard");
const { loadCredentials } = require("./services/credentialService");
const signalScheduler = require("./services/signalScheduler");

// Global process safety handlers to prevent container crashes on async network timeouts
process.on("unhandledRejection", (reason, promise) => {
  console.warn("⚠️  [Server Safety] Unhandled Async Rejection:", reason?.message || reason);
});

process.on("uncaughtException", (error) => {
  console.error("❌ [Server Safety] Uncaught Exception:", error.message);
});

const app = express();

// Middleware
app.use(cors()); // Enable CORS for all routes
app.use(bodyParser.json());

// Multi-path resolution for frontend files (supports both local and Render rootDir deployments)
function getFrontendFile(filename) {
  const possiblePaths = [
    path.join(__dirname, "../frontend", filename),
    path.join(__dirname, "frontend", filename),
    path.join(process.cwd(), "../frontend", filename),
    path.join(process.cwd(), "frontend", filename)
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  return possiblePaths[0];
}

const frontendFolder = [
  path.join(__dirname, "../frontend"),
  path.join(__dirname, "frontend"),
  path.join(process.cwd(), "../frontend"),
  path.join(process.cwd(), "frontend")
].find(d => fs.existsSync(d)) || path.join(__dirname, "../frontend");

app.use(express.static(frontendFolder));

// Health check endpoint (for Render)
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API Routes
app.use("/api", routes);

// Serve index.html
app.get("/", (req, res) => {
  res.sendFile(getFrontendFile("index.html"));
});

// Serve survey.html
app.get(["/survey", "/survey.html"], (req, res) => {
  res.sendFile(getFrontendFile("survey.html"));
});

// Health check & keep-alive ping endpoint for uptime monitors
app.get("/health", (req, res) => {
  res.json({
    status: "UP",
    timestamp: new Date().toISOString(),
    pcrCollectorRunning: pcrCollector ? pcrCollector.isRunning : false,
    message: "Render keep-alive ping received"
  });
});

// Global PCR collector instance
let pcrCollector = null;
let pcrCollectorUsername = null;
let pcrCollectorDashboard = null;

/**
 * Start PCR Collector ONLY after successful authentication
 * FIXED: Now receives authenticated dashboard instance
 */
async function startPCRCollectorBackground(username, authenticatedDashboard) {
  try {
    // Don't start if already running for this user
    if (pcrCollector && pcrCollector.isRunning && pcrCollectorUsername === username) {
      console.log('✅ PCR Collector already running for this user');
      return { success: true, alreadyRunning: true };
    }
    
    // Stop existing collector if running for different user
    if (pcrCollector && pcrCollector.isRunning) {
      console.log(`⚠️  Stopping PCR Collector for ${pcrCollectorUsername}...`);
      pcrCollector.stop();
    }
    
    console.log(`\n🚀 Starting PCR Collector for ${username}...`);
    
    // Use the ALREADY AUTHENTICATED dashboard instance
    pcrCollector = new PCRCollectorService(authenticatedDashboard.smart_api, 1);
    pcrCollectorUsername = username;
    pcrCollectorDashboard = authenticatedDashboard;
    
    pcrCollector.start();
    
    console.log(`✅ PCR Collector started successfully\n`);
    
    return { success: true, alreadyRunning: false };
    
  } catch (error) {
    console.error("❌ Error starting PCR Collector:", error.message);
    return { success: false, message: error.message };
  }
}

/**
 * Start PCR Collector endpoint
 * FIXED: Now waits for authenticated dashboard from frontend
 */
app.post("/api/start-pcr-collector", async (req, res) => {
  try {
    const { username } = req.body || {};
    
    if (!username) {
      return res.status(400).json({ 
        success: false, 
        message: "Username required" 
      });
    }
    
    // Check if user has authenticated dashboard in active sessions
    const { getActiveDashboards } = require("./middleware/authMiddleware");
    const activeDashboards = getActiveDashboards();
    const userDashboard = activeDashboards[username];
    
    if (!userDashboard || !userDashboard.authenticated) {
      return res.status(401).json({ 
        success: false, 
        message: "User not authenticated. Please login first." 
      });
    }
    
    // Return immediately, start in background
    res.json({ 
      success: true, 
      message: "PCR Collector starting...",
      status: {
        isRunning: false,
        starting: true
      }
    });
    
    // Start in background (don't await)
    startPCRCollectorBackground(username, userDashboard).then(result => {
      if (result.success) {
        console.log('✅ PCR Collector background start completed');
      } else {
        console.error('❌ PCR Collector background start failed:', result.message);
      }
    }).catch(error => {
      console.error('❌ PCR Collector background start error:', error);
    });
  } catch (error) {
    console.error("❌ Error starting PCR collector endpoint:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * Get PCR Collector status
 */
app.get("/api/pcr-collector-status", (req, res) => {
  try {
    if (!pcrCollector) {
      return res.json({ 
        success: true,
        isRunning: false,
        message: "PCR Collector not initialized"
      });
    }
    
    res.json({ 
      success: true,
      ...pcrCollector.getStatus(),
      username: pcrCollectorUsername
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * Stop PCR Collector
 */
app.post("/api/stop-pcr-collector", (req, res) => {
  try {
    if (!pcrCollector) {
      return res.json({ 
        success: false, 
        message: "PCR Collector not running" 
      });
    }
    
    pcrCollector.stop();
    pcrCollector = null;
    pcrCollectorUsername = null;
    pcrCollectorDashboard = null;
    
    res.json({ 
      success: true, 
      message: "PCR Collector stopped" 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

app.listen(PORT, HOST, async () => {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 Trading Dashboard API Server');
  console.log('='.repeat(60));
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔧 Port: ${PORT}`);
  if (!process.env.RENDER) {
    console.log(`📊 Dashboard URL: http://localhost:${PORT}`);
  }
  console.log('='.repeat(60));

  // Initialize futures instruments dynamically in the background (non-blocking)
  console.log('\n📦 Loading futures instruments asynchronously...');
  const { initializeFuturesInstruments } = require("./config/constants");
  initializeFuturesInstruments().catch(err => {
    console.warn("⚠️ Background futures loading error:", err.message);
  });

  console.log('\n💡 Server Features:');
  console.log('   ✅ Fast parallel data fetching');
  console.log('   ✅ 5-second API timeout protection');
  console.log('   ✅ Smart market-aware intervals');
  console.log('   ✅ PCR collector (starts after login)');
  console.log('   ✅ Autonomous 60s signal evaluation & telemetry scheduler');
  console.log('   ✅ Automatic cache management');
  // Headless Auto-Authentication for Render Deployment / Background Daemons
  const { getAnyAvailableCredentials } = require("./services/credentialService");
  const { setActiveDashboard } = require("./middleware/authMiddleware");
  const autoCreds = getAnyAvailableCredentials();

  if (autoCreds && autoCreds.credentials) {
    console.log(`\n🔐 Attempting headless background authentication for '${autoCreds.username}'...`);
    const systemDashboard = new TradingDashboard(autoCreds.credentials);
    systemDashboard.authenticate().then(authRes => {
      if (authRes && authRes.success) {
        setActiveDashboard(autoCreds.username, systemDashboard);
        setActiveDashboard('default', systemDashboard);
        console.log(`✅ Headless background authentication successful for '${autoCreds.username}'`);

        // Automatically launch PCR collector in background
        startPCRCollectorBackground(autoCreds.username, systemDashboard);
      } else {
        console.warn(`⚠️ Headless background authentication failed:`, authRes?.message);
      }
    }).catch(err => {
      console.warn(`⚠️ Headless background authentication error:`, err.message);
    });
  } else {
    console.log('ℹ️  No background credentials detected for auto-login. Waiting for user login.');
  }

  // Start Autonomous 60-Second Signal Evaluation & Audit Scheduler
  signalScheduler.start();
});

// Cleanup on exit
process.on('SIGINT', () => {
  console.log('\n\n🛑 Shutting down server...');
  if (pcrCollector) {
    console.log('   Stopping PCR Collector...');
    pcrCollector.stop();
  }
  if (signalScheduler) {
    signalScheduler.stop();
  }
  console.log('✅ Cleanup complete. Goodbye!\n');
  process.exit(0);
});

module.exports = app;