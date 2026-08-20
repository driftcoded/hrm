import { DataSource, ObjectLiteral, Repository } from 'typeorm';
import { AppDataSource } from '../data-source';
import {
  DEFAULT_CODE_DIGITS,
  findMaxCodeNumber,
  formatSequentialCode,
} from '../../common/utils/sequential-code.util';
import { DEPARTMENT_CODE_PREFIX } from '../../modules/departments/departments.constants';
import { POSITION_CODE_PREFIX } from '../../modules/positions/positions.constants';
import { Department } from '../../modules/departments/entities/department.entity';
import { Position } from '../../modules/positions/entities/position.entity';
import {
  EducationLevel,
  Employee,
  EmployeeStatus,
  Gender,
  MaritalStatus,
  TerminationType,
} from '../../modules/employees/entities/employee.entity';
import { User } from '../../modules/users/entities/user.entity';

/**
 * DEMO seed — a fictional Vietnamese SME ("Công ty Cổ phần Công nghệ Việt
 * Phát") so the UI has a real-looking org chart, position catalogue and staff
 * list instead of the six auth accounts of `npm run seed`.
 *
 * Deliberately NOT part of `npm run seed`: that one is the baseline the e2e
 * suites assert against, and 60+ extra employees would change the world every
 * test runs in. Run it on its own:
 *
 *   npm run seed:demo            # seed once (no-op if already seeded)
 *   npm run seed:demo -- --reset # wipe the demo data, then seed it again
 *
 * What it does NOT touch, on purpose:
 *  - `leave_types`: `test/master-data.e2e-spec.ts` asserts exactly 11 rows.
 *  - `users`: the auth suites count rows for the seeded accounts, and
 *    `users.employee_id` is nullable — demo staff are HR records only, with no
 *    login.
 *  - the Giai đoạn 1 baseline (`ADM`, `STAFF`, `NV0001`–`NV0006`, the 8 seed
 *    accounts, the 2025/2026 holidays) and anything under the `E2E…` / `E3E…` /
 *    `@e3e.local` test-fixture namespaces.
 *
 * Marker / namespace: every demo employee's work email ends in
 * `@vietphattech.vn`. That single marker drives both the "already seeded"
 * check and `--reset`, and it collides with no fixture prefix in the repo.
 *
 * The same wipe by hand, if you would rather not run the script:
 *
 *   CREATE TEMPORARY TABLE demo_depts AS
 *     SELECT DISTINCT department_id AS id FROM employees
 *     WHERE email LIKE '%@vietphattech.vn';
 *   UPDATE employees SET direct_manager_id = NULL
 *     WHERE email LIKE '%@vietphattech.vn';
 *   UPDATE departments SET manager_id = NULL, parent_id = NULL
 *     WHERE id IN (SELECT id FROM demo_depts);
 *   DELETE FROM employees WHERE email LIKE '%@vietphattech.vn';
 *   DELETE FROM positions WHERE department_id IN (SELECT id FROM demo_depts);
 *   DELETE FROM departments WHERE id IN (SELECT id FROM demo_depts);
 *   DROP TEMPORARY TABLE demo_depts;
 */

/** Work-email domain — the marker for the whole demo data set (see above). */
const DEMO_EMAIL_DOMAIN = 'vietphattech.vn';

/**
 * The placeholder org `users.seed.ts` creates so the dev login accounts have a
 * department and a position. Kept in sync with the constants there — this seed
 * folds it into the real company (see `absorbBaselineOrg`).
 */
const BASELINE_DEPARTMENT_CODE = 'ADM';
const BASELINE_POSITION_CODE = 'STAFF';

/**
 * `NV` prefix / 4-digit width, as
 * `src/modules/employees/employees.repository.ts` defines them. Duplicated
 * rather than imported so a dev-only seed does not drag the employees
 * repository (and its Nest decorators) into a plain ts-node script.
 */
const EMPLOYEE_CODE_PREFIX = 'NV';

// ------------------------------------------------------------ locations ----

interface DemoLocation {
  /** From `src/common/data/vn-administrative-units-2025.csv` (34-province list). */
  provinceCode: string;
  provinceName: string;
  /** Short form used for `hometown`. */
  provinceShortName: string;
  /**
   * No district/ward reference data exists in the project (phase 0.1 decided
   * against a table), and the API only checks `^\d{1,10}$` — so these are
   * plausible GSO-shaped codes, 3 digits for a district and 5 for a ward.
   */
  districtCode: string;
  wardCode: string;
  ward: string;
  street: string;
}

const LOCATIONS: Record<string, DemoLocation> = {
  HN1: {
    provinceCode: '01',
    provinceName: 'Thành phố Hà Nội',
    provinceShortName: 'Hà Nội',
    districtCode: '001',
    wardCode: '00004',
    ward: 'phường Ngọc Hà',
    street: 'phố Đội Cấn',
  },
  HN2: {
    provinceCode: '01',
    provinceName: 'Thành phố Hà Nội',
    provinceShortName: 'Hà Nội',
    districtCode: '005',
    wardCode: '00169',
    ward: 'phường Cầu Giấy',
    street: 'đường Trần Duy Hưng',
  },
  HN3: {
    provinceCode: '01',
    provinceName: 'Thành phố Hà Nội',
    provinceShortName: 'Hà Nội',
    districtCode: '008',
    wardCode: '00301',
    ward: 'phường Định Công',
    street: 'đường Giải Phóng',
  },
  HN4: {
    provinceCode: '01',
    provinceName: 'Thành phố Hà Nội',
    provinceShortName: 'Hà Nội',
    districtCode: '268',
    wardCode: '09556',
    ward: 'phường Hà Đông',
    street: 'đường Quang Trung',
  },
  HN5: {
    provinceCode: '01',
    provinceName: 'Thành phố Hà Nội',
    provinceShortName: 'Hà Nội',
    districtCode: '019',
    wardCode: '00637',
    ward: 'phường Long Biên',
    street: 'đường Nguyễn Văn Cừ',
  },
  HP1: {
    provinceCode: '31',
    provinceName: 'Thành phố Hải Phòng',
    provinceShortName: 'Hải Phòng',
    districtCode: '303',
    wardCode: '11305',
    ward: 'phường Lê Chân',
    street: 'đường Tô Hiệu',
  },
  BN1: {
    provinceCode: '24',
    provinceName: 'Tỉnh Bắc Ninh',
    provinceShortName: 'Bắc Ninh',
    districtCode: '256',
    wardCode: '09322',
    ward: 'phường Võ Cường',
    street: 'đường Lý Thái Tổ',
  },
  QN1: {
    provinceCode: '22',
    provinceName: 'Tỉnh Quảng Ninh',
    provinceShortName: 'Quảng Ninh',
    districtCode: '193',
    wardCode: '06976',
    ward: 'phường Hồng Hải',
    street: 'đường Nguyễn Văn Cừ',
  },
  TN1: {
    provinceCode: '19',
    provinceName: 'Tỉnh Thái Nguyên',
    provinceShortName: 'Thái Nguyên',
    districtCode: '164',
    wardCode: '05623',
    ward: 'phường Phan Đình Phùng',
    street: 'đường Hoàng Văn Thụ',
  },
  PT1: {
    provinceCode: '25',
    provinceName: 'Tỉnh Phú Thọ',
    provinceShortName: 'Phú Thọ',
    districtCode: '227',
    wardCode: '08404',
    ward: 'phường Nông Trang',
    street: 'đường Nguyễn Tất Thành',
  },
  HY1: {
    provinceCode: '33',
    provinceName: 'Tỉnh Hưng Yên',
    provinceShortName: 'Hưng Yên',
    districtCode: '323',
    wardCode: '12043',
    ward: 'phường Hiến Nam',
    street: 'đường Nguyễn Văn Linh',
  },
  NB1: {
    provinceCode: '37',
    provinceName: 'Tỉnh Ninh Bình',
    provinceShortName: 'Ninh Bình',
    districtCode: '369',
    wardCode: '13873',
    ward: 'phường Đông Thành',
    street: 'đường Trần Hưng Đạo',
  },
  TH1: {
    provinceCode: '38',
    provinceName: 'Tỉnh Thanh Hóa',
    provinceShortName: 'Thanh Hóa',
    districtCode: '380',
    wardCode: '14290',
    ward: 'phường Đông Vệ',
    street: 'đường Lê Lợi',
  },
  NA1: {
    provinceCode: '40',
    provinceName: 'Tỉnh Nghệ An',
    provinceShortName: 'Nghệ An',
    districtCode: '412',
    wardCode: '16687',
    ward: 'phường Hưng Bình',
    street: 'đường Nguyễn Thị Minh Khai',
  },
  HCM1: {
    provinceCode: '79',
    provinceName: 'Thành phố Hồ Chí Minh',
    provinceShortName: 'TP. Hồ Chí Minh',
    districtCode: '760',
    wardCode: '26743',
    ward: 'phường Bến Nghé',
    street: 'đường Nguyễn Huệ',
  },
  HCM2: {
    provinceCode: '79',
    provinceName: 'Thành phố Hồ Chí Minh',
    provinceShortName: 'TP. Hồ Chí Minh',
    districtCode: '768',
    wardCode: '27052',
    ward: 'phường Phú Nhuận',
    street: 'đường Phan Xích Long',
  },
  HCM3: {
    provinceCode: '79',
    provinceName: 'Thành phố Hồ Chí Minh',
    provinceShortName: 'TP. Hồ Chí Minh',
    districtCode: '766',
    wardCode: '27364',
    ward: 'phường Tân Bình',
    street: 'đường Cộng Hoà',
  },
  DN1: {
    provinceCode: '75',
    provinceName: 'Tỉnh Đồng Nai',
    provinceShortName: 'Đồng Nai',
    districtCode: '731',
    wardCode: '26026',
    ward: 'phường Trấn Biên',
    street: 'đường Phạm Văn Thuận',
  },
  CT1: {
    provinceCode: '92',
    provinceName: 'Thành phố Cần Thơ',
    provinceShortName: 'Cần Thơ',
    districtCode: '916',
    wardCode: '31117',
    ward: 'phường Ninh Kiều',
    street: 'đường 30 Tháng 4',
  },
  VL1: {
    provinceCode: '86',
    provinceName: 'Tỉnh Vĩnh Long',
    provinceShortName: 'Vĩnh Long',
    districtCode: '855',
    wardCode: '29806',
    ward: 'phường Long Châu',
    street: 'đường Phạm Thái Bường',
  },
  AG1: {
    provinceCode: '91',
    provinceName: 'Tỉnh An Giang',
    provinceShortName: 'An Giang',
    districtCode: '883',
    wardCode: '30289',
    ward: 'phường Mỹ Long',
    street: 'đường Nguyễn Trãi',
  },
};

/** Where each office is, so out-of-province staff get a `current_address`. */
const HEAD_OFFICE_KEYS = ['HN1', 'HN2', 'HN3', 'HN4', 'HN5'];
const BRANCH_OFFICE_KEYS = ['HCM1', 'HCM2', 'HCM3'];

