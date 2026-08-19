/**
 * Prefix for generated department codes: `PB0001`, `PB0002`… ("phòng ban").
 *
 * Matches the `NV####` scheme already used for `employees.employee_code`, so the
 * whole system reads consistently.
 *
 * Codes that predate generation (the seeded `ADM`) do not match the pattern and
 * are left alone — they are referenced by existing data and paperwork.
 */
export const DEPARTMENT_CODE_PREFIX = 'PB';
