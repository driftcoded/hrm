import { DataSource, DeepPartial } from 'typeorm';
import { AppDataSource } from '../data-source';
import {
  WORK_END_TIME,
  WORK_START_TIME,
} from '../../common/constants/attendance.constant';
import { toDateOnlyString } from '../../common/utils/date.util';
import {
  calculateWorkHours,
  formatMinutesToTime,
  parseTimeToMinutes,
} from '../../common/utils/work-hours.util';
import {
  Attendance,
  AttendanceStatus,
} from '../../modules/attendances/entities/attendance.entity';

/**
 * ATTENDANCE demo seed — a believable timesheet for the 62 demo employees of
 * `demo.seed.ts`, so the attendance list, the month view and the calendar have
 * real-looking content instead of a handful of fixtures.
 *
 *   npm run seed:attendance            # seed once (no-op if already seeded)
 *   npm run seed:attendance -- --reset # wipe what this seed made, then re-seed
 *
 * Deliberately NOT part of `npm run seed`: that one is the baseline the e2e
 * suites assert against, and ~2,100 attendance rows would change the world
 * every test runs in. Same reasoning as `demo.seed.ts`, whose shape this file
 * follows (marker-scoped wipe, "already seeded" short-circuit, `--reset`).
 *
 * ======================== THE ONE HARD RULE ========================
 * NOT A SINGLE derived number in this file is typed by hand. `work_hours`,
 * `overtime_hours`, `is_late`, `late_minutes`, `is_early_leave` and
 * `early_leave_minutes` all come out of `calculateWorkHours()` — the same
 * function `AttendancesService` uses — in exactly one place
 * (`toAttendanceRow`). The generators below only ever decide a check-in time, a
 * check-out time and a label; every consequence of those times is computed.
 *
 * Seed data that disagrees with the application's own arithmetic is worse than
 * no seed data: it makes the UI look broken and sends people debugging the
 * wrong layer.
 *
 * WHAT IT TOUCHES: `attendances` rows for demo employees (work email at
 * `@vietphattech.vn`) inside `RANGE_FROM`..`RANGE_TO`, plus the handful of
 * declared rest-day exceptions. Nothing else. In particular `NV0001`–`NV0006`
 * — the records behind the `admin` / `hr.manager` / … accounts — are never
 * written to, and their existing rows are never read or deleted.
 *
 * The same wipe by hand, if you would rather not run the script:
 *
 *   DELETE a FROM attendances a
 *     JOIN employees e ON e.id = a.employee_id
 *    WHERE e.email LIKE '%@vietphattech.vn'
 *      AND (a.work_date BETWEEN '2026-07-01' AND '2026-08-19'
 *           OR a.work_date IN ('2026-04-30', '2026-05-01'));
 */

// -------------------------------------------------------------- scope -----

/** Work-email domain — the same marker `demo.seed.ts` uses. */
const DEMO_EMAIL_DOMAIN = 'vietphattech.vn';

/**
 * The window the timesheet covers: one complete month plus the current month up
 * to "today", so a month summary has a full month to add up and the calendar
 * has a partial month with a visible edge.
 *
 * Fixed dates rather than `new Date()` on purpose. A seed whose output depends
 * on the day it ran cannot be re-created, and "run it again and compare" is the
 * only way to tell demo data from real data later on. Move these when the demo
 * needs a different window.
 */
const RANGE_FROM = '2026-07-01';
const RANGE_TO = '2026-08-19';

// --------------------------------------------------------- work rhythm ---

const WORK_START_MINUTES = parseTimeToMinutes(WORK_START_TIME);
const WORK_END_MINUTES = parseTimeToMinutes(WORK_END_TIME);

/**
 * Habitual latecomers — a handful of named people rather than lateness
 * sprinkled evenly over everybody.
 *
 * This is what real attendance data looks like: being late is a property of a
 * person, not of a dice roll. Spread uniformly, every employee ends the month
 * with the same two late days and no report can tell anyone apart — which is
 * the one thing an attendance report exists to do.
 */
const HABITUAL_LATECOMERS = new Set([
  'NV0023',
  'NV0031',
  'NV0036',
  'NV0046',
  'NV0060',
  'NV0067',
]);

/** People who regularly leave before the bell (school run, evening class). */
const HABITUAL_EARLY_LEAVERS = new Set([
  'NV0021',
  'NV0043',
  'NV0053',
  'NV0064',
]);