// ---------------------------------------------------------- departments ----

interface DemoDepartmentRow {
  key: string;
  name: string;
  parentKey: string | null;
  description: string;
  /** Employee that heads it → `departments.manager_id`. */
  managerKey: string;
}

/** Parents come first: `parent_id` is resolved from an already-inserted row. */
const DEPARTMENTS: DemoDepartmentRow[] = [
  {
    key: 'BGD',
    name: 'Ban Giám đốc',
    parentKey: null,
    description:
      'Điều hành chung, quyết định chiến lược và phê duyệt ngân sách toàn công ty.',
    managerKey: 'e01',
  },
  {
    key: 'NS',
    name: 'Phòng Nhân sự',
    parentKey: 'BGD',
    description:
      'Tuyển dụng, đào tạo, tiền lương – phúc lợi và quan hệ lao động.',
    managerKey: 'e03',
  },
  {
    key: 'TCKT',
    name: 'Phòng Tài chính – Kế toán',
    parentKey: 'BGD',
    description:
      'Kế toán tổng hợp, thuế, dòng tiền và báo cáo tài chính định kỳ.',
    managerKey: 'e08',
  },
  {
    key: 'KKD',
    name: 'Khối Kinh doanh',
    parentKey: 'BGD',
    description:
      'Điều phối toàn bộ hoạt động bán hàng của hai khu vực Miền Bắc và Miền Nam.',
    managerKey: 'e13',
  },
  {
    key: 'KDMB',
    name: 'Phòng Kinh doanh Miền Bắc',
    parentKey: 'KKD',
    description:
      'Phụ trách khách hàng doanh nghiệp từ Ninh Bình trở ra, trụ sở Hà Nội.',
    managerKey: 'e14',
  },
  {
    key: 'KDMN',
    name: 'Phòng Kinh doanh Miền Nam',
    parentKey: 'KKD',
    description:
      'Phụ trách khu vực Đông Nam Bộ và Đồng bằng sông Cửu Long, chi nhánh TP. Hồ Chí Minh.',
    managerKey: 'e22',
  },
  {
    key: 'MKT',
    name: 'Phòng Marketing',
    parentKey: 'BGD',
    description:
      'Thương hiệu, nội dung, quảng cáo số và các chiến dịch tạo nhu cầu.',
    managerKey: 'e28',
  },
  {
    key: 'KCN',
    name: 'Khối Công nghệ',
    parentKey: 'BGD',
    description:
      'Định hướng kiến trúc, tiêu chuẩn kỹ thuật và lộ trình sản phẩm công nghệ.',
    managerKey: 'e33',
  },
  {
    key: 'PTSP',
    name: 'Phòng Phát triển Sản phẩm',
    parentKey: 'KCN',
    description:
      'Phân tích nghiệp vụ và lập trình các sản phẩm phần mềm của công ty.',
    managerKey: 'e35',
  },
  {
    key: 'QA',
    name: 'Phòng Kiểm thử Chất lượng',
    parentKey: 'KCN',
    description:
      'Kiểm thử thủ công và tự động, quản lý chất lượng trước mỗi lần phát hành.',
    managerKey: 'e45',
  },
  {
    key: 'HTVH',
    name: 'Phòng Hạ tầng – Vận hành Hệ thống',
    parentKey: 'KCN',
    description:
      'Hạ tầng máy chủ, giám sát, sao lưu và an toàn thông tin nội bộ.',
    managerKey: 'e49',
  },
  {
    key: 'VH',
    name: 'Phòng Vận hành',
    parentKey: 'BGD',
    description:
      'Điều phối đơn hàng, hỗ trợ và chăm sóc khách hàng sau bán hàng.',
    managerKey: 'e53',
  },
  {
    key: 'HCPL',
    name: 'Phòng Hành chính – Pháp chế',
    parentKey: 'BGD',
    description:
      'Hành chính văn phòng, quản trị hợp đồng và tư vấn pháp lý nội bộ.',
    managerKey: 'e59',
  },
];

// ------------------------------------------------------------ positions ----

interface DemoPositionRow {
  key: string;
  departmentKey: string;
  name: string;
  /** 1 Staff · 2 Senior · 3 Lead · 4 Manager · 5 Director. */
  level: number;
  /** Monthly gross in VNĐ, 2026 market range for a mid-size company. */
  minSalary: number;
  maxSalary: number;
}

const POSITIONS: DemoPositionRow[] = [
  {
    key: 'BGD_TGD',
    departmentKey: 'BGD',
    name: 'Tổng Giám đốc',
    level: 5,
    minSalary: 60000000,
    maxSalary: 90000000,
  },
  {
    key: 'BGD_TL',
    departmentKey: 'BGD',
    name: 'Trợ lý Ban Giám đốc',
    level: 2,
    minSalary: 14000000,
    maxSalary: 20000000,
  },
  {
    key: 'NS_TP',
    departmentKey: 'NS',
    name: 'Trưởng phòng Nhân sự',
    level: 4,
    minSalary: 28000000,
    maxSalary: 40000000,
  },
  {
    key: 'NS_TD',
    departmentKey: 'NS',
    name: 'Chuyên viên Tuyển dụng',
    level: 2,
    minSalary: 13000000,
    maxSalary: 19000000,
  },
  {
    key: 'NS_CB',
    departmentKey: 'NS',
    name: 'Chuyên viên Tiền lương & Phúc lợi',
    level: 2,
    minSalary: 15000000,
    maxSalary: 22000000,
  },
  {
    key: 'KT_TRUONG',
    departmentKey: 'TCKT',
    name: 'Kế toán trưởng',
    level: 4,
    minSalary: 30000000,
    maxSalary: 45000000,
  },
  {
    key: 'KT_TH',
    departmentKey: 'TCKT',
    name: 'Kế toán Tổng hợp',
    level: 2,
    minSalary: 15000000,
    maxSalary: 22000000,
  },
  {
    key: 'KT_VIEN',
    departmentKey: 'TCKT',
    name: 'Kế toán viên',
    level: 1,
    minSalary: 9000000,
    maxSalary: 13000000,
  },
  {
    key: 'KD_GD',
    departmentKey: 'KKD',
    name: 'Giám đốc Kinh doanh',
    level: 5,
    minSalary: 45000000,
    maxSalary: 70000000,
  },
  {
    key: 'MB_TP',
    departmentKey: 'KDMB',
    name: 'Trưởng phòng Kinh doanh Miền Bắc',
    level: 4,
    minSalary: 25000000,
    maxSalary: 38000000,
  },
  {
    key: 'MB_TN',
    departmentKey: 'KDMB',
    name: 'Trưởng nhóm Kinh doanh Miền Bắc',
    level: 3,
    minSalary: 18000000,
    maxSalary: 26000000,
  },
  {
    key: 'MB_NV',
    departmentKey: 'KDMB',
    name: 'Nhân viên Kinh doanh Miền Bắc',
    level: 1,
    minSalary: 8000000,
    maxSalary: 15000000,
  },
  {
    key: 'MN_TP',
    departmentKey: 'KDMN',
    name: 'Trưởng phòng Kinh doanh Miền Nam',
    level: 4,
    minSalary: 25000000,
    maxSalary: 38000000,
  },
  {
    key: 'MN_NV',
    departmentKey: 'KDMN',
    name: 'Nhân viên Kinh doanh Miền Nam',
    level: 1,
    minSalary: 8000000,
    maxSalary: 15000000,
  },
  {
    key: 'MKT_TP',
    departmentKey: 'MKT',
    name: 'Trưởng phòng Marketing',
    level: 4,
    minSalary: 26000000,
    maxSalary: 38000000,
  },
  {
    key: 'MKT_DIGITAL',
    departmentKey: 'MKT',
    name: 'Chuyên viên Marketing Kỹ thuật số',
    level: 2,
    minSalary: 15000000,
    maxSalary: 23000000,
  },
  {
    key: 'CN_GD',
    departmentKey: 'KCN',
    name: 'Giám đốc Công nghệ',
    level: 5,
    minSalary: 55000000,
    maxSalary: 85000000,
  },
  {
    key: 'CN_KTS',
    departmentKey: 'KCN',
    name: 'Kiến trúc sư Giải pháp',
    level: 3,
    minSalary: 35000000,
    maxSalary: 50000000,
  },
  {
    key: 'SP_TP',
    departmentKey: 'PTSP',
    name: 'Trưởng phòng Phát triển Sản phẩm',
    level: 4,
    minSalary: 35000000,
    maxSalary: 50000000,
  },
  {
    key: 'SP_TN',
    departmentKey: 'PTSP',
    name: 'Trưởng nhóm Lập trình',
    level: 3,
    minSalary: 28000000,
    maxSalary: 40000000,
  },
  {
    key: 'SP_SENIOR',
    departmentKey: 'PTSP',
    name: 'Lập trình viên Cấp cao',
    level: 2,
    minSalary: 22000000,
    maxSalary: 32000000,
  },
  {
    key: 'SP_DEV',
    departmentKey: 'PTSP',
    name: 'Lập trình viên',
    level: 1,
    minSalary: 12000000,
    maxSalary: 20000000,
  },
  {
    key: 'QA_TP',
    departmentKey: 'QA',
    name: 'Trưởng phòng Kiểm thử Chất lượng',
    level: 4,
    minSalary: 24000000,
    maxSalary: 34000000,
  },
  {
    key: 'QA_AUTO',
    departmentKey: 'QA',
    name: 'Chuyên viên Kiểm thử Tự động',
    level: 2,
    minSalary: 16000000,
    maxSalary: 25000000,
  },
  {
    key: 'HT_TP',
    departmentKey: 'HTVH',
    name: 'Trưởng phòng Hạ tầng – Vận hành Hệ thống',
    level: 4,
    minSalary: 28000000,
    maxSalary: 40000000,
  },
  {
    key: 'HT_CV',
    departmentKey: 'HTVH',
    name: 'Chuyên viên Vận hành Hệ thống',
    level: 2,
    minSalary: 18000000,
    maxSalary: 28000000,
  },
  {
    key: 'VH_TP',
    departmentKey: 'VH',
    name: 'Trưởng phòng Vận hành',
    level: 4,
    minSalary: 24000000,
    maxSalary: 34000000,
  },
  {
    key: 'VH_CSKH',
    departmentKey: 'VH',
    name: 'Nhân viên Chăm sóc Khách hàng',
    level: 1,
    minSalary: 7500000,
    maxSalary: 11000000,
  },
  {
    key: 'PL_TP',
    departmentKey: 'HCPL',
    name: 'Trưởng phòng Hành chính – Pháp chế',
    level: 4,
    minSalary: 24000000,
    maxSalary: 34000000,
  },
  {
    key: 'PL_CV',
    departmentKey: 'HCPL',
    name: 'Chuyên viên Pháp chế',
    level: 2,
    minSalary: 18000000,
    maxSalary: 26000000,
  },
];

// ------------------------------------------------------------ employees ----

