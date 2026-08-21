/**
 * Chuyển đổi dương lịch ↔ âm lịch Việt Nam.
 *
 * Thuật toán của Hồ Ngọc Đức: tính điểm sóc (new moon) và kinh độ mặt trời
 * theo múi giờ +7, nên khớp với lịch in ở Việt Nam — khác lịch âm Trung Quốc ở
 * một số năm vì họ dùng múi giờ +8.
 *
 * Cần cho hai ngày lễ pháp định tính theo âm lịch: Tết Nguyên đán và Giỗ Tổ
 * Hùng Vương (10/3 âm lịch).
 */

/** Múi giờ dùng để xác định ngày âm lịch. */
const VIETNAM_TIMEZONE = 7;

export interface LunarDate {
  day: number;
  month: number;
  year: number;
  /** Tháng nhuận — âm lịch có năm 13 tháng. */
  isLeapMonth: boolean;
}

/** Số ngày Julius của một ngày dương lịch. */
export function julianDayFromDate(
  day: number,
  month: number,
  year: number,
): number {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  let jd =
    day +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045;

  // Trước 05/10/1582 lịch Julius vẫn còn hiệu lực.
  if (jd < 2299161) {
    jd =
      day +
      Math.floor((153 * m + 2) / 5) +
      365 * y +
      Math.floor(y / 4) -
      32083;
  }

  return jd;
}

/** Ngày dương lịch của một số ngày Julius. */
export function dateFromJulianDay(jd: number): {
  day: number;
  month: number;
  year: number;
} {
  let a: number;
  let b: number;
  let c: number;

  if (jd > 2299160) {
    a = jd + 32044;
    b = Math.floor((4 * a + 3) / 146097);
    c = a - Math.floor((b * 146097) / 4);
  } else {
    b = 0;
    c = jd + 32082;
  }

  const d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * d) / 4);
  const m = Math.floor((5 * e + 2) / 153);

  return {
    day: e - Math.floor((153 * m + 2) / 5) + 1,
    month: m + 3 - 12 * Math.floor(m / 10),
    year: b * 100 + d - 4800 + Math.floor(m / 10),
  };
}

/** Ngày sóc thứ `k` tính từ điểm sóc 01/01/1900, quy về múi giờ đã cho. */
function newMoonDay(k: number, timeZone: number): number {
  const T = k / 1236.85;
  const T2 = T * T;
  const T3 = T2 * T;
  const dr = Math.PI / 180;

  let Jd1 =
    2415020.75933 +
    29.53058868 * k +
    0.0001178 * T2 -
    0.000000155 * T3;
  Jd1 += 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr);

  const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3;
  const Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3;
  const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3;

  let C1 = (0.1734 - 0.000393 * T) * Math.sin(M * dr) + 0.0021 * Math.sin(2 * dr * M);
  C1 -= 0.4068 * Math.sin(Mpr * dr) + 0.0161 * Math.sin(2 * dr * Mpr);
  C1 -= 0.0004 * Math.sin(3 * dr * Mpr);
  C1 += 0.0104 * Math.sin(2 * dr * F) - 0.0051 * Math.sin(dr * (M + Mpr));
  C1 -= 0.0074 * Math.sin(dr * (M - Mpr)) + 0.0004 * Math.sin(dr * (2 * F + M));
  C1 -= 0.0004 * Math.sin(dr * (2 * F - M)) - 0.0006 * Math.sin(dr * (2 * F + Mpr));
  C1 += 0.001 * Math.sin(dr * (2 * F - Mpr)) + 0.0005 * Math.sin(dr * (2 * Mpr + M));

  let deltat: number;
  if (T < -11) {
    deltat =
      0.001 +
      0.000839 * T +
      0.0002261 * T2 -
      0.00000845 * T3 -
      0.000000081 * T * T3;
  } else {
    deltat = -0.000278 + 0.000265 * T + 0.000262 * T2;
  }

  const JdNew = Jd1 + C1 - deltat;

  return Math.floor(JdNew + 0.5 + timeZone / 24);
}

/** Kinh độ mặt trời tại một ngày, trả về cung 0–11 (mỗi cung 30°). */
function sunLongitude(jdn: number, timeZone: number): number {
  const T = (jdn - 2451545.5 - timeZone / 24) / 36525;
  const T2 = T * T;
  const dr = Math.PI / 180;

  const M = 357.5291 + 35999.0503 * T - 0.0001559 * T2 - 0.00000048 * T * T2;
  const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2;

  let DL = (1.9146 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * M);
  DL +=
    (0.019993 - 0.000101 * T) * Math.sin(dr * 2 * M) +
    0.00029 * Math.sin(dr * 3 * M);

  let L = L0 + DL;
  L -= 360 * Math.floor(L / 360);

  return Math.floor((L / 360) * 12);
}