/**
 * People who regularly stay well past the bell.
 *
 * Their long days are how `overtime_hours` gets into the data: it is DERIVED
 * from the timesheet by `calculateWorkHours`, never typed. Product development
 * during a release and the infrastructure team during maintenance windows are
 * the plausible places for it.
 */
const HABITUAL_LONG_DAYS = new Set([
  'NV0014',
  'NV0015',
  'NV0041',
  'NV0042',
  'NV0044',
  'NV0055',
  'NV0056',
]);

/** Departments where working from home is an ordinary arrangement. */
const WFH_DEPARTMENTS = new Set([
  'Khối Công nghệ',
  'Phòng Phát triển Sản phẩm',
  'Phòng Kiểm thử Chất lượng',
  'Phòng Marketing',
]);

/**
 * Days somebody clocked in and forgot to clock out.
 *
 * Worth having in the data on purpose: `work_hours` is `null` there, NOT 0, and
 * anything that averages or sums the column has to tell those apart. A data set
 * without this case lets that bug through unnoticed.
 */
const MISSING_CHECK_OUT = [
  { code: 'NV0020', date: '2026-07-09' },
  { code: 'NV0037', date: '2026-07-23' },
  { code: 'NV0059', date: '2026-08-12' },
];

/**
 * Saturday shifts — DELIBERATE exceptions to the weekend filter.
 *
 * Work on a weekly rest day is paid at a different statutory rate (Điều 98
 * BLLĐ 2019, 200%), so the data has to contain the case or nothing downstream
 * can be shown to handle it. Kept to three rows: any more and they stop reading
 * as exceptions.
 *
 * `status` is left to be DERIVED (present / late / early_leave) rather than
 * forced: the enum has no "weekend" member, and `holiday` means a PUBLIC
 * holiday — a Saturday is not one. The rest-day premium is decided from the
 * DATE, which is how `resolveRateType()` in `overtime.util.ts` already does it,
 * so no status value is needed to carry that fact.
 */
const SATURDAY_SHIFTS = [
  {
    code: 'NV0055',
    date: '2026-07-11',
    checkIn: '08:00',
    checkOut: '15:30',
    note: 'Trực nâng cấp máy chủ cuối tuần theo kế hoạch bảo trì.',
  },
  {
    code: 'NV0056',
    date: '2026-07-11',
    checkIn: '08:10',
    checkOut: '16:00',
    note: 'Trực nâng cấp máy chủ cuối tuần theo kế hoạch bảo trì.',
  },
  {
    code: 'NV0015',
    date: '2026-08-08',
    checkIn: '08:30',
    checkOut: '17:00',
    note: 'Làm thêm ngày thứ Bảy để chốt số liệu kế toán tháng 7.',
  },
];

/**
 * Public-holiday shifts — the other DELIBERATE exception.
 *
 * THE DATES ARE NOT WRITTEN HERE. They are read from the `holidays` table at
 * run time (the two most recent holidays on or before `RANGE_TO`), because a
 * hardcoded holiday list is exactly the thing that goes stale and then quietly
 * disagrees with the table the application itself reads.
 *
 * ⚠️ Those dates fall OUTSIDE `RANGE_FROM`..`RANGE_TO`: no seeded 2026 holiday
 * lands in July or August. The alternative was 01–02/09, which are in the
 * FUTURE relative to `RANGE_TO` — a timesheet for a day that has not happened
 * yet is worse data than a timesheet slightly out of window. `--reset` covers
 * these dates explicitly, so they are still fully reversible.
 *
 * `status` is forced to `holiday`: that is the member the enum offers for it,
 * and forcing it follows the same "caller-supplied status wins over the
 * computed label" rule as `AttendancesService.create()`. The times and every
 * number derived from them are still computed, so the row says both "this was a
 * public holiday" and "this many hours were actually worked".
 */
const HOLIDAY_SHIFT_CREW = [
  {
    code: 'NV0055',
    checkIn: '09:00',
    checkOut: '15:00',
    note: 'Trực hệ thống ngày lễ theo lịch phân công của phòng.',
  },
  {
    code: 'NV0056',
    checkIn: '09:00',
    checkOut: '14:30',
    note: 'Trực hệ thống ngày lễ theo lịch phân công của phòng.',
  },
];

const ABSENCE_NOTES = [
  'Nghỉ không phép, chưa có đơn.',
  'Nghỉ ốm đột xuất, chưa bổ sung giấy tờ.',
  'Nghỉ việc riêng đột xuất, quản lý đã nắm.',
];

const LEAVE_NOTES = [
  'Nghỉ phép năm đã được duyệt.',
  'Nghỉ phép năm.',
  'Nghỉ việc riêng có lương.',
];

