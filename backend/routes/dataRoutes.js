const express = require("express");
const router = express.Router();
const { requireAuth } = require("../middleware/authMiddleware");
const { SYMBOL_TOKEN_MAP, INDICES_INSTRUMENTS, TIME_INTERVALS } = require("../config/constants");

router.post("/banknifty-data", requireAuth, async (req, res) => {
  const dashboard = req.dashboard;
  const results = [];
  
  for (const [symbol, token] of Object.entries(SYMBOL_TOKEN_MAP)) {
    const response = await dashboard.getCandleData("NSE", token, "ONE_MINUTE");
    
    if (response.status && response.data && response.data.length > 0) {
      const candle = response.data[response.data.length - 1];
      const ltp = candle[4];
      const volume = candle[5];
      const changePercent = ((candle[4] - candle[1]) / candle[1]) * 100;
      const status = dashboard.getStatus(symbol, candle[4]);
      
      results.push({
        bank: symbol,
        ltp: ltp.toFixed(2),
        volume,
        changePercent: changePercent.toFixed(2),
        status
      });
    }
  }
  
  res.json({ success: true, data: results });
});

router.post("/indices-data", requireAuth, async (req, res) => {
  const dashboard = req.dashboard;
  const results = {};
  
  for (const [symbol, info] of Object.entries(INDICES_INSTRUMENTS)) {
    results[symbol] = {};
    
    for (const interval of TIME_INTERVALS) {
      const response = await dashboard.getCandleData(info.exchange, info.token, interval);
      
      if (response.status && response.data && response.data.length > 0) {
        const candle = response.data[response.data.length - 1];
        const sentiment = dashboard.getSentiment(symbol + "_" + interval, candle[4]);
        results[symbol][interval] = sentiment;
      } else {
        results[symbol][interval] = "No Data";
      }
    }
  }
  
  res.json({ success: true, data: results });
});

module.exports = router;