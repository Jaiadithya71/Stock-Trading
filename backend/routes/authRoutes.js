const express = require("express");
const router = express.Router();
const { saveCredentials, loadCredentials, userExists } = require("../services/credentialService");
const TradingDashboard = require("../services/tradingDashboard");
const { setActiveDashboard } = require("../middleware/authMiddleware");

router.post("/check-user", (req, res) => {
  const { username } = req.body;
  const exists = userExists(username);
  res.json({ exists });
});

router.post("/save-credentials", (req, res) => {
  const { username, credentials } = req.body;
  try {
    saveCredentials(username, credentials);
    res.json({ success: true, message: "Credentials saved successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/authenticate", async (req, res) => {
  const { username } = req.body;
  
  try {
    const credentials = loadCredentials(username);
    if (!credentials) {
      return res.status(404).json({ 
        success: false, 
        message: "User not found" 
      });
    }
    
    const dashboard = new TradingDashboard(credentials);
    const authResult = await dashboard.authenticate();
    
    if (authResult.success) {
      setActiveDashboard(username, dashboard);
      res.json(authResult);
    } else {
      res.status(401).json(authResult);
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;