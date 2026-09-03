// ============================================================================
// FILE: backend/routes/simulationRoutes.js
// Stage 1: Historical Simulation & Backtesting Routes
// ============================================================================

const express = require('express');
const router = express.Router();
const backtestSimulationService = require('../services/backtestSimulationService');

router.get('/results', (req, res) => {
  try {
    const results = backtestSimulationService.getLatestResults();
    res.json({ success: true, ...results });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/run', (req, res) => {
  try {
    const params = req.body || {};
    const results = backtestSimulationService.runSimulation(params);
    res.json({ success: true, message: 'Simulation completed successfully', ...results });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
