// backend/server.js - FIXED VERSION (PCR collector starts after auth)
const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const routes = require("./routes/routes");
const PCRCollectorService = require("./services/pcrCollectorService");
const TradingDashboard = require("./services/tradingDashboard");
const { loadCredentials } = require("./services/credentialService");

const app = express();

// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "../frontend")));

// API Routes
app.use("/api", routes);

// Serve index.html
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
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
  const { username } = req.body;
  
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
});

/**
 * Get PCR Collector status
 */
app.get("/api/pcr-collector-status", (req, res) => {
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
});

/**
 * Stop PCR Collector
 */
app.post("/api/stop-pcr-collector", (req, res) => {
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
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 Trading Dashboard API Server');
  console.log('='.repeat(60));
  console.log(`📊 Dashboard URL: http://localhost:${PORT}`);
  console.log(`🔧 API Base URL: http://localhost:${PORT}/api`);
  console.log('='.repeat(60));
  console.log('\n💡 Server Features:');
  console.log('   ✅ Fast parallel data fetching');
  console.log('   ✅ 5-second API timeout protection');
  console.log('   ✅ Smart market-aware intervals');
  console.log('   ✅ PCR collector (starts after login)');
  console.log('   ✅ Automatic cache management');
  console.log('\n🔄 Ready to accept connections!\n');
});

// Cleanup on exit
process.on('SIGINT', () => {
  console.log('\n\n🛑 Shutting down server...');
  if (pcrCollector) {
    console.log('   Stopping PCR Collector...');
    pcrCollector.stop();
  }
  console.log('✅ Cleanup complete. Goodbye!\n');
  process.exit(0);
});

module.exports = app;