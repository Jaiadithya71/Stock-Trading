// backend/routes/routes.js - UPDATED WITH PCR
const express = require("express");
const router = express.Router();
const authRoutes = require("./authRoutes");
const dataRoutes = require("./dataRoutes");
const dataCheckRoutes = require("./dataCheckRoutes");
const statusRoute = require("./statusRoute");
const currencyRoutes = require("./currencyRoutes");
const nseOptionRoutes = require("./nseOptionRoutes");
const pcrRoutes = require("./pcrRoutes"); // NEW

// Mount routes
router.use(authRoutes);
router.use(dataRoutes);
router.use(dataCheckRoutes);
router.use(statusRoute);
router.use(currencyRoutes);
router.use(nseOptionRoutes); // No auth required
router.use(pcrRoutes); // NEW - PCR data routes

// Client Survey Submission Route
const fs = require("fs");
const path = require("path");

router.post("/save-survey", (req, res) => {
  try {
    const surveyData = req.body;
    const dataDir = path.join(__dirname, "../data");
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const filePath = path.join(dataDir, "client_survey_response.json");
    fs.writeFileSync(filePath, JSON.stringify(surveyData, null, 2));
    console.log("✅ Client survey response saved!");

    // Update REQUIREMENTS.md
    const reqPath = path.join(__dirname, "../../REQUIREMENTS.md");
    if (fs.existsSync(reqPath)) {
      let md = fs.readFileSync(reqPath, "utf8");
      md += `\n\n---\n## Client Survey Submission (${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })})\n\n- **Execution Mode**: ${surveyData.executionMode || 'N/A'}\n- **Broker Target**: ${surveyData.broker || 'N/A'}\n- **Risk Controls**: ${(surveyData.riskControls || []).join(', ') || 'N/A'}\n- **Instruments**: ${(surveyData.instruments || []).join(', ') || 'N/A'}\n- **Custom Notes**: ${surveyData.customNotes || 'None'}\n`;
      fs.writeFileSync(reqPath, md);
    }

    res.json({ success: true, message: "Survey saved successfully" });
  } catch (err) {
    console.error("❌ Error saving survey:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;