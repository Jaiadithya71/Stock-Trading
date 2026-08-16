---
name: code-auditor
description: >-
  Specialized Code Quality, API Contract & Quantitative Strategy Auditor.
  Use to audit, double-check, and source-correct any code modifications, strategy logic, or API integrations made by other agents.
---

# Code & Strategy Auditor Skill

When activated, this skill performs a rigorous, empirical source audit of the codebase to catch bugs, unhandled exceptions, broken API contracts, or deviations from project requirements.

---

## 🔍 Audit Workflow & Verification Checklist

### 1. Codebase Verification & Syntax Integrity
- Run `node -c <file.js>` on all modified or new JavaScript files in `backend/` to verify zero syntax errors.
- Ensure all imported modules (`require(...)`) are declared at top of file (e.g., `const fs = require('fs')`, `const path = require('path')`).

### 2. API Contract & Error Handling Audit
- Verify that every route handler (`router.get`, `router.post`) includes `try / catch` blocks with meaningful HTTP status codes (`400`, `404`, `500`).
- Ensure no silent error swallowing (e.g., empty `catch(e) {}`) or dummy fallback returns without logging.

### 3. Quantitative Risk & Strategy Confluence Audit
- Check position sizing calculations against `riskEngine.js` rules (Fractional Kelly $0.25f^*$, Volatility Targeting, Daily Max Loss Circuit Breaker).
- Ensure the **Emergency Kill Switch** header button immediately freezes signal execution and cancels open orders.

### 4. Cross-Domain CORS & Deployment Audit
- Ensure static file routes in `server.js` support fallback multi-path resolution (`getFrontendFile()`).
- Verify that cross-domain API calls from static site URLs fallback to the active Web Service backend (`https://stock-trading-1-cquo.onrender.com/api/...`).

---

## 🛠️ Execution Strategy
1. **Inspect Log Outputs**: Fetch and read full, untruncated runtime logs before forming diagnostic hypotheses.
2. **Empirical Verification**: Never declare an audit complete until verification scripts pass cleanly (`node -e "..."`).
