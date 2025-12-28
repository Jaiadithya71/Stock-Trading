// backend/server.js - MODIFIED VERSION
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

// Start PCR Collector when user authenticates
app.post("/api/start-pcr-collector", async (req, res) => {
  try {
    const { username } = req.body;
    
    if (pcrCollector && pcrCollector.isRunning) {
      return res.json({ 
        success: true, 
        message: "PCR Collector already running" 
      });
    }
    
    console.log(`\n🚀 Starting PCR Collector for ${username}...`);
    
    // Load credentials and authenticate
    const credentials = loadCredentials(username);
    if (!credentials) {
      return res.status(404).json({ 
        success: false, 
        message: "User not found" 
      });
    }
    
    const dashboard = new TradingDashboard(credentials);
    const authResult = await dashboard.authenticate();
    
    if (!authResult.success) {
      return res.status(401).json({ 
        success: false, 
        message: authResult.message 
      });
    }
    
    // Start collector
    pcrCollector = new PCRCollectorService(dashboard.smart_api, 1);
    pcrCollector.start();
    
    console.log(`✅ PCR Collector started successfully`);
    
    res.json({ 
      success: true, 
      message: "PCR Collector started",
      status: pcrCollector.getStatus()
    });
    
  } catch (error) {
    console.error("❌ Error starting PCR Collector:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// Get PCR Collector status
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
    ...pcrCollector.getStatus()
  });
});

// Stop PCR Collector
app.post("/api/stop-pcr-collector", (req, res) => {
  if (!pcrCollector) {
    return res.json({ 
      success: false, 
      message: "PCR Collector not running" 
    });
  }
  
  pcrCollector.stop();
  pcrCollector = null;
  
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