# Bank Nifty Trading Dashboard - Project Understanding

## 1. PROJECT OVERVIEW

The **Bank Nifty Trading Dashboard** is a real-time trading application that displays market data for Bank Nifty indices, individual stocks, currencies, and options chains using Angel One's SmartAPI. It features a Node.js/Express backend with a vanilla JavaScript frontend, plus a background PCR (Put-Call Ratio) collector service.

**Tech Stack:**
- Backend: Express.js, Node.js
- Frontend: Vanilla JavaScript (no frameworks)
- API: Angel One SmartAPI + NSE India public API
- Security: AES-256-CBC encryption for credentials, TOTP for authentication

---

## 2. DIRECTORY STRUCTURE

```
Application_transfer/
├── backend/
│   ├── server.js                      # Express app entry point + PCR lifecycle
│   ├── package.json                   # Node dependencies
│   ├── encryption.key                 # AES-256 encryption key (not committed)
│   ├── credentials.enc                # Encrypted user credentials
│   ├── config/
│   │   └── constants.js               # Token maps, market hours, intervals
│   ├── routes/                        # API endpoint handlers
│   │   ├── routes.js                  # Route aggregator
│   │   ├── authRoutes.js              # Login/credentials/authentication
│   │   ├── dataRoutes.js              # Bank Nifty & indices data
│   │   ├── currencyRoutes.js          # Currency data endpoints
│   │   ├── nseOptionRoutes.js         # NSE option chain data (public API)
│   │   ├── pcrRoutes.js               # PCR historical & stats
│   │   ├── dataCheckRoutes.js         # Data validation endpoints
│   │   └── statusRoute.js             # System status
│   ├── services/                      # Business logic layer
│   │   ├── tradingDashboard.js        # Main Angel One SmartAPI wrapper
│   │   ├── authService.js             # TOTP token generation
│   │   ├── credentialService.js       # Credential encryption/decryption
│   │   ├── pcrCollectorService.js     # Background PCR collector (1-min intervals)
│   │   ├── pcrStorageService.js       # PCR data persistence (JSON files)
│   │   ├── instrumentFetcher.js       # Fetches Angel One instrument master
│   │   ├── nseApiFetcher.js           # Fetches NSE option chain data
│   │   └── currencyService.js         # Currency rates fetching
│   ├── middleware/
│   │   └── authMiddleware.js          # Session management (activeDashboards map)
│   ├── utils/
│   │   ├── dateHelpers.js             # Market hours, date range logic
│   │   ├── encryption.js              # AES-256 encrypt/decrypt
│   │   └── dataChecker.js             # Data validation utilities
│   ├── data/                          # PCR storage
│   │   ├── pcr_snapshots.json         # Current PCR snapshots
│   │   └── pcr_snapshots.backup.json  # Backup
│   ├── cache/
│   │   └── instruments.json           # Cached instrument master
│   └── test/                          # Testing scripts
│
├── frontend/
│   ├── index.html                     # Single page entry point
│   ├── js/
│   │   ├── app.js                     # Main app controller & state management
│   │   ├── api/
│   │   │   └── apiService.js          # HTTP client with session recovery
│   │   ├── components/                # Vanilla JS UI components
│   │   │   ├── IndicesGrid.js         # BANKNIFTY, NIFTY, VIX display
│   │   │   ├── BankNiftyTable.js      # Bank stock grid with filtering
│   │   │   ├── CurrencyWidget.js      # Currency pairs display
│   │   │   ├── OptionChain.js         # NSE option chain visualization
│   │   │   ├── PCRWidget.js           # PCR chart & statistics
│   │   │   ├── Toolbar.js             # Control panel
│   │   │   ├── Header.js              # Navigation header
│   │   │   └── LoadingSpinner.js      # Loading indicator
│   │   ├── modals/
│   │   │   ├── LoginModal.js          # User login UI
│   │   │   └── CredentialsModal.js    # Credential entry UI
│   │   └── utils/
│   │       ├── eventHandler.js        # Pub-sub event system
│   │       ├── formatters.js          # Number/currency/date formatting
│   │       └── helpers.js             # Utility functions
│   ├── config/
│   │   └── config.js                  # Frontend configuration
│   └── css/                           # Modular stylesheets
│
└── Unit_testing/                      # Additional test utilities
```

---

## 3. BACKEND ARCHITECTURE

### A. Core Service Layer

#### TradingDashboard.js (Main Service)
This is the orchestrator for all Angel One SmartAPI interactions:

