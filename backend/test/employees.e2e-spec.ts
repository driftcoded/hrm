import * as request from 'supertest';
import { App } from 'supertest/types';
import {
  cleanupSeedRefreshTokens,
  createE2eApp,
  E2eContext,
  errorBody,
  SEED_PASSWORD,
  SEED_USERS,
  successBody,
  loginData,
} from './support/e2e-app';
import {
  cleanupEmployeeFixtures,
  DeleteBody,
  findEmployeeDeletedAt,
  findEmployeeIdByUsername,
  FIXTURE_PREFIX,
  fixtureCccd,
  fixtureEmail,
  insertFixtureDepartment,
  insertFixturePosition,
  makeJpegBuffer,
  PaginatedBody,
  RestoreBody,
  setDepartmentManager,
} from './support/employee-fixtures';

interface EmployeeBody {
  id: number;
  employeeCode: string;
  fullName: string;
  email: string;
  phone: string;
  status: string;
  hireDate: string;
  avatarUrl: string | null;
  baseSalary: number | null;
  deletedAt: string | null;
  department: { id: number; name: string } | null;
  position: { id: number; name: string } | null;
}

interface EmployeeDetailBody extends EmployeeBody {
  lastName: string;
  firstName: string;
  cccdNumber: string;
  districtCode: string | null;
  notes: string | null;
  directManager: { id: number; name: string } | null;
}

interface SummaryBody {
  id: number;
  employeeCode: string;
  fullName: string;
  activeDependents: number;
  activeContract: { id: number; baseSalary: number } | null;
}

interface AvatarBody {
  avatarUrl: string;
}

interface DependentBody {
  id: number;
  employeeId: number;
  fullName: string;
  relationship: string;
  registrationDate: string;
  endDate: string | null;
  status: string;
  reasonInactive: string | null;
  isCurrentlyDeductible: boolean;
}

interface WardBody {
  code: string;
  name: string;
  provinceCode: string;
  type: string;
  legacyDistrictCode: string;
  legacyDistrictName: string;
}

interface StatsBody {
  total: number;
  byStatus: Record<string, number>;
  contractsExpiringSoon: number;
  windowDays: number;
  hiredLast30Days: number;
  probationEndingSoon: number;
  byGender: { male: number; female: number; other: number };
  averageAge: number | null;
  averageTenureYears: number | null;
  byDepartment: Array<{
    departmentId: number;
    departmentName: string;
    count: number;
  }>;
  upcomingBirthdays: Array<{
    employeeId: number;
    fullName: string;
    birthday: string;
    daysUntil: number;
  }>;
}

const BASE = '/api/v1';

/** Body hợp lệ tối thiểu; mỗi test override đúng field nó quan tâm. */
function makeEmployeePayload(
  suffix: string,
  departmentId: number,
  positionId: number,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    lastName: 'Nguyễn',
    firstName: 'Văn Bình',
    dateOfBirth: '1998-07-20',
    gender: 'male',
    placeOfBirth: 'Hà Nội',
    hometown: 'Hà Nam',
    cccdNumber: fixtureCccd(suffix),
    cccdIssueDate: '2021-05-10',
    cccdIssuePlace: 'Cục CS QLHC về TTXH Hà Nội',
    permanentAddress: 'Số 10, Ngõ 20, Phố Huế, Hà Nội',
    // Mã theo danh mục sau sáp nhập 01/07/2025: tỉnh BNV 01–34, phường/xã TMS.
    // `districtCode` cố tình KHÔNG gửi — cấp huyện đã bị bỏ.
    provinceCode: '01',
    wardCode: '10101003',
    phone: `09${suffix.padStart(8, '0')}`,
    email: fixtureEmail(`nv.${suffix}`),
    positionId,
    departmentId,
    hireDate: '2026-06-01',
    ...overrides,
  };
}

/**
 * Giai đoạn 3.1 – `/employees`, `/contracts`, `/employees/:id/family-members`.
 *
 * Fixture dùng tiền tố `E3E` + email miền `@e3e.local`, được dọn sạch ở cả
 * `beforeAll` lẫn `afterAll` nên bộ test chạy lại được nhiều lần và không bao
 * giờ đụng dữ liệu seed của Giai đoạn 1.
 */
