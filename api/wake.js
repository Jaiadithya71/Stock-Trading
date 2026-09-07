// ============================================================================
// FILE: api/wake.js
// Vercel Serverless Function - High-Reliability Render Keep-Alive Probe ($0 Cost)
// Runs on Vercel's Edge/Serverless infrastructure with 90s socket timeout & retry loop
// ============================================================================

const https = require('https');

module.exports = async (req, res) => {
  const targetUrl = process.env.RENDER_HEALTH_URL || 'https://stock-trading-1-cquo.onrender.com/health';
  const startTime = Date.now();
  const logs = [];

  const log = (msg) => {
    console.log(msg);
    logs.push(msg);
  };

  log(`⏰ [Vercel Keep-Alive] Probing Render: ${targetUrl}`);

  const probe = () => {
    return new Promise((resolve) => {
      const request = https.get(targetUrl, { timeout: 60000, rejectUnauthorized: false }, (response) => {
        let data = '';
        response.on('data', chunk => data += chunk);
        response.on('end', () => {
          resolve({ status: response.statusCode, body: data });
        });
      });

      request.on('error', (err) => {
        resolve({ status: 0, error: err.message });
      });

      request.on('timeout', () => {
        request.destroy();
        resolve({ status: 408, error: 'Socket timeout after 60s' });
      });
    });
  };

  let attempts = 0;
  const maxAttempts = 3;
  let success = false;
  let lastStatus = 0;

  while (attempts < maxAttempts && !success) {
    attempts++;
    log(`Attempt ${attempts}/${maxAttempts}: Probing /health...`);
    const result = await probe();
    lastStatus = result.status;
    log(`Result: HTTP ${result.status} ${result.error ? '(' + result.error + ')' : ''}`);

    if (result.status === 200) {
      success = true;
      log(`✅ Render is warm, awake, and healthy!`);
      break;
    }

    if (attempts < maxAttempts) {
      log(`⏳ Render is booting (HTTP ${result.status}). Waiting 15s before next attempt...`);
      await new Promise(r => setTimeout(r, 15000));
    }
  }

  const durationMs = Date.now() - startTime;

  return res.status(success ? 200 : 502).json({
    success,
    targetUrl,
    attempts,
    finalStatus: lastStatus,
    durationMs,
    timestamp: new Date().toISOString(),
    logs
  });
};