**Key Responsibilities:**
- Manages SmartAPI authentication with TOTP tokens
- Fetches real-time market data via `marketData()` API
- Fetches candle data with smart interval fallback based on market status
- Implements caching (10-second duration) to reduce API quota usage
- Protects all API calls with 5-second timeout (`callWithTimeout()`)

**Key Methods:**
```javascript
// Authentication
authenticate() → Generates TOTP, calls generateSession, stores tokens

// Market Data Fetching
getLTPData(exchange, tokens, mode) → Gets real-time LTP for multiple tokens
getCandleData(exchange, token, interval) → Gets candle data with cache
getCandleDataWithFallback(exchange, token, interval) → Tries preferred interval, then falls back

// Batch Operations
batchGetLTP(symbols) → Parallel fetch for multiple symbols
batchFetchSymbols(symbols, interval) → Parallel fetch with Promise.all

// Status Tracking
getStatus(symbol, close) → Buying/Selling/Neutral based on highs/lows
```

**Smart Fallback Logic:**
- Market OPEN: Try ONE_MINUTE → FIVE_MINUTE → FIFTEEN_MINUTE
- Market CLOSED: Skip real-time, use ONE_HOUR → FIFTEEN_MINUTE → FIVE_MINUTE

---

#### PCRCollectorService.js (Background Service)
Runs continuously, collecting Put-Call Ratio snapshots every minute:

**Key Features:**
- Calls `smartAPI.putCallRatio()` once per minute
- Stores snapshots to local JSON files via PCRStorageService
- Determines sentiment: Buying (<0.8), Neutral (0.8-1.2), Selling (>1.2)
- Starts ONLY after successful user authentication
- Runs in background via server.js lifecycle management

**Data Storage Format:**
```json
{
  "symbol": "BANKNIFTY",
  "pcr": 1.0234,
  "expiry": "08JAN25",
  "sentiment": "Neutral",
  "timestamp": "2025-01-05T10:30:00.000Z",
  "source": "putCallRatio_api"
}
```

---

#### PCRStorageService.js (Persistence)
Manages PCR data storage to JSON files with smart market-aware logic:

**Key Methods:**
- `storeSnapshot()` → Adds snapshot, auto-rotates old data (24-hour retention)
- `getHistoricalPCR()` → Returns PCR data for multiple time intervals (1, 3, 5, 15 min)
- `getLatestSnapshot()` → Returns most recent PCR
- `getStats()` → Calculates averages and sentiment distribution

---

#### InstrumentFetcher.js
Downloads and caches Angel One's OpenAPIScripMaster.json (24-hour cache):
- Extracts expiry dates for option chains
- Used for NSE option data filtering

---

#### NSEApiFetcher.js
Fetches option chain data from NSE India's public API (no auth required):
- Gets strike prices, OI (Open Interest), volume
- Calculates Greeks and other option metrics

---

### B. Authentication Flow

**Step 1: User Check**
```
Frontend → POST /api/check-user { username }
Backend → Checks if credentials exist in credentials.enc
```

**Step 2: Save Credentials** (if new user)
```
Frontend → POST /api/save-credentials { username, credentials }
Backend → Encrypts with AES-256-CBC, stores in credentials.enc
```

**Step 3: Authenticate**
```
Frontend → POST /api/authenticate { username }
Backend:
  1. Load encrypted credentials
  2. Decrypt credentials
  3. Generate TOTP token from secret
  4. Call smartAPI.generateSession(clientId, password, totp)
  5. Get authToken, refreshToken, feedToken
  6. Create TradingDashboard instance
  7. Store in activeDashboards[username]
  8. Return success
```

**Session Management in Memory:**
```javascript
// authMiddleware.js maintains a map:
const activeDashboards = {
  "john_doe": <TradingDashboard instance with auth tokens>,
  "jane_smith": <TradingDashboard instance with auth tokens>
}
```

The `requireAuth()` middleware extracts username from request body and validates:
```javascript
function requireAuth(req, res, next) {
  const { username } = req.body;
  const dashboard = activeDashboards[username];

  if (!dashboard || !dashboard.authenticated) {
    return res.status(401).json({ success: false, message: "Not authenticated" });
  }

  req.dashboard = dashboard;  // Attach to request
  next();
}
```

**Critical:** PCR collector receives the authenticated dashboard instance from activeDashboards, so it uses the same auth tokens as API calls.

---

### C. Data Routes & Endpoints