/** Ngày bắt đầu tháng 11 âm lịch của một năm dương — mốc để đánh số tháng. */
function lunarMonth11(year: number, timeZone: number): number {
  const off = julianDayFromDate(31, 12, year) - 2415021;
  const k = Math.floor(off / 29.530588853);
  let nm = newMoonDay(k, timeZone);
  const sunLong = sunLongitude(nm, timeZone);

  if (sunLong >= 9) {
    nm = newMoonDay(k - 1, timeZone);
  }

  return nm;
}

/** Vị trí tháng nhuận trong năm âm lịch, tính từ tháng 11. */
function leapMonthOffset(a11: number, timeZone: number): number {
  const k = Math.floor((a11 - 2415021.076998695) / 29.530588853 + 0.5);
  let last = 0;
  let i = 1;
  let arc = sunLongitude(newMoonDay(k + i, timeZone), timeZone);

  do {
    last = arc;
    i += 1;
    arc = sunLongitude(newMoonDay(k + i, timeZone), timeZone);
  } while (arc !== last && i < 14);

  return i - 1;
}

/** Ngày âm lịch tương ứng với một ngày dương lịch. */
export function solarToLunar(
  day: number,
  month: number,
  year: number,
  timeZone: number = VIETNAM_TIMEZONE,
): LunarDate {
  const dayNumber = julianDayFromDate(day, month, year);
  const k = Math.floor((dayNumber - 2415021.076998695) / 29.530588853);

  let monthStart = newMoonDay(k + 1, timeZone);
  if (monthStart > dayNumber) {
    monthStart = newMoonDay(k, timeZone);
  }

  let a11 = lunarMonth11(year, timeZone);
  let b11 = a11;
  let lunarYear: number;

  if (a11 >= monthStart) {
    lunarYear = year;
    a11 = lunarMonth11(year - 1, timeZone);
  } else {
    lunarYear = year + 1;
    b11 = lunarMonth11(year + 1, timeZone);
  }

  const lunarDay = dayNumber - monthStart + 1;
  const diff = Math.floor((monthStart - a11) / 29);
  let lunarMonth = diff + 11;
  let isLeapMonth = false;

  if (b11 - a11 > 365) {
    const leapOffset = leapMonthOffset(a11, timeZone);

    if (diff >= leapOffset) {
      lunarMonth = diff + 10;

      if (diff === leapOffset) {
        isLeapMonth = true;
      }
    }
  }

  if (lunarMonth > 12) {
    lunarMonth -= 12;
  }

  if (lunarMonth >= 11 && diff < 4) {
    lunarYear -= 1;
  }

  return { day: lunarDay, month: lunarMonth, year: lunarYear, isLeapMonth };
}

/** Ngày dương lịch tương ứng với một ngày âm lịch. */
export function lunarToSolar(
  day: number,
  month: number,
  year: number,
  isLeapMonth = false,
  timeZone: number = VIETNAM_TIMEZONE,
): { day: number; month: number; year: number } {
  let a11: number;
  let b11: number;

  if (month < 11) {
    a11 = lunarMonth11(year - 1, timeZone);
    b11 = lunarMonth11(year, timeZone);
  } else {
    a11 = lunarMonth11(year, timeZone);
    b11 = lunarMonth11(year + 1, timeZone);
  }

  const k = Math.floor(0.5 + (a11 - 2415021.076998695) / 29.530588853);
  let off = month - 11;

  if (off < 0) {
    off += 12;
  }

  if (b11 - a11 > 365) {
    const leapOffset = leapMonthOffset(a11, timeZone);
    let leapMonth = leapOffset - 2;

    if (leapMonth < 0) {
      leapMonth += 12;
    }

    if (isLeapMonth && month !== leapMonth) {
      // Năm đó không nhuận tháng này — không có ngày dương tương ứng.
      return { day: 0, month: 0, year: 0 };
    }

    if (isLeapMonth || off >= leapOffset) {
      off += 1;
    }
  }

  const monthStart = newMoonDay(k + off, timeZone);

  return dateFromJulianDay(monthStart + day - 1);
}

/** Ngày dương lịch (chuỗi `YYYY-MM-DD`) của một ngày âm lịch trong năm dương đã cho. */
export function lunarDateInSolarYear(
  lunarDay: number,
  lunarMonth: number,
  solarYear: number,
): string | null {
  for (const candidateYear of [solarYear, solarYear - 1, solarYear + 1]) {
    const solar = lunarToSolar(lunarDay, lunarMonth, candidateYear);

    if (solar.year === solarYear) {
      return toDateString(solar.day, solar.month, solar.year);
    }
  }

  return null;
}

/** `YYYY-MM-DD` từ ba số ngày/tháng/năm. */
export function toDateString(
  day: number,
  month: number,
  year: number,
): string {
  return [
    String(year).padStart(4, '0'),
    String(month).padStart(2, '0'),
    String(day).padStart(2, '0'),
  ].join('-');
}