const WFH_NOTES = [
  'Làm việc tại nhà.',
  'Làm việc tại nhà, họp online với khách hàng.',
  'Làm việc tại nhà theo lịch luân phiên của phòng.',
];

const LONG_DAY_NOTES = [
  'Ở lại xử lý công việc gấp.',
  'Ở lại theo tiến độ bàn giao dự án.',
  'Ở lại hỗ trợ sự cố hệ thống.',
];

// -------------------------------------------------------------- types ----

interface DemoEmployee {
  id: number;
  code: string;
  fullName: string;
  departmentName: string;
  hireDate: string;
  terminationDate: string | null;
  status: string;
}

/**
 * What a generator decides. Everything else about the row is computed.
 *
 * `status: null` means "derive the label from the times", which is the normal
 * case; a value means the caller knows something the clock does not (a leave
 * day, an absence, a day worked from home, a public holiday).
 */
interface PlannedRow {
  employeeId: number;
  workDate: string;
  checkIn: string | null;
  checkOut: string | null;
  status: AttendanceStatus | null;
  note: string | null;
}

// ------------------------------------------------------ deterministic ----

/**
 * FNV-1a over a string → a 32-bit seed.
 *
 * The generators are seeded from `${employeeCode}|${date}|${purpose}` and never
 * touch `Math.random()`, so `--reset` followed by a re-seed reproduces the same
 * timesheet row for row. Demo data that changes on every run cannot be used to
 * reproduce a bug report.
 */
function hashSeed(value: string): number {
  let hash = 0x811c9dc5;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return hash >>> 0;
}

/** mulberry32 — small, fast, and good enough to look like human behaviour. */
function makeRandom(seed: string): () => number {
  let state = hashSeed(seed);

  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomInt(random: () => number, min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1));
}

function pickOne<T>(random: () => number, values: T[]): T {
  return values[randomInt(random, 0, values.length - 1)];
}

// -------------------------------------------------------------- dates ----

