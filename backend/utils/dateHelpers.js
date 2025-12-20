const { MARKET_HOURS } = require("../config/constants");

function getLastTradingDay(currentDate) {
  let lastTradingDay = new Date(currentDate);
  const dayOfWeek = currentDate.getDay();
  
  if (dayOfWeek === 0) { // Sunday
    lastTradingDay.setDate(currentDate.getDate() - 2);
  } else if (dayOfWeek === 6) { // Saturday
    lastTradingDay.setDate(currentDate.getDate() - 1);
  } else if (dayOfWeek === 1) { // Monday
    lastTradingDay.setDate(currentDate.getDate() - 3);
  } else {
    lastTradingDay.setDate(currentDate.getDate() - 1);
  }
  
  return lastTradingDay;
}

function getDateRange() {
  const now = new Date();
  const marketOpen = new Date(now);
  marketOpen.setHours(MARKET_HOURS.OPEN.hour, MARKET_HOURS.OPEN.minute, 0, 0);
  const marketClose = new Date(now);
  marketClose.setHours(MARKET_HOURS.CLOSE.hour, MARKET_HOURS.CLOSE.minute, 0, 0);
  
  let fromDate, toDate;
  
  if (now.getDay() === 0 || now.getDay() === 6) {
    // Weekend
    const lastTradingDay = getLastTradingDay(now);
    fromDate = new Date(lastTradingDay);
    fromDate.setHours(14, 30, 0, 0);
    toDate = new Date(lastTradingDay);
    toDate.setHours(15, 30, 0, 0);
  } else if (now < marketOpen) {
    // Before market open
    const lastTradingDay = getLastTradingDay(now);
    fromDate = new Date(lastTradingDay);
    fromDate.setHours(14, 30, 0, 0);
    toDate = new Date(lastTradingDay);
    toDate.setHours(15, 30, 0, 0);
  } else if (now > marketClose) {
    // After market close
    fromDate = new Date(marketClose);
    fromDate.setHours(14, 30, 0, 0);
    toDate = marketClose;
  } else {
    // During market hours
    fromDate = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago
    toDate = now;
  }
  
  return {
    fromDate: formatDateTime(fromDate),
    toDate: formatDateTime(toDate)
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

module.exports = {
  getLastTradingDay,
  getDateRange,
  formatDateTime
};