# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Bank Nifty Trading Dashboard - A real-time trading dashboard that displays market data for Bank Nifty, indices, currencies, and options chains using Angel One's SmartAPI. The application features a Node.js/Express backend with a vanilla JavaScript frontend, plus a background PCR (Put-Call Ratio) collector service.

## Development Commands

### Backend
```bash
# Start production server
cd backend
npm start

# Start development server with auto-reload
npm run dev

# Run tests
cd backend/test
node testPCRStorage.js       # Test PCR storage functionality
node checkPCREndpoint.js     # Test PCR API endpoint
node diagnosticPCR.js        # Comprehensive PCR diagnostics
```

### Frontend
The frontend is served statically by the Express server. Open `http://localhost:3000` after starting the backend.

## Architecture Overview

### Backend Architecture (`backend/`)

**Core Service Layer:**
- `services/tradingDashboard.js` - Main service orchestrating Angel One SmartAPI interactions. Handles authentication, candle data fetching with timeouts (5s default), smart interval fallback based on market status, caching (10s duration), and batch parallel fetching
- `services/pcrCollectorService.js` - Background service collecting PCR snapshots every minute, stores to local files via PCRStorageService
- `services/pcrStorageService.js` - Manages PCR data persistence to JSON files with automatic rotation
- `services/instrumentFetcher.js` - Downloads and caches Angel One's OpenAPIScripMaster.json (24h cache), extracts expiry dates for options
- `services/nseApiFetcher.js` - Fetches option chain data from NSE India public API (no auth required)
- `services/authService.js` - TOTP generation for Angel One authentication
- `services/credentialService.js` - Loads encrypted user credentials

**Authentication Flow:**
1. User credentials stored encrypted in `backend/credentials.enc`
2. `authMiddleware.js` maintains in-memory `activeDashboards` map (username → authenticated dashboard instance)
3. PCR collector starts ONLY after successful authentication, receives the authenticated dashboard instance
4. All authenticated routes use `requireAuth()` middleware to verify active session

**Route Structure (`routes/`):**
- `authRoutes.js` - Login/logout endpoints, manages active dashboard sessions
- `dataRoutes.js` - Bank Nifty and indices data endpoints (requires auth)
- `currencyRoutes.js` - Currency pair data endpoints (requires auth)
- `nseOptionRoutes.js` - Option chain data from NSE (no auth required)
- `pcrRoutes.js` - PCR historical data and statistics endpoints
- `dataCheckRoutes.js` - Data validation endpoints
- `statusRoute.js` - System status endpoint

**Data Flow for Market Data:**
1. Frontend calls `/api/banknifty` or `/api/indices` with username + interval
2. Route uses `requireAuth()` to get user's authenticated dashboard instance
3. Dashboard's `batchFetchSymbols()` fetches all symbols in parallel using `Promise.all`
4. Each fetch uses `getCandleDataWithFallback()` which selects intervals based on market status:
   - Market OPEN: Try real-time intervals (ONE_MINUTE, FIVE_MINUTE, FIFTEEN_MINUTE)
   - Market CLOSED: Skip to session intervals (ONE_HOUR, FIFTEEN_MINUTE, FIVE_MINUTE)
5. API calls protected by 5-second timeout via `callWithTimeout()`
6. Results cached for 10 seconds to reduce API load

**PCR Collector Background Service:**
- Starts via POST `/api/start-pcr-collector` (requires authenticated user)
- Runs independently, fetching PCR via `smartAPI.putCallRatio()` every minute
- Stores snapshots to `backend/data/pcr_snapshots_YYYY-MM-DD.json`
- Determines sentiment: Buying (<0.8), Neutral (0.8-1.2), Selling (>1.2)
- Status endpoint: GET `/api/pcr-collector-status`

**Important Constants (`config/constants.js`):**
- `SYMBOL_TOKEN_MAP` - Bank token mappings for Angel One API
- `INDICES_INSTRUMENTS` - Index tokens (BANKNIFTY, NIFTY, INDIA VIX)
- `MARKET_HOURS` - IST market open (9:15) and close (15:30)

### Frontend Architecture (`frontend/`)

**Component-Based Vanilla JS:**
- `js/app.js` - Main application controller, state management, event coordination
- Components in `js/components/`:
  - `IndicesGrid.js` - Displays BANKNIFTY, NIFTY, VIX with real-time LTP and change indicators
  - `BankNiftyTable.js` - Bank stock grid with filtering (Buying/Selling/Neutral)
  - `CurrencyWidget.js` - Currency pairs display
  - `OptionChain.js` - NSE option chain with strike prices, OI, volume
  - `PCRWidget.js` - PCR chart and statistics from historical data
  - `Toolbar.js` - Control panel for refresh, intervals, filters, PCR collector controls

**State Management:**
- Single `App.state` object in `app.js` contains all application state
- `EventHandler.js` provides pub-sub pattern for component communication
- Components emit events (e.g., 'refresh-banknifty'), App handles via registered handlers

**API Communication:**
- `js/api/apiService.js` - Centralized HTTP client with error handling
- All API calls return `{ success, data/message }` structure

**Styling:**
- Modular CSS files: `main.css`, `components.css`, `indices-styles.css`, `option-chain.css`, `pcr-styles.css`
- Price changes reflected with color coding (green = up, red = down)

## Key Implementation Patterns

### Adding New Market Data Endpoints