#### Bank Nifty Data - `POST /api/banknifty-data`
```
Flow:
1. Get all 12 bank tokens (HDFCBANK, ICICIBANK, etc.)
2. Try real-time marketData API first
3. If fails, fallback to candle data with smart interval selection
4. Calculate change % from open price
5. Determine status: Buying/Selling/Neutral
6. Return array of 12 banks with LTP, volume, change%
```

#### Indices Data - `POST /api/indices-data`
```
Flow:
1. Get tokens for BANKNIFTY, NIFTY, INDIA VIX
2. Fetch real-time LTP for all three at once
3. Fetch candle data for 6 intervals in parallel: 1min, 3min, 5min, 15min, 30min, 1hour
4. For each interval, calculate:
   - Open price (from candle open)
   - Change from open to current LTP
   - Direction (up/down/neutral)
5. Return nested structure with interval data
```

#### Currency Rates - `POST /api/currency-rates`
Fetches forex rates (no SmartAPI, uses public data source)

#### NSE Option Chain - `GET /api/nse-option-chain?symbol=BANKNIFTY&expiry=08JAN25`
No authentication required - calls NSE public API directly

#### PCR Historical - `POST /api/pcr-historical`
Returns PCR data for multiple time windows: last 1/3/5/15 minutes

---

### D. Market-Aware Interval Logic (dateHelpers.js)

```javascript
function isMarketOpen(date)
  // IST-based check
  // Mon-Fri, 9:15 AM - 3:30 PM = OPEN
  // Otherwise = CLOSED

function getDateRange()
  // If OPEN: Use last 3 hours or from market open (whichever is later)
  // If CLOSED: Use last trading day's full session (9:15 AM - 3:30 PM)
  // Returns: { fromDate, toDate, isMarketOpen }
```

---

## 4. FRONTEND ARCHITECTURE

### A. Single Page Application Structure

**Entry Point: index.html**
- Loads CSS files (8 stylesheets)
- Loads utility scripts in order
- Loads component scripts
- Loads app.js last (app controller)

**Script Load Order (Critical):**
```
1. config.js         # API_BASE_URL configuration
2. helpers.js        # Utility functions
3. formatters.js     # Number/currency formatting
4. eventHandler.js   # Pub-sub system
5. Components        # UI components (LoadingSpinner, Header, etc.)
6. Modals           # Login/Credentials modals
7. apiService.js    # HTTP client
8. app.js           # Main controller
```

---

### B. State Management (app.js)

Single `App.state` object contains all application state:

```javascript
state: {
  currentUsername: '',

  // Data collections
  bankNiftyData: [],           // Array of 12 banks
  indicesData: {},             // BANKNIFTY, NIFTY, VIX
  currencyData: {},            // Forex rates
  nseOptionChainData: {},      // Option chain with strikes
  pcrData: {},                 // Historical PCR data

  // UI state
  selectedInterval: 'ONE_MINUTE',
  selectedNSESymbol: 'BANKNIFTY',
  selectedNSEExpiry: null,
  showCurrency: true,
  showOptionChain: false,
  showPCR: true,
  isLoading: false,
  autoRefreshEnabled: true,
  refreshIntervalTime: 60000,   // 60 seconds

  // Filters
  filters: {
    showBuying: true,
    showSelling: true,
    showNeutral: true
  }
}
```

---

### C. Component-Based Architecture

Each component is a simple object with a `render(data, timestamp)` method:

#### IndicesGrid.js
Displays BANKNIFTY, NIFTY, VIX in a table with 6 time intervals as columns

#### BankNiftyTable.js
Displays 12 bank stocks with filtering (Buying/Selling/Neutral)

#### CurrencyWidget.js
Forex pairs (EURINR, GBPINR, USDINR, etc.)

#### OptionChain.js
Strike prices with CE/PE data, OI, Greeks

#### PCRWidget.js
PCR chart and statistics (sentiment over time)

#### Toolbar.js
Controls: Refresh button, interval selector, auto-refresh toggle, filters, export buttons

---

### D. Event-Driven Communication

**EventHandler.js** implements pub-sub pattern via data attributes:

```html
<!-- HTML with data-action attribute triggers events -->
<button data-action="refresh-banknifty">Refresh</button>
<input type="checkbox" data-change-action="toggle-autorefresh" />
```

**Key Events:**
- `refresh-banknifty`, `refresh-indices`, `refresh-currency`, `refresh-pcr`, `refresh-all`
- `toggle-autorefresh`, `toggle-filter`, `toggle-currency`, `toggle-pcr`
- `change-interval`, `change-refresh-interval`
- `select-nse-symbol`, `change-nse-expiry`
- `session-expired` (custom event for auth failures)

