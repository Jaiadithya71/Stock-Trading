// ============================================================================
// FILE: backend/utils/marketCalendar.js
// Centralized NSE Market Calendar & Holiday Utility
// Provides high-precision market session checks across the backend & daemons
// ============================================================================

const { NSE_HOLIDAYS } = require('../config/marketHolidays');

class MarketCalendar {
  /**
   * Convert any date into an IST Date object
   */
  getISTDate(date = new Date()) {
    const d = new Date(date);
    const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
    return new Date(utc + (3600000 * 5.5)); // IST is UTC+5.5
  }

  /**
   * Returns date string formatted as YYYY-MM-DD in IST timezone
   */
  getDateKeyIST(date = new Date()) {
    const ist = this.getISTDate(date);
    const year = ist.getFullYear();
    const month = String(ist.getMonth() + 1).padStart(2, '0');
    const day = String(ist.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Checks if date is a weekend (Saturday or Sunday)
   */
  isWeekend(date = new Date()) {
    const ist = this.getISTDate(date);
    const day = ist.getDay(); // 0 = Sunday, 6 = Saturday
    return day === 0 || day === 6;
  }

  /**
   * Checks if date falls on an official NSE holiday
   * @returns {string|null} Holiday name if holiday, else null
   */
  isHoliday(date = new Date()) {
    const dateKey = this.getDateKeyIST(date);
    return NSE_HOLIDAYS[dateKey] || null;
  }

  /**
   * Checks if today is an active exchange trading day (Mon-Fri and not a holiday)
   */
  isTradingDay(date = new Date()) {
    if (this.isWeekend(date)) {
      return false;
    }
    if (this.isHoliday(date)) {
      return false;
    }
    return true;
  }

  /**
   * Checks if NSE market is currently in active regular trading session
   * Regular session: 9:15 AM IST (555 min) to 3:30 PM IST (930 min)
   */
  isMarketOpenNow(date = new Date()) {
    if (!this.isTradingDay(date)) {
      return false;
    }

    const ist = this.getISTDate(date);
    const hours = ist.getHours();
    const minutes = ist.getMinutes();
    const timeInMinutes = hours * 60 + minutes;

    return timeInMinutes >= 555 && timeInMinutes <= 930;
  }

  /**
   * Detailed market status with reason string
   */
  getMarketStatus(date = new Date()) {
    const ist = this.getISTDate(date);
    const holidayName = this.isHoliday(date);
    const dateKey = this.getDateKeyIST(date);

    if (this.isWeekend(date)) {
      const dayName = ist.getDay() === 0 ? 'Sunday' : 'Saturday';
      return {
        isOpen: false,
        reason: `Market Closed (Weekend: ${dayName})`,
        holidayName: null,
        dateKey
      };
    }

    if (holidayName) {
      return {
        isOpen: false,
        reason: `Market Closed (NSE Holiday: ${holidayName})`,
        holidayName,
        dateKey
      };
    }

    const hours = ist.getHours();
    const minutes = ist.getMinutes();
    const timeInMinutes = hours * 60 + minutes;

    if (timeInMinutes < 555) {
      return {
        isOpen: false,
        reason: 'Market Closed (Pre-Market / Before 9:15 AM IST)',
        holidayName: null,
        dateKey
      };
    } else if (timeInMinutes > 930) {
      return {
        isOpen: false,
        reason: 'Market Closed (Post-Market / After 3:30 PM IST)',
        holidayName: null,
        dateKey
      };
    }

    return {
      isOpen: true,
      reason: 'Market Open (Live Regular Trading Session: 9:15 AM - 3:30 PM IST)',
      holidayName: null,
      dateKey
    };
  }
}

module.exports = new MarketCalendar();
