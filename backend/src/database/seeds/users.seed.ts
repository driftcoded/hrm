import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';
import { Department } from '../../modules/departments/entities/department.entity';
import { Position } from '../../modules/positions/entities/position.entity';
import {
  Employee,
  EmployeeStatus,
  Gender,
} from '../../modules/employees/entities/employee.entity';
import { User, UserStatus } from '../../modules/users/entities/user.entity';

/** Salt rounds bắt buộc = 10 (CLAUDE.md §Bảo mật). */
const BCRYPT_SALT_ROUNDS = 10;

/**
 * Mật khẩu cho các tài khoản demo — BẮT BUỘC truyền qua `SEED_DEFAULT_PASSWORD`.
 *
 * Cố tình KHÔNG có giá trị mặc định trong source: một fallback hardcode nghĩa là
 * chạy `npm run seed` ở môi trường thiếu env var sẽ tạo ra 8 tài khoản (gồm cả
 * `admin`) với mật khẩu nằm công khai trong git. Checklist go-live của dự án cấm
 * hardcode credential, nên ở đây fail-fast thay vì đoán.
 *
 * KHÔNG ép độ dài tối thiểu: đây là tài khoản dev để gõ nhanh khi thử, và luật
 * độ dài của `/auth/*` áp cho mật khẩu người dùng tự đặt qua ứng dụng. Ép ở đây
 * chỉ tổ bắt người dev gõ mật khẩu dài mỗi lần đăng nhập thử.
 */
function requireSeedPassword(): string {
  const password = process.env.SEED_DEFAULT_PASSWORD;

  if (!password) {
    throw new Error(
      'SEED_DEFAULT_PASSWORD chưa được set. ' +
        'Đặt biến này trong .env trước khi chạy seed — xem .env.example.',
    );
  }

  return password;
}

const DEPARTMENT_CODE = 'ADM';
const POSITION_CODE = 'STAFF';

interface SeedEmployeeRow {
  employeeCode: string;
  lastName: string;
  firstName: string;
  dateOfBirth: string;
  gender: Gender;
  cccdNumber: string;
  phone: string;
  email: string;
}

interface SeedUserRow {
  username: string;
  email: string;
  roleId: number;
  status: UserStatus;
  /** employee_code của nhân viên liên kết; null = tài khoản chưa gắn hồ sơ. */
  employeeCode: string | null;
}

const EMPLOYEES: SeedEmployeeRow[] = [
  {
    employeeCode: 'NV0001',
    lastName: 'Nguyễn',
    firstName: 'Văn Quản Trị',
    dateOfBirth: '1988-03-12',
    gender: Gender.MALE,
    cccdNumber: '001188000001',
    phone: '0901000001',
    email: 'admin@hrm.local',
  },
  {
    employeeCode: 'NV0002',
    lastName: 'Trần',
    firstName: 'Thị Nhân Sự',
    dateOfBirth: '1990-07-25',
    gender: Gender.FEMALE,
    cccdNumber: '001190000002',
    phone: '0901000002',
    email: 'hr.manager@hrm.local',
  },
  {
    employeeCode: 'NV0003',
    lastName: 'Phạm',
    firstName: 'Thị Hành Chính',
    dateOfBirth: '1995-11-02',
    gender: Gender.FEMALE,
    cccdNumber: '001195000003',
    phone: '0901000003',
    email: 'hr.staff@hrm.local',
  },
  {
    employeeCode: 'NV0004',
    lastName: 'Lê',
    firstName: 'Văn Trưởng Nhóm',
    dateOfBirth: '1987-01-18',
    gender: Gender.MALE,
    cccdNumber: '001187000004',
    phone: '0901000004',
    email: 'manager@hrm.local',
  },
  {
    employeeCode: 'NV0005',
    lastName: 'Hoàng',
    firstName: 'Thị An',
    dateOfBirth: '1998-05-09',
    gender: Gender.FEMALE,
    cccdNumber: '001198000005',
    phone: '0901000005',
    email: 'an.hoang@hrm.local',
  },
  {
    employeeCode: 'NV0006',
    lastName: 'Vũ',
    firstName: 'Văn Bình',
    dateOfBirth: '1999-09-30',
    gender: Gender.MALE,
    cccdNumber: '001199000006',
    phone: '0901000006',
    email: 'binh.vu@hrm.local',
  },
];

