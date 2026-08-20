// ============================================================================
// FILE: backend/config/marketHolidays.js
// Official NSE Trading Holiday Calendar (2025, 2026, 2027)
// Ensures background schedulers, telemetry loggers, and OMS daemons 
// never execute on exchange holidays or weekends.
// ============================================================================

const NSE_HOLIDAYS = {
  // --- 2025 Holidays ---
  "2025-01-26": "Republic Day",
  "2025-02-26": "Mahashivratri",
  "2025-03-14": "Holi",
  "2025-03-31": "Id-Ul-Fitr (Ramzan Id)",
  "2025-04-10": "Shri Mahavir Jayanti",
  "2025-04-14": "Dr. Baba Saheb Ambedkar Jayanti",
  "2025-04-18": "Good Friday",
  "2025-05-01": "Maharashtra Day",
  "2025-06-07": "Bakri Id (Eid ul-Adha)",
  "2025-08-15": "Independence Day",
  "2025-08-27": "Ganesh Chaturthi",
  "2025-10-02": "Mahatma Gandhi Jayanti / Dussehra",
  "2025-10-21": "Diwali Laxmi Pujan (Muhurat Trading only)",
  "2025-10-22": "Diwali Balipratipada",
  "2025-11-05": "Guru Nanak Jayanti",
  "2025-12-25": "Christmas",

  // --- 2026 Holidays ---
  "2026-01-26": "Republic Day",
  "2026-02-17": "Mahashivratri",
  "2026-03-03": "Holi",
  "2026-03-20": "Id-Ul-Fitr (Ramzan Id)",
  "2026-03-31": "Shri Ram Navami",
  "2026-04-03": "Good Friday",
  "2026-04-14": "Dr. Baba Saheb Ambedkar Jayanti",
  "2026-05-01": "Maharashtra Day",
  "2026-05-27": "Bakri Id (Eid ul-Adha)",
  "2026-06-26": "Muharram",
  "2026-08-15": "Independence Day",
  "2026-09-14": "Milad-un-Nabi",
  "2026-10-02": "Mahatma Gandhi Jayanti",
  "2026-10-20": "Dussehra",
  "2026-11-08": "Diwali Laxmi Pujan (Muhurat Trading only)",
  "2026-11-10": "Diwali Balipratipada",
  "2026-11-24": "Guru Nanak Jayanti",
  "2026-12-25": "Christmas",

  // --- 2027 Fixed National Holidays ---
  "2027-01-26": "Republic Day",
  "2027-03-26": "Good Friday",
  "2027-04-14": "Dr. Baba Saheb Ambedkar Jayanti",
  "2027-05-01": "Maharashtra Day",
  "2027-08-15": "Independence Day",
  "2027-10-02": "Mahatma Gandhi Jayanti",
  "2027-12-25": "Christmas"
};

module.exports = {
  NSE_HOLIDAYS
};
