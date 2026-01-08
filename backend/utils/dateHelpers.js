// backend/utils/dateHelpers.js - ENHANCED VERSION
const { MARKET_HOURS } = require("../config/constants");

/**
 * Check if market is currently open
 * ENHANCED: Now exports this function for use everywhere
 */
function isMarketOpen(date = new Date()) {
  // Convert to IST
  const istDate = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  
  const dayOfWeek = istDate.getDay();
  const currentHour = istDate.getHours();
  const currentMinute = istDate.getMinutes();
  const currentTime = currentHour * 60 + currentMinute;
  
  const marketOpen = MARKET_HOURS.OPEN.hour * 60 + MARKET_HOURS.OPEN.minute;
  const marketClose = MARKET_HOURS.CLOSE.hour * 60 + MARKET_HOURS.CLOSE.minute;
  
  const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
  const inTradingHours = currentTime >= marketOpen && currentTime <= marketClose;
  
  return isWeekday && inTradingHours;
}

/**
 * Get last trading day
 */
function getLastTradingDay(currentDate = new Date()) {
  const istDate = new Date(currentDate.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  let lastTradingDay = new Date(istDate);
  const dayOfWeek = istDate.getDay();
  
  if (dayOfWeek === 0) { // Sunday -> Friday
    lastTradingDay.setDate(istDate.getDate() - 2);
  } else if (dayOfWeek === 6) { // Saturday -> Friday
    lastTradingDay.setDate(istDate.getDate() - 1);
  } else if (dayOfWeek === 1) { // Monday before open -> Friday
    const currentHour = istDate.getHours();
    const currentMinute = istDate.getMinutes();
    const currentTime = currentHour * 60 + currentMinute;
    const marketOpen = MARKET_HOURS.OPEN.hour * 60 + MARKET_HOURS.OPEN.minute;
    
    if (currentTime < marketOpen) {
      lastTradingDay.setDate(istDate.getDate() - 3);
    }
  } else {
    // Regular weekday - go back one day if before market open
    const currentHour = istDate.getHours();
    const currentMinute = istDate.getMinutes();
    const currentTime = currentHour * 60 + currentMinute;
    const marketOpen = MARKET_HOURS.OPEN.hour * 60 + MARKET_HOURS.OPEN.minute;
    
    if (currentTime < marketOpen) {
      lastTradingDay.setDate(istDate.getDate() - 1);
      // If that was a weekend, go back further
      if (lastTradingDay.getDay() === 0) {
        lastTradingDay.setDate(lastTradingDay.getDate() - 2);
      } else if (lastTradingDay.getDay() === 6) {
        lastTradingDay.setDate(lastTradingDay.getDate() - 1);
      }
    }
  }
  
  return lastTradingDay;
}

/**
 * Get smart date range based on current market status
 * ENHANCED: Better logic for market closed scenarios
 */
function getDateRange() {
  const now = new Date();
  const istNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  
  let fromDate, toDate;
  
  if (isMarketOpen(istNow)) {
    // Market is OPEN - use recent data (last 3 hours or from market open)
    const marketOpenToday = new Date(istNow);
    marketOpenToday.setHours(MARKET_HOURS.OPEN.hour, MARKET_HOURS.OPEN.minute, 0, 0);
    
    const threeHoursAgo = new Date(istNow.getTime() - 3 * 60 * 60 * 1000);
    fromDate = threeHoursAgo > marketOpenToday ? threeHoursAgo : marketOpenToday;
    toDate = istNow;
  } else {
    // Market is CLOSED - use last trading session
    const lastTradingDay = getLastTradingDay(istNow);
    
    fromDate = new Date(lastTradingDay);
    fromDate.setHours(MARKET_HOURS.OPEN.hour, MARKET_HOURS.OPEN.minute, 0, 0);
    
    toDate = new Date(lastTradingDay);
    toDate.setHours(MARKET_HOURS.CLOSE.hour, MARKET_HOURS.CLOSE.minute, 0, 0);
  }
  
  return {
    fromDate: formatDateTime(fromDate),
    toDate: formatDateTime(toDate),
    isMarketOpen: isMarketOpen(istNow)
  };
}

/**
 * Get date range optimized for a specific interval
 */
function getDateRangeForInterval(interval) {
  const now = new Date();
  const istNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const toDate = istNow;
  let fromDate;
  let lookbackMinutes;
  
  // Calculate lookback based on interval
  switch(interval) {
    case "ONE_MINUTE":
      lookbackMinutes = 120; // 2 hours
      break;
    case "THREE_MINUTE":
      lookbackMinutes = 180; // 3 hours
      break;
    case "FIVE_MINUTE":
      lookbackMinutes = 240; // 4 hours
      break;
    case "FIFTEEN_MINUTE":
      lookbackMinutes = 360; // 6 hours
      break;
    case "THIRTY_MINUTE":
      lookbackMinutes = 480; // 8 hours
      break;
    case "ONE_HOUR":
      lookbackMinutes = 480; // 8 hours
      break;
    default:
      lookbackMinutes = 180;
  }
  
  fromDate = new Date(istNow.getTime() - lookbackMinutes * 60 * 1000);
  
  // Ensure we don't go back before market open if market is currently open
  if (isMarketOpen(istNow)) {
    const marketOpenToday = new Date(istNow);
    marketOpenToday.setHours(MARKET_HOURS.OPEN.hour, MARKET_HOURS.OPEN.minute, 0, 0);
    
    if (fromDate < marketOpenToday) {
      fromDate = marketOpenToday;
    }
  }
  
  return {
    fromDate: formatDateTime(fromDate),
    toDate: formatDateTime(toDate),
    interval,
    lookbackMinutes
  };
}

/**
 * Format date for API
 */
function formatDateTime(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

/**
 * Get market status summary
 */
function getMarketStatus() {
  const now = new Date();
  const istNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const open = isMarketOpen(istNow);
  const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][istNow.getDay()];
  const currentTime = istNow.toLocaleTimeString('en-IN', { 
    timeZone: 'Asia/Kolkata', 
    hour: '2-digit', 
    minute: '2-digit' 
  });
  
  return {
    isOpen: open,
    dayOfWeek,
    currentTime,
    marketOpen: `${MARKET_HOURS.OPEN.hour}:${String(MARKET_HOURS.OPEN.minute).padStart(2, '0')}`,
    marketClose: `${MARKET_HOURS.CLOSE.hour}:${String(MARKET_HOURS.CLOSE.minute).padStart(2, '0')}`,
    timezone: 'Asia/Kolkata'
  };
}

module.exports = {
  getLastTradingDay,
  getDateRange,
  getDateRangeForInterval,
  formatDateTime,
  isMarketOpen,  // EXPORTED for use in other modules
  getMarketStatus
};