---

### E. API Service (apiService.js)

Centralized HTTP client with session recovery:

```javascript
async request(endpoint, data, method='POST', skipAuthRetry=false)
  // Detects auth failures (401 or "Not authenticated" message)
  // Auto-retries with re-authentication
  // Prevents infinite loops with skipAuthRetry flag
```

All methods return `{ success, data/message }` structure.

---

## 5. DATA FLOW ARCHITECTURE

### Complete Request-Response Cycle

```
┌─────────────────────────────────────────────────────────────────────┐
│ FRONTEND                                                            │
│ ┌───────────────────────────────────────────────────────────────┐  │
│ │ App.js: loadAllData()                                         │  │
│ │  → Parallel fetch: bankNifty, indices, currency              │  │
│ │  → Wait with 20-second timeout                               │  │
│ │  → Update App.state                                          │  │
│ │  → updateDashboard() renders components                      │  │
│ └───────────────────────────────────────────────────────────────┘  │
│          ↓                                                           │
│ ┌───────────────────────────────────────────────────────────────┐  │
│ │ apiService.js: request(endpoint, data)                       │  │
│ │  → fetch(API_BASE_URL + endpoint)                            │  │
│ │  → Detects auth failures, auto-retries if needed            │  │
│ │  → Returns { success, data }                                 │  │
│ └───────────────────────────────────────────────────────────────┘  │
│          ↓ HTTP POST                                                 │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ BACKEND                                                             │
│ ┌───────────────────────────────────────────────────────────────┐  │
│ │ routes.js: POST /api/banknifty-data                          │  │
│ │  → requireAuth middleware extracts username from body        │  │
│ │  → Gets TradingDashboard from activeDashboards[username]    │  │
│ └───────────────────────────────────────────────────────────────┘  │
│          ↓                                                           │
│ ┌───────────────────────────────────────────────────────────────┐  │
│ │ tradingDashboard.js                                          │  │
│ │ Step 1: Try marketData API                                   │  │
│ │  → getLTPData("NSE", tokens, "FULL")                         │  │
│ │  → smartAPI.marketData({...})  [5-sec timeout]              │  │
│ │                                                              │  │
│ │ Step 2 (if failed): Fall back to candle data                │  │
│ │  → getCandleDataWithFallback() for each bank token          │  │
│ │  → Promise.all() for parallel execution                    │  │
│ │                                                              │  │
│ │ Step 3: Process results                                      │  │
│ │  → Map to { bank, ltp, volume, change%, status }           │  │
│ │  → Calculate status using getStatus()                       │  │
│ └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 6. SECURITY & AUTHENTICATION

### Credential Encryption

```javascript
// encryption.js: AES-256-CBC encryption
encrypt(plaintext)
  → Generate random IV
  → Create cipher with 256-bit key
  → Return: iv:encrypted (hex format)

decrypt(encrypted)
  → Split on colon to extract IV
  → Create decipher
  → Return plaintext
```

**Credentials File Format:**
```json
{
  "user1": {
    "api_key": "a1b2c3d4e5:encrypted_hex",
    "client_id": "f6g7h8i9:encrypted_hex",
    "password": "j0k1l2m3:encrypted_hex",
    "totp_token": "n4o5p6q7:encrypted_hex"
  }
}
```

### TOTP Authentication

```javascript
// authService.js: generateTOTP(secret)
1. Decode base32 secret
2. Generate time-based counter: Math.floor(Date.now() / 1000 / 30)
3. Create HMAC-SHA1 of counter
4. Dynamic truncation (extract 6 digits)
5. Return 6-digit OTP string
```

---

## 7. KEY IMPLEMENTATION PATTERNS

### Parallel Data Fetching
```javascript
const promises = [
  fetchBankNiftyData(),
  fetchIndicesData(),
  fetchCurrencyData()
];

await Promise.race([
  Promise.all(promises),
  timeout(20000)  // 20-second timeout
]);
```

### Market-Aware Interval Selection
```javascript
if (isMarketOpen()) {
  intervals = ["ONE_MINUTE", "FIVE_MINUTE", "FIFTEEN_MINUTE"];
} else {
  intervals = ["ONE_HOUR", "FIFTEEN_MINUTE", "FIVE_MINUTE"];
}
```

### Caching Strategy
```javascript
cache = new Map();
CACHE_DURATION = 10000;  // 10 seconds

