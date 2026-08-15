# Deployment Research Plan: Bank Nifty Trading Dashboard

## Project Architecture Summary

Before selecting a deployment platform, understanding the project's requirements is critical:

| Component | Description | Deployment Challenge |
|-----------|-------------|---------------------|
| Express Backend | Node.js server on port 3000 | Needs persistent process |
| Static Frontend | Vanilla JS served by Express | Can be separated or bundled |
| PCR Collector | Background service running every minute | Requires always-on process |
| Data Storage | JSON files (`pcr_snapshots_*.json`) | Needs persistent filesystem |
| Authentication | In-memory session storage (`activeDashboards`) | Stateful, lost on restart |
| Credentials | Encrypted file (`credentials.enc`) | Needs secure file access |
| External APIs | Angel One SmartAPI, NSE India | Outbound HTTPS required |

---

## Platform Comparison Matrix

| Platform | Free Tier | Persistent Process | File Storage | Background Jobs | Best For |
|----------|-----------|-------------------|--------------|-----------------|----------|
| **Vercel** | Yes | No (Serverless) | No | No | Static/Serverless only |
| **Railway** | $5 credit/mo | Yes | Yes (ephemeral) | Yes | Full-stack apps |
| **Render** | Yes (limited) | Yes | Yes (ephemeral) | Yes (cron) | Node.js apps |
| **Fly.io** | Yes | Yes | Yes (volumes) | Yes | Containers |
| **DigitalOcean App Platform** | No | Yes | Yes | Yes | Production apps |
| **Heroku** | No (paid only) | Yes | No (ephemeral) | Yes (worker dynos) | Traditional PaaS |
| **AWS EC2/Lightsail** | Free tier | Yes | Yes | Yes | Full control |
| **Google Cloud Run** | Yes | No (Serverless) | No | External trigger | Serverless containers |

---

## Detailed Platform Analysis

### 1. Vercel

**Verdict: NOT RECOMMENDED for this project**

**Why it won't work well:**
- Vercel is designed for serverless functions, not persistent Node.js servers
- No support for long-running background processes (PCR collector)
- No persistent filesystem for JSON data storage
- In-memory session state (`activeDashboards`) lost between function invocations
- WebSocket/long-polling connections have timeout limits

**What would need to change:**
- Rewrite backend as serverless API routes
- Move PCR collector to external cron service (e.g., cron-job.org)
- Replace JSON file storage with database (MongoDB Atlas, Supabase)
- Replace in-memory sessions with Redis/database sessions

**Effort Level:** High (significant refactoring required)

---

### 2. Railway

**Verdict: RECOMMENDED - Best balance of simplicity and features**

**Why it works:**
- Supports persistent Node.js processes
- Simple GitHub integration (auto-deploy on push)
- Environment variables for secrets
- Background processes supported
- Reasonable free tier ($5/month credit)

**Deployment Steps:**
1. Create Railway account and link GitHub
2. Create new project from `Stock-Trading` repo
3. Set environment variables:
   - `PORT` (Railway provides this)
   - `NODE_ENV=production`
   - Encryption key and other secrets
4. Add `Procfile` or use detected Node.js buildpack
5. Configure start command: `npm start`

**Limitations:**
- Filesystem is ephemeral (resets on redeploy)
- Need external database for PCR data persistence
- Free tier has usage limits

**Required Changes:**
- Add database for PCR storage (Railway offers PostgreSQL/Redis add-ons)
- Store credentials in environment variables instead of file
- Update PCR storage service to use database

**Effort Level:** Medium

---

### 3. Render

**Verdict: RECOMMENDED - Good free tier option**

**Why it works:**
- Native Node.js support with persistent processes
- Free tier available (with sleep after inactivity)
- Built-in cron job support for PCR collector
- Persistent disk available (paid plans)
- Auto-deploy from GitHub

**Deployment Steps:**
1. Create Render account
2. New Web Service → Connect GitHub repo
3. Configure:
   - Build Command: `cd backend && npm install`
   - Start Command: `cd backend && npm start`
4. Add environment variables
5. Optionally add Render Cron Job for PCR collection

**Limitations:**
- Free tier sleeps after 15 min inactivity (cold starts)
- Filesystem ephemeral on free tier
- Paid plan needed for persistent disk

**Required Changes:**
- Similar to Railway - database for persistence
- Consider separating PCR collector as cron job

**Effort Level:** Medium