/** `YYYY-MM-DD` → day of week, 0 = Sunday. Read in UTC so it never drifts. */
function dayOfWeek(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

function isWeekend(date: string): boolean {
  const day = dayOfWeek(date);

  return day === 0 || day === 6;
}

/** Every calendar date from `from` to `to`, inclusive. */
function datesBetween(from: string, to: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${from}T00:00:00Z`);
  const last = new Date(`${to}T00:00:00Z`);

  while (cursor.getTime() <= last.getTime()) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
}

/** MySQL `TIME` columns want `HH:mm:ss`; the generators produce `HH:mm`. */
function normaliseTime(time: string): string {
  return time.length === 5 ? `${time}:00` : time;
}

/** Minutes-from-midnight → `HH:mm`, so no clock time is ever a literal. */
function timeAt(minutes: number): string {
  return formatMinutesToTime(minutes);
}

// --------------------------------------------- the single derivation -----

/**
 * Turns a planned row into the row that gets inserted.
 *
 * THE ONLY place in this file that produces a derived number, and it produces
 * all of them from `calculateWorkHours` — the same call
 * `AttendancesService.applyTimes()` makes. If the company's work hours, lunch
 * break or late threshold ever change, the seed follows automatically, and it
 * is not possible for a row here to claim a number the application would
 * compute differently.
 */
function toAttendanceRow(planned: PlannedRow): DeepPartial<Attendance> {
  const row: DeepPartial<Attendance> = {
    employeeId: planned.employeeId,
    workDate: planned.workDate,
    checkIn: null,
    checkOut: null,
    breakStart: null,
    breakEnd: null,
    workHours: null,
    overtimeHours: '0.00',
    isLate: false,
    lateMinutes: 0,
    isEarlyLeave: false,
    earlyLeaveMinutes: 0,
    leaveRequestId: null,
    status: planned.status ?? AttendanceStatus.PRESENT,
    note: planned.note,
  };

  if (planned.checkIn === null) {
    /*
     * No clock data at all: leave, absence, or a holiday nobody worked.
     * `work_hours` stays `null` — "nothing was worked" and "nobody knows" look
     * the same inside a SUM, but only one of them is honest about a
     * measurement that was never taken.
     */
    return row;
  }

  if (planned.checkOut === null) {
    /*
     * Clocked in, never clocked out. Mirrors the `else if (dto.checkIn)` branch
     * of `AttendancesService.create()`: the arrival is known, so lateness is
     * known, but `work_hours` is `null` rather than 0.
     */
    const arrival = calculateWorkHours({
      checkIn: planned.checkIn,
      checkOut: planned.checkIn,
    });

    row.checkIn = normaliseTime(planned.checkIn);
    row.isLate = arrival.isLate;
    row.lateMinutes = arrival.lateMinutes;
    row.status =
      planned.status ??
      (arrival.isLate ? AttendanceStatus.LATE : AttendanceStatus.PRESENT);

    return row;
  }

  const computed = calculateWorkHours({
    checkIn: planned.checkIn,
    checkOut: planned.checkOut,
  });

  row.checkIn = normaliseTime(planned.checkIn);
  row.checkOut = normaliseTime(planned.checkOut);
  row.workHours = computed.workHours.toFixed(2);
  row.overtimeHours = computed.overtimeHours.toFixed(2);
  row.isLate = computed.isLate;
  row.lateMinutes = computed.lateMinutes;
  row.isEarlyLeave = computed.isEarlyLeave;
  row.earlyLeaveMinutes = computed.earlyLeaveMinutes;
  row.status =
    planned.status ?? resolveStatus(computed.isLate, computed.isEarlyLeave);

  return row;
}

/**
 * The display label for a day with clock data.
 *
 * A mirror of the private `AttendancesService.resolveStatus()` (late wins over
 * early-leave, because `status` holds one value and `is_early_leave` keeps the
 * rest of the story). Duplicated rather than imported because it is private on
 * a Nest service with four injected dependencies, and a plain ts-node seed
 * should not have to stand up the DI container to label a row. It is three
 * lines and it is a mirror — if that method's rule changes, change it here too.
 */
function resolveStatus(
  isLate: boolean,
  isEarlyLeave: boolean,
): AttendanceStatus {
  if (isLate) {
    return AttendanceStatus.LATE;
  }

  return isEarlyLeave ? AttendanceStatus.EARLY_LEAVE : AttendanceStatus.PRESENT;
}

// --------------------------------------------------------- generators ----

/**
 * How a given person tends to behave. Derived once per employee from their
 * code, so it is stable across runs and the same person is the same person in
 * every screenshot.
 */
interface Persona {
  /** Chance a day starts more than the late threshold after the bell. */
  lateChance: number;
  /** Chance a day ends more than the early-leave threshold before the bell. */
  earlyLeaveChance: number;
  /** Chance a day runs long enough to derive real overtime. */
  longDayChance: number;
  /** Chance a day is worked from home. */
  wfhChance: number;
  /** Unexcused / undocumented absences across the whole window. */
  absenceDays: number;
  /** Approved leave days across the whole window. */
  leaveDays: number;
}

function personaOf(employee: DemoEmployee): Persona {
  const random = makeRandom(`${employee.code}|persona`);
  const wfhEligible = WFH_DEPARTMENTS.has(employee.departmentName);

  return {
    lateChance: HABITUAL_LATECOMERS.has(employee.code)
      ? 0.34 + random() * 0.14
      : 0.02 + random() * 0.04,
    earlyLeaveChance: HABITUAL_EARLY_LEAVERS.has(employee.code)
      ? 0.2 + random() * 0.1
      : 0.01 + random() * 0.03,
    longDayChance: HABITUAL_LONG_DAYS.has(employee.code)
      ? 0.22 + random() * 0.1
      : 0.01 + random() * 0.02,
    wfhChance: wfhEligible ? 0.06 + random() * 0.05 : 0,
    // Most people are absent zero days in seven weeks; a few are absent once.
    absenceDays: random() < 0.22 ? (random() < 0.25 ? 2 : 1) : 0,
    leaveDays: random() < 0.55 ? randomInt(random, 1, 3) : 0,
  };
}

/**
 * Picks the days a person is on approved leave, as one consecutive block.
 *
 * Consecutive on purpose: annual leave is taken in blocks, and a calendar
 * showing three isolated leave days scattered through a month is a shape real
 * data does not have.
 */
function planBlock(
  employee: DemoEmployee,
  workingDays: string[],
  length: number,
  purpose: string,
): Set<string> {
  const chosen = new Set<string>();

  if (length <= 0 || workingDays.length === 0) {
    return chosen;
  }

  const random = makeRandom(`${employee.code}|${purpose}`);
  const start = randomInt(random, 0, Math.max(0, workingDays.length - length));

  for (let offset = 0; offset < length; offset += 1) {
    const date = workingDays[start + offset];

    if (date !== undefined) {
      chosen.add(date);
    }
  }

  return chosen;
}

/** Absences are single scattered days, unlike leave — that is what makes them absences. */
function planScatter(
  employee: DemoEmployee,
  workingDays: string[],
  count: number,
  purpose: string,
): Set<string> {
  const chosen = new Set<string>();

  if (count <= 0 || workingDays.length === 0) {
    return chosen;
  }

  const random = makeRandom(`${employee.code}|${purpose}`);
  let guard = 0;

  while (chosen.size < count && guard < count * 20) {
    chosen.add(workingDays[randomInt(random, 0, workingDays.length - 1)]);
    guard += 1;
  }

  return chosen;
}

/**
 * An ordinary worked day: a check-in near the bell and a check-out near the
 * other bell, both jittered by minutes.
 *
 * Nobody arrives at exactly 08:00 every day, and a column of identical
 * `08:00:00` values is the clearest single tell that a timesheet was generated.
 * The jitter straddles the bell in both directions, which also means an
 * ordinary day lands a little either side of eight net hours — that is what a
 * real timesheet looks like, and it is where the small non-zero
 * `overtime_hours` values come from. The deliberate long days are the ones an
 * hour or more over.
 *
 * The jitter ranges are chosen against the thresholds, not at random: an
 * ordinary day never crosses `LATE_THRESHOLD_MINUTES` or
 * `EARLY_LEAVE_THRESHOLD_MINUTES`, and a late / early-leave day always clears
 * it — otherwise "late" rows would appear that the application does not
 * consider late.
 */
function planWorkedDay(
  employee: DemoEmployee,
  date: string,
  persona: Persona,
): PlannedRow {
  const random = makeRandom(`${employee.code}|${date}|day`);

  const isLateDay = random() < persona.lateChance;
  const isLongDay = !isLateDay && random() < persona.longDayChance;
  const isEarlyLeaveDay = !isLongDay && random() < persona.earlyLeaveChance;
  const isWfhDay = !isLateDay && !isLongDay && random() < persona.wfhChance;

  const checkInMinutes = isLateDay
    ? WORK_START_MINUTES + randomInt(random, 17, 52)
    : WORK_START_MINUTES + randomInt(random, -12, 12);

  const checkOutMinutes = isLongDay
    ? /*
       * 17:45 to 20:30 — 0.75h to 3.5h of derived overtime.
       *
       * The lower bound is 45 minutes, not the 75 it started as: a long-day
       * range that begins at 18:15 leaves the 0.5–1.0h overtime bucket
       * completely EMPTY (ordinary jitter tops out around 0.4h), and a
       * histogram with a hole in the middle of it is a tell that the numbers
       * were generated. The upper bound is 20:30, which is 11.5 net hours —
       * inside the 12-hour daily cap of Điều 107 even for somebody who also
       * arrived early.
       */
      WORK_END_MINUTES + randomInt(random, 45, 210)
    : isEarlyLeaveDay
      ? WORK_END_MINUTES - randomInt(random, 25, 95)
      : WORK_END_MINUTES + randomInt(random, -12, 14);

  let note: string | null = null;

  if (isWfhDay) {
    note = pickOne(random, WFH_NOTES);
  } else if (isLongDay) {
    note = pickOne(random, LONG_DAY_NOTES);
  }

  return {
    employeeId: employee.id,
    workDate: date,
    checkIn: timeAt(checkInMinutes),
    checkOut: timeAt(checkOutMinutes),
    // Working from home is the one thing the clock cannot tell you.
    status: isWfhDay ? AttendanceStatus.WFH : null,
    note,
  };
}

/**
 * The whole timesheet for one employee.
 *
 * Employment window first, everything else after: a row before someone's
 * `hire_date` or after their `termination_date` is not "slightly wrong demo
 * data", it is a record of work by somebody who did not work there.
 */
function planEmployee(
  employee: DemoEmployee,
  workingDays: string[],
): PlannedRow[] {
  const eligible = workingDays.filter(
    (date) =>
      date >= employee.hireDate &&
      (employee.terminationDate === null || date <= employee.terminationDate),
  );

  if (eligible.length === 0) {
    return [];
  }

  /*
   * `on_leave` is read from the DATA, not from a hardcoded employee code: the
   * demo company has one person on six months' maternity leave (`NV0012`,
   * 01/06/2026–30/11/2026, which covers this whole window).
   *
   * She gets `leave` rows for every working day rather than no rows at all.
   * Both are defensible, but a GAP in the timesheet is indistinguishable from
   * missing data — an explicit `leave` row says the absence is accounted for,
   * which is the thing an HR screen needs to be able to show.
   */
  if (employee.status === 'on_leave') {
    return eligible.map((date) => ({
      employeeId: employee.id,
      workDate: date,
      checkIn: null,
      checkOut: null,
      status: AttendanceStatus.LEAVE,
      note: 'Nghỉ chế độ thai sản.',
    }));
  }

  const persona = personaOf(employee);
  const leaveDates = planBlock(
    employee,
    eligible,
    Math.min(persona.leaveDays, eligible.length),
    'leave',
  );
  const absenceDates = planScatter(
    employee,
    eligible.filter((date) => !leaveDates.has(date)),
    persona.absenceDays,
    'absence',
  );

  return eligible.map((date) => {
    if (leaveDates.has(date)) {
      return {
        employeeId: employee.id,
        workDate: date,
        checkIn: null,
        checkOut: null,
        status: AttendanceStatus.LEAVE,
        note: pickOne(
          makeRandom(`${employee.code}|${date}|leave`),
          LEAVE_NOTES,
        ),
      };
    }

    if (absenceDates.has(date)) {
      return {
        employeeId: employee.id,
        workDate: date,
        checkIn: null,
        checkOut: null,
        status: AttendanceStatus.ABSENT,
        note: pickOne(
          makeRandom(`${employee.code}|${date}|absent`),
          ABSENCE_NOTES,
        ),
      };
    }

    return planWorkedDay(employee, date, persona);
  });
}

// ----------------------------------------------------------- database ----

async function loadDemoEmployees(
  dataSource: DataSource,
): Promise<DemoEmployee[]> {
  const rows = await dataSource.query<
    Array<{
      id: string | number;
      employee_code: string;
      full_name: string;
      department_name: string | null;
      hire_date: Date | string;
      termination_date: Date | string | null;
      status: string;
    }>
  >(
    `SELECT e.id, e.employee_code, e.full_name, d.name AS department_name,
            e.hire_date, e.termination_date, e.status
       FROM employees e
       LEFT JOIN departments d ON d.id = e.department_id
      WHERE e.email LIKE ?
      ORDER BY e.employee_code`,
    [`%@${DEMO_EMAIL_DOMAIN}`],
  );

  return rows.map((row) => ({
    id: Number(row.id),
    code: row.employee_code,
    fullName: row.full_name,
    departmentName: row.department_name ?? '',
    hireDate: toDateOnlyString(row.hire_date),
    terminationDate:
      row.termination_date === null
        ? null
        : toDateOnlyString(row.termination_date),
    status: row.status,
  }));
}

/**
 * Every holiday date in the table, as `YYYY-MM-DD`, ascending.
 *
 * Read from the DB, never hardcoded: `holidays` is the list the application
 * itself consults (`HolidaysService`), it changes every year, and a copy of it
 * living in a seed file is a copy that will eventually be wrong.
 */
async function loadHolidayDates(dataSource: DataSource): Promise<string[]> {
  const rows = await dataSource.query<Array<{ holiday_date: Date | string }>>(
    `SELECT holiday_date FROM holidays ORDER BY holiday_date`,
  );

  return rows.map((row) => toDateOnlyString(row.holiday_date));
}

/**
 * The dates the holiday-shift exception rows land on: the two most recent
 * holidays that have already happened as of `RANGE_TO`.
 */
function holidayShiftDatesOf(holidayDates: string[]): string[] {
  return holidayDates
    .filter((date) => date <= RANGE_TO)
    .slice(-2)
    .sort();
}

/** The `WHERE` fragment + params that scope every read and delete this seed does. */
function seededScope(holidayShiftDates: string[]): {
  clause: string;
  params: unknown[];
} {
  const extra =
    holidayShiftDates.length > 0
      ? ` OR a.work_date IN (${holidayShiftDates.map(() => '?').join(', ')})`
      : '';

  return {
    clause: `e.email LIKE ? AND ((a.work_date BETWEEN ? AND ?)${extra})`,
    params: [
      `%@${DEMO_EMAIL_DOMAIN}`,
      RANGE_FROM,
      RANGE_TO,
      ...holidayShiftDates,
    ],
  };
}

async function countSeededRows(
  dataSource: DataSource,
  holidayShiftDates: string[],
): Promise<number> {
  const scope = seededScope(holidayShiftDates);

  const rows = await dataSource.query<Array<{ total: string | number }>>(
    `SELECT COUNT(*) AS total
       FROM attendances a
       JOIN employees e ON e.id = a.employee_id
      WHERE ${scope.clause}`,
    scope.params,
  );

  return Number(rows[0].total);
}

/**
 * Removes every row this seed created and nothing else.
 *
 * Scoped THREE ways at once — demo work email, this seed's date window, and the
 * declared exception dates — so it cannot reach the `NV0001`–`NV0006` fixtures
 * (different employees), a real month outside the window (different dates), or
 * anything the other seeds own.
 */
export async function wipeAttendanceDemoData(
  dataSource: DataSource,
  holidayShiftDates: string[],
): Promise<void> {
  const before = await countSeededRows(dataSource, holidayShiftDates);
  const scope = seededScope(holidayShiftDates);

  await dataSource.query(
    `DELETE a
       FROM attendances a
       JOIN employees e ON e.id = a.employee_id
      WHERE ${scope.clause}`,
    scope.params,
  );

  console.log(
    `  - wiped ${before} demo attendance rows (${RANGE_FROM}..${RANGE_TO}` +
      (holidayShiftDates.length > 0
        ? ` plus ${holidayShiftDates.join(', ')}`
        : '') +
      ')',
  );
}

// --------------------------------------------------------------- seed ----

export async function seedAttendance(dataSource: DataSource): Promise<void> {
  const employees = await loadDemoEmployees(dataSource);

  /*
   * Refuse rather than write nothing. An attendance seed with no employees to
   * write for produces zero rows and a cheerful "completed successfully", and
   * the next half hour goes into wondering why the screen is empty.
   */
  if (employees.length === 0) {
    throw new Error(
      `No demo employees found (nobody has a work email at @${DEMO_EMAIL_DOMAIN}).\n` +
        'This seed writes attendance for the demo company only — seed the company first:\n' +
        '  npm run seed:demo',
    );
  }

  const holidayDates = await loadHolidayDates(dataSource);
  const holidaySet = new Set(holidayDates);
  const holidayShiftDates = holidayShiftDatesOf(holidayDates);
  const existing = await countSeededRows(dataSource, holidayShiftDates);

  if (existing > 0) {
    console.log(
      `  - attendance demo data already present (${existing} rows for @${DEMO_EMAIL_DOMAIN} employees in ${RANGE_FROM}..${RANGE_TO}); nothing to do.`,
    );
    console.log(
      '    Re-seed from scratch with: npm run seed:attendance -- --reset',
    );

    return;
  }

  const allDates = datesBetween(RANGE_FROM, RANGE_TO);
  const workingDays = allDates.filter(
    (date) => !isWeekend(date) && !holidaySet.has(date),
  );

  console.log(
    `  - demo employees: ${employees.length} (@${DEMO_EMAIL_DOMAIN})`,
  );
  console.log(
    `  - window ${RANGE_FROM}..${RANGE_TO}: ${allDates.length} calendar days → ` +
      `${workingDays.length} working days ` +
      `(${allDates.filter(isWeekend).length} weekend days skipped, ` +
      `${allDates.filter((date) => holidaySet.has(date)).length} holidays skipped)`,
  );

  const planned: PlannedRow[] = [];

  for (const employee of employees) {
    planned.push(...planEmployee(employee, workingDays));
  }

  applyExceptions(planned, employees, holidayShiftDates);

  // ---- insert -----------------------------------------------------------

  const rows = planned.map(toAttendanceRow);
  const repository = dataSource.getRepository(Attendance);
  const chunkSize = 200;

  for (let offset = 0; offset < rows.length; offset += chunkSize) {
    await repository.insert(rows.slice(offset, offset + chunkSize));
  }

  report(employees, rows, holidayShiftDates);
}

/**
 * Applies the deliberate exceptions on top of the ordinary timesheet.
 *
 * All three throw rather than skip when the row they target does not exist. An
 * exception row that silently vanishes is the worst outcome: the seed reports
 * success, the case the exception was there to demonstrate is missing, and
 * nothing says so.
 */
function applyExceptions(
  planned: PlannedRow[],
  employees: DemoEmployee[],
  holidayShiftDates: string[],
): void {
  const byCode = new Map(
    employees.map((employee) => [employee.code, employee] as const),
  );
  const byKey = new Map(
    planned.map((row) => [`${row.employeeId}|${row.workDate}`, row] as const),
  );

  const employeeByCode = (code: string): DemoEmployee => {
    const employee = byCode.get(code);

    if (employee === undefined) {
      throw new Error(
        `An exception row refers to employee ${code}, who is not among the demo employees. ` +
          'Re-seed the demo company (npm run seed:demo -- --reset) or update the constant in this file.',
      );
    }

    return employee;
  };

  for (const shift of MISSING_CHECK_OUT) {
    const employee = employeeByCode(shift.code);
    const row = byKey.get(`${employee.id}|${shift.date}`);

    if (row === undefined || row.checkIn === null) {
      throw new Error(
        `The forgot-to-clock-out row for ${shift.code} on ${shift.date} has no ordinary worked day to replace ` +
          '(weekend, holiday, leave, absence, or outside the employment window). Pick another date.',
      );
    }

    row.checkOut = null;
    // Back to a derived label: without a check-out there is no early-leave to
    // read, and `work_hours` becomes `null` in `toAttendanceRow`.
    row.status = null;
    row.note = 'Quên chấm ra, chờ nhân sự đối chiếu.';
  }

  for (const shift of SATURDAY_SHIFTS) {
    const employee = employeeByCode(shift.code);

    if (dayOfWeek(shift.date) !== 6) {
      throw new Error(
        `The Saturday shift for ${shift.code} is dated ${shift.date}, which is not a Saturday.`,
      );
    }

    planned.push({
      employeeId: employee.id,
      workDate: shift.date,
      checkIn: shift.checkIn,
      checkOut: shift.checkOut,
      status: null,
      note: shift.note,
    });
  }

  for (const date of holidayShiftDates) {
    for (const shift of HOLIDAY_SHIFT_CREW) {
      const employee = employeeByCode(shift.code);

      if (date < employee.hireDate) {
        throw new Error(
          `The holiday shift on ${date} lands before ${shift.code} was hired (${employee.hireDate}).`,
        );
      }

      planned.push({
        employeeId: employee.id,
        workDate: date,
        checkIn: shift.checkIn,
        checkOut: shift.checkOut,
        status: AttendanceStatus.HOLIDAY,
        note: shift.note,
      });
    }
  }
}

function report(
  employees: DemoEmployee[],
  rows: Array<DeepPartial<Attendance>>,
  holidayShiftDates: string[],
): void {
  const byStatus = new Map<string, number>();

  for (const row of rows) {
    const status = String(row.status);
    byStatus.set(status, (byStatus.get(status) ?? 0) + 1);
  }

  const overtimeOf = (row: DeepPartial<Attendance>): number =>
    Number(row.overtimeHours ?? 0);

  const withoutCheckOut = rows.filter(
    (row) => row.checkIn !== null && row.checkOut === null,
  ).length;
  const staffed = new Set(rows.map((row) => row.employeeId)).size;

  console.log(`  - attendance: OK (${rows.length} rows inserted)`);
  console.log(
    `  - covered: ${staffed} of ${employees.length} demo employees ` +
      `(the rest left the company before ${RANGE_FROM})`,
  );
  console.log(
    '  - status: ' +
      [...byStatus.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([status, count]) => `${status} ${count}`)
        .join(', '),
  );
  console.log(
    `  - derived overtime: ${rows.filter((row) => overtimeOf(row) > 0).length} rows over 8h net, ` +
      `${rows.filter((row) => overtimeOf(row) >= 1).length} of them by an hour or more ` +
      `(longest ${Math.max(...rows.map(overtimeOf)).toFixed(2)}h)`,
  );
  console.log(`  - clocked in, never clocked out: ${withoutCheckOut} rows`);
  console.log(
    `  - rest-day exceptions: ${SATURDAY_SHIFTS.length} Saturday rows, ` +
      `${HOLIDAY_SHIFT_CREW.length * holidayShiftDates.length} holiday rows on ` +
      `${holidayShiftDates.join(', ') || 'no date'}`,
  );
  console.log('  - NV0001–NV0006 and every other table: untouched on purpose');
}

// ----------------------------------------------------------- entry point --

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Refusing to run the attendance seed with NODE_ENV=production: it inserts fictional timesheet data.',
    );
  }

  const reset = process.argv.includes('--reset');
  const dataSource = await AppDataSource.initialize();
  console.log('Seeding demo attendance into:', dataSource.options.database);

  try {
    if (reset) {
      const holidayDates = await loadHolidayDates(dataSource);
      await wipeAttendanceDemoData(
        dataSource,
        holidayShiftDatesOf(holidayDates),
      );
    }

    await seedAttendance(dataSource);
    console.log('Attendance seed completed successfully.');
  } finally {
    await dataSource.destroy();
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(
      'Attendance seed failed:',
      error instanceof Error ? error.message : error,
    );
    process.exit(1);
  });
}