if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
  return cached.data;
}

cache.set(key, { data: response, timestamp: Date.now() });
```

### Timeout Protection
```javascript
async callWithTimeout(apiCall, timeoutMs = 5000) {
  return Promise.race([
    apiCall,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('API call timeout')), timeoutMs)
    )
  ]);
}
```

### Batch Operations with Promise.all
```javascript
const promises = banks.map(bank =>
  dashboard.getCandleDataWithFallback(bank.exchange, bank.token, interval)
);

const results = await Promise.all(promises);
```

---

## 8. PCR COLLECTOR LIFECYCLE

```
User logs in (POST /api/authenticate)
  ↓
TradingDashboard created & authenticated
  ↓
Stored in activeDashboards[username]
  ↓
Frontend calls POST /api/start-pcr-collector
  ↓
server.js startPCRCollectorBackground()
  ↓
PCRCollectorService instantiated with authenticated smartAPI
  ↓
service.start() called
  ↓
  ├─ Immediately collect PCR (don't wait)
  │   ├─ Call smartAPI.putCallRatio()
  │   ├─ Find BANKNIFTY in response
  │   ├─ Create snapshot object
  │   └─ Store via PCRStorageService
  │
  └─ setInterval(collectPCR, 60000) - runs every minute

User logs out:
  ├─ PCR collector stopped
  ├─ Removed from activeDashboards
  └─ Dashboard instance garbage collected
```

---

## 9. API ENDPOINTS SUMMARY

### Authentication Routes
| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | `/check-user` | No | Check if user exists |
| POST | `/save-credentials` | No | Save encrypted credentials |
| POST | `/authenticate` | No | Login & create session |

### Market Data Routes (Require auth via username in body)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/banknifty-data` | Get 12 bank stocks with LTP |
| POST | `/indices-data` | Get BANKNIFTY, NIFTY, VIX with 6-interval data |
| POST | `/currency-rates` | Get forex rates |

### Option Chain Routes (Public API, no auth)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/nse-symbols` | Get available symbols |
| GET | `/nse-option-chain?symbol=X&expiry=Y` | Get strike prices & OI |
| GET | `/nse-expiry-dates?symbol=X` | Get expiry dates |

### PCR Routes (Require auth)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/pcr-historical` | Historical PCR for 1/3/5/15 min intervals |
| POST | `/pcr-current` | Latest PCR snapshot |
| POST | `/pcr-stats` | PCR statistics & sentiment |

### PCR Collector Routes
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/start-pcr-collector` | Start background collection |
| GET | `/pcr-collector-status` | Check if running |
| POST | `/stop-pcr-collector` | Stop collection |

---

## 10. COMMON ISSUES & DEBUGGING

**"API call timeout"**
- Increase `API_TIMEOUT` in `tradingDashboard.js` or check Angel One API status

**"No candle data"**
- Market closed, switch to ONE_HOUR interval or use `getCandleDataWithFallback()`

**"Not authenticated"**
- Check `activeDashboards` has entry for username, verify TOTP token is valid

**PCR collector not starting**
- Ensure user is authenticated first, check `/api/pcr-collector-status`

---

## 11. PERFORMANCE OPTIMIZATIONS

1. **Parallel Fetching**: `batchFetchSymbols()` uses `Promise.all` to fetch multiple symbols simultaneously
2. **Smart Caching**: 10-second cache duration prevents redundant API calls
3. **Market-Aware Intervals**: Skips real-time intervals when market is closed
4. **Timeout Protection**: All API calls have 5-second timeout to prevent hanging
5. **Instrument Caching**: Angel One's instrument list cached for 24 hours

---

## 12. KEY FILE LOCATIONS

**Backend Services:**
- `backend/services/tradingDashboard.js` - Main SmartAPI orchestrator
- `backend/services/pcrCollectorService.js` - Background PCR collection
- `backend/services/pcrStorageService.js` - PCR data persistence

**Authentication & Security:**
- `backend/middleware/authMiddleware.js` - Session management
- `backend/utils/encryption.js` - AES-256 encryption
- `backend/services/authService.js` - TOTP generation

**Routes & Configuration:**
- `backend/routes/dataRoutes.js` - Market data endpoints
- `backend/config/constants.js` - Token maps, market hours
- `backend/utils/dateHelpers.js` - Market status logic

**Frontend Core:**
- `frontend/js/app.js` - Main controller & state
- `frontend/js/api/apiService.js` - HTTP client
- `frontend/js/utils/eventHandler.js` - Pub-sub system