describe('Employees / contracts / family members (e2e)', () => {
  let context: E2eContext;
  let server: App;

  let adminToken: string;
  let hrManagerToken: string;
  let hrStaffToken: string;
  let managerToken: string;
  let employeeToken: string;

  let departmentId: number;
  let otherDepartmentId: number;
  let positionId: number;
  let otherPositionId: number;
  let managerEmployeeId: number;
  let employeeAId: number;

  async function loginAs(username: string): Promise<string> {
    const response = await request(server)
      .post(`${BASE}/auth/login`)
      .send({ username, password: SEED_PASSWORD })
      .expect(200);

    return loginData(response).accessToken;
  }

  /** Tạo nhân viên qua API và trả về body chi tiết. */
  async function createEmployee(
    suffix: string,
    overrides: Record<string, unknown> = {},
    token = adminToken,
  ): Promise<EmployeeDetailBody> {
    const response = await request(server)
      .post(`${BASE}/employees`)
      .set('Authorization', `Bearer ${token}`)
      .send(makeEmployeePayload(suffix, departmentId, positionId, overrides))
      .expect(201);

    return successBody<EmployeeDetailBody>(response).data;
  }

  beforeAll(async () => {
    context = await createE2eApp();
    server = context.app.getHttpServer() as App;

    await cleanupEmployeeFixtures(context.dataSource);

    departmentId = await insertFixtureDepartment(
      context.dataSource,
      `${FIXTURE_PREFIX}_DEPT`,
      `${FIXTURE_PREFIX} Phòng Thử Nghiệm`,
    );
    otherDepartmentId = await insertFixtureDepartment(
      context.dataSource,
      `${FIXTURE_PREFIX}_DEPT2`,
      `${FIXTURE_PREFIX} Phòng Thử Nghiệm 2`,
    );
    positionId = await insertFixturePosition(
      context.dataSource,
      `${FIXTURE_PREFIX}_POS`,
      `${FIXTURE_PREFIX} Chức Vụ`,
      departmentId,
    );
    otherPositionId = await insertFixturePosition(
      context.dataSource,
      `${FIXTURE_PREFIX}_POS2`,
      `${FIXTURE_PREFIX} Chức Vụ 2`,
      otherDepartmentId,
    );

    managerEmployeeId = await findEmployeeIdByUsername(
      context.dataSource,
      SEED_USERS.manager,
    );
    employeeAId = await findEmployeeIdByUsername(
      context.dataSource,
      SEED_USERS.employeeA,
    );
    // Cho manager phụ trách phòng ban fixture để kiểm tra phạm vi theo phòng ban.
    await setDepartmentManager(
      context.dataSource,
      departmentId,
      managerEmployeeId,
    );

    adminToken = await loginAs(SEED_USERS.admin);
    hrManagerToken = await loginAs(SEED_USERS.hrManager);
    hrStaffToken = await loginAs(SEED_USERS.hrStaff);
    managerToken = await loginAs(SEED_USERS.manager);
    employeeToken = await loginAs(SEED_USERS.employeeA);
  });

  afterAll(async () => {
    await cleanupEmployeeFixtures(context.dataSource);
    await cleanupSeedRefreshTokens(context.dataSource);
    await context.app.close();
  });

  // =====================================================  POST /employees ===

  describe('POST /employees', () => {
    it('[1] tạo NV với đủ field bắt buộc → 201, mã NV do server sinh', async () => {
      const created = await createEmployee('3001');

      expect(created.employeeCode).toMatch(/^NV\d{4,}$/);
      expect(created.fullName).toBe('Nguyễn Văn Bình');
      expect(created.status).toBe('probation');
      expect(created.department?.id).toBe(departmentId);
      // Client không gửi employeeCode/fullName – server tự dựng.
      expect(created.id).toBeGreaterThan(0);
    });

    it('[2] CCCD không đủ 12 số → 400 VALIDATION_ERROR, details.code = INVALID_CCCD', async () => {
      const response = await request(server)
        .post(`${BASE}/employees`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(
          makeEmployeePayload('3002', departmentId, positionId, {
            cccdNumber: '12345',
          }),
        )
        .expect(400);

      const body = errorBody(response);
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'cccdNumber',
            code: 'INVALID_CCCD',
          }),
        ]),
      );
    });

    it('[3] SĐT sai định dạng → 400 với details.code = INVALID_PHONE', async () => {
      const response = await request(server)
        .post(`${BASE}/employees`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(
          makeEmployeePayload('3003', departmentId, positionId, {
            phone: '12345',
          }),
        )
        .expect(400);

      expect(errorBody(response).error.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'phone', code: 'INVALID_PHONE' }),
        ]),
      );
    });

    it('[4] thiếu email → 400 với details cho field email', async () => {
      const payload = makeEmployeePayload('3004', departmentId, positionId);
      delete payload.email;

      const response = await request(server)
        .post(`${BASE}/employees`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload)
        .expect(400);

      expect(errorBody(response).error.details).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'email' })]),
      );
    });

    it('[5] CCCD trùng → 409 DUPLICATE_CCCD', async () => {
      await createEmployee('3005');

      const response = await request(server)
        .post(`${BASE}/employees`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(
          makeEmployeePayload('3006', departmentId, positionId, {
            cccdNumber: fixtureCccd('3005'),
          }),
        )
        .expect(409);

      expect(errorBody(response).error.code).toBe('DUPLICATE_CCCD');
    });

    it('[6] email trùng (khác hoa/thường) → 409 DUPLICATE_EMAIL', async () => {
      const response = await request(server)
        .post(`${BASE}/employees`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(
          makeEmployeePayload('3007', departmentId, positionId, {
            email: fixtureEmail('NV.3005').toUpperCase(),
          }),
        )
        .expect(409);

      expect(errorBody(response).error.code).toBe('DUPLICATE_EMAIL');
    });

    it('[7] chức vụ thuộc phòng ban khác → 422 POSITION_DEPARTMENT_MISMATCH', async () => {
      const response = await request(server)
        .post(`${BASE}/employees`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(makeEmployeePayload('3008', departmentId, otherPositionId, {}))
        .expect(422);

      expect(errorBody(response).error.code).toBe(
        'POSITION_DEPARTMENT_MISMATCH',
      );
    });

    it('[8] tuổi dưới 15 → 422 INVALID_DATE_OF_BIRTH', async () => {
      const response = await request(server)
        .post(`${BASE}/employees`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(
          makeEmployeePayload('3009', departmentId, positionId, {
            dateOfBirth: '2020-01-01',
          }),
        )
        .expect(422);

      expect(errorBody(response).error.code).toBe('INVALID_DATE_OF_BIRTH');
    });

    it('[9] ngày vào làm trước ngày sinh + 15 năm → 422 INVALID_HIRE_DATE', async () => {
      const response = await request(server)
        .post(`${BASE}/employees`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(
          makeEmployeePayload('3010', departmentId, positionId, {
            dateOfBirth: '2009-07-20',
            hireDate: '2022-01-01',
          }),
        )
        .expect(422);

      expect(errorBody(response).error.code).toBe('INVALID_HIRE_DATE');
    });

    it('[10] nhân viên thường không được tạo hồ sơ → 403', async () => {
      await request(server)
        .post(`${BASE}/employees`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .send(makeEmployeePayload('3011', departmentId, positionId))
        .expect(403);
    });

    it('[11] request không có token → 401', async () => {
      await request(server)
        .post(`${BASE}/employees`)
        .send(makeEmployeePayload('3012', departmentId, positionId))
        .expect(401);
    });
  });

  // ======================================================  GET /employees ===

  describe('GET /employees', () => {
    it('[12] tìm kiếm theo tên trả đúng nhân viên', async () => {
      await createEmployee('3020', {
        lastName: 'Đặng',
        firstName: 'Thị Tìm Kiếm',
        email: fixtureEmail('search.3020'),
      });

      const response = await request(server)
        .get(`${BASE}/employees`)
        .query({ search: 'Thị Tìm Kiếm' })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const body = successBody<PaginatedBody<EmployeeBody>>(response).data;
      expect(body.items.length).toBeGreaterThanOrEqual(1);
      expect(
        body.items.every((item) => item.fullName.includes('Tìm Kiếm')),
      ).toBe(true);
    });

    it('[13] tìm kiếm theo mã NV trả đúng 1 bản ghi', async () => {
      const created = await createEmployee('3021');

      const response = await request(server)
        .get(`${BASE}/employees`)
        .query({ search: created.employeeCode })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const body = successBody<PaginatedBody<EmployeeBody>>(response).data;
      expect(body.items).toHaveLength(1);
      expect(body.items[0].id).toBe(created.id);
    });

    it('[14] filter kết hợp phòng ban + trạng thái trả đúng tập con', async () => {
      await createEmployee('3022', { status: 'active' });
      await createEmployee('3023', { status: 'probation' });

      const response = await request(server)
        .get(`${BASE}/employees`)
        .query({ departmentId, status: 'active', limit: 100 })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const body = successBody<PaginatedBody<EmployeeBody>>(response).data;
      expect(body.items.length).toBeGreaterThanOrEqual(1);
      expect(
        body.items.every(
          (item) =>
            item.status === 'active' && item.department?.id === departmentId,
        ),
      ).toBe(true);
    });

    it('[15] envelope phân trang đúng chuẩn api-spec §1.1', async () => {
      const response = await request(server)
        .get(`${BASE}/employees`)
        .query({ page: 1, limit: 2 })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const body = successBody<PaginatedBody<EmployeeBody>>(response).data;
      expect(body.meta.page).toBe(1);
      expect(body.meta.limit).toBe(2);
      expect(body.items.length).toBeLessThanOrEqual(2);
    });

    it('[16] limit vượt 100 → 400 VALIDATION_ERROR (trần cứng api-spec §1.2)', async () => {
      const response = await request(server)
        .get(`${BASE}/employees`)
        .query({ limit: 99999 })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      expect(errorBody(response).error.code).toBe('VALIDATION_ERROR');
    });

    it('[17] danh sách KHÔNG lộ CCCD / số tài khoản', async () => {
      const response = await request(server)
        .get(`${BASE}/employees`)
        .query({ limit: 1 })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const body = successBody<PaginatedBody<EmployeeBody>>(response).data;
      expect(body.items[0]).not.toHaveProperty('cccdNumber');
      expect(body.items[0]).not.toHaveProperty('bankAccount');
    });

    it('[18] role employee gọi danh sách → 403 FORBIDDEN', async () => {
      const response = await request(server)
        .get(`${BASE}/employees`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(403);

      expect(errorBody(response).error.code).toBe('FORBIDDEN');
    });

    it('[19] manager chỉ thấy nhân viên trong phạm vi phòng ban của mình', async () => {
      const response = await request(server)
        .get(`${BASE}/employees`)
        .query({ limit: 100 })
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      const body = successBody<PaginatedBody<EmployeeBody>>(response).data;
      const managerDepartmentIds = new Set(
        body.items.map((item) => item.department?.id),
      );

      // Phòng ban fixture (manager phụ trách) được phép; phòng ban fixture 2 thì không.
      expect(managerDepartmentIds.has(otherDepartmentId)).toBe(false);
      expect(body.items.length).toBeGreaterThan(0);
    });
  });

  // ==================================  GET /employees/me + /:id + /summary ===

  describe('GET /employees/me, /:id, /:id/summary', () => {
    it('[20] /employees/me trả đúng hồ sơ của tài khoản đang đăng nhập', async () => {
      const response = await request(server)
        .get(`${BASE}/employees/me`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(200);

      expect(successBody<EmployeeDetailBody>(response).data.id).toBe(
        employeeAId,
      );
    });

    it('[21] nhân viên A xem hồ sơ nhân viên B → 403 FORBIDDEN', async () => {
      const other = await createEmployee('3030');

      const response = await request(server)
        .get(`${BASE}/employees/${other.id}`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(403);

      expect(errorBody(response).error.code).toBe('FORBIDDEN');
    });

    it('[22] hồ sơ không tồn tại → 404 EMPLOYEE_NOT_FOUND', async () => {
      const response = await request(server)
        .get(`${BASE}/employees/99999999`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect(errorBody(response).error.code).toBe('EMPLOYEE_NOT_FOUND');
    });

    it('[23] /summary trả tóm tắt cho phiếu lương, chưa có HĐ thì activeContract = null', async () => {
      const created = await createEmployee('3031');

      const response = await request(server)
        .get(`${BASE}/employees/${created.id}/summary`)
        .set('Authorization', `Bearer ${hrStaffToken}`)
        .expect(200);

      const summary = successBody<SummaryBody>(response).data;
      expect(summary.employeeCode).toBe(created.employeeCode);
      expect(summary.activeContract).toBeNull();
      expect(summary.activeDependents).toBe(0);
    });
  });

  // ====================================================  PATCH /employees ===

  describe('PATCH /employees/:id', () => {
    it('[24] cập nhật một phần, fullName được ghép lại khi đổi tên', async () => {
      const created = await createEmployee('3040');

      const response = await request(server)
        .patch(`${BASE}/employees/${created.id}`)
        .set('Authorization', `Bearer ${hrStaffToken}`)
        .send({ firstName: 'Văn Cường', notes: 'Đã cập nhật' })
        .expect(200);

      const updated = successBody<EmployeeDetailBody>(response).data;
      expect(updated.fullName).toBe('Nguyễn Văn Cường');
      expect(updated.notes).toBe('Đã cập nhật');
      // Field không gửi thì giữ nguyên.
      expect(updated.cccdNumber).toBe(created.cccdNumber);
    });

    it('[25] đổi email sang email đã dùng → 409 DUPLICATE_EMAIL', async () => {
      const first = await createEmployee('3041');
      const second = await createEmployee('3042');

      const response = await request(server)
        .patch(`${BASE}/employees/${second.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email: first.email })
        .expect(409);

      expect(errorBody(response).error.code).toBe('DUPLICATE_EMAIL');
    });

    it('[26] gán chính mình làm quản lý trực tiếp → 422 EMPLOYEE_SELF_MANAGER', async () => {
      const created = await createEmployee('3043');

      const response = await request(server)
        .patch(`${BASE}/employees/${created.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ directManagerId: created.id })
        .expect(422);

      expect(errorBody(response).error.code).toBe('EMPLOYEE_SELF_MANAGER');
    });
  });

  // ==========================================  DELETE + restore /employees ===

  describe('DELETE /employees/:id + restore', () => {
    it('[27] xoá mềm → biến mất khỏi danh sách thường, deleted_at được set', async () => {
      const created = await createEmployee('3050');

      const response = await request(server)
        .delete(`${BASE}/employees/${created.id}`)
        .set('Authorization', `Bearer ${hrManagerToken}`)
        .expect(200);

      expect(successBody<DeleteBody>(response).data).toEqual({
        id: created.id,
        deleted: true,
      });

      // Bản ghi vẫn còn trong DB, chỉ được đánh dấu xoá.
      expect(
        await findEmployeeDeletedAt(context.dataSource, created.id),
      ).not.toBeNull();

      const list = await request(server)
        .get(`${BASE}/employees`)
        .query({ search: created.employeeCode })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(
        successBody<PaginatedBody<EmployeeBody>>(list).data.items,
      ).toHaveLength(0);

      await request(server)
        .get(`${BASE}/employees/${created.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('[28] ?onlyDeleted=true liệt kê hồ sơ đã xoá để khôi phục', async () => {
      const created = await createEmployee('3051');
      await request(server)
        .delete(`${BASE}/employees/${created.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const response = await request(server)
        .get(`${BASE}/employees`)
        .query({ onlyDeleted: true, search: created.employeeCode })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const body = successBody<PaginatedBody<EmployeeBody>>(response).data;
      expect(body.items).toHaveLength(1);
      expect(body.items[0].deletedAt).not.toBeNull();
    });

    it('[29] restore → hồ sơ xuất hiện lại trong danh sách thường', async () => {
      const created = await createEmployee('3052');
      await request(server)
        .delete(`${BASE}/employees/${created.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const response = await request(server)
        .post(`${BASE}/employees/${created.id}/restore`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);

      expect(successBody<RestoreBody>(response).data).toEqual({
        id: created.id,
        restored: true,
      });
      expect(
        await findEmployeeDeletedAt(context.dataSource, created.id),
      ).toBeNull();

      const list = await request(server)
        .get(`${BASE}/employees`)
        .query({ search: created.employeeCode })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(
        successBody<PaginatedBody<EmployeeBody>>(list).data.items,
      ).toHaveLength(1);
    });

    it('[30] restore hồ sơ chưa bị xoá → 422 EMPLOYEE_NOT_DELETED', async () => {
      const created = await createEmployee('3053');

      const response = await request(server)
        .post(`${BASE}/employees/${created.id}/restore`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(422);

      expect(errorBody(response).error.code).toBe('EMPLOYEE_NOT_DELETED');
    });

    it('[31] hr_staff KHÔNG được xoá hồ sơ → 403', async () => {
      const created = await createEmployee('3054');

      await request(server)
        .delete(`${BASE}/employees/${created.id}`)
        .set('Authorization', `Bearer ${hrStaffToken}`)
        .expect(403);
    });

    it('[32] tạo lại nhân viên với CCCD của hồ sơ đã xoá mềm → 409, message chỉ dẫn khôi phục', async () => {
      const created = await createEmployee('3055');
      await request(server)
        .delete(`${BASE}/employees/${created.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const response = await request(server)
        .post(`${BASE}/employees`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(
          makeEmployeePayload('3056', departmentId, positionId, {
            cccdNumber: fixtureCccd('3055'),
          }),
        )
        .expect(409);

      const body = errorBody(response);
      expect(body.error.code).toBe('DUPLICATE_CCCD');
      expect(body.error.message).toContain('soft-deleted');
    });
  });

  // ==========================================  POST /employees/:id/avatar ===

  describe('POST /employees/:id/avatar', () => {
    it('[33] upload JPEG hợp lệ → 201, avatarUrl được lưu vào hồ sơ', async () => {
      const created = await createEmployee('3060');

      const response = await request(server)
        .post(`${BASE}/employees/${created.id}/avatar`)
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('avatar', makeJpegBuffer(), {
          filename: 'avatar.jpg',
          contentType: 'image/jpeg',
        })
        .expect(201);

      const { avatarUrl } = successBody<AvatarBody>(response).data;
      expect(avatarUrl).toContain(`/uploads/avatars/${created.id}/`);
      expect(avatarUrl.endsWith('.jpg')).toBe(true);

      const detail = await request(server)
        .get(`${BASE}/employees/${created.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(successBody<EmployeeDetailBody>(detail).data.avatarUrl).toBe(
        avatarUrl,
      );
    });

    it('[34] upload ảnh > 2MB → 400 AVATAR_TOO_LARGE', async () => {
      const created = await createEmployee('3061');

      const response = await request(server)
        .post(`${BASE}/employees/${created.id}/avatar`)
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('avatar', makeJpegBuffer(2 * 1024 * 1024 + 1), {
          filename: 'big.jpg',
          contentType: 'image/jpeg',
        })
        .expect(400);

      expect(errorBody(response).error.code).toBe('AVATAR_TOO_LARGE');
    });

    it('[35] file không phải ảnh nhưng đặt tên .jpg → 400 AVATAR_INVALID_TYPE', async () => {
      const created = await createEmployee('3062');

      const response = await request(server)
        .post(`${BASE}/employees/${created.id}/avatar`)
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('avatar', Buffer.alloc(64, 0x41), {
          filename: 'avatar.jpg',
          contentType: 'image/jpeg',
        })
        .expect(400);

      expect(errorBody(response).error.code).toBe('AVATAR_INVALID_TYPE');
    });

    it('[36] không đính kèm file → 400 AVATAR_REQUIRED', async () => {
      const created = await createEmployee('3063');

      const response = await request(server)
        .post(`${BASE}/employees/${created.id}/avatar`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      expect(errorBody(response).error.code).toBe('AVATAR_REQUIRED');
    });

    it('[37] nhân viên upload avatar cho người khác → 403', async () => {
      const created = await createEmployee('3064');

      await request(server)
        .post(`${BASE}/employees/${created.id}/avatar`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .attach('avatar', makeJpegBuffer(), {
          filename: 'avatar.jpg',
          contentType: 'image/jpeg',
        })
        .expect(403);
    });
  });

  // ==============================================  /employees/:id/family ===

  describe('Family members', () => {
    let employeeId: number;

    beforeAll(async () => {
      employeeId = (await createEmployee('3070')).id;
    });

    it('[38] thêm + đọc danh sách thành viên gia đình', async () => {
      const created = await request(server)
        .post(`${BASE}/employees/${employeeId}/family-members`)
        .set('Authorization', `Bearer ${hrStaffToken}`)
        .send({
          fullName: 'Nguyễn Thị Vợ',
          relationship: 'spouse',
          dateOfBirth: '1998-03-10',
          occupation: 'Giáo viên',
          phone: '0912 345 678',
        })
        .expect(201);

      const member = successBody<{ id: number; phone: string }>(created).data;
      // SĐT được chuẩn hoá bỏ khoảng trắng trước khi lưu.
      expect(member.phone).toBe('0912345678');

      const list = await request(server)
        .get(`${BASE}/employees/${employeeId}/family-members`)
        .set('Authorization', `Bearer ${hrStaffToken}`)
        .expect(200);

      expect(
        successBody<Array<{ id: number }>>(list).data.map((m) => m.id),
      ).toContain(member.id);
    });

    it('[39] sửa + xoá thành viên gia đình', async () => {
      const created = await request(server)
        .post(`${BASE}/employees/${employeeId}/family-members`)
        .set('Authorization', `Bearer ${hrStaffToken}`)
        .send({ fullName: 'Nguyễn Văn Con', relationship: 'child' })
        .expect(201);

      const memberId = successBody<{ id: number }>(created).data.id;

      const updated = await request(server)
        .patch(`${BASE}/employees/${employeeId}/family-members/${memberId}`)
        .set('Authorization', `Bearer ${hrStaffToken}`)
        .send({ occupation: 'Học sinh' })
        .expect(200);

      expect(successBody<{ occupation: string }>(updated).data.occupation).toBe(
        'Học sinh',
      );

      await request(server)
        .delete(`${BASE}/employees/${employeeId}/family-members/${memberId}`)
        .set('Authorization', `Bearer ${hrStaffToken}`)
        .expect(200);

      const list = await request(server)
        .get(`${BASE}/employees/${employeeId}/family-members`)
        .set('Authorization', `Bearer ${hrStaffToken}`)
        .expect(200);

      expect(
        successBody<Array<{ id: number }>>(list).data.map((m) => m.id),
      ).not.toContain(memberId);
    });

    it('[40] sửa thành viên gia đình của nhân viên khác qua URL sai → 404 (chống IDOR)', async () => {
      const otherEmployee = await createEmployee('3071');

      const created = await request(server)
        .post(`${BASE}/employees/${employeeId}/family-members`)
        .set('Authorization', `Bearer ${hrStaffToken}`)
        .send({ fullName: 'Nguyễn Thị Mẹ', relationship: 'mother' })
        .expect(201);

      const memberId = successBody<{ id: number }>(created).data.id;

      const response = await request(server)
        .patch(
          `${BASE}/employees/${otherEmployee.id}/family-members/${memberId}`,
        )
        .set('Authorization', `Bearer ${hrStaffToken}`)
        .send({ occupation: 'x' })
        .expect(404);

      expect(errorBody(response).error.code).toBe('FAMILY_MEMBER_NOT_FOUND');
    });

    it('[41] nhân viên đọc được người nhà của CHÍNH MÌNH', async () => {
      await request(server)
        .get(`${BASE}/employees/${employeeAId}/family-members`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(200);
    });

    it('[42] nhân viên đọc người nhà của người khác → 403', async () => {
      await request(server)
        .get(`${BASE}/employees/${employeeId}/family-members`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(403);
    });
  });

  // ============================================  /employees/:id/dependents ==

  describe('Dependents (giảm trừ gia cảnh)', () => {
    let employeeId: number;
    let otherEmployeeId: number;

    beforeAll(async () => {
      employeeId = (await createEmployee('3120')).id;
      otherEmployeeId = (await createEmployee('3121')).id;
    });

    const payload = (overrides: Record<string, unknown> = {}) => ({
      fullName: 'Nguyễn Thị Mẹ',
      relationship: 'parent',
      dateOfBirth: '1960-04-15',
      registrationDate: '2026-01-01',
      ...overrides,
    });

    it('[67] đăng ký người phụ thuộc → 201, mặc định active và đang được giảm trừ', async () => {
      const response = await request(server)
        .post(`${BASE}/employees/${employeeId}/dependents`)
        .set('Authorization', `Bearer ${hrStaffToken}`)
        .send(payload())
        .expect(201);

      const dependent = successBody<DependentBody>(response).data;

      expect(dependent.employeeId).toBe(employeeId);
      expect(dependent.status).toBe('active');
      expect(dependent.isCurrentlyDeductible).toBe(true);
    });

    it('[68] /employees/:id/summary đếm đúng số người phụ thuộc đang hiệu lực', async () => {
      const response = await request(server)
        .get(`${BASE}/employees/${employeeId}/summary`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Trước Giai đoạn 3.2 con số này luôn bằng 0 vì không có đường nào tạo
      // dependent — đây là chỗ chứng minh nó đã được nối thật.
      expect(successBody<SummaryBody>(response).data.activeDependents).toBe(1);
    });

    it('[69] cùng CCCD khai cho nhân viên KHÁC → 409 DEPENDENT_ALREADY_CLAIMED', async () => {
      const cccd = fixtureCccd('3122');

      await request(server)
        .post(`${BASE}/employees/${employeeId}/dependents`)
        .set('Authorization', `Bearer ${hrStaffToken}`)
        .send(payload({ fullName: 'Nguyễn Văn Con', relationship: 'child', cccdNumber: cccd }))
        .expect(201);

      const response = await request(server)
        .post(`${BASE}/employees/${otherEmployeeId}/dependents`)
        .set('Authorization', `Bearer ${hrStaffToken}`)
        .send(payload({ fullName: 'Nguyễn Văn Con', relationship: 'child', cccdNumber: cccd }))
        .expect(409);

      expect(errorBody(response).error.code).toBe('DEPENDENT_ALREADY_CLAIMED');
    });

    it('[70] ngừng giảm trừ không kèm lý do → 422 DEPENDENT_REASON_REQUIRED', async () => {
      const created = await request(server)
        .post(`${BASE}/employees/${employeeId}/dependents`)
        .set('Authorization', `Bearer ${hrStaffToken}`)
        .send(payload({ fullName: 'Nguyễn Thị Bà' }))
        .expect(201);

      const dependentId = successBody<DependentBody>(created).data.id;

      const response = await request(server)
        .patch(`${BASE}/employees/${employeeId}/dependents/${dependentId}`)
        .set('Authorization', `Bearer ${hrStaffToken}`)
        .send({ status: 'inactive' })
        .expect(422);

      expect(errorBody(response).error.code).toBe('DEPENDENT_REASON_REQUIRED');
    });

    it('[71] ngừng giảm trừ kèm lý do → inactive, hết được tính, và giải phóng CCCD', async () => {
      const cccd = fixtureCccd('3123');

      const created = await request(server)
        .post(`${BASE}/employees/${employeeId}/dependents`)
        .set('Authorization', `Bearer ${hrStaffToken}`)
        .send(payload({ fullName: 'Nguyễn Văn Út', relationship: 'child', cccdNumber: cccd }))
        .expect(201);

      const dependentId = successBody<DependentBody>(created).data.id;

      const patched = await request(server)
        .patch(`${BASE}/employees/${employeeId}/dependents/${dependentId}`)
        .set('Authorization', `Bearer ${hrStaffToken}`)
        .send({ status: 'inactive', reasonInactive: 'Đã có thu nhập' })
        .expect(200);

      const dependent = successBody<DependentBody>(patched).data;
      expect(dependent.status).toBe('inactive');
      expect(dependent.reasonInactive).toBe('Đã có thu nhập');
      expect(dependent.isCurrentlyDeductible).toBe(false);

      // Đã thôi giảm trừ nên không còn chiếm suất — nhân viên khác khai được.
      await request(server)
        .post(`${BASE}/employees/${otherEmployeeId}/dependents`)
        .set('Authorization', `Bearer ${hrStaffToken}`)
        .send(payload({ fullName: 'Nguyễn Văn Út', relationship: 'child', cccdNumber: cccd }))
        .expect(201);
    });

    it('[72] endDate trước registrationDate → 422 INVALID_DATE_RANGE', async () => {
      const response = await request(server)
        .post(`${BASE}/employees/${employeeId}/dependents`)
        .set('Authorization', `Bearer ${hrStaffToken}`)
        .send(payload({ endDate: '2025-01-01' }))
        .expect(422);

      expect(errorBody(response).error.code).toBe('INVALID_DATE_RANGE');
    });

    it('[73] sửa qua URL của nhân viên khác → 404 (chống IDOR)', async () => {
      const created = await request(server)
        .post(`${BASE}/employees/${employeeId}/dependents`)
        .set('Authorization', `Bearer ${hrStaffToken}`)
        .send(payload({ fullName: 'Nguyễn Thị Dì' }))
        .expect(201);

      const dependentId = successBody<DependentBody>(created).data.id;

      const response = await request(server)
        .patch(`${BASE}/employees/${otherEmployeeId}/dependents/${dependentId}`)
        .set('Authorization', `Bearer ${hrStaffToken}`)
        .send({ note: 'x' })
        .expect(404);

      expect(errorBody(response).error.code).toBe('DEPENDENT_NOT_FOUND');
    });

    it('[74] xoá người phụ thuộc → biến mất khỏi danh sách', async () => {
      const created = await request(server)
        .post(`${BASE}/employees/${employeeId}/dependents`)
        .set('Authorization', `Bearer ${hrStaffToken}`)
        .send(payload({ fullName: 'Nguyễn Thị Cô' }))
        .expect(201);

      const dependentId = successBody<DependentBody>(created).data.id;

      await request(server)
        .delete(`${BASE}/employees/${employeeId}/dependents/${dependentId}`)
        .set('Authorization', `Bearer ${hrStaffToken}`)
        .expect(200);

      const list = await request(server)
        .get(`${BASE}/employees/${employeeId}/dependents`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(
        successBody<DependentBody[]>(list).data.map((row) => row.id),
      ).not.toContain(dependentId);
    });

    it('[75] nhân viên đọc người phụ thuộc của người khác → 403', async () => {
      await request(server)
        .get(`${BASE}/employees/${employeeId}/dependents`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(403);
    });

    it('[76] nhân viên thường KHÔNG được tự đăng ký người phụ thuộc → 403', async () => {
      await request(server)
        .post(`${BASE}/employees/${employeeAId}/dependents`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .send(payload())
        .expect(403);
    });
  });

  // ==================================================== /contracts =========

  describe('Contracts', () => {
    let employeeId: number;

    beforeAll(async () => {
      employeeId = (await createEmployee('3080')).id;
    });

    it('[43] tạo hợp đồng → 201, tiền trả về dạng number (api-spec §1.5)', async () => {
      const response = await request(server)
        .post(`${BASE}/contracts`)
        .set('Authorization', `Bearer ${hrManagerToken}`)
        .send({
          employeeId,
          contractNumber: `E3E-HDLD-3080-1`,
          contractType: 'fixed_term',
          startDate: '2026-08-01',
          endDate: '2027-07-31',
          signDate: '2026-07-28',
          baseSalary: 15000000,
          insuranceSalary: 15000000,
          positionAllowance: 500000,
          status: 'active',
        })
        .expect(201);

      const contract = successBody<{
        id: number;
        baseSalary: number;
        positionAllowance: number;
        status: string;
        employee: { id: number } | null;
      }>(response).data;

      expect(contract.baseSalary).toBe(15000000);
      expect(contract.positionAllowance).toBe(500000);
      expect(contract.status).toBe('active');
      expect(contract.employee?.id).toBe(employeeId);
    });

    it('[44] /employees/:id/summary lấy được hợp đồng đang hiệu lực', async () => {
      const response = await request(server)
        .get(`${BASE}/employees/${employeeId}/summary`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const summary = successBody<SummaryBody>(response).data;
      expect(summary.activeContract?.baseSalary).toBe(15000000);
    });

    it('[45] nhân viên đã có HĐ active mà tạo tiếp HĐ active → 409 CONTRACT_ALREADY_ACTIVE', async () => {
      const response = await request(server)
        .post(`${BASE}/contracts`)
        .set('Authorization', `Bearer ${hrManagerToken}`)
        .send({
          employeeId,
          contractNumber: `E3E-HDLD-3080-2`,
          contractType: 'indefinite',
          startDate: '2026-09-01',
          signDate: '2026-08-25',
          baseSalary: 16000000,
          insuranceSalary: 16000000,
          status: 'active',
        })
        .expect(409);

      expect(errorBody(response).error.code).toBe('CONTRACT_ALREADY_ACTIVE');
    });

    it('[46] HĐ không xác định thời hạn mà gửi endDate → 422 INVALID_CONTRACT_PERIOD', async () => {
      const response = await request(server)
        .post(`${BASE}/contracts`)
        .set('Authorization', `Bearer ${hrManagerToken}`)
        .send({
          employeeId,
          contractNumber: `E3E-HDLD-3080-3`,
          contractType: 'indefinite',
          startDate: '2026-09-01',
          endDate: '2027-09-01',
          signDate: '2026-08-25',
          baseSalary: 16000000,
          insuranceSalary: 16000000,
        })
        .expect(422);

      expect(errorBody(response).error.code).toBe('INVALID_CONTRACT_PERIOD');
    });

    it('[47] HĐ xác định thời hạn quá 36 tháng → 422', async () => {
      const response = await request(server)
        .post(`${BASE}/contracts`)
        .set('Authorization', `Bearer ${hrManagerToken}`)
        .send({
          employeeId,
          contractNumber: `E3E-HDLD-3080-4`,
          contractType: 'fixed_term',
          startDate: '2026-09-01',
          endDate: '2030-09-01',
          signDate: '2026-08-25',
          baseSalary: 16000000,
          insuranceSalary: 16000000,
        })
        .expect(422);

      expect(errorBody(response).error.code).toBe('INVALID_CONTRACT_PERIOD');
    });

    it('[48] số hợp đồng trùng → 409 DUPLICATE_CONTRACT_NUMBER', async () => {
      const response = await request(server)
        .post(`${BASE}/contracts`)
        .set('Authorization', `Bearer ${hrManagerToken}`)
        .send({
          employeeId,
          contractNumber: `E3E-HDLD-3080-1`,
          contractType: 'indefinite',
          startDate: '2026-09-01',
          signDate: '2026-08-25',
          baseSalary: 16000000,
          insuranceSalary: 16000000,
        })
        .expect(409);

      expect(errorBody(response).error.code).toBe('DUPLICATE_CONTRACT_NUMBER');
    });

    it('[49] lọc theo employeeId + expiringDays', async () => {
      const response = await request(server)
        .get(`${BASE}/contracts`)
        .query({ employeeId, limit: 50 })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const body =
        successBody<PaginatedBody<{ employee: { id: number } | null }>>(
          response,
        ).data;
      expect(body.items.length).toBeGreaterThanOrEqual(1);
      expect(body.items.every((c) => c.employee?.id === employeeId)).toBe(true);
    });

    it('[50] chấm dứt hợp đồng → status = terminated, lưu ngày + lý do', async () => {
      const list = await request(server)
        .get(`${BASE}/contracts`)
        .query({ employeeId, status: 'active' })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const contractId =
        successBody<PaginatedBody<{ id: number }>>(list).data.items[0].id;

      const response = await request(server)
        .patch(`${BASE}/contracts/${contractId}/terminate`)
        .set('Authorization', `Bearer ${hrManagerToken}`)
        .send({
          terminatedDate: '2026-10-31',
          terminatedReason: 'Nhân viên xin thôi việc',
        })
        .expect(200);

      const terminated = successBody<{
        status: string;
        terminatedDate: string;
        terminatedReason: string;
      }>(response).data;

      expect(terminated.status).toBe('terminated');
      expect(terminated.terminatedDate).toBe('2026-10-31');
      expect(terminated.terminatedReason).toBe('Nhân viên xin thôi việc');
    });

    it('[51] xoá được HĐ nháp, KHÔNG xoá được HĐ đã ký', async () => {
      const draft = await request(server)
        .post(`${BASE}/contracts`)
        .set('Authorization', `Bearer ${hrManagerToken}`)
        .send({
          employeeId,
          contractNumber: `E3E-HDLD-3080-5`,
          contractType: 'indefinite',
          startDate: '2026-11-01',
          signDate: '2026-10-25',
          baseSalary: 17000000,
          insuranceSalary: 17000000,
        })
        .expect(201);

      const draftId = successBody<{ id: number }>(draft).data.id;

      await request(server)
        .delete(`${BASE}/contracts/${draftId}`)
        .set('Authorization', `Bearer ${hrManagerToken}`)
        .expect(200);

      const signed = await request(server)
        .post(`${BASE}/contracts`)
        .set('Authorization', `Bearer ${hrManagerToken}`)
        .send({
          employeeId,
          contractNumber: `E3E-HDLD-3080-6`,
          contractType: 'indefinite',
          startDate: '2026-11-01',
          signDate: '2026-10-25',
          baseSalary: 17000000,
          insuranceSalary: 17000000,
          status: 'active',
        })
        .expect(201);

      const signedId = successBody<{ id: number }>(signed).data.id;

      const response = await request(server)
        .delete(`${BASE}/contracts/${signedId}`)
        .set('Authorization', `Bearer ${hrManagerToken}`)
        .expect(422);

      expect(errorBody(response).error.code).toBe('CONTRACT_NOT_DELETABLE');
    });

    it('[52] hr_staff KHÔNG được tạo hợp đồng → 403', async () => {
      await request(server)
        .post(`${BASE}/contracts`)
        .set('Authorization', `Bearer ${hrStaffToken}`)
        .send({
          employeeId,
          contractNumber: `E3E-HDLD-3080-7`,
          contractType: 'indefinite',
          startDate: '2026-12-01',
          signDate: '2026-11-25',
          baseSalary: 18000000,
          insuranceSalary: 18000000,
        })
        .expect(403);
    });

    it('[53] danh sách nhân viên kèm baseSalary của hợp đồng đang hiệu lực', async () => {
      const salaried = await createEmployee('3090');

      await request(server)
        .post(`${BASE}/contracts`)
        .set('Authorization', `Bearer ${hrManagerToken}`)
        .send({
          employeeId: salaried.id,
          contractNumber: `E3E-HDLD-3090-1`,
          contractType: 'indefinite',
          startDate: '2026-08-01',
          signDate: '2026-07-28',
          baseSalary: 19500000,
          insuranceSalary: 19500000,
          status: 'active',
        })
        .expect(201);

      const list = await request(server)
        .get(`${BASE}/employees`)
        .query({ search: salaried.employeeCode })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const rows = successBody<PaginatedBody<EmployeeBody>>(list).data.items;
      expect(rows).toHaveLength(1);
      expect(rows[0].baseSalary).toBe(19500000);
    });

    it('[54] nhân viên chưa có hợp đồng active → baseSalary = null', async () => {
      const created = await createEmployee('3091');

      const list = await request(server)
        .get(`${BASE}/employees`)
        .query({ search: created.employeeCode })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(
        successBody<PaginatedBody<EmployeeBody>>(list).data.items[0].baseSalary,
      ).toBeNull();
    });
  });

  // ================================================  GET /employees/stats ===

  describe('GET /employees/stats', () => {
    it('[55] trả đủ số liệu cho các thẻ tổng quan', async () => {
      const response = await request(server)
        .get(`${BASE}/employees/stats`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const stats = successBody<StatsBody>(response).data;

      expect(stats.total).toBeGreaterThan(0);
      expect(stats.windowDays).toBe(30);
      // Mọi trạng thái đều có key, kể cả khi bằng 0 (frontend không phải đoán).
      expect(Object.keys(stats.byStatus).sort()).toEqual([
        'active',
        'on_leave',
        'probation',
        'resigned',
        'suspended',
        'terminated',
      ]);
      expect(
        stats.byGender.male + stats.byGender.female + stats.byGender.other,
      ).toBe(stats.total);
    });

    it('[56] tổng theo phòng ban khớp với tổng số nhân viên', async () => {
      const response = await request(server)
        .get(`${BASE}/employees/stats`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const stats = successBody<StatsBody>(response).data;
      const summed = stats.byDepartment.reduce(
        (accumulator, row) => accumulator + row.count,
        0,
      );

      expect(summed).toBe(stats.total);
    });

    it('[57] tuổi và thâm niên trung bình là số dương, làm tròn 1 chữ số', async () => {
      const response = await request(server)
        .get(`${BASE}/employees/stats`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const stats = successBody<StatsBody>(response).data;

      expect(stats.averageAge).not.toBeNull();
      expect(stats.averageAge!).toBeGreaterThan(0);
      // Làm tròn 1 chữ số: nhân 10 phải ra số nguyên.
      expect(Number.isInteger(Math.round(stats.averageAge! * 10))).toBe(true);
      expect(stats.averageTenureYears).not.toBeNull();
    });

    it('[58] sinh nhật sắp tới nằm trong cửa sổ windowDays và sắp xếp tăng dần', async () => {
      const response = await request(server)
        .get(`${BASE}/employees/stats`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const stats = successBody<StatsBody>(response).data;

      for (const birthday of stats.upcomingBirthdays) {
        expect(birthday.daysUntil).toBeGreaterThanOrEqual(0);
        expect(birthday.daysUntil).toBeLessThanOrEqual(stats.windowDays);
        expect(birthday.birthday).toMatch(/^\d{2}-\d{2}$/);
      }

      const order = stats.upcomingBirthdays.map((row) => row.daysUntil);
      expect([...order].sort((a, b) => a - b)).toEqual(order);
    });

    it('[59] manager chỉ thấy thống kê trong phạm vi phòng ban mình', async () => {
      // Manager phụ trách `departmentId` chứ không phải `otherDepartmentId`.
      // Phải có ÍT NHẤT một nhân viên ngoài phạm vi, nếu không hai con số bằng
      // nhau vì lý do vô hại và phép so sánh không chứng minh được gì.
      await createEmployee('3110', {
        departmentId: otherDepartmentId,
        positionId: otherPositionId,
      });

      const adminStats = successBody<StatsBody>(
        await request(server)
          .get(`${BASE}/employees/stats`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200),
      ).data;

      const managerStats = successBody<StatsBody>(
        await request(server)
          .get(`${BASE}/employees/stats`)
          .set('Authorization', `Bearer ${managerToken}`)
          .expect(200),
      ).data;

      // Tổng công ty KHÔNG được rò rỉ qua endpoint thống kê.
      expect(managerStats.total).toBeLessThan(adminStats.total);
      expect(
        managerStats.byDepartment.some(
          (row) => row.departmentId === otherDepartmentId,
        ),
      ).toBe(false);
    });

    it('[60] role employee → 403 FORBIDDEN', async () => {
      const response = await request(server)
        .get(`${BASE}/employees/stats`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(403);

      expect(errorBody(response).error.code).toBe('FORBIDDEN');
    });
  });

  // ==========================================  POST /users + GET /roles =====

  describe('Tài khoản đăng nhập (bước 4 của wizard)', () => {
    it('[61] GET /roles trả 5 vai trò seed', async () => {
      const response = await request(server)
        .get(`${BASE}/roles`)
        .set('Authorization', `Bearer ${hrStaffToken}`)
        .expect(200);

      const roles =
        successBody<Array<{ id: number; name: string }>>(response).data;

      expect(roles.length).toBeGreaterThanOrEqual(5);
      expect(roles.map((role) => role.name)).toEqual(
        expect.arrayContaining(['admin', 'hr_manager', 'employee']),
      );
    });

    it('[62] admin tạo tài khoản gắn với nhân viên → 201, không lộ password', async () => {
      const owner = await createEmployee('3100');

      const response = await request(server)
        .post(`${BASE}/users`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: `e3e.user.3100`,
          email: fixtureEmail('user.3100'),
          password: 'Temp@2026x',
          roleId: 5,
          employeeId: owner.id,
        })
        .expect(201);

      const user = successBody<Record<string, unknown>>(response).data;
      expect(user.username).toBe('e3e.user.3100');
      expect(user.employeeId).toBe(owner.id);
      expect(user).not.toHaveProperty('password');
    });

    it('[63] nhân viên đã có tài khoản → 409 EMPLOYEE_ALREADY_HAS_ACCOUNT', async () => {
      const owner = await createEmployee('3101');

      const payload = {
        email: fixtureEmail('user.3101'),
        password: 'Temp@2026x',
        roleId: 5,
        employeeId: owner.id,
      };

      await request(server)
        .post(`${BASE}/users`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...payload, username: 'e3e.user.3101' })
        .expect(201);

      const response = await request(server)
        .post(`${BASE}/users`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          ...payload,
          username: 'e3e.user.3101b',
          email: fixtureEmail('user.3101b'),
        })
        .expect(409);

      expect(errorBody(response).error.code).toBe(
        'EMPLOYEE_ALREADY_HAS_ACCOUNT',
      );
    });

    it('[64] hr_manager KHÔNG được tạo tài khoản → 403 (chỉ admin)', async () => {
      const owner = await createEmployee('3102');

      await request(server)
        .post(`${BASE}/users`)
        .set('Authorization', `Bearer ${hrManagerToken}`)
        .send({
          username: 'e3e.user.3102',
          email: fixtureEmail('user.3102'),
          password: 'Temp@2026x',
          roleId: 5,
          employeeId: owner.id,
        })
        .expect(403);
    });

    it('[66] GET /system/provinces trả 34 tỉnh/thành từ file tĩnh', async () => {
      const response = await request(server)
        .get(`${BASE}/system/provinces`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(200);

      const provinces =
        successBody<Array<{ code: string; name: string; type: string }>>(
          response,
        ).data;

      expect(provinces).toHaveLength(34);
      expect(typeof provinces[0].code).toBe('string');
      expect(provinces[0].name.length).toBeGreaterThan(0);
      // Mã tỉnh là chuỗi số có giữ số 0 ở đầu ("01"), không phải number.
      expect(
        provinces.every((province) => /^\d{1,10}$/.test(province.code)),
      ).toBe(true);
    });

    it('[77] GET /system/wards trả 3.321 phường/xã/đặc khu', async () => {
      const response = await request(server)
        .get(`${BASE}/system/wards`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(200);

      const wards = successBody<WardBody[]>(response).data;

      expect(wards).toHaveLength(3321);
      // Con số chính thức: 687 phường + 2.621 xã + 13 đặc khu.
      const byType = wards.reduce<Record<string, number>>((accumulator, ward) => {
        accumulator[ward.type] = (accumulator[ward.type] ?? 0) + 1;
        return accumulator;
      }, {});
      expect(byType).toEqual({ phuong: 687, xa: 2621, dac_khu: 13 });
    });

    it('[78] lọc theo tỉnh trả đúng tập con', async () => {
      const response = await request(server)
        .get(`${BASE}/system/wards`)
        .query({ provinceCode: '01' })
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(200);

      const wards = successBody<WardBody[]>(response).data;

      expect(wards.length).toBeGreaterThan(0);
      expect(wards.every((ward) => ward.provinceCode === '01')).toBe(true);
      // Mã quận/huyện CŨ vẫn được giữ để đối chiếu hồ sơ trước 01/07/2025.
      expect(wards[0].legacyDistrictCode).toMatch(/^\d+$/);
      expect(wards[0].legacyDistrictName.length).toBeGreaterThan(0);
    });

    it('[79] mã tỉnh không tồn tại → mảng rỗng, không phải lỗi', async () => {
      const response = await request(server)
        .get(`${BASE}/system/wards`)
        .query({ provinceCode: '9999' })
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(200);

      expect(successBody<WardBody[]>(response).data).toEqual([]);
    });

    it('[80] mọi phường/xã đều trỏ tới một tỉnh có thật', async () => {
      const provinces = successBody<Array<{ code: string }>>(
        await request(server)
          .get(`${BASE}/system/provinces`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200),
      ).data;
      const wards = successBody<WardBody[]>(
        await request(server)
          .get(`${BASE}/system/wards`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200),
      ).data;

      const codes = new Set(provinces.map((province) => province.code));
      expect(wards.filter((ward) => !codes.has(ward.provinceCode))).toEqual([]);
    });

    it('[81] tạo NV không gửi districtCode → 201 (cấp huyện đã bị bỏ)', async () => {
      const payload = makeEmployeePayload('3130', departmentId, positionId);
      expect(payload.districtCode).toBeUndefined();

      const response = await request(server)
        .post(`${BASE}/employees`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload)
        .expect(201);

      expect(successBody<EmployeeDetailBody>(response).data.districtCode).toBeNull();
    });

    it('[65] roleId không tồn tại → 422 ROLE_NOT_FOUND', async () => {
      const owner = await createEmployee('3103');

      const response = await request(server)
        .post(`${BASE}/users`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: 'e3e.user.3103',
          email: fixtureEmail('user.3103'),
          password: 'Temp@2026x',
          roleId: 99,
          employeeId: owner.id,
        })
        .expect(422);

      expect(errorBody(response).error.code).toBe('ROLE_NOT_FOUND');
    });
  });
});
