// backend/utils/dateHelpers.js - ENHANCED VERSION
const { MARKET_HOURS } = require("../config/constants");

function getLastTradingDay(currentDate) {
  let lastTradingDay = new Date(currentDate);
  const dayOfWeek = currentDate.getDay();
  
  if (dayOfWeek === 0) { // Sunday -> Friday
    lastTradingDay.setDate(currentDate.getDate() - 2);
  } else if (dayOfWeek === 6) { // Saturday -> Friday
    lastTradingDay.setDate(currentDate.getDate() - 1);
  } else if (dayOfWeek === 1) { // Monday before open -> Friday
    const currentHour = currentDate.getHours();
    const currentMinute = currentDate.getMinutes();
    const currentTime = currentHour * 60 + currentMinute;
    const marketOpen = MARKET_HOURS.OPEN.hour * 60 + MARKET_HOURS.OPEN.minute;
    
    if (currentTime < marketOpen) {
      lastTradingDay.setDate(currentDate.getDate() - 3);
    }
  } else {
    // Regular weekday - go back one day
    lastTradingDay.setDate(currentDate.getDate() - 1);
  }
  
  return lastTradingDay;
}

/**
 * Check if market is currently open
 */
function isMarketOpen(date = new Date()) {
  const dayOfWeek = date.getDay();
  const currentHour = date.getHours();
  const currentMinute = date.getMinutes();
  const currentTime = currentHour * 60 + currentMinute;
  
  const marketOpen = MARKET_HOURS.OPEN.hour * 60 + MARKET_HOURS.OPEN.minute;
  const marketClose = MARKET_HOURS.CLOSE.hour * 60 + MARKET_HOURS.CLOSE.minute;
  
  const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
  const inTradingHours = currentTime >= marketOpen && currentTime <= marketClose;
  
  return isWeekday && inTradingHours;
}

/**
 * Get smart date range based on current market status
 * Returns wider range for better data availability
 */
function getDateRange() {
  const now = new Date();
  const marketOpenToday = new Date(now);
  marketOpenToday.setHours(MARKET_HOURS.OPEN.hour, MARKET_HOURS.OPEN.minute, 0, 0);
  const marketCloseToday = new Date(now);
  marketCloseToday.setHours(MARKET_HOURS.CLOSE.hour, MARKET_HOURS.CLOSE.minute, 0, 0);
  
  let fromDate, toDate;
  
  if (isMarketOpen(now)) {
    // Market is OPEN - use wider range for better data availability
    // Go back 3 hours or to market open, whichever is later
    const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    fromDate = threeHoursAgo > marketOpenToday ? threeHoursAgo : marketOpenToday;
    toDate = now;
    
    console.log(`📅 Market OPEN - Date Range: ${formatDateTime(fromDate)} to ${formatDateTime(toDate)}`);
  } else {
    // Market is CLOSED - use last trading session
    let lastTradingDay = now;
    const dayOfWeek = now.getDay();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = currentHour * 60 + currentMinute;
    const marketOpen = MARKET_HOURS.OPEN.hour * 60 + MARKET_HOURS.OPEN.minute;
    
    // Determine which day to fetch data from
    if (dayOfWeek === 0) { // Sunday
      lastTradingDay = new Date(now);
      lastTradingDay.setDate(now.getDate() - 2); // Friday
    } else if (dayOfWeek === 6) { // Saturday
      lastTradingDay = new Date(now);
      lastTradingDay.setDate(now.getDate() - 1); // Friday
    } else if (currentTime < marketOpen) {
      // Before market open - use previous trading day
      lastTradingDay = getLastTradingDay(now);
    }
    // If after market close on weekday, use today
    
    // Use full trading session of that day
    fromDate = new Date(lastTradingDay);
    fromDate.setHours(MARKET_HOURS.OPEN.hour, MARKET_HOURS.OPEN.minute, 0, 0);
    toDate = new Date(lastTradingDay);
    toDate.setHours(MARKET_HOURS.CLOSE.hour, MARKET_HOURS.CLOSE.minute, 0, 0);
    
    console.log(`📅 Market CLOSED - Using last session: ${formatDateTime(fromDate)} to ${formatDateTime(toDate)}`);
  }
  
  return {
    fromDate: formatDateTime(fromDate),
    toDate: formatDateTime(toDate),
    isMarketOpen: isMarketOpen(now)
  };
}

/**
 * Get date range optimized for a specific interval
 */
function getDateRangeForInterval(interval) {
  const now = new Date();
  const toDate = now;
  let fromDate;
  let lookbackMinutes;
  
  // Calculate lookback based on interval to get good number of candles
  switch(interval) {
    case "ONE_MINUTE":
      lookbackMinutes = 120; // 2 hours = ~120 candles
      break;
    case "THREE_MINUTE":
      lookbackMinutes = 180; // 3 hours = ~60 candles
      break;
    case "FIVE_MINUTE":
      lookbackMinutes = 240; // 4 hours = ~48 candles
      break;
    case "FIFTEEN_MINUTE":
      lookbackMinutes = 360; // 6 hours = ~24 candles
      break;
    case "THIRTY_MINUTE":
      lookbackMinutes = 480; // 8 hours = ~16 candles (spans multiple sessions)
      break;
    case "ONE_HOUR":
      lookbackMinutes = 480; // 8 hours = ~8 candles
      break;
    default:
      lookbackMinutes = 180;
  }
  
  fromDate = new Date(now.getTime() - lookbackMinutes * 60 * 1000);
  
  // Ensure we don't go back before market open if market is currently open
  if (isMarketOpen(now)) {
    const marketOpenToday = new Date(now);
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
  const open = isMarketOpen(now);
  const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getDay()];
  const currentTime = now.toLocaleTimeString('en-IN', { 
    timeZone: 'Asia/Kolkata', 
    hour: '2-digit', 
    minute: '2-digit' 
  });
  
  return {
    isOpen: open,
    dayOfWeek,
    currentTime,
    marketOpen: `${MARKET_HOURS.OPEN.hour}:${String(MARKET_HOURS.OPEN.minute).padStart(2, '0')}`,
    marketClose: `${MARKET_HOURS.CLOSE.hour}:${String(MARKET_HOURS.CLOSE.minute).padStart(2, '0')}`
  };
}

module.exports = {
  getLastTradingDay,
  getDateRange,
  getDateRangeForInterval,
  formatDateTime,
  isMarketOpen,
  getMarketStatus
};