const USERS: SeedUserRow[] = [
  {
    username: 'admin',
    email: 'admin@hrm.local',
    roleId: 1,
    status: UserStatus.ACTIVE,
    employeeCode: 'NV0001',
  },
  {
    username: 'hr.manager',
    email: 'hr.manager@hrm.local',
    roleId: 2,
    status: UserStatus.ACTIVE,
    employeeCode: 'NV0002',
  },
  {
    username: 'hr.staff',
    email: 'hr.staff@hrm.local',
    roleId: 3,
    status: UserStatus.ACTIVE,
    employeeCode: 'NV0003',
  },
  {
    username: 'manager',
    email: 'manager@hrm.local',
    roleId: 4,
    status: UserStatus.ACTIVE,
    employeeCode: 'NV0004',
  },
  {
    // Nhân viên A – dùng cho test assertOwnership
    username: 'an.hoang',
    email: 'an.hoang@hrm.local',
    roleId: 5,
    status: UserStatus.ACTIVE,
    employeeCode: 'NV0005',
  },
  {
    // Nhân viên B – dùng cho test assertOwnership (A truy cập resource của B)
    username: 'binh.vu',
    email: 'binh.vu@hrm.local',
    roleId: 5,
    status: UserStatus.ACTIVE,
    employeeCode: 'NV0006',
  },
  {
    // Tài khoản bị khoá – test đăng nhập vào tài khoản status = locked (423)
    username: 'locked.user',
    email: 'locked.user@hrm.local',
    roleId: 5,
    status: UserStatus.LOCKED,
    employeeCode: null,
  },
  {
    // Tài khoản vô hiệu – test đăng nhập vào tài khoản status = inactive (403)
    username: 'inactive.user',
    email: 'inactive.user@hrm.local',
    roleId: 5,
    status: UserStatus.INACTIVE,
    employeeCode: null,
  },
];

/**
 * Seed tối thiểu để test được auth end-to-end (Giai đoạn 1.1):
 * 1 phòng ban + 1 chức vụ + 6 nhân viên + 8 tài khoản (đủ 5 role + 2 tài khoản
 * trạng thái locked/inactive).
 *
 * KHÔNG phải seed nhân sự đầy đủ của Giai đoạn 3.
 * Idempotent: chạy lại nhiều lần không tạo trùng và KHÔNG ghi đè mật khẩu của
 * tài khoản đã tồn tại.
 */
