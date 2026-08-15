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

// Client Survey Submission & Retrieval Routes
const fs = require("fs");
const path = require("path");

router.post("/save-survey", (req, res) => {
  try {
    const surveyData = req.body;
    surveyData.clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'Unknown IP';
    surveyData.userAgent = req.headers['user-agent'] || 'Unknown Device';
    surveyData.submittedAt = surveyData.submittedAt || new Date().toISOString();

    const dataDir = path.join(__dirname, "../data");
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const filePath = path.join(dataDir, "client_survey_response.json");
    fs.writeFileSync(filePath, JSON.stringify(surveyData, null, 2));
    console.log("✅ Client survey response saved for:", surveyData.clientName || 'Client');

    // Update REQUIREMENTS.md
    const reqPath = path.join(__dirname, "../../REQUIREMENTS.md");
    if (fs.existsSync(reqPath)) {
      let md = `# Project T - Client Requirements & Specification Document\n\n`;
      md += `*Last Updated: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}*\n\n`;
      md += `---
## Section 1: The Big Picture
- **Q1 (System Goal)**: ${surveyData.q1_goal || 'N/A'}
- **Q2 (Approval Mode)**: ${surveyData.q2_approval || 'N/A'}
- **Q3 (Daily Workflow)**: ${surveyData.q3_workflow || 'N/A'}
- **Q4 (Success Metric)**: ${surveyData.q4_success || 'N/A'}

## Section 2: Built Baseline & Indicators
- **Q5 (Baseline Scope)**: ${surveyData.q5_baseline || 'N/A'}
- **Q6 (New Indicators)**: ${(surveyData.q6_indicators || []).join(', ') || 'None'}

## Section 3: Strategy & Auto-Execution
- **Q7 (Strategy Foundation)**: ${surveyData.q7_strategy || 'N/A'}
- **Q8 (Trigger Condition)**: ${surveyData.q8_trigger || 'N/A'}
- **Q9 (Risk & Position Sizing)**: ${(surveyData.q9_risk || []).join(', ') || 'N/A'}
- **Q10 (Emergency Control)**: ${surveyData.q10_killswitch || 'N/A'}
- **Q11 (Broker Target)**: ${surveyData.q11_broker || 'N/A'}
- **Q12 (System Logic)**: ${surveyData.q12_logic || 'N/A'}

## Section 4: Look, Feel & Usage
- **Q13 (Target Devices)**: ${surveyData.q13_devices || 'N/A'}
- **Q14 (Dashboard Layout)**: ${surveyData.q14_layout || 'N/A'}

## Section 5: Priorities & Testing
- **Q15 (Testing Phase)**: ${surveyData.q15_papertrading || 'N/A'}
- **Q16 (Top Priorities)**: ${surveyData.q16_priorities || 'N/A'}

## Additional Notes
- **Custom Notes**: ${surveyData.customNotes || 'None'}
`;
      fs.writeFileSync(reqPath, md);
    }

    res.json({ success: true, message: "Survey saved successfully" });
  } catch (err) {
    console.error("❌ Error saving survey:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get("/survey-results", (req, res) => {
  try {
    const filePath = path.join(__dirname, "../data/client_survey_response.json");
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
      return res.json({ success: true, data });
    }
    return res.json({ success: false, message: "No survey response recorded yet" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;