When adding a new data endpoint (e.g., commodity data):

1. **Backend Route** (`routes/newDataRoutes.js`):
```javascript
const { requireAuth } = require('../middleware/authMiddleware');

router.post('/api/commodity-data', requireAuth, async (req, res) => {
  const { interval } = req.body;
  const dashboard = req.dashboard; // From requireAuth middleware

  // Use dashboard.batchFetchSymbols() for parallel fetching
  // OR dashboard.getCandleDataWithFallback() for single symbol
});
```

2. **Frontend Component** (`js/components/CommodityWidget.js`):
```javascript
const CommodityWidget = {
  render(data) {
    // Component logic
    EventHandler.emit('refresh-commodity'); // For refresh
  }
};
```

3. **Register in App** (`js/app.js`):
```javascript
EventHandler.on('refresh-commodity', () => this.refreshCommodity());
```

### Working with Angel One SmartAPI

**Token Resolution:**
- Use `SYMBOL_TOKEN_MAP` for bank stocks
- Use `INDICES_INSTRUMENTS` for indices
- For options, use `instrumentFetcher.getInstruments()` to search OpenAPIScripMaster.json

**Candle Data Intervals:**
Available intervals: `ONE_MINUTE`, `THREE_MINUTE`, `FIVE_MINUTE`, `FIFTEEN_MINUTE`, `THIRTY_MINUTE`, `ONE_HOUR`

**Market Status Awareness:**
Always use `isMarketOpen()` from `utils/dateHelpers.js` to select appropriate intervals. Real-time intervals often fail when market is closed.

### Authentication and Sessions

**Important:** Never create new dashboard instances for data fetching. Always use the authenticated instance from `activeDashboards`:

```javascript
const { getActiveDashboards } = require('./middleware/authMiddleware');
const activeDashboards = getActiveDashboards();
const dashboard = activeDashboards[username];
```

Creating new instances will fail authentication and waste API quota.

### PCR Data Collection

**Storage Format:**
PCR snapshots stored in `backend/data/pcr_snapshots_YYYY-MM-DD.json`:
```json
[
  {
    "timestamp": "2025-01-05T10:30:00.000Z",
    "symbol": "BANKNIFTY",
    "pcr": 1.0234,
    "sentiment": "Neutral",
    "expiry": "08JAN25",
    "source": "putCallRatio_api"
  }
]
```

**Accessing Historical PCR:**
- GET `/api/pcr/historical?hours=24` - Last N hours of data
- GET `/api/pcr/stats` - Statistics (avg PCR, sentiment distribution)

## Testing and Debugging

**Enable Debug Logging:**
Frontend logging controlled via `Helpers.log()` in `js/utils/helpers.js`

**Common Issues:**

1. **"API call timeout"** - Increase `API_TIMEOUT` in `tradingDashboard.js` or check Angel One API status
2. **"No candle data"** - Market closed, switch to ONE_HOUR interval or use `getCandleDataWithFallback()`
3. **"Not authenticated"** - Check `activeDashboards` has entry for username, verify TOTP token is valid
4. **PCR collector not starting** - Ensure user is authenticated first, check `/api/pcr-collector-status`

**Testing Market Scenarios:**
- Modify `MARKET_HOURS` in `constants.js` to simulate market open/closed
- Use `backend/test/` scripts to test individual services without full server

## File Structure

```
Application_transfer/
├── backend/
│   ├── server.js              # Express app, PCR collector lifecycle
│   ├── routes/                # API route handlers
│   ├── services/              # Business logic (dashboard, PCR, fetchers)
│   ├── middleware/            # Auth middleware with session management
│   ├── utils/                 # Helpers (encryption, date helpers, data checker)
│   ├── config/                # Constants and configuration
│   ├── data/                  # PCR snapshot storage
│   ├── cache/                 # Instrument cache
│   └── test/                  # Test scripts
├── frontend/
│   ├── index.html             # Entry point
│   ├── js/
│   │   ├── app.js             # Main controller
│   │   ├── components/        # UI components
│   │   ├── api/               # API service
│   │   ├── utils/             # Formatters, helpers, event handler
│   │   └── modals/            # Login and credentials modals
│   ├── css/                   # Modular stylesheets
│   └── config/                # Frontend configuration
└── Unit_testing/              # Additional test utilities
```

## Security Notes

- User credentials stored encrypted using AES-256-CBC (`utils/encryption.js`)
- Encryption key in `backend/encryption.key` - **DO NOT commit to git**
- TOTP tokens generated on-demand, never stored
- Active dashboard sessions kept in memory only, cleared on logout

## Performance Optimizations

1. **Parallel Fetching**: `batchFetchSymbols()` uses `Promise.all` to fetch multiple symbols simultaneously
2. **Smart Caching**: 10-second cache duration prevents redundant API calls
3. **Market-Aware Intervals**: Skips real-time intervals when market is closed
4. **Timeout Protection**: All API calls have 5-second timeout to prevent hanging
5. **Instrument Caching**: Angel One's instrument list cached for 24 hours

## API Quotas and Rate Limits

Angel One SmartAPI has rate limits. The application implements:
- Request caching to reduce API calls
- Timeout protection to fail fast
- Market status checks to avoid unnecessary calls
- Batch fetching to minimize round trips

If hitting rate limits, increase `CACHE_DURATION` in `tradingDashboard.js` or reduce refresh frequency in frontend.
