/* The Iranian (Solar Hijri / Jalali) calendar. Events stay stored as normal dates, so the same
 * schedule shows in both calendars. Same arithmetic as to_jalali / from_jalali in atom_sysinfo.py. */
(function () {
  "use strict";
  const MONTHS = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];
  const WEEKDAYS = ["یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه", "شنبه"];   // Date.getDay() order
  const SHORT_DAYS = ["ش", "ی", "د", "س", "چ", "پ", "ج"];                                  // weeks start on Saturday
  const div = (a, b) => Math.floor(a / b);
  const digits = (v) => String(v).replace(/\d/g, (c) => "۰۱۲۳۴۵۶۷۸۹"[c]);

  function fromDate(d) {
    const gy = d.getFullYear(), gm = d.getMonth() + 1, gd = d.getDate();
    const before = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
    const gy2 = gm > 2 ? gy + 1 : gy;
    let days = 355666 + 365 * gy + div(gy2 + 3, 4) - div(gy2 + 99, 100) + div(gy2 + 399, 400) + gd + before[gm - 1];
    let y = -1595 + 33 * div(days, 12053);
    days %= 12053;
    y += 4 * div(days, 1461);
    days %= 1461;
    if (days > 365) { y += div(days - 1, 365); days = (days - 1) % 365; }
    return days < 186 ? { y, m: 1 + div(days, 31), d: 1 + (days % 31) }
                      : { y, m: 7 + div(days - 186, 30), d: 1 + ((days - 186) % 30) };
  }

  function toDate(jy, jm, jd) {
    const y = jy + 1595;
    let days = -355668 + 365 * y + div(y, 33) * 8 + div((y % 33) + 3, 4) + jd + (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);
    let gy = 400 * div(days, 146097);
    days %= 146097;
    if (days > 36524) {
      days -= 1;
      gy += 100 * div(days, 36524);
      days %= 36524;
      if (days >= 365) days += 1;
    }
    gy += 4 * div(days, 1461);
    days %= 1461;
    if (days > 365) { gy += div(days - 1, 365); days = (days - 1) % 365; }
    let gd = days + 1, gm = 1;
    const leap = (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0;
    const lengths = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    while (gd > lengths[gm - 1]) { gd -= lengths[gm - 1]; gm += 1; }
    return new Date(gy, gm - 1, gd);
  }

  function monthDays(jy, jm) {
    if (jm <= 6) return 31;
    if (jm <= 11) return 30;
    return Math.round((toDate(jy + 1, 1, 1) - toDate(jy, 12, 1)) / 864e5);
  }

  function addMonths(jy, jm, delta) {
    const index = jy * 12 + jm - 1 + delta;
    return { y: div(index, 12), m: (index % 12 + 12) % 12 + 1 };
  }

  window.Jalali = { MONTHS, WEEKDAYS, SHORT_DAYS, digits, fromDate, toDate, monthDays, addMonths };
})();