export async function seedUsers(dataSource: DataSource): Promise<void> {
  // Demo accounts với mật khẩu dùng chung không được phép tồn tại ở production,
  // kể cả khi có ai đó set SEED_DEFAULT_PASSWORD.
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Từ chối seed tài khoản demo khi NODE_ENV=production: các tài khoản này dùng chung một mật khẩu.',
    );
  }

  const password = requireSeedPassword();
  const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

  const departmentRepo = dataSource.getRepository(Department);
  const positionRepo = dataSource.getRepository(Position);
  const employeeRepo = dataSource.getRepository(Employee);
  const userRepo = dataSource.getRepository(User);

  // ---- Phòng ban + chức vụ ----
  //
  // Các tài khoản dev bắt buộc phải có phòng ban/chức vụ vì `employees` NOT NULL
  // ở hai cột đó. Nhưng nếu `seed:demo` đã chạy và đã chuyển 6 hồ sơ này vào cơ
  // cấu thật của công ty, thì TÁI SỬ DỤNG chỗ hiện có — nếu không, mỗi lần chạy
  // lại seed nền sẽ dựng lại `ADM` rỗng bên cạnh phòng Nhân sự thật, đúng kiểu
  // hai phòng trùng chức năng mà bản demo vừa dọn đi.
  const existingAnchor = await employeeRepo.findOne({
    where: { employeeCode: EMPLOYEES[0].employeeCode },
  });

  let department = existingAnchor
    ? await departmentRepo.findOne({
        where: { id: existingAnchor.departmentId },
      })
    : await departmentRepo.findOne({ where: { code: DEPARTMENT_CODE } });

  if (!department) {
    department = await departmentRepo.save(
      departmentRepo.create({
        code: DEPARTMENT_CODE,
        name: 'Phòng Nhân sự',
        description: 'Phòng ban mẫu cho môi trường dev',
        sortOrder: 1,
        isActive: true,
      }),
    );
  }

  let position = existingAnchor
    ? await positionRepo.findOne({ where: { id: existingAnchor.positionId } })
    : await positionRepo.findOne({ where: { code: POSITION_CODE } });

  if (!position) {
    position = await positionRepo.save(
      positionRepo.create({
        code: POSITION_CODE,
        name: 'Nhân viên',
        departmentId: department.id,
        level: 1,
        isActive: true,
      }),
    );
  }

  // ---- Nhân viên ----
  const employeeIdByCode = new Map<string, number>();
  let insertedEmployees = 0;

  for (const row of EMPLOYEES) {
    let employee = await employeeRepo.findOne({
      where: { employeeCode: row.employeeCode },
    });

    if (!employee) {
      employee = await employeeRepo.save(
        employeeRepo.create({
          employeeCode: row.employeeCode,
          lastName: row.lastName,
          firstName: row.firstName,
          fullName: `${row.lastName} ${row.firstName}`,
          dateOfBirth: row.dateOfBirth,
          gender: row.gender,
          nationality: 'Việt Nam',
          ethnicity: 'Kinh',
          placeOfBirth: 'Hà Nội',
          hometown: 'Hà Nội',
          cccdNumber: row.cccdNumber,
          cccdIssueDate: '2021-06-15',
          cccdIssuePlace: 'Cục CS QLHC về TTXH',
          permanentAddress: 'Số 1, phố Mẫu, Hà Nội',
          // Mã theo danh mục hành chính SAU sáp nhập 01/07/2025
          // (src/common/data/): tỉnh dùng mã BNV 01–34, phường/xã dùng mã TMS.
          // `districtCode` để null vì cấp huyện đã chấm dứt hoạt động.
          provinceCode: '01',
          districtCode: null,
          wardCode: '10101003',
          phone: row.phone,
          email: row.email,
          positionId: position.id,
          departmentId: department.id,
          hireDate: '2024-01-02',
          officialStartDate: '2024-04-02',
          status: EmployeeStatus.ACTIVE,
        }),
      );
      insertedEmployees++;
    }

    employeeIdByCode.set(row.employeeCode, employee.id);
  }

  // Trưởng phòng = NV0002 (hr_manager) – FK manager_id được thêm sau bảng employees.
  const managerEmployeeId = employeeIdByCode.get('NV0002');
  if (managerEmployeeId && !department.managerId) {
    await departmentRepo.update(
      { id: department.id },
      { managerId: managerEmployeeId },
    );
  }

  // ---- Tài khoản ----
  let insertedUsers = 0;

  for (const row of USERS) {
    const existing = await userRepo.findOne({
      where: { username: row.username },
    });

    if (existing) {
      continue;
    }

    await userRepo.save(
      userRepo.create({
        username: row.username,
        email: row.email,
        password: passwordHash,
        roleId: row.roleId,
        status: row.status,
        employeeId: row.employeeCode
          ? (employeeIdByCode.get(row.employeeCode) ?? null)
          : null,
      }),
    );
    insertedUsers++;
  }

  console.log(
    // Print what was actually used, not the constants: after `seed:demo` these
    // accounts live in the real company, and printing `ADM / STAFF` there would
    // claim a placeholder department that no longer exists.
    `  - departments/positions: OK (${department.code} / ${position.code})`,
  );
  console.log(
    `  - employees: OK (${insertedEmployees} inserted / ${EMPLOYEES.length} total)`,
  );
  console.log(
    `  - users: OK (${insertedUsers} inserted / ${USERS.length} total) – mật khẩu dev lấy từ SEED_DEFAULT_PASSWORD`,
  );
}
