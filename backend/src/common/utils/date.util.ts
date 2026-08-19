/**
 * Chuẩn hoá giá trị cột `timestamp` về ISO-8601 UTC (api-spec.md §1.4).
 *
 * TypeORM trả về `Date` cho cột timestamp, nhưng driver có thể trả chuỗi tuỳ
 * cấu hình; hàm này nhận cả hai để response không bao giờ vỡ.
 */
export function toIsoString(value: Date | string): string {
  return value instanceof Date
    ? value.toISOString()
    : new Date(value).toISOString();
}

/** Năm của một ngày dạng `YYYY-MM-DD` (không phụ thuộc timezone). */
export function yearOfDateString(value: string): number {
  return Number(value.slice(0, 4));
}

const VN_UTC_OFFSET_MS = 7 * 60 * 60 * 1000;

/**
 * Current year in Vietnam time (UTC+7), regardless of the server's timezone.
 *
 * `new Date().getFullYear()` reads the Node process's LOCAL timezone — if the
 * server runs in UTC (common for containers), for ~7 hours around New Year's
 * (VN already in the new year, UTC not yet) it would return the old year.
 * Add the offset to the UTC instant and read it back with `getUTCFullYear()`
 * so the result never depends on the server's timezone.
 */
export function currentYearInVietnam(): number {
  return new Date(Date.now() + VN_UTC_OFFSET_MS).getUTCFullYear();
}

/**
 * Chuẩn hoá cột `DATE` về `YYYY-MM-DD`.
 *
 * TypeORM thường đã trả string cho cột `date`, nhưng nếu driver trả `Date` thì
 * phải lấy theo giờ ĐỊA PHƯƠNG: mysql2 dựng `Date` ở nửa đêm local, dùng
 * `toISOString()` sẽ lùi 1 ngày ở múi giờ +07 (Việt Nam).
 */
export function toDateOnlyString(value: Date | string): string {
  if (typeof value === 'string') {
    return value.slice(0, 10);
  }

  const month = `${value.getMonth() + 1}`.padStart(2, '0');
  const day = `${value.getDate()}`.padStart(2, '0');

  return `${value.getFullYear()}-${month}-${day}`;
}

/** Ngày hôm nay theo giờ ĐỊA PHƯƠNG, dạng `YYYY-MM-DD`. */
export function todayDateString(now: Date = new Date()): string {
  return toDateOnlyString(now);
}

/**
 * Cộng thêm `years` năm vào một ngày `YYYY-MM-DD`.
 * 29/02 + 1 năm rơi vào năm không nhuận sẽ thành 01/03 (hành vi của `Date`),
 * chấp nhận được cho mọi so sánh tuổi trong dự án.
 */
export function addYears(dateString: string, years: number): string {
  const [year, month, day] = dateString.slice(0, 10).split('-').map(Number);
  const date = new Date(Date.UTC(year + years, month - 1, day));

  return date.toISOString().slice(0, 10);
}

/**
 * Số tuổi tròn tính tới `at` (mặc định hôm nay). Chỉ so sánh chuỗi ngày nên
 * KHÔNG phụ thuộc timezone của server.
 */
export function calculateAge(
  dateOfBirth: string,
  at: string = todayDateString(),
): number {
  const [birthYear, birthMonth, birthDay] = dateOfBirth
    .slice(0, 10)
    .split('-')
    .map(Number);
  const [year, month, day] = at.slice(0, 10).split('-').map(Number);

  let age = year - birthYear;

  if (month < birthMonth || (month === birthMonth && day < birthDay)) {
    age -= 1;
  }

  return age;
}

/**
 * Ngày và giờ HIỆN TẠI theo giờ Việt Nam (UTC+7), bất kể server chạy múi nào.
 *
 * VÌ SAO KHÔNG DÙNG `new Date()` TRỰC TIẾP: container thường chạy UTC. Lúc 06:00
 * sáng ở Việt Nam thì UTC mới 23:00 của NGÀY HÔM TRƯỚC — người đi ca sáng sẽ bị
 * ghi công vào ngày hôm qua, đè lên bản ghi hôm qua (cột UNIQUE
 * `employee_id + work_date`) hoặc tạo ra một ngày công ma. Cộng thẳng offset
 * rồi đọc bằng các hàm `getUTC*` nên kết quả không phụ thuộc `process.env.TZ`.
 *
 * Việt Nam không có quy ước giờ mùa hè nên offset cố định +07:00 là đủ.
 */
export function vietnamDateTime(now: Date = new Date()): {
  date: string;
  time: string;
} {
  const shifted = new Date(now.getTime() + VN_UTC_OFFSET_MS);
  const pad = (value: number): string => `${value}`.padStart(2, '0');

  return {
    date: `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`,
    time: `${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}`,
  };
}
