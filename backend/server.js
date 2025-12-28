// backend/server.js - FIXED VERSION (Non-blocking PCR collector)
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

/**
 * Start PCR Collector in background (non-blocking)
 */
async function startPCRCollectorBackground(username) {
  try {
    // Don't start if already running
    if (pcrCollector && pcrCollector.isRunning) {
      console.log('✅ PCR Collector already running');
      return { success: true, alreadyRunning: true };
    }
    
    console.log(`\n🚀 Starting PCR Collector for ${username} (background)...`);
    
    // Load credentials and authenticate
    const credentials = loadCredentials(username);
    if (!credentials) {
      console.error('❌ PCR Collector: User not found');
      return { success: false, message: "User not found" };
    }
    
    const dashboard = new TradingDashboard(credentials);
    const authResult = await dashboard.authenticate();
    
    if (!authResult.success) {
      console.error('❌ PCR Collector: Authentication failed');
      return { success: false, message: authResult.message };
    }
    
    // Start collector
    pcrCollector = new PCRCollectorService(dashboard.smart_api, 1);
    pcrCollectorUsername = username;
    pcrCollector.start();
    
    console.log(`✅ PCR Collector started successfully (background)\n`);
    
    return { success: true, alreadyRunning: false };
    
  } catch (error) {
    console.error("❌ Error starting PCR Collector:", error.message);
    return { success: false, message: error.message };
  }
}

/**
 * Start PCR Collector (non-blocking endpoint)
 */
app.post("/api/start-pcr-collector", async (req, res) => {
  const { username } = req.body;
  
  // Return immediately, start in background
  res.json({ 
    success: true, 
    message: "PCR Collector starting in background...",
    status: {
      isRunning: false,
      starting: true
    }
  });
  
  // Start in background (don't await)
  startPCRCollectorBackground(username).then(result => {
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
  
  res.json({ 
    success: true, 
    message: "PCR Collector stopped" 
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Trading Dashboard API running on port ${PORT}`);
  console.log(`📊 Access the dashboard at http://localhost:${PORT}`);
  console.log(`\n💡 PCR Collector will start automatically when you authenticate`);
  console.log(`   (Running in background - won't block dashboard loading)\n`);
});

// Cleanup on exit
process.on('SIGINT', () => {
  console.log('\n\n🛑 Shutting down server...');
  if (pcrCollector) {
    pcrCollector.stop();
  }
  process.exit(0);
});

module.exports = app;