interface DemoTermination {
  date: string;
  type: TerminationType;
  reason: string;
}

interface DemoEmployeeRow {
  key: string;
  lastName: string;
  firstName: string;
  gender: Gender;
  dateOfBirth: string;
  maritalStatus: MaritalStatus;
  locationKey: string;
  departmentKey: string;
  positionKey: string;
  /** `null` only for the CEO. */
  managerKey: string | null;
  hireDate: string;
  /** Defaults to ACTIVE. */
  status?: EmployeeStatus;
  educationLevel?: EducationLevel;
  major?: string;
  university?: string;
  graduationYear?: number;
  religion?: string;
  notes?: string;
  termination?: DemoTermination;
}

const EMPLOYEES: DemoEmployeeRow[] = [
  // ---- Ban Giám đốc ----
  {
    key: 'e01',
    lastName: 'Nguyễn',
    firstName: 'Đức Thắng',
    gender: Gender.MALE,
    dateOfBirth: '1974-05-18',
    maritalStatus: MaritalStatus.MARRIED,
    locationKey: 'HN1',
    departmentKey: 'BGD',
    positionKey: 'BGD_TGD',
    managerKey: null,
    hireDate: '2015-03-02',
    educationLevel: EducationLevel.MASTER,
    major: 'Quản trị Kinh doanh',
    university: 'Đại học Kinh tế Quốc dân',
    graduationYear: 2004,
  },
  {
    key: 'e02',
    lastName: 'Phạm',
    firstName: 'Thị Thu Hà',
    gender: Gender.FEMALE,
    dateOfBirth: '1993-08-22',
    maritalStatus: MaritalStatus.SINGLE,
    locationKey: 'HN2',
    departmentKey: 'BGD',
    positionKey: 'BGD_TL',
    managerKey: 'e01',
    hireDate: '2019-06-03',
    educationLevel: EducationLevel.UNIVERSITY,
    major: 'Ngôn ngữ Anh',
    university: 'Đại học Hà Nội',
    graduationYear: 2015,
  },

  // ---- Phòng Nhân sự ----
  {
    key: 'e03',
    lastName: 'Trần',
    firstName: 'Thị Minh Nguyệt',
    gender: Gender.FEMALE,
    dateOfBirth: '1985-02-11',
    maritalStatus: MaritalStatus.MARRIED,
    locationKey: 'HN3',
    departmentKey: 'NS',
    positionKey: 'NS_TP',
    managerKey: 'e01',
    hireDate: '2016-08-01',
    educationLevel: EducationLevel.MASTER,
    major: 'Quản trị Nhân lực',
    university: 'Đại học Kinh tế Quốc dân',
    graduationYear: 2012,
  },
  {
    key: 'e04',
    lastName: 'Lê',
    firstName: 'Thị Ngọc Ánh',
    gender: Gender.FEMALE,
    dateOfBirth: '1994-11-05',
    maritalStatus: MaritalStatus.MARRIED,
    locationKey: 'HY1',
    departmentKey: 'NS',
    positionKey: 'NS_TD',
    managerKey: 'e03',
    hireDate: '2020-02-10',
    educationLevel: EducationLevel.UNIVERSITY,
    major: 'Quản trị Nhân lực',
    university: 'Đại học Lao động – Xã hội',
    graduationYear: 2016,
    religion: 'Công giáo',
  },
  {
    key: 'e05',
    lastName: 'Đỗ',
    firstName: 'Văn Hải',
    gender: Gender.MALE,
    dateOfBirth: '1996-04-27',
    maritalStatus: MaritalStatus.SINGLE,
    locationKey: 'TH1',
    departmentKey: 'NS',
    positionKey: 'NS_TD',
    managerKey: 'e03',
    hireDate: '2022-05-16',
    educationLevel: EducationLevel.UNIVERSITY,
    major: 'Tâm lý học',
    university: 'Đại học Khoa học Xã hội và Nhân văn',
    graduationYear: 2018,
  },
  {
    key: 'e06',
    lastName: 'Vũ',
    firstName: 'Thị Kim Chi',
    gender: Gender.FEMALE,
    dateOfBirth: '1990-09-14',
    maritalStatus: MaritalStatus.MARRIED,
    locationKey: 'HP1',
    departmentKey: 'NS',
    positionKey: 'NS_CB',
    managerKey: 'e03',
    hireDate: '2018-01-08',
    status: EmployeeStatus.ON_LEAVE,
    educationLevel: EducationLevel.UNIVERSITY,
    major: 'Kế toán',
    university: 'Đại học Thương mại',
    graduationYear: 2012,
    notes:
      'Nghỉ chế độ thai sản 6 tháng từ 01/06/2026 đến 30/11/2026. Công việc tiền lương do chị Ngô Thị Phương Linh đảm nhiệm trong thời gian nghỉ.',
  },
  {
    key: 'e07',
    lastName: 'Ngô',
    firstName: 'Thị Phương Linh',
    gender: Gender.FEMALE,
    dateOfBirth: '1997-12-03',
    maritalStatus: MaritalStatus.SINGLE,
    locationKey: 'NB1',
    departmentKey: 'NS',
    positionKey: 'NS_CB',
    managerKey: 'e03',
    hireDate: '2023-03-06',
    educationLevel: EducationLevel.UNIVERSITY,
    major: 'Quản trị Nhân lực',
    university: 'Học viện Hành chính Quốc gia',
    graduationYear: 2019,
  },

  // ---- Phòng Tài chính – Kế toán ----
  {
    key: 'e08',
    lastName: 'Bùi',
    firstName: 'Quang Vinh',
    gender: Gender.MALE,
    dateOfBirth: '1982-07-09',
    maritalStatus: MaritalStatus.MARRIED,
    locationKey: 'HN4',
    departmentKey: 'TCKT',
    positionKey: 'KT_TRUONG',
    managerKey: 'e01',
    hireDate: '2016-04-04',
    educationLevel: EducationLevel.MASTER,
    major: 'Tài chính – Ngân hàng',
    university: 'Học viện Tài chính',
    graduationYear: 2010,
  },
  {
    key: 'e09',
    lastName: 'Hoàng',
    firstName: 'Thị Thanh Tâm',
    gender: Gender.FEMALE,
    dateOfBirth: '1989-03-25',
    maritalStatus: MaritalStatus.MARRIED,
    locationKey: 'BN1',
    departmentKey: 'TCKT',
    positionKey: 'KT_TH',
    managerKey: 'e08',
    hireDate: '2017-09-11',
    educationLevel: EducationLevel.UNIVERSITY,
    major: 'Kế toán',
    university: 'Học viện Tài chính',
    graduationYear: 2011,
  },
  {
    key: 'e10',
    lastName: 'Đặng',
    firstName: 'Thị Hồng Nhung',
    gender: Gender.FEMALE,
    dateOfBirth: '1992-06-18',
    maritalStatus: MaritalStatus.MARRIED,
    locationKey: 'PT1',
    departmentKey: 'TCKT',
    positionKey: 'KT_TH',
    managerKey: 'e08',
    hireDate: '2019-11-04',
    educationLevel: EducationLevel.UNIVERSITY,
    major: 'Kế toán',
    university: 'Đại học Thương mại',
    graduationYear: 2014,
  },
  {
    key: 'e11',
    lastName: 'Nguyễn',
    firstName: 'Thị Lan Hương',
    gender: Gender.FEMALE,
    dateOfBirth: '1999-01-30',
    maritalStatus: MaritalStatus.SINGLE,
    locationKey: 'NB1',
    departmentKey: 'TCKT',
    positionKey: 'KT_VIEN',
    managerKey: 'e08',
    hireDate: '2022-08-15',
    educationLevel: EducationLevel.UNIVERSITY,
    major: 'Kế toán',
    university: 'Đại học Kinh tế Quốc dân',
    graduationYear: 2021,
  },
  {
    key: 'e12',
    lastName: 'Trịnh',
    firstName: 'Văn Đạt',
    gender: Gender.MALE,
    dateOfBirth: '2001-05-12',
    maritalStatus: MaritalStatus.SINGLE,
    locationKey: 'TN1',
    departmentKey: 'TCKT',
    positionKey: 'KT_VIEN',
    managerKey: 'e08',
    hireDate: '2026-07-06',
    status: EmployeeStatus.PROBATION,
    educationLevel: EducationLevel.COLLEGE,
    major: 'Kế toán',
    university: 'Trường Cao đẳng Kinh tế – Kỹ thuật Thái Nguyên',
    graduationYear: 2022,
    notes:
      'Đang thử việc 2 tháng. Cần hoàn thiện chứng chỉ kế toán trưởng trước khi xét ký hợp đồng chính thức.',
  },

  // ---- Khối Kinh doanh ----
  {
    key: 'e13',
    lastName: 'Lý',
    firstName: 'Hoàng Sơn',
    gender: Gender.MALE,
    dateOfBirth: '1980-10-02',
    maritalStatus: MaritalStatus.MARRIED,
    locationKey: 'HN1',
    departmentKey: 'KKD',
    positionKey: 'KD_GD',
    managerKey: 'e01',
    hireDate: '2016-01-04',
    educationLevel: EducationLevel.UNIVERSITY,
    major: 'Quản trị Kinh doanh',
    university: 'Đại học Ngoại thương',
    graduationYear: 2003,
    notes:
      'Kiêm nhiệm phụ trách kênh đối tác chiến lược khu vực Đông Nam Bộ từ quý II/2025.',
  },

  // ---- Phòng Kinh doanh Miền Bắc ----
  {
    key: 'e14',
    lastName: 'Phan',
    firstName: 'Minh Tuấn',
    gender: Gender.MALE,
    dateOfBirth: '1986-12-19',
    maritalStatus: MaritalStatus.MARRIED,
    locationKey: 'HN5',
    departmentKey: 'KDMB',
    positionKey: 'MB_TP',
    managerKey: 'e13',
    hireDate: '2016-06-01',
    educationLevel: EducationLevel.UNIVERSITY,
    major: 'Marketing',
    university: 'Đại học Thương mại',
    graduationYear: 2008,
  },
  {
    key: 'e15',
    lastName: 'Dương',
    firstName: 'Thị Thuý Hằng',
    gender: Gender.FEMALE,
    dateOfBirth: '1991-03-08',
    maritalStatus: MaritalStatus.MARRIED,
    locationKey: 'HP1',
    departmentKey: 'KDMB',
    positionKey: 'MB_TN',
    managerKey: 'e14',
    hireDate: '2018-03-05',
    educationLevel: EducationLevel.UNIVERSITY,
    major: 'Quản trị Kinh doanh',
    university: 'Đại học Hải Phòng',
    graduationYear: 2013,
  },
  {
    key: 'e16',
    lastName: 'Cao',
    firstName: 'Văn Trường',
    gender: Gender.MALE,
    dateOfBirth: '1990-07-21',
    maritalStatus: MaritalStatus.MARRIED,
    locationKey: 'QN1',
    departmentKey: 'KDMB',
    positionKey: 'MB_TN',
    managerKey: 'e14',
    hireDate: '2018-10-01',
    educationLevel: EducationLevel.UNIVERSITY,
    major: 'Kinh tế',
    university: 'Đại học Kinh tế Quốc dân',
    graduationYear: 2012,
  },
  {
    key: 'e17',
    lastName: 'Nguyễn',
    firstName: 'Văn Khoa',
    gender: Gender.MALE,
    dateOfBirth: '1995-09-16',
    maritalStatus: MaritalStatus.SINGLE,
    locationKey: 'BN1',
    departmentKey: 'KDMB',
    positionKey: 'MB_NV',
    managerKey: 'e15',
    hireDate: '2021-04-12',
    educationLevel: EducationLevel.UNIVERSITY,
    major: 'Quản trị Kinh doanh',
    university: 'Đại học Công nghiệp Hà Nội',
    graduationYear: 2017,
  },
  {
    key: 'e18',
    lastName: 'Trần',
    firstName: 'Thị Bích Ngọc',
    gender: Gender.FEMALE,
    dateOfBirth: '1997-02-24',
    maritalStatus: MaritalStatus.SINGLE,
    locationKey: 'HY1',
    departmentKey: 'KDMB',
    positionKey: 'MB_NV',
    managerKey: 'e15',
    hireDate: '2022-01-10',
    educationLevel: EducationLevel.UNIVERSITY,
    major: 'Marketing',
    university: 'Đại học Thương mại',
    graduationYear: 2019,
  },
  {
    key: 'e19',
    lastName: 'Lê',
    firstName: 'Quốc Cường',
    gender: Gender.MALE,
    dateOfBirth: '1998-08-07',
    maritalStatus: MaritalStatus.SINGLE,
    locationKey: 'TH1',
    departmentKey: 'KDMB',
    positionKey: 'MB_NV',
    managerKey: 'e15',
    hireDate: '2023-07-03',
    educationLevel: EducationLevel.COLLEGE,
    major: 'Quản trị Kinh doanh',
    university: 'Trường Cao đẳng Công thương Việt Nam',
    graduationYear: 2020,
  },
  {
    key: 'e20',
    lastName: 'Mai',
    firstName: 'Thị Hồng Vân',
    gender: Gender.FEMALE,
    dateOfBirth: '1996-05-29',
    maritalStatus: MaritalStatus.MARRIED,
    locationKey: 'NB1',
    departmentKey: 'KDMB',
    positionKey: 'MB_NV',
    managerKey: 'e16',
    hireDate: '2021-09-06',
    educationLevel: EducationLevel.UNIVERSITY,
    major: 'Kinh doanh Quốc tế',
    university: 'Đại học Ngoại thương',
    graduationYear: 2018,
  },
  {
    key: 'e21',
    lastName: 'Hồ',
    firstName: 'Văn Nam',
    gender: Gender.MALE,
    dateOfBirth: '1994-10-11',
    maritalStatus: MaritalStatus.MARRIED,
    locationKey: 'NA1',
    departmentKey: 'KDMB',
    positionKey: 'MB_NV',
    managerKey: 'e16',
    hireDate: '2020-07-13',
    status: EmployeeStatus.RESIGNED,
    educationLevel: EducationLevel.UNIVERSITY,
    major: 'Quản trị Kinh doanh',
    university: 'Đại học Vinh',
    graduationYear: 2016,
    termination: {
      date: '2026-02-27',
      type: TerminationType.RESIGNED,
      reason:
        'Nghỉ việc theo nguyện vọng cá nhân để chuyển công tác về Nghệ An. Đã báo trước 30 ngày và hoàn tất bàn giao danh sách khách hàng ngày 26/02/2026.',
    },
  },

  // ---- Phòng Kinh doanh Miền Nam ----
  {
    key: 'e22',
    lastName: 'Võ',
    firstName: 'Thành Trung',
    gender: Gender.MALE,
    dateOfBirth: '1984-04-15',
    maritalStatus: MaritalStatus.MARRIED,
    locationKey: 'HCM1',
    departmentKey: 'KDMN',
    positionKey: 'MN_TP',
    managerKey: 'e13',
    hireDate: '2017-02-06',
    educationLevel: EducationLevel.UNIVERSITY,
    major: 'Quản trị Kinh doanh',
    university: 'Đại học Kinh tế TP. Hồ Chí Minh',
    graduationYear: 2006,
  },
  {
    key: 'e23',
    lastName: 'Huỳnh',
    firstName: 'Thị Mỹ Duyên',
    gender: Gender.FEMALE,
    dateOfBirth: '1993-11-27',
    maritalStatus: MaritalStatus.MARRIED,
    locationKey: 'HCM2',
    departmentKey: 'KDMN',
    positionKey: 'MN_NV',
    managerKey: 'e22',
    hireDate: '2019-05-06',
    educationLevel: EducationLevel.UNIVERSITY,
    major: 'Marketing',
    university: 'Đại học Tài chính – Marketing',
    graduationYear: 2015,
    religion: 'Công giáo',
  },
  {
    key: 'e24',
    lastName: 'Nguyễn',
    firstName: 'Tấn Phát',
    gender: Gender.MALE,
    dateOfBirth: '1996-06-09',
    maritalStatus: MaritalStatus.SINGLE,
    locationKey: 'DN1',
    departmentKey: 'KDMN',
    positionKey: 'MN_NV',
    managerKey: 'e22',
    hireDate: '2021-11-01',
    educationLevel: EducationLevel.UNIVERSITY,
    major: 'Quản trị Kinh doanh',
    university: 'Đại học Lạc Hồng',
    graduationYear: 2018,
  },
  {
    key: 'e25',
    lastName: 'Trần',
    firstName: 'Thị Kim Ngân',
    gender: Gender.FEMALE,
    dateOfBirth: '1998-03-14',
    maritalStatus: MaritalStatus.SINGLE,
    locationKey: 'CT1',
    departmentKey: 'KDMN',
    positionKey: 'MN_NV',
    managerKey: 'e22',
    hireDate: '2022-06-13',
    educationLevel: EducationLevel.UNIVERSITY,
    major: 'Kinh doanh Quốc tế',
    university: 'Đại học Cần Thơ',
    graduationYear: 2020,
  },
  {
    key: 'e26',
    lastName: 'Lê',
    firstName: 'Minh Hoàng',
    gender: Gender.MALE,
    dateOfBirth: '1999-07-22',
    maritalStatus: MaritalStatus.SINGLE,
    locationKey: 'VL1',
    departmentKey: 'KDMN',
    positionKey: 'MN_NV',
    managerKey: 'e22',
    hireDate: '2025-03-04',
    // Học vấn cố tình để trống: hồ sơ chưa bổ sung bằng cấp.
  },
  {
    key: 'e27',
    lastName: 'Phạm',
    firstName: 'Thị Ánh Tuyết',
    gender: Gender.FEMALE,
    dateOfBirth: '2000-12-05',
    maritalStatus: MaritalStatus.SINGLE,
    locationKey: 'AG1',
    departmentKey: 'KDMN',
    positionKey: 'MN_NV',
    managerKey: 'e22',
    hireDate: '2026-07-01',
    status: EmployeeStatus.PROBATION,
    educationLevel: EducationLevel.UNIVERSITY,
    major: 'Marketing',
    university: 'Đại học An Giang',
    graduationYear: 2022,
  },

  // ---- Phòng Marketing ----
  {
    key: 'e28',
    lastName: 'Đinh',
    firstName: 'Thị Hải Yến',
    gender: Gender.FEMALE,
    dateOfBirth: '1988-01-23',
    maritalStatus: MaritalStatus.MARRIED,
    locationKey: 'HN2',
    departmentKey: 'MKT',
    positionKey: 'MKT_TP',
    managerKey: 'e01',
    hireDate: '2017-05-08',
    educationLevel: EducationLevel.MASTER,
    major: 'Marketing',
    university: 'Đại học Kinh tế Quốc dân',
    graduationYear: 2014,
  },
  {
    key: 'e29',
    lastName: 'Nguyễn',
    firstName: 'Hoàng Long',
    gender: Gender.MALE,
    dateOfBirth: '1994-09-04',
    maritalStatus: MaritalStatus.SINGLE,
    locationKey: 'HN3',
    departmentKey: 'MKT',
    positionKey: 'MKT_DIGITAL',
    managerKey: 'e28',
    hireDate: '2019-08-19',
    educationLevel: EducationLevel.UNIVERSITY,
    major: 'Marketing',
    university: 'Đại học Thương mại',
    graduationYear: 2016,
  },
  {
    key: 'e30',
    lastName: 'Trần',
    firstName: 'Thanh Tùng',
    gender: Gender.MALE,
    dateOfBirth: '1996-02-17',
    maritalStatus: MaritalStatus.SINGLE,
    locationKey: 'PT1',
    departmentKey: 'MKT',
    positionKey: 'MKT_DIGITAL',
    managerKey: 'e28',
    hireDate: '2021-06-07',
    educationLevel: EducationLevel.UNIVERSITY,
    major: 'Truyền thông Đa phương tiện',
    university: 'Học viện Báo chí và Tuyên truyền',
    graduationYear: 2018,
  },
  {
    key: 'e31',
    lastName: 'Lương',
    firstName: 'Thị Diễm Quỳnh',
    gender: Gender.FEMALE,
    dateOfBirth: '1997-10-30',
    maritalStatus: MaritalStatus.SINGLE,
    locationKey: 'HN4',
    departmentKey: 'MKT',
    positionKey: 'MKT_DIGITAL',
    managerKey: 'e28',
    hireDate: '2022-09-05',
    educationLevel: EducationLevel.UNIVERSITY,
    major: 'Quan hệ Công chúng',
    university: 'Học viện Báo chí và Tuyên truyền',
    graduationYear: 2019,
  },
  {
    key: 'e32',
    lastName: 'Tạ',
    firstName: 'Văn Hùng',
    gender: Gender.MALE,
    dateOfBirth: '1999-05-08',
    maritalStatus: MaritalStatus.SINGLE,
    locationKey: 'TN1',
    departmentKey: 'MKT',
    positionKey: 'MKT_DIGITAL',
    managerKey: 'e28',
    hireDate: '2023-11-06',
    educationLevel: EducationLevel.UNIVERSITY,
    major: 'Thiết kế Đồ hoạ',
    university: 'Đại học Mỹ thuật Công nghiệp',
    graduationYear: 2021,
  },

  // ---- Khối Công nghệ ----
  {
    key: 'e33',
    lastName: 'Nguyễn',
    firstName: 'Hữu Phước',
    gender: Gender.MALE,
    dateOfBirth: '1981-06-26',
    maritalStatus: MaritalStatus.MARRIED,
    locationKey: 'HN2',
    departmentKey: 'KCN',
    positionKey: 'CN_GD',
    managerKey: 'e01',
    hireDate: '2016-02-15',
    educationLevel: EducationLevel.MASTER,
    major: 'Khoa học Máy tính',
    university: 'Đại học Bách khoa Hà Nội',
    graduationYear: 2007,
  },
  {
    key: 'e34',
    lastName: 'Đỗ',
    firstName: 'Minh Quân',
    gender: Gender.MALE,
    dateOfBirth: '1987-11-13',
    maritalStatus: MaritalStatus.MARRIED,
    locationKey: 'HN5',
    departmentKey: 'KCN',
    positionKey: 'CN_KTS',
    managerKey: 'e33',
    hireDate: '2018-04-02',
    educationLevel: EducationLevel.UNIVERSITY,
    major: 'Công nghệ Thông tin',
    university: 'Đại học Bách khoa Hà Nội',
    graduationYear: 2010,
    notes:
      'Chịu trách nhiệm kiến trúc tổng thể cho toàn bộ sản phẩm nội bộ và chuẩn tích hợp với đối tác.',
  },

  // ---- Phòng Phát triển Sản phẩm ----
  {
    key: 'e35',
    lastName: 'Vũ',
    firstName: 'Đình Khánh',
    gender: Gender.MALE,
    dateOfBirth: '1988-03-19',
    maritalStatus: MaritalStatus.MARRIED,
    locationKey: 'HN3',
    departmentKey: 'PTSP',
    positionKey: 'SP_TP',
    managerKey: 'e33',
    hireDate: '2017-01-09',
    educationLevel: EducationLevel.UNIVERSITY,
    major: 'Công nghệ Thông tin',
    university: 'Đại học Công nghệ – Đại học Quốc gia Hà Nội',
    graduationYear: 2011,
    religion: 'Phật giáo',
  },
  {
    key: 'e36',
    lastName: 'Nguyễn',
    firstName: 'Thành Đạt',
    gender: Gender.MALE,
    dateOfBirth: '1991-08-06',
    maritalStatus: MaritalStatus.MARRIED,
    locationKey: 'HN1',
    departmentKey: 'PTSP',
    positionKey: 'SP_TN',
    managerKey: 'e35',
    hireDate: '2018-07-02',
    educationLevel: EducationLevel.UNIVERSITY,
    major: 'Khoa học Máy tính',
    university: 'Đại học Bách khoa Hà Nội',
    graduationYear: 2014,
  },
  {
    key: 'e37',
    lastName: 'Trần',
    firstName: 'Văn Kiên',
    gender: Gender.MALE,
    dateOfBirth: '1992-01-28',
    maritalStatus: MaritalStatus.MARRIED,
    locationKey: 'HP1',
    departmentKey: 'PTSP',
    positionKey: 'SP_TN',
    managerKey: 'e35',
    hireDate: '2019-02-11',
    educationLevel: EducationLevel.UNIVERSITY,
    major: 'Công nghệ Thông tin',
    university: 'Đại học Hàng hải Việt Nam',
    graduationYear: 2015,
  },
  {
    key: 'e38',
    lastName: 'Phạm',
    firstName: 'Quang Huy',
    gender: Gender.MALE,
    dateOfBirth: '1993-05-21',
    maritalStatus: MaritalStatus.MARRIED,
    locationKey: 'HN4',
    departmentKey: 'PTSP',
    positionKey: 'SP_SENIOR',
    managerKey: 'e36',
    hireDate: '2019-09-16',
    educationLevel: EducationLevel.UNIVERSITY,
    major: 'Công nghệ Thông tin',
    university: 'Đại học Bách khoa Hà Nội',
    graduationYear: 2016,
  },
  {
    key: 'e39',
    lastName: 'Lê',
    firstName: 'Thị Thu Trang',
    gender: Gender.FEMALE,
    dateOfBirth: '1995-07-12',
    maritalStatus: MaritalStatus.SINGLE,
    locationKey: 'BN1',
    departmentKey: 'PTSP',
    positionKey: 'SP_SENIOR',
    managerKey: 'e36',
    hireDate: '2020-05-11',
    educationLevel: EducationLevel.UNIVERSITY,
    major: 'Kỹ thuật Máy tính',
    university: 'Đại học Công nghệ – Đại học Quốc gia Hà Nội',
    graduationYear: 2017,
  },
  {
    key: 'e40',
    lastName: 'Hoàng',
    firstName: 'Văn Tú',
    gender: Gender.MALE,
    dateOfBirth: '1994-12-02',
    maritalStatus: MaritalStatus.MARRIED,
    locationKey: 'PT1',
    departmentKey: 'PTSP',
    positionKey: 'SP_SENIOR',
    managerKey: 'e37',
    hireDate: '2020-10-05',
    educationLevel: EducationLevel.UNIVERSITY,
    major: 'Công nghệ Thông tin',
    university: 'Đại học Công nghiệp Hà Nội',
    graduationYear: 2016,
  },
  {
    key: 'e41',
    lastName: 'Nguyễn',
    firstName: 'Bá Lộc',
    gender: Gender.MALE,
    dateOfBirth: '1998-04-18',
    maritalStatus: MaritalStatus.SINGLE,
    locationKey: 'HN5',
    departmentKey: 'PTSP',
    positionKey: 'SP_DEV',
    managerKey: 'e36',
    hireDate: '2022-03-07',
    educationLevel: EducationLevel.UNIVERSITY,
    major: 'Công nghệ Thông tin',
    university: 'Đại học Công nghệ – Đại học Quốc gia Hà Nội',
    graduationYear: 2020,
  },
  {
    key: 'e42',
    lastName: 'Đặng',
    firstName: 'Minh Khoa',
    gender: Gender.MALE,
    dateOfBirth: '1999-11-09',
    maritalStatus: MaritalStatus.SINGLE,
    locationKey: 'TH1',
    departmentKey: 'PTSP',
    positionKey: 'SP_DEV',
    managerKey: 'e36',
    hireDate: '2023-02-06',
    educationLevel: EducationLevel.UNIVERSITY,
    major: 'Khoa học Máy tính',
    university: 'Đại học Bách khoa Hà Nội',
    graduationYear: 2021,
  },
  {
    key: 'e43',
    lastName: 'Trịnh',
    firstName: 'Thị Mai Anh',
    gender: Gender.FEMALE,
    dateOfBirth: '2000-08-25',
    maritalStatus: MaritalStatus.SINGLE,
    locationKey: 'HN2',
    departmentKey: 'PTSP',
    positionKey: 'SP_DEV',
    managerKey: 'e37',
    hireDate: '2023-08-14',
    educationLevel: EducationLevel.UNIVERSITY,
    major: 'Công nghệ Thông tin',
    university: 'Đại học Công nghệ – Đại học Quốc gia Hà Nội',
    graduationYear: 2022,
  },
  {
    key: 'e44',
    lastName: 'Phùng',
    firstName: 'Văn Sang',
    gender: Gender.MALE,
    dateOfBirth: '2001-03-03',
    maritalStatus: MaritalStatus.SINGLE,
    locationKey: 'HY1',
    departmentKey: 'PTSP',
    positionKey: 'SP_DEV',
    managerKey: 'e37',
    hireDate: '2026-08-03',
    status: EmployeeStatus.PROBATION,
    educationLevel: EducationLevel.UNIVERSITY,
    major: 'Công nghệ Thông tin',
    university: 'Đại học Điện lực',
    graduationYear: 2023,
    notes:
      'Thực tập sinh chuyển tiếp lên thử việc từ 03/08/2026, làm việc trong nhóm của anh Trần Văn Kiên.',
  },

  // ---- Phòng Kiểm thử Chất lượng ----
  {
    key: 'e45',
    lastName: 'Nguyễn',
    firstName: 'Thị Thanh Huyền',
    gender: Gender.FEMALE,
    dateOfBirth: '1989-09-27',
    maritalStatus: MaritalStatus.MARRIED,
    locationKey: 'HN3',
    departmentKey: 'QA',
    positionKey: 'QA_TP',
    managerKey: 'e33',
    hireDate: '2017-11-13',
    educationLevel: EducationLevel.UNIVERSITY,
    major: 'Công nghệ Thông tin',
    university: 'Đại học Công nghệ – Đại học Quốc gia Hà Nội',
    graduationYear: 2012,
  },
  {
    key: 'e46',
    lastName: 'Lê',
    firstName: 'Văn Thái',
    gender: Gender.MALE,
    dateOfBirth: '1993-02-08',
    maritalStatus: MaritalStatus.MARRIED,
    locationKey: 'NB1',
    departmentKey: 'QA',
    positionKey: 'QA_AUTO',
    managerKey: 'e45',
    hireDate: '2019-12-02',
    educationLevel: EducationLevel.UNIVERSITY,
    major: 'Công nghệ Thông tin',
    university: 'Đại học Công nghiệp Hà Nội',
    graduationYear: 2015,
  },
  {
    key: 'e47',
    lastName: 'Phạm',
    firstName: 'Thị Ngọc Diệp',
    gender: Gender.FEMALE,
    dateOfBirth: '1996-06-15',
    maritalStatus: MaritalStatus.SINGLE,
    locationKey: 'HN1',
    departmentKey: 'QA',
    positionKey: 'QA_AUTO',
    managerKey: 'e45',
    hireDate: '2021-07-05',
    educationLevel: EducationLevel.UNIVERSITY,
    major: 'Hệ thống Thông tin',
    university: 'Đại học Công nghệ – Đại học Quốc gia Hà Nội',
    graduationYear: 2018,
    notes:
      'Đại diện phòng Kiểm thử trong nhóm cải tiến quy trình phát hành và tích hợp liên tục.',
  },
  {
    key: 'e48',
    lastName: 'Bùi',
    firstName: 'Văn Định',
    gender: Gender.MALE,
    dateOfBirth: '1997-10-19',
    maritalStatus: MaritalStatus.SINGLE,
    locationKey: 'TN1',
    departmentKey: 'QA',
    positionKey: 'QA_AUTO',
    managerKey: 'e45',
    hireDate: '2022-11-14',
    educationLevel: EducationLevel.UNIVERSITY,
    major: 'Công nghệ Thông tin',
    university:
      'Đại học Công nghệ Thông tin và Truyền thông – Đại học Thái Nguyên',
    graduationYear: 2019,
  },

  // ---- Phòng Hạ tầng – Vận hành Hệ thống ----
  {
    key: 'e49',
    lastName: 'Trần',
    firstName: 'Quốc Bảo',
    gender: Gender.MALE,
    dateOfBirth: '1987-05-30',
    maritalStatus: MaritalStatus.MARRIED,
    locationKey: 'HN4',
    departmentKey: 'HTVH',
    positionKey: 'HT_TP',
    managerKey: 'e33',
    hireDate: '2017-03-13',
    educationLevel: EducationLevel.UNIVERSITY,
    major: 'Điện tử – Viễn thông',
    university: 'Đại học Bách khoa Hà Nội',
    graduationYear: 2010,
  },
  {
    key: 'e50',
    lastName: 'Nguyễn',
    firstName: 'Văn Chiến',
    gender: Gender.MALE,
    dateOfBirth: '1992-12-11',
    maritalStatus: MaritalStatus.MARRIED,
    locationKey: 'BN1',
    departmentKey: 'HTVH',
    positionKey: 'HT_CV',
    managerKey: 'e49',
    hireDate: '2019-04-08',
    educationLevel: EducationLevel.UNIVERSITY,
    major: 'Công nghệ Thông tin',
    university: 'Đại học Công nghiệp Hà Nội',
    graduationYear: 2014,
  },
  {
    key: 'e51',
    lastName: 'Lê',
    firstName: 'Đức Anh',
    gender: Gender.MALE,
    dateOfBirth: '1995-03-06',
    maritalStatus: MaritalStatus.SINGLE,
    locationKey: 'HN5',
    departmentKey: 'HTVH',
    positionKey: 'HT_CV',
    managerKey: 'e49',
    hireDate: '2021-02-01',
    educationLevel: EducationLevel.UNIVERSITY,
    major: 'An toàn Thông tin',
    university: 'Học viện Kỹ thuật Mật mã',
    graduationYear: 2017,
  },
  {
    key: 'e52',
    lastName: 'Hoàng',
    firstName: 'Minh Đức',
    gender: Gender.MALE,
    dateOfBirth: '1998-07-24',
    maritalStatus: MaritalStatus.SINGLE,
    locationKey: 'QN1',
    departmentKey: 'HTVH',
    positionKey: 'HT_CV',
    managerKey: 'e49',
    hireDate: '2025-05-12',
    educationLevel: EducationLevel.COLLEGE,
    major: 'Công nghệ Thông tin',
    university: 'Trường Cao đẳng Công nghiệp và Xây dựng',
    graduationYear: 2020,
  },

  // ---- Phòng Vận hành ----
  {
    key: 'e53',
    lastName: 'Nguyễn',
    firstName: 'Thị Hồng Nhung',
    gender: Gender.FEMALE,
    dateOfBirth: '1986-08-13',
    maritalStatus: MaritalStatus.MARRIED,
    locationKey: 'HN1',
    departmentKey: 'VH',
    positionKey: 'VH_TP',
    managerKey: 'e01',
    hireDate: '2016-10-03',
    educationLevel: EducationLevel.UNIVERSITY,
    major: 'Quản trị Kinh doanh',
    university: 'Đại học Kinh tế Quốc dân',
    graduationYear: 2009,
  },
  {
    key: 'e54',
    lastName: 'Đào',
    firstName: 'Thị Thuỳ Dương',
    gender: Gender.FEMALE,
    dateOfBirth: '1995-01-19',
    maritalStatus: MaritalStatus.MARRIED,
    locationKey: 'HN3',
    departmentKey: 'VH',
    positionKey: 'VH_CSKH',
    managerKey: 'e53',
    hireDate: '2020-01-13',
    educationLevel: EducationLevel.COLLEGE,
    major: 'Quản trị Kinh doanh',
    university: 'Trường Cao đẳng Thương mại và Du lịch Hà Nội',
    graduationYear: 2016,
    religion: 'Phật giáo',
  },
  {
    key: 'e55',
    lastName: 'Vũ',
    firstName: 'Thị Ngọc Hân',
    gender: Gender.FEMALE,
    dateOfBirth: '1997-05-26',
    maritalStatus: MaritalStatus.SINGLE,
    locationKey: 'HY1',
    departmentKey: 'VH',
    positionKey: 'VH_CSKH',
    managerKey: 'e53',
    hireDate: '2021-10-04',
    educationLevel: EducationLevel.UNIVERSITY,
    major: 'Ngôn ngữ Anh',
    university: 'Đại học Hà Nội',
    graduationYear: 2019,
  },
  {
    key: 'e56',
    lastName: 'Nguyễn',
    firstName: 'Thị Mỹ Lệ',
    gender: Gender.FEMALE,
    dateOfBirth: '1999-09-02',
    maritalStatus: MaritalStatus.SINGLE,
    locationKey: 'TH1',
    departmentKey: 'VH',
    positionKey: 'VH_CSKH',
    managerKey: 'e53',
    hireDate: '2023-04-10',
    educationLevel: EducationLevel.HIGH_SCHOOL,
    notes:
      'Đang học liên thông ngành Quản trị Kinh doanh, hệ vừa làm vừa học, dự kiến tốt nghiệp năm 2027.',
  },
  {
    key: 'e57',
    lastName: 'Trần',
    firstName: 'Văn Lâm',
    gender: Gender.MALE,
    dateOfBirth: '2000-04-07',
    maritalStatus: MaritalStatus.SINGLE,
    locationKey: 'NB1',
    departmentKey: 'VH',
    positionKey: 'VH_CSKH',
    managerKey: 'e53',
    hireDate: '2024-08-05',
    status: EmployeeStatus.TERMINATED,
    educationLevel: EducationLevel.COLLEGE,
    major: 'Marketing',
    university: 'Trường Cao đẳng Kinh tế Công nghiệp Hà Nội',
    graduationYear: 2022,
    termination: {
      date: '2026-05-29',
      type: TerminationType.CONTRACT_ENDED,
      reason:
        'Hợp đồng lao động xác định thời hạn kết thúc ngày 29/05/2026, hai bên thống nhất không gia hạn do thu hẹp nhóm hỗ trợ ngoài giờ.',
    },
  },
  {
    key: 'e58',
    lastName: 'Lê',
    firstName: 'Thị Phương Thảo',
    gender: Gender.FEMALE,
    dateOfBirth: '1996-11-15',
    maritalStatus: MaritalStatus.MARRIED,
    locationKey: 'HN4',
    departmentKey: 'VH',
    positionKey: 'VH_CSKH',
    managerKey: 'e53',
    hireDate: '2020-06-08',
    educationLevel: EducationLevel.UNIVERSITY,
    major: 'Quản trị Kinh doanh',
    university: 'Đại học Mở Hà Nội',
    graduationYear: 2018,
  },

  // ---- Phòng Hành chính – Pháp chế ----
  {
    key: 'e59',
    lastName: 'Nghiêm',
    firstName: 'Xuân Thành',
    gender: Gender.MALE,
    dateOfBirth: '1983-10-21',
    maritalStatus: MaritalStatus.MARRIED,
    locationKey: 'HN2',
    departmentKey: 'HCPL',
    positionKey: 'PL_TP',
    managerKey: 'e01',
    hireDate: '2016-12-05',
    educationLevel: EducationLevel.MASTER,
    major: 'Luật Kinh tế',
    university: 'Đại học Luật Hà Nội',
    graduationYear: 2009,
  },
  {
    key: 'e60',
    lastName: 'Trần',
    firstName: 'Thị Quỳnh Anh',
    gender: Gender.FEMALE,
    dateOfBirth: '1991-04-09',
    maritalStatus: MaritalStatus.MARRIED,
    locationKey: 'HN5',
    departmentKey: 'HCPL',
    positionKey: 'PL_CV',
    managerKey: 'e59',
    hireDate: '2018-09-10',
    educationLevel: EducationLevel.UNIVERSITY,
    major: 'Luật',
    university: 'Đại học Luật Hà Nội',
    graduationYear: 2013,
    religion: 'Phật giáo',
  },
  {
    key: 'e61',
    lastName: 'Nguyễn',
    firstName: 'Văn Hoà',
    gender: Gender.MALE,
    dateOfBirth: '1994-08-16',
    maritalStatus: MaritalStatus.MARRIED,
    locationKey: 'BN1',
    departmentKey: 'HCPL',
    positionKey: 'PL_CV',
    managerKey: 'e59',
    hireDate: '2020-11-09',
    educationLevel: EducationLevel.UNIVERSITY,
    major: 'Luật Kinh tế',
    university: 'Đại học Luật Hà Nội',
    graduationYear: 2016,
  },
  {
    key: 'e62',
    lastName: 'Phạm',
    firstName: 'Thị Vân Anh',
    gender: Gender.FEMALE,
    dateOfBirth: '1998-02-28',
    maritalStatus: MaritalStatus.SINGLE,
    locationKey: 'HN3',
    departmentKey: 'HCPL',
    positionKey: 'PL_CV',
    managerKey: 'e59',
    hireDate: '2022-04-11',
    educationLevel: EducationLevel.UNIVERSITY,
    major: 'Luật',
    university: 'Đại học Luật Hà Nội',
    graduationYear: 2020,
  },
];

/**
 * Deliberate blanks. Every nullable column filled for all 62 people would mean
 * the UI's empty states never show up in the demo, so a handful of records are
 * left genuinely incomplete — the way a real HR database looks.
 *
 * Employees still on probation additionally have no tax code and no insurance
 * numbers: those are registered only once the official contract is signed.
 */
const NO_TAX_CODE = new Set(['e05', 'e24', 'e43', 'e62']);
const NO_INSURANCE = new Set(['e19', 'e56']);
const NO_BANK_ACCOUNT = new Set(['e05', 'e19', 'e26', 'e56']);
const NO_EMERGENCY_CONTACT = new Set(['e11', 'e26', 'e32', 'e48', 'e55']);
const NO_PERSONAL_EMAIL = new Set([
  'e01',
  'e08',
  'e13',
  'e33',
  'e46',
  'e51',
  'e59',
]);

// -------------------------------------------------- derived-value tables ----

const PHONE_PREFIXES = [
  '090',
  '091',
  '093',
  '094',
  '096',
  '097',
  '098',
  '032',
  '033',
  '035',
  '036',
  '037',
  '038',
  '039',
  '070',
  '076',
  '077',
  '078',
  '079',
  '081',
  '082',
  '083',
  '084',
  '085',
  '086',
  '088',
  '089',
];

const BANK_NAMES = [
  'Vietcombank',
  'Techcombank',
  'BIDV',
  'VietinBank',
  'MB Bank',
  'ACB',
  'VPBank',
  'TPBank',
  'Agribank',
  'Sacombank',
];

const HEAD_OFFICE_BANK_BRANCHES = [
  'Chi nhánh Hoàn Kiếm, Hà Nội',
  'Chi nhánh Thanh Xuân, Hà Nội',
  'Chi nhánh Cầu Giấy, Hà Nội',
  'Chi nhánh Hà Đông, Hà Nội',
  'Chi nhánh Long Biên, Hà Nội',
];

const BRANCH_OFFICE_BANK_BRANCHES = [
  'Chi nhánh Quận 1, TP. Hồ Chí Minh',
  'Chi nhánh Tân Bình, TP. Hồ Chí Minh',
  'Chi nhánh Phú Nhuận, TP. Hồ Chí Minh',
];

/**
 * Split by gender so the name always agrees with the relationship — a "Vợ"
 * (wife) called Trần Văn Bình would be the first thing a reviewer notices.
 */
const EMERGENCY_CONTACT_NAMES: Record<'female' | 'male', string[]> = {
  female: [
    'Nguyễn Thị Hồng',
    'Lê Thị Thu',
    'Hoàng Thị Loan',
    'Đỗ Thị Hiền',
    'Ngô Thị Xuân',
    'Trịnh Thị Nga',
    'Mai Thị Oanh',
    'Phan Thị Tuyết',
    'Đinh Thị Lệ',
  ],
  male: [
    'Trần Văn Bình',
    'Phạm Văn Dũng',
    'Vũ Văn Thịnh',
    'Bùi Văn Hưng',
    'Đặng Văn Toàn',
    'Dương Văn Lâm',
    'Cao Văn Sinh',
    'Hồ Văn Quyết',
    'Lý Văn Thái',
  ],
};

/** Relationship → the gender of the person on the other end of the phone. */
const EMERGENCY_CONTACT_GENDERS: Record<string, 'female' | 'male'> = {
  Vợ: 'female',
  Mẹ: 'female',
  'Chị gái': 'female',
  Chồng: 'male',
  Bố: 'male',
  'Anh trai': 'male',
};

const CCCD_ISSUE_DATES = [
  '2021-03-18',
  '2021-07-22',
  '2022-01-14',
  '2022-05-09',
  '2023-02-27',
  '2023-09-11',
  '2024-04-16',
  '2024-11-05',
  '2025-03-24',
];

/** All 12-digit CCCD in the demo set are issued centrally (chip-based CCCD). */
const CCCD_ISSUE_PLACE =
  'Cục Cảnh sát quản lý hành chính về trật tự xã hội – Bộ Công an';

/** Statutory probation for university-level jobs: 60 days (Điều 25 BLLĐ 2019). */
const PROBATION_DAYS = 60;

// ------------------------------------------------------------- helpers -----

function removeDiacritics(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);

  return value.toISOString().slice(0, 10);
}

function addYears(date: string, years: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCFullYear(value.getUTCFullYear() + years);

  return value.toISOString().slice(0, 10);
}

/**
 * A CCCD expires on the holder's 25th / 40th / 60th birthday, whichever comes
 * first after the issue date; one issued at 60+ never expires (`null`).
 */
function cccdExpiredDate(
  dateOfBirth: string,
  issueDate: string,
): string | null {
  for (const age of [25, 40, 60]) {
    const milestone = addYears(dateOfBirth, age);

    if (milestone > issueDate) {
      return milestone;
    }
  }

  return null;
}

/**
 * `Nguyễn` + `Đức Thắng` → `thang.nguyenduc` — the given name, then the family
 * name plus any middle names, which is how Vietnamese companies usually build
 * work addresses. `taken` keeps a numeric suffix ready for the rare collision.
 */
function buildEmailLocalPart(
  lastName: string,
  firstName: string,
  taken: Set<string>,
): string {
  const parts = firstName.trim().split(/\s+/);
  const givenName = parts[parts.length - 1];
  const middleNames = parts.slice(0, -1);

  const slug = (value: string): string =>
    removeDiacritics(value)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');

  const base = `${slug(givenName)}.${slug([lastName, ...middleNames].join(''))}`;

  let candidate = base;
  let suffix = 2;

  while (taken.has(candidate)) {
    candidate = `${base}${suffix}`;
    suffix++;
  }

  taken.add(candidate);

  return candidate;
}

/**
 * `001` + gender/century digit + 2-digit birth year + a 6-digit tail, i.e. the
 * real CCCD layout. The tail is `5000xx`, which no seed or test fixture uses
 * (`0011…` phase-1 seed, `0999…` E2E, `0993…` E3E), so these 12 digits cannot
 * collide with anything already in `hrm_dev`.
 */
function buildCccdNumber(row: DemoEmployeeRow, index: number): string {
  const location = LOCATIONS[row.locationKey];
  const birthYear = Number(row.dateOfBirth.slice(0, 4));
  const centuryDigit = birthYear < 2000 ? 0 : 2;
  const genderDigit = centuryDigit + (row.gender === Gender.FEMALE ? 1 : 0);

  return [
    location.provinceCode.padStart(3, '0'),
    String(genderDigit),
    row.dateOfBirth.slice(2, 4),
    String(500000 + index).padStart(6, '0'),
  ].join('');
}

function pick<T>(values: T[], index: number): T {
  return values[index % values.length];
}

// -------------------------------------------------------- build & insert ----

interface BuiltEmployee {
  key: string;
  managerKey: string | null;
  data: Partial<Employee>;
}

function buildEmployees(
  departmentIds: Map<string, number>,
  positionIds: Map<string, number>,
  positionDepartmentKeys: Map<string, string>,
  startNumber: number,
  createdBy: number | null,
): BuiltEmployee[] {
  const emailLocalParts = new Set<string>();

  return EMPLOYEES.map((row, offset) => {
    const index = offset + 1;
    const location = LOCATIONS[row.locationKey];
    const status = row.status ?? EmployeeStatus.ACTIVE;
    const isProbation = status === EmployeeStatus.PROBATION;

    // The API rejects a position from another department with
    // POSITION_DEPARTMENT_MISMATCH — fail here rather than seed data that
    // looks like a bug in the app.
    const positionDepartmentKey = positionDepartmentKeys.get(row.positionKey);
    if (positionDepartmentKey !== row.departmentKey) {
      throw new Error(
        `Employee ${row.key}: position ${row.positionKey} belongs to department ` +
          `${String(positionDepartmentKey)}, not ${row.departmentKey}`,
      );
    }

    const isHeadOffice = row.departmentKey !== 'KDMN';
    const officeLocation = isHeadOffice
      ? LOCATIONS[pick(HEAD_OFFICE_KEYS, index)]
      : LOCATIONS[pick(BRANCH_OFFICE_KEYS, index)];
    const worksWhereTheyLive =
      location.provinceCode === officeLocation.provinceCode;

    const localPart = buildEmailLocalPart(
      row.lastName,
      row.firstName,
      emailLocalParts,
    );
    const cccdIssueDate = pick(CCCD_ISSUE_DATES, index);
    const probationEndDate = addDays(row.hireDate, PROBATION_DAYS);
    const hasInsurance = !isProbation && !NO_INSURANCE.has(row.key);
    const hasBankAccount = !NO_BANK_ACCOUNT.has(row.key);
    const hasEmergencyContact = !NO_EMERGENCY_CONTACT.has(row.key);

    const emergencyRelation =
      row.maritalStatus === MaritalStatus.MARRIED
        ? row.gender === Gender.MALE
          ? 'Vợ'
          : 'Chồng'
        : pick(['Mẹ', 'Bố', 'Anh trai', 'Chị gái'], index);
    const emergencyContactName = pick(
      EMERGENCY_CONTACT_NAMES[EMERGENCY_CONTACT_GENDERS[emergencyRelation]],
      index,
    );

    const data: Partial<Employee> = {
      employeeCode: formatSequentialCode(
        EMPLOYEE_CODE_PREFIX,
        DEFAULT_CODE_DIGITS,
        startNumber + offset,
      ),
      lastName: row.lastName,
      firstName: row.firstName,
      fullName: `${row.lastName} ${row.firstName}`,
      dateOfBirth: row.dateOfBirth,
      gender: row.gender,
      maritalStatus: row.maritalStatus,
      nationality: 'Việt Nam',
      ethnicity: 'Kinh',
      religion: row.religion ?? null,
      placeOfBirth: location.provinceName,
      hometown: location.provinceShortName,

      cccdNumber: buildCccdNumber(row, index),
      cccdIssueDate,
      cccdIssuePlace: CCCD_ISSUE_PLACE,
      cccdExpiredDate: cccdExpiredDate(row.dateOfBirth, cccdIssueDate),

      taxCode:
        isProbation || NO_TAX_CODE.has(row.key)
          ? null
          : `8${String(100000000 + index * 7919)}`,
      socialInsuranceNo: hasInsurance
        ? `01${String(10000000 + index * 13579)}`
        : null,
      healthInsuranceNo: hasInsurance
        ? `DN401${String(1000000 + index * 2468).padStart(10, '0')}`
        : null,
      healthInsuranceExp: hasInsurance
        ? index % 4 === 0
          ? '2027-12-31'
          : '2026-12-31'
        : null,

      permanentAddress: `Số ${20 + index * 3} ${location.street}, ${location.ward}, ${location.provinceName}`,
      currentAddress: worksWhereTheyLive
        ? null
        : `Số ${8 + index * 2} ${officeLocation.street}, ${officeLocation.ward}, ${officeLocation.provinceName}`,
      provinceCode: location.provinceCode,
      districtCode: location.districtCode,
      wardCode: location.wardCode,

      phone: `${pick(PHONE_PREFIXES, index)}${String(1000000 + index * 4567)}`,
      email: `${localPart}@${DEMO_EMAIL_DOMAIN}`,
      personalEmail: NO_PERSONAL_EMAIL.has(row.key)
        ? null
        : `${localPart}@gmail.com`,
      emergencyContactName: hasEmergencyContact ? emergencyContactName : null,
      emergencyContactPhone: hasEmergencyContact
        ? `${pick(PHONE_PREFIXES, index + 7)}${String(2000000 + index * 3571)}`
        : null,
      emergencyContactRel: hasEmergencyContact ? emergencyRelation : null,

      bankAccount: hasBankAccount
        ? `19${String(10000000 + index * 60013)}`
        : null,
      bankName: hasBankAccount ? pick(BANK_NAMES, index) : null,
      bankBranch: hasBankAccount
        ? isHeadOffice
          ? pick(HEAD_OFFICE_BANK_BRANCHES, index)
          : pick(BRANCH_OFFICE_BANK_BRANCHES, index)
        : null,

      positionId: positionIds.get(row.positionKey),
      departmentId: departmentIds.get(row.departmentKey),
      hireDate: row.hireDate,
      probationStartDate: row.hireDate,
      probationEndDate,
      officialStartDate: isProbation ? null : addDays(probationEndDate, 1),
      terminationDate: row.termination?.date ?? null,
      terminationReason: row.termination?.reason ?? null,
      terminationType: row.termination?.type ?? null,
      status,

      educationLevel: row.educationLevel ?? null,
      major: row.major ?? null,
      university: row.university ?? null,
      graduationYear: row.graduationYear ?? null,

      avatarUrl: null,
      notes: row.notes ?? null,
      createdBy,
    };

    return { key: row.key, managerKey: row.managerKey, data };
  });
}

/** `MAX(<prefix>####) + 1`, exactly as the app allocates the next code. */
async function nextCodeNumber<T extends ObjectLiteral>(
  repository: Repository<T>,
  alias: string,
  column: string,
  prefix: string,
): Promise<number> {
  const max = await findMaxCodeNumber(repository, alias, column, prefix, true);

  return max + 1;
}

async function countDemoEmployees(dataSource: DataSource): Promise<number> {
  const rows = await dataSource.query<Array<{ total: string | number }>>(
    `SELECT COUNT(*) AS total FROM employees WHERE email LIKE ?`,
    [`%@${DEMO_EMAIL_DOMAIN}`],
  );

  return Number(rows[0].total);
}