---

### 4. Fly.io

**Verdict: RECOMMENDED - Best for production with persistent storage**

**Why it works:**
- Runs actual Docker containers (full control)
- Persistent volumes for file storage (keeps JSON files!)
- Always-on processes
- Global edge deployment
- Generous free tier

**Deployment Steps:**
1. Install Fly CLI: `flyctl`
2. Create `fly.toml` configuration
3. Create `Dockerfile` for the app
4. Create persistent volume for `/backend/data`
5. Deploy: `fly deploy`

**Example fly.toml:**
```toml
app = "banknifty-dashboard"
primary_region = "bom"  # Mumbai for low latency to NSE/Angel One

[build]
  dockerfile = "Dockerfile"

[env]
  NODE_ENV = "production"
  PORT = "3000"

[http_service]
  internal_port = 3000
  force_https = true

[mounts]
  source = "pcr_data"
  destination = "/app/backend/data"
```

**Limitations:**
- Requires Docker knowledge
- More complex setup than Railway/Render
- Volume storage has size limits on free tier

**Required Changes:**
- Create Dockerfile
- Create fly.toml
- Mount volume for data persistence
- Store secrets using `fly secrets set`

**Effort Level:** Medium-High

---

### 5. DigitalOcean App Platform

**Verdict: GOOD - Reliable paid option**

**Why it works:**
- Full Node.js support
- Background workers supported
- Managed databases available
- Good documentation
- Predictable pricing

**Pricing:** Starts at $5/month for basic dyno

**Deployment Steps:**
1. Create DigitalOcean account
2. Create App → GitHub integration
3. Configure as Web Service
4. Add managed database if needed
5. Set environment variables
6. Deploy

**Effort Level:** Medium

---

### 6. AWS (EC2 / Lightsail)

**Verdict: RECOMMENDED for full control and production**

**Why it works:**
- Complete control over environment
- Persistent storage
- Can run exactly as developed locally
- Lightsail is simpler than EC2
- Free tier available (EC2 t2.micro for 12 months)

**Lightsail Deployment Steps:**
1. Create Lightsail instance (Node.js blueprint or Ubuntu)
2. SSH into instance
3. Clone repository
4. Install dependencies
5. Set up PM2 for process management
6. Configure Nginx as reverse proxy
7. Set up SSL with Let's Encrypt
8. Configure firewall

**Example PM2 ecosystem:**
```javascript
module.exports = {
  apps: [{
    name: 'banknifty-dashboard',
    script: 'backend/server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
};
```

**Limitations:**
- More DevOps knowledge required
- Manual scaling
- Need to manage updates/security yourself

**Required Changes:**
- None! Can run exactly as-is
- Add PM2 for process management
- Add Nginx for SSL termination

**Effort Level:** High (initial setup), Low (maintenance)

---

## Recommended Approach by Use Case

### For Development/Testing
**Use: Railway or Render Free Tier**
- Quick setup (< 30 minutes)
- GitHub auto-deploy
- Acceptable limitations for testing

### For Production (Budget-Conscious)
**Use: Fly.io with Persistent Volume**
- Keeps your JSON file storage working
- Generous free tier
- Mumbai region for low latency

### For Production (Reliability Priority)
**Use: AWS Lightsail or DigitalOcean Droplet**
- Full control
- No platform limitations
- Predictable performance

---

## Required Code Changes Summary

### Minimal Changes (Fly.io / AWS / DigitalOcean Droplet)
```
No code changes required - mount persistent storage
```

### Medium Changes (Railway / Render / Heroku)

1. **Database for PCR Storage**
   - Replace `pcrStorageService.js` file operations with database calls
   - Options: PostgreSQL, MongoDB, Redis

2. **Environment-based Credentials**
   - Store encryption key in environment variable
   - Option: Move credentials to environment variables directly

3. **Session Store**
   - Replace in-memory `activeDashboards` with Redis
   - Enables horizontal scaling

### Example: PCR Storage with PostgreSQL

```javascript
// services/pcrStorageService.js (modified for PostgreSQL)
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function saveSnapshot(snapshot) {
  await pool.query(
    'INSERT INTO pcr_snapshots (timestamp, symbol, pcr, sentiment, expiry) VALUES ($1, $2, $3, $4, $5)',
    [snapshot.timestamp, snapshot.symbol, snapshot.pcr, snapshot.sentiment, snapshot.expiry]
  );
}

async function getSnapshots(hours = 24) {
  const result = await pool.query(
    'SELECT * FROM pcr_snapshots WHERE timestamp > NOW() - INTERVAL \'$1 hours\' ORDER BY timestamp DESC',
    [hours]
  );
  return result.rows;
}
```

