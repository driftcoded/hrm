/**
 * Prefix for generated leave-type codes: `NP0001`, `NP0002`… ("nghỉ phép").
 *
 * The nine statutory types seeded from BLLĐ 2019 keep their meaningful codes
 * (`ANNUAL`, `SICK`, `MATERNITY`, …) because payroll and leave-balance rules
 * match on those values, and legislation refers to them by name. Only
 * company-defined types added through the API get a generated code, so the two
 * styles coexist on purpose.
 */
export const LEAVE_TYPE_CODE_PREFIX = 'NP';