/**
 * Folds the baseline seed's placeholder department into the real company.
 *
 * `users.seed.ts` must give the dev login accounts a department and a position
 * (both columns are NOT NULL), so on a fresh database it creates `ADM` /
 * `STAFF`. Once the demo company exists, that leaves two HR departments sitting
 * next to each other in the org chart.
 *
 * The six employees behind those accounts are NOT deletable — they are what
 * `admin`, `hr.manager`, `an.hoang` … resolve to, and the ownership tests
 * compare two of them — so they are moved rather than removed. The placeholder
 * rows are only dropped once nothing references them; if anything still does,
 * they are left in place rather than forcing the delete.
 *
 * @returns how many employees were moved (0 when there was nothing to fold in).
 */
async function absorbBaselineOrg(
  dataSource: DataSource,
  hrDepartmentId: number | undefined,
  hrPositionId: number | undefined,
): Promise<number> {
  if (hrDepartmentId === undefined || hrPositionId === undefined) {
    return 0;
  }

  const departmentRepo = dataSource.getRepository(Department);
  const positionRepo = dataSource.getRepository(Position);
  const employeeRepo = dataSource.getRepository(Employee);

  const placeholder = await departmentRepo.findOne({
    where: { code: BASELINE_DEPARTMENT_CODE },
  });

  if (!placeholder) {
    return 0;
  }

  const stranded = await employeeRepo.find({
    where: { departmentId: placeholder.id },
  });

  const head = await departmentRepo.findOne({ where: { id: hrDepartmentId } });

  for (const employee of stranded) {
    await employeeRepo.update(
      { id: employee.id },
      {
        departmentId: hrDepartmentId,
        positionId: hrPositionId,
        // They report to the real HR head, unless they ARE that person.
        directManagerId:
          head?.managerId && Number(head.managerId) !== Number(employee.id)
            ? head.managerId
            : null,
      },
    );
  }

  // A department cannot be deleted while it still points at a manager.
  await departmentRepo.update({ id: placeholder.id }, { managerId: null });

  const placeholderPosition = await positionRepo.findOne({
    where: { code: BASELINE_POSITION_CODE },
  });

  if (placeholderPosition) {
    const stillUsed = await employeeRepo.count({
      where: { positionId: placeholderPosition.id },
    });

    if (stillUsed === 0) {
      await positionRepo.delete({ id: placeholderPosition.id });
    }
  }

  const remaining = await employeeRepo.count({
    where: { departmentId: placeholder.id },
  });

  if (remaining === 0) {
    await departmentRepo.delete({ id: placeholder.id });
  }

  return stranded.length;
}

/**
 * Removes every row this seed created and nothing else.
 *
 * The only marker is the `@vietphattech.vn` work email; departments and
 * positions are reached from there (every demo department has at least its own
 * head in it, and demo departments only ever contain demo positions). Order
 * follows the FK direction: employees → positions → departments, with the
 * self-referencing links (`direct_manager_id`, `parent_id`, `manager_id`)
 * nulled first.
 */
export async function wipeDemoData(dataSource: DataSource): Promise<void> {
  const emailPattern = `%@${DEMO_EMAIL_DOMAIN}`;

  const departmentRows = await dataSource.query<Array<{ id: string | number }>>(
    `SELECT DISTINCT department_id AS id FROM employees WHERE email LIKE ?`,
    [emailPattern],
  );
  const departmentIds = departmentRows.map((row) => Number(row.id));

  await dataSource.query(
    `UPDATE employees SET direct_manager_id = NULL WHERE email LIKE ?`,
    [emailPattern],
  );

  if (departmentIds.length > 0) {
    const placeholders = departmentIds.map(() => '?').join(', ');

    await dataSource.query(
      `UPDATE departments SET manager_id = NULL, parent_id = NULL
       WHERE id IN (${placeholders})`,
      departmentIds,
    );
    await dataSource.query(`DELETE FROM employees WHERE email LIKE ?`, [
      emailPattern,
    ]);
    await dataSource.query(
      `DELETE FROM positions WHERE department_id IN (${placeholders})`,
      departmentIds,
    );
    await dataSource.query(
      `DELETE FROM departments WHERE id IN (${placeholders})`,
      departmentIds,
    );
  } else {
    await dataSource.query(`DELETE FROM employees WHERE email LIKE ?`, [
      emailPattern,
    ]);
  }

  console.log(
    `  - wiped demo data (${departmentIds.length} departments and everything under them)`,
  );
}

/**
 * Inserts the demo company. Idempotent: a second run finds the demo employees
 * already there and returns without writing anything.
 */
export async function seedDemo(dataSource: DataSource): Promise<void> {
  const existing = await countDemoEmployees(dataSource);

  if (existing > 0) {
    console.log(
      `  - demo data already present (${existing} employees @${DEMO_EMAIL_DOMAIN}); nothing to do.`,
    );
    console.log('    Re-seed from scratch with: npm run seed:demo -- --reset');

    return;
  }

  const departmentRepo = dataSource.getRepository(Department);
  const positionRepo = dataSource.getRepository(Position);
  const employeeRepo = dataSource.getRepository(Employee);
  const userRepo = dataSource.getRepository(User);

  // Codes continue from the highest one ever issued (soft-deleted rows
  // included), so a demo row is indistinguishable from one the UI created and
  // can never steal a number the app already handed out.
  const firstDepartmentNumber = await nextCodeNumber(
    departmentRepo,
    'department',
    'code',
    DEPARTMENT_CODE_PREFIX,
  );
  const firstPositionNumber = await nextCodeNumber(
    positionRepo,
    'position',
    'code',
    POSITION_CODE_PREFIX,
  );
  const firstEmployeeNumber = await nextCodeNumber(
    employeeRepo,
    'employee',
    'employee_code',
    EMPLOYEE_CODE_PREFIX,
  );

  console.log(
    `  - next codes: ${DEPARTMENT_CODE_PREFIX}${firstDepartmentNumber} / ` +
      `${POSITION_CODE_PREFIX}${firstPositionNumber} / ` +
      `${EMPLOYEE_CODE_PREFIX}${firstEmployeeNumber}`,
  );

  // Demo records are attributed to the seeded `admin` account when it exists,
  // so the "created by" column in the UI is not empty either.
  const admin = await userRepo.findOne({ where: { username: 'admin' } });
  const createdBy = admin ? Number(admin.id) : null;

  // ---- Departments (parents first, `manager_id` filled after employees) ----
  const departmentIds = new Map<string, number>();

  for (const [offset, row] of DEPARTMENTS.entries()) {
    const saved = await departmentRepo.save(
      departmentRepo.create({
        code: formatSequentialCode(
          DEPARTMENT_CODE_PREFIX,
          DEFAULT_CODE_DIGITS,
          firstDepartmentNumber + offset,
        ),
        name: row.name,
        description: row.description,
        parentId:
          row.parentKey === null
            ? null
            : (departmentIds.get(row.parentKey) ?? null),
        sortOrder: offset + 1,
        isActive: true,
      }),
    );

    departmentIds.set(row.key, Number(saved.id));
  }

  // ---- Positions ----
  const positionIds = new Map<string, number>();
  const positionDepartmentKeys = new Map<string, string>();

  for (const [offset, row] of POSITIONS.entries()) {
    const departmentId = departmentIds.get(row.departmentKey);

    if (departmentId === undefined) {
      throw new Error(
        `Position ${row.key} points at unknown department ${row.departmentKey}`,
      );
    }

    const saved = await positionRepo.save(
      positionRepo.create({
        code: formatSequentialCode(
          POSITION_CODE_PREFIX,
          DEFAULT_CODE_DIGITS,
          firstPositionNumber + offset,
        ),
        name: row.name,
        departmentId,
        level: row.level,
        minSalary: row.minSalary.toFixed(2),
        maxSalary: row.maxSalary.toFixed(2),
        isActive: true,
      }),
    );

    positionIds.set(row.key, Number(saved.id));
    positionDepartmentKeys.set(row.key, row.departmentKey);
  }

  // ---- Employees (`direct_manager_id` filled in a second pass) ----
  const built = buildEmployees(
    departmentIds,
    positionIds,
    positionDepartmentKeys,
    firstEmployeeNumber,
    createdBy,
  );
  const employeeIds = new Map<string, number>();

  for (const employee of built) {
    const saved = await employeeRepo.save(employeeRepo.create(employee.data));
    employeeIds.set(employee.key, Number(saved.id));
  }

  for (const employee of built) {
    if (employee.managerKey === null) {
      continue;
    }

    const managerId = employeeIds.get(employee.managerKey);

    if (managerId === undefined) {
      throw new Error(
        `Employee ${employee.key} points at unknown manager ${employee.managerKey}`,
      );
    }

    await employeeRepo.update(
      { id: employeeIds.get(employee.key) },
      { directManagerId: managerId },
    );
  }

  // ---- Department heads ----
  for (const row of DEPARTMENTS) {
    const managerId = employeeIds.get(row.managerKey);

    if (managerId === undefined) {
      throw new Error(
        `Department ${row.key} points at unknown head ${row.managerKey}`,
      );
    }

    await departmentRepo.update(
      { id: departmentIds.get(row.key) },
      { managerId },
    );
  }

  // ---- Absorb the baseline seed's placeholder org ----
  //
  // `users.seed.ts` has to give the dev login accounts a department and a
  // position, because both columns are NOT NULL — so on a fresh database it
  // creates `ADM` / `STAFF`. Left alone, the company then shows TWO HR
  // departments side by side ("Phòng Hành chính – Nhân sự" next to "Phòng Nhân
  // sự"), which is what the project owner spotted in the UI.
  //
  // Those six employees are NOT deletable: they are the records behind the
  // `admin` / `hr.manager` / `an.hoang` / … accounts, and the ownership tests
  // compare two of them. So they move into the real HR department instead, and
  // the placeholder department/position are dropped once nothing points at them.
  const absorbed = await absorbBaselineOrg(
    dataSource,
    departmentIds.get('NS'),
    positionIds.get('NS_TD'),
  );

  console.log(`  - departments: OK (${DEPARTMENTS.length} inserted)`);
  console.log(`  - positions: OK (${POSITIONS.length} inserted)`);
  console.log(`  - employees: OK (${built.length} inserted)`);
  console.log(
    `  - baseline org: ${absorbed} hồ sơ tài khoản dev chuyển vào Phòng Nhân sự` +
      (absorbed > 0
        ? ', đã xoá phòng/chức vụ giữ chỗ'
        : ' (không có gì để gộp)'),
  );
  console.log(
    '  - leave types / users: untouched on purpose (see the header comment)',
  );
}

// ---------------------------------------------------------- entry point ----

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Refusing to run the demo seed with NODE_ENV=production: it inserts fictional employee records.',
    );
  }

  const reset = process.argv.includes('--reset');
  const dataSource = await AppDataSource.initialize();
  console.log('Seeding demo data into:', dataSource.options.database);

  try {
    if (reset) {
      await wipeDemoData(dataSource);
    }

    await seedDemo(dataSource);
    console.log('Demo seed completed successfully.');
  } finally {
    await dataSource.destroy();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Demo seed failed:', error);
    process.exit(1);
  });
}