---

## Security Considerations for Production

### Must Do Before Deployment

1. **Environment Variables**
   - Never commit `credentials.enc` or `encryption.key`
   - Use platform's secret management

2. **HTTPS Only**
   - All platforms support automatic SSL
   - Ensure `force_https` is enabled

3. **Rate Limiting**
   - Add express-rate-limit to prevent abuse
   ```javascript
   const rateLimit = require('express-rate-limit');
   app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));
   ```

4. **CORS Configuration**
   - Restrict to your frontend domain in production

5. **API Keys**
   - Angel One credentials should be in environment variables
   - Rotate keys if accidentally exposed

---

## Deployment Checklist

### Pre-Deployment
- [ ] Remove sensitive files from git history if committed
- [ ] Create `.env.example` with required variables (no values)
- [ ] Update `.gitignore` for production files
- [ ] Test build process locally
- [ ] Document all environment variables needed

### Platform Setup
- [ ] Create account on chosen platform
- [ ] Connect GitHub repository
- [ ] Configure build and start commands
- [ ] Set all environment variables
- [ ] Configure custom domain (optional)
- [ ] Enable HTTPS

### Post-Deployment
- [ ] Verify all endpoints work
- [ ] Test authentication flow
- [ ] Confirm PCR collector is running
- [ ] Set up monitoring/alerts
- [ ] Test error handling

---

## Recommended Next Steps

1. **Decide on platform** based on budget and requirements
2. **Create database** if using Railway/Render (modify storage service)
3. **Prepare environment variables** list
4. **Create Dockerfile** (if using Fly.io)
5. **Test deployment** on staging first
6. **Set up monitoring** (e.g., UptimeRobot for free)

---

## Quick Start: Railway Deployment

If you want to deploy quickly with minimal changes:

```bash
# 1. Install Railway CLI
npm install -g @railway/cli

# 2. Login
railway login

# 3. Initialize project
railway init

# 4. Add PostgreSQL (for PCR storage)
railway add --plugin postgresql

# 5. Set environment variables
railway variables set NODE_ENV=production
railway variables set ENCRYPTION_KEY=your-key-here

# 6. Deploy
railway up
```

---

## Cost Estimates (Monthly)

| Platform | Free Tier | Basic Paid | With Database |
|----------|-----------|------------|---------------|
| Railway | $5 credit | $5-20 | +$5 PostgreSQL |
| Render | Free (sleeps) | $7 | +$7 PostgreSQL |
| Fly.io | Free (limited) | $5-10 | +$0 (SQLite on volume) |
| DigitalOcean | None | $5 | +$15 managed DB |
| AWS Lightsail | None | $3.50 | +$15 RDS |
| Heroku | None | $7 | +$9 PostgreSQL |

---

## Conclusion

For your Bank Nifty Trading Dashboard, I recommend:

1. **Quick Start:** Railway - minimal setup, good developer experience
2. **Best Value:** Fly.io with persistent volume - keeps your architecture intact
3. **Production Ready:** AWS Lightsail - full control, Indian region available

The key decision point is whether you want to keep the JSON file storage (requires Fly.io/AWS/VPS) or migrate to a database (enables Railway/Render/Heroku).

---

## SmartAPI IP Whitelisting & SaaS Architecture Note

> [!IMPORTANT]
> **Angel One SmartAPI IP Addressing & Website URL Requirements**
> 
> Due to updated SmartAPI creation requirements regarding static IP addressing and website URLs, to allow clients to use your trading tool, adopt the following architecture:

### Centralized Backend / SaaS Architecture (Recommended)

1. **Centralized Cloud Hosting**:
   - Host your core trading logic on a centralized cloud server (e.g., AWS EC2 with an Elastic IP, or Render with a static outbound proxy like Fixie / QuotaGuard).

2. **SmartAPI Portal Whitelisting**:
   - Register that single server static IP in the SmartAPI portal.

3. **Client Frontend Interaction**:
   - Clients interact with your frontend (web, desktop, or mobile app). The frontend sends instructions to your central server, and your server executes the trades and market requests via Angel One using the whitelisted IP.

