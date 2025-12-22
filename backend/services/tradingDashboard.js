const { SmartAPI } = require("smartapi-javascript");
const { getDateRange } = require("../utils/dateHelpers");
const { generateTOTP } = require("./authService");

class TradingDashboard {
  constructor(credentials) {
    this.credentials = credentials;
    this.smart_api = new SmartAPI({
      api_key: credentials.api_key
    });
    this.authenticated = false;
    this.highs = {};
    this.lows = {};
  }

  async authenticate() {
    try {
      const totp = generateTOTP(this.credentials.totp_token);
      
      console.log("🔐 Attempting authentication...");
      console.log("Client ID:", this.credentials.client_id);
      console.log("TOTP:", totp);
      
      const sessionData = await this.smart_api.generateSession(
        this.credentials.client_id,
        this.credentials.password,
        totp
      );
      
      console.log("Session response:", sessionData);
      
      if (sessionData && sessionData.status === true && sessionData.data) {
        this.authToken = sessionData.data.jwtToken;
        this.refreshToken = sessionData.data.refreshToken;
        this.feedToken = sessionData.data.feedToken;
        
        await this.smart_api.setSessionExpiryHook({
          token: this.refreshToken
        });
        
        const profile = await this.smart_api.getProfile(this.refreshToken);
        console.log("Profile:", profile);
        
        this.authenticated = true;
        console.log("✅ Authentication successful");
        
        return { 
          success: true, 
          message: "Authenticated successfully",
          data: {
            clientId: profile.data.clientcode,
            name: profile.data.name
          }
        };
      } else {
        const errorMsg = sessionData?.message || "Authentication failed";
        throw new Error(errorMsg);
      }
    } catch (error) {
      console.error("❌ Authentication error:", error);
      return { 
        success: false, 
        message: error.message || "Authentication failed"
      };
    }
  }

  async getCandleData(exchange, symboltoken, interval) {
    const { fromDate, toDate } = getDateRange();
    
    const params = {
      exchange,
      symboltoken,
      interval,
      fromdate: fromDate,
      todate: toDate
    };
    
    try {
      const response = await this.smart_api.getCandleData(params);
      return response;
    } catch (error) {
      console.error(`Error fetching candle data:`, error);
      return { status: false, data: null };
    }
  }

  getStatus(symbol, close) {
    if (!this.highs[symbol]) {
      this.highs[symbol] = close;
      this.lows[symbol] = close;
      return "Neutral";
    }
    
    if (close > this.highs[symbol]) {
      this.highs[symbol] = close;
      return "Buying";
    } else if (close < this.lows[symbol]) {
      this.lows[symbol] = close;
      return "Selling";
    }
    return "Neutral";
  }

  getSentiment(symbol, close) {
    if (!this.highs[symbol]) {
      this.highs[symbol] = close;
      this.lows[symbol] = close;
      return "Neutral";
    }
    
    if (close > this.highs[symbol]) {
      this.highs[symbol] = close;
      return "Bullish";
    } else if (close < this.lows[symbol]) {
      this.lows[symbol] = close;
      return "Bearish";
    }
    return "Neutral";
  }

  async getCandleDataWithFallback(exchange, symboltoken, preferredInterval) {
    const intervals = [preferredInterval, "FIVE_MINUTE", "FIFTEEN_MINUTE", "ONE_HOUR"];
    
    for (const interval of intervals) {
      const response = await this.getCandleData(exchange, symboltoken, interval);
      if (response.status && response.data && response.data.length > 0) {
        return response;
      }
    }
    
    return { status: false, data: null };
  }
}

module.exports = TradingDashboard;