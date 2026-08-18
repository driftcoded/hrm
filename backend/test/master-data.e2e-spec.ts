import * as request from 'supertest';
import { App } from 'supertest/types';
import {
  cleanupSeedRefreshTokens,
  createE2eApp,
  E2eContext,
  errorBody,
  SEED_USERS,
  successBody,
} from './support/e2e-app';
import {
  cleanupMasterDataFixtures,
  countFixtureEmployee,
  DeleteBody,
  FIXTURE_HOLIDAY_YEAR,
  insertFixtureDepartment,
  insertFixtureEmployee,
  insertFixturePosition,
  loginAs,
  PaginatedBody,
} from './support/master-data-fixtures';

interface PositionBody {
  id: number;
  code: string;
  name: string;
  department: { id: number; name: string } | null;
  level: number;
  minSalary: number | null;
  maxSalary: number | null;
  description: string | null;
  isActive: boolean;
}

interface LeaveTypeBody {
  id: number;
  code: string;
  name: string;
  daysPerYear: number;
  isPaid: boolean;
  requireApproval: boolean;
  minDays: number;
  maxConsecutive: number | null;
  advanceNoticeDays: number;
  applicableGender: 'all' | 'female' | 'male';
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  isSystem: boolean;
}

interface HolidayBody {
  id: number;
  name: string;
  holidayDate: string;
  type: string;
  year: number;
  isPaid: boolean;
  note: string | null;
}

interface ContractTypeBody {
  value: string;
  label: string;
  description: string;
}

/**
 * Phase 2.1 – `/positions`, `/contract-types`, `/leave-types`, `/holidays`
 * and the `/system/*` aliases.
 *
 * Fixtures use the E2E prefix (holidays use year 2099) and are deleted in
 * beforeAll + afterAll so the suite is rerunnable and never touches Phase 1
 * seed data.
 */
describe('Positions / contract types / leave types / holidays (e2e)', () => {
  let context: E2eContext;
  let server: App;

  let adminToken: string;
  let hrManagerToken: string;
  let employeeToken: string;

  let departmentId: number;
  let positionId: number;

  const EMPLOYEE_SUFFIX = '9002';

  beforeAll(async () => {
    context = await createE2eApp();
    server = context.app.getHttpServer() as App;
    await context.cache.reset();
    await cleanupMasterDataFixtures(context.dataSource);

    departmentId = await insertFixtureDepartment(
      context.dataSource,
      'E2EM_DEP',
      'E2E Phòng master data',
    );
    positionId = await insertFixturePosition(
      context.dataSource,
      'E2EM_POS',
      'E2E Chức vụ có người giữ',
      departmentId,
      2,
    );
    await insertFixtureEmployee(
      context.dataSource,
      EMPLOYEE_SUFFIX,
      departmentId,
      positionId,
    );

    adminToken = await loginAs(server, SEED_USERS.admin);
    hrManagerToken = await loginAs(server, SEED_USERS.hrManager);
    employeeToken = await loginAs(server, SEED_USERS.employeeA);
  });

  afterAll(async () => {
    await cleanupMasterDataFixtures(context.dataSource);
    await cleanupSeedRefreshTokens(context.dataSource);
    await context.cache.reset();
    await context.app.close();
  });

  const get = (path: string, token?: string) => {
    const req = request(server).get(`/api/v1${path}`);
    return token ? req.set('Authorization', `Bearer ${token}`) : req;
  };

  const post = (path: string, token: string) =>
    request(server)
      .post(`/api/v1${path}`)
      .set('Authorization', `Bearer ${token}`);

  const patch = (path: string, token: string) =>
    request(server)
      .patch(`/api/v1${path}`)
      .set('Authorization', `Bearer ${token}`);

  const del = (path: string, token: string) =>
    request(server)
      .delete(`/api/v1${path}`)
      .set('Authorization', `Bearer ${token}`);

  // ------------------------------------------------------------- POSITIONS ---

  describe('/positions', () => {
    it('GET returns pagination + nested department + salary as a number', async () => {
      const response = await get(
        `/positions?departmentId=${departmentId}`,
        adminToken,
      ).expect(200);

      const body = successBody<PaginatedBody<PositionBody>>(response);
      expect(body.data.meta).toMatchObject({ page: 1, limit: 20 });

      const position = body.data.items.find((item) => item.code === 'E2EM_POS');
      expect(position).toMatchObject({
        id: positionId,
        level: 2,
        department: { id: departmentId, name: 'E2E Phòng master data' },
      });
      expect(position).not.toHaveProperty('deletedAt');
    });

    it('POST → PATCH → DELETE full lifecycle', async () => {
      const created = successBody<PositionBody>(
        await post('/positions', adminToken)
          .send({
            code: 'e2em_tmp',
            name: 'E2E Chức vụ tạm',
            departmentId,
            level: 3,
            minSalary: 20000000,
            maxSalary: 35000000,
          })
          .expect(201),
      ).data;

      expect(created).toMatchObject({
        code: 'E2EM_TMP',
        level: 3,
        minSalary: 20000000,
        maxSalary: 35000000,
      });

      const updated = successBody<PositionBody>(
        await patch(`/positions/${created.id}`, hrManagerToken)
          .send({ level: 4, maxSalary: 50000000 })
          .expect(200),
      ).data;
      expect(updated).toMatchObject({ level: 4, maxSalary: 50000000 });

      const deleted = successBody<DeleteBody>(
        await del(`/positions/${created.id}`, adminToken).expect(200),
      ).data;
      expect(deleted).toEqual({ id: created.id, deleted: true });

      await get(`/positions/${created.id}`, adminToken).expect(404);
    });

    it('POST with a duplicate code → 409 DUPLICATE_POSITION_CODE', async () => {
      const response = await post('/positions', adminToken)
        .send({ code: 'E2EM_POS', name: 'Trùng mã', departmentId, level: 1 })
        .expect(409);

      expect(errorBody(response).error.code).toBe('DUPLICATE_POSITION_CODE');
    });

    it('POST with a non-existent departmentId → 422 DEPARTMENT_NOT_FOUND', async () => {
      const response = await post('/positions', adminToken)
        .send({
          code: 'E2EM_BAD',
          name: 'Sai phòng ban',
          departmentId: 99999999,
          level: 1,
        })
        .expect(422);

      expect(errorBody(response).error.code).toBe('DEPARTMENT_NOT_FOUND');
    });

    it('POST minSalary > maxSalary → 422 INVALID_SALARY_RANGE', async () => {
      const response = await post('/positions', adminToken)
        .send({
          code: 'E2EM_SAL',
          name: 'Sai thang lương',
          departmentId,
          level: 1,
          minSalary: 50000000,
          maxSalary: 10000000,
        })
        .expect(422);

      expect(errorBody(response).error.code).toBe('INVALID_SALARY_RANGE');
    });

    it('POST with level outside 1..5 → 400 VALIDATION_ERROR', async () => {
      const response = await post('/positions', adminToken)
        .send({ code: 'E2EM_LVL', name: 'Level sai', departmentId, level: 9 })
        .expect(400);

      expect(errorBody(response).error.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'level', code: 'OUT_OF_RANGE' }),
        ]),
      );
    });

    it('DELETE a position that STILL HAS AN EMPLOYEE → 422 POSITION_HAS_EMPLOYEES, employee remains intact', async () => {
      const response = await del(`/positions/${positionId}`, adminToken).expect(
        422,
      );

      expect(errorBody(response).error.code).toBe('POSITION_HAS_EMPLOYEES');
      expect(
        await countFixtureEmployee(context.dataSource, EMPLOYEE_SUFFIX),
      ).toBe(1);
      await get(`/positions/${positionId}`, adminToken).expect(200);
    });

    it('limit > 100 → 400 VALIDATION_ERROR', async () => {
      await get('/positions?limit=101', adminToken).expect(400);
    });

    it('authorization: employee CAN GET, POST/PATCH/DELETE → 403', async () => {
      await get('/positions', employeeToken).expect(200);
      await post('/positions', employeeToken)
        .send({ code: 'E2EM_NO', name: 'x', departmentId, level: 1 })
        .expect(403);
      await patch(`/positions/${positionId}`, employeeToken)
        .send({ name: 'x' })
        .expect(403);
      await del(`/positions/${positionId}`, employeeToken).expect(403);
    });
  });

  // --------------------------------------------------------- CONTRACT TYPES ---

  describe('/contract-types (read-only)', () => {
    it('GET returns all 4 contract types with Vietnamese labels', async () => {
      const response = await get('/contract-types', employeeToken).expect(200);
      const data = successBody<ContractTypeBody[]>(response).data;

      expect(data.map((item) => item.value)).toEqual([
        'probation',
        'fixed_term',
        'indefinite',
        'seasonal',
      ]);
      for (const item of data) {
        expect(item.label.length).toBeGreaterThan(0);
        expect(item.description.length).toBeGreaterThan(0);
      }
    });

    it('no token → 401', async () => {
      await get('/contract-types').expect(401);
    });

    it('no write endpoint exists: POST /contract-types → 404', async () => {
      await post('/contract-types', adminToken)
        .send({ value: 'x' })
        .expect(404);
    });
  });

  // ------------------------------------------------------------ LEAVE TYPES ---

  describe('/leave-types', () => {
    it('GET returns an ARRAY of the 9 seeded leave types (api-spec §8)', async () => {
      const response = await get('/leave-types', employeeToken).expect(200);
      const data = successBody<LeaveTypeBody[]>(response).data;

      expect(Array.isArray(data)).toBe(true);
      const codes = data.map((item) => item.code);
      expect(codes).toEqual(
        expect.arrayContaining([
          'ANNUAL',
          'SICK',
          'MATERNITY',
          'PATERNITY',
          'MARRIAGE',
          'CHILD_MARRIAGE',
          'BEREAVEMENT',
          'UNPAID',
          'COMPENSATORY',
        ]),
      );

      const annual = data.find((item) => item.code === 'ANNUAL');
      expect(annual).toMatchObject({
        daysPerYear: 12,
        isPaid: true,
        requireApproval: true,
        minDays: 0.5,
        isSystem: true,
      });
      expect(annual?.description).toContain('Điều 113');

      expect(data.find((item) => item.code === 'MATERNITY')).toMatchObject({
        applicableGender: 'female',
        daysPerYear: 180,
      });
      expect(data.find((item) => item.code === 'PATERNITY')).toMatchObject({
        applicableGender: 'male',
        daysPerYear: 5,
      });
      expect(data.find((item) => item.code === 'UNPAID')).toMatchObject({
        isPaid: false,
        daysPerYear: 0,
      });
    });

    it('GET ?applicableGender=female returns only female-applicable types', async () => {
      const response = await get(
        '/leave-types?applicableGender=female',
        adminToken,
      ).expect(200);

      const data = successBody<LeaveTypeBody[]>(response).data;
      expect(data.length).toBeGreaterThan(0);
      expect(data.every((item) => item.applicableGender === 'female')).toBe(
        true,
      );
    });

    it('POST → PATCH → DELETE full lifecycle', async () => {
      const created = successBody<LeaveTypeBody>(
        await post('/leave-types', hrManagerToken)
          .send({
            code: 'e2em_lv',
            name: 'E2E Nghỉ thử nghiệm',
            daysPerYear: 2.5,
            isPaid: false,
            advanceNoticeDays: 0,
            maxConsecutive: 2,
            description: 'fixture e2e',
          })
          .expect(201),
      ).data;

      expect(created).toMatchObject({
        code: 'E2EM_LV',
        daysPerYear: 2.5,
        isPaid: false,
        advanceNoticeDays: 0,
        maxConsecutive: 2,
        applicableGender: 'all',
        isSystem: false,
      });

      const updated = successBody<LeaveTypeBody>(
        await patch(`/leave-types/${created.id}`, adminToken)
          .send({ daysPerYear: 4, isActive: false })
          .expect(200),
      ).data;
      expect(updated).toMatchObject({ daysPerYear: 4, isActive: false });

      await patch(`/leave-types/${created.id}`, adminToken)
        .send({ name: null })
        .expect(400)
        .then((response) => {
          expect(errorBody(response).error.code).toBe('VALIDATION_ERROR');
        });

      const deleted = successBody<DeleteBody>(
        await del(`/leave-types/${created.id}`, adminToken).expect(200),
      ).data;
      expect(deleted).toEqual({ id: created.id, deleted: true });

      await get(`/leave-types/${created.id}`, adminToken).expect(404);
    });

    it('statutory leave type (isSystem=true): code cannot be changed, cannot be deleted', async () => {
      const before = successBody<LeaveTypeBody[]>(
        await get('/leave-types', adminToken).expect(200),
      ).data.find((item) => item.code === 'ANNUAL');
      expect(before).toBeDefined();

      const renameResponse = await patch(
        `/leave-types/${before?.id}`,
        adminToken,
      )
        .send({ code: 'ANNUAL_LEAVE' })
        .expect(403);
      expect(errorBody(renameResponse).error.code).toBe(
        'LEAVE_TYPE_SYSTEM_LOCKED',
      );

      const deleteResponse = await del(
        `/leave-types/${before?.id}`,
        adminToken,
      ).expect(403);
      expect(errorBody(deleteResponse).error.code).toBe(
        'LEAVE_TYPE_SYSTEM_LOCKED',
      );

      const after = successBody<LeaveTypeBody>(
        await get(`/leave-types/${before?.id}`, adminToken).expect(200),
      ).data;
      expect(after.code).toBe('ANNUAL');
    });

    it('POST duplicate code of a seeded type → 409 DUPLICATE_LEAVE_TYPE_CODE', async () => {
      const response = await post('/leave-types', adminToken)
        .send({ code: 'ANNUAL', name: 'Trùng mã', daysPerYear: 1 })
        .expect(409);

      expect(errorBody(response).error.code).toBe('DUPLICATE_LEAVE_TYPE_CODE');
    });

    it('authorization: employee CAN GET, POST → 403', async () => {
      await get('/leave-types', employeeToken).expect(200);
      await post('/leave-types', employeeToken)
        .send({ code: 'E2EM_NO2', name: 'x', daysPerYear: 1 })
        .expect(403);
    });
  });

  // --------------------------------------------------------------- HOLIDAYS ---

  describe('/holidays', () => {
    let holidayId: number;

    it('POST infers year automatically from holidayDate', async () => {
      const created = successBody<HolidayBody>(
        await post('/holidays', adminToken)
          .send({
            name: 'E2E Ngày lễ fixture',
            holidayDate: `${FIXTURE_HOLIDAY_YEAR}-03-15`,
            type: 'company',
            note: 'fixture e2e',
          })
          .expect(201),
      ).data;

      expect(created).toMatchObject({
        name: 'E2E Ngày lễ fixture',
        holidayDate: `${FIXTURE_HOLIDAY_YEAR}-03-15`,
        year: FIXTURE_HOLIDAY_YEAR,
        type: 'company',
        isPaid: true,
      });

      holidayId = created.id;
    });

    it('POST with a duplicate date → 409 DUPLICATE_HOLIDAY_DATE', async () => {
      const response = await post('/holidays', adminToken)
        .send({
          name: 'E2E Trùng ngày',
          holidayDate: `${FIXTURE_HOLIDAY_YEAR}-03-15`,
        })
        .expect(409);

      expect(errorBody(response).error.code).toBe('DUPLICATE_HOLIDAY_DATE');
    });

    it('POST with a calendar date that does not exist → 400 VALIDATION_ERROR INVALID_DATE', async () => {
      const response = await post('/holidays', adminToken)
        .send({
          name: 'E2E 30/2',
          holidayDate: `${FIXTURE_HOLIDAY_YEAR}-02-30`,
        })
        .expect(400);

      expect(errorBody(response).error.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'holidayDate',
            code: 'INVALID_DATE',
          }),
        ]),
      );
    });

    it('GET ?year= filters by the exact year, without mixing in the seeded 2025/2026 holidays', async () => {
      const response = await get(
        `/holidays?year=${FIXTURE_HOLIDAY_YEAR}`,
        employeeToken,
      ).expect(200);

      const body = successBody<PaginatedBody<HolidayBody>>(response);
      expect(body.data.items).toHaveLength(1);
      expect(body.data.items[0]).toMatchObject({
        year: FIXTURE_HOLIDAY_YEAR,
        holidayDate: `${FIXTURE_HOLIDAY_YEAR}-03-15`,
      });
    });

    it('GET ?year=2026 still returns the full seeded holiday calendar (11 days)', async () => {
      const response = await get(
        '/holidays?year=2026&limit=100',
        adminToken,
      ).expect(200);

      const body = successBody<PaginatedBody<HolidayBody>>(response);
      expect(body.data.meta.total).toBe(11);
      expect(body.data.items[0].holidayDate).toBe('2026-01-01');
    });

    it('PATCH changing the date → year is recalculated', async () => {
      const updated = successBody<HolidayBody>(
        await patch(`/holidays/${holidayId}`, hrManagerToken)
          .send({ holidayDate: `${FIXTURE_HOLIDAY_YEAR}-12-31`, isPaid: false })
          .expect(200),
      ).data;

      expect(updated).toMatchObject({
        holidayDate: `${FIXTURE_HOLIDAY_YEAR}-12-31`,
        year: FIXTURE_HOLIDAY_YEAR,
        isPaid: false,
      });
    });

    it('DELETE permanently removes the fixture holiday', async () => {
      const deleted = successBody<DeleteBody>(
        await del(`/holidays/${holidayId}`, adminToken).expect(200),
      ).data;

      expect(deleted).toEqual({ id: holidayId, deleted: true });
      await get(`/holidays/${holidayId}`, adminToken).expect(404);
    });

    it('authorization: employee CAN GET, POST/DELETE → 403', async () => {
      await get('/holidays', employeeToken).expect(200);
      await post('/holidays', employeeToken)
        .send({ name: 'x', holidayDate: `${FIXTURE_HOLIDAY_YEAR}-05-05` })
        .expect(403);
      await del('/holidays/1', employeeToken).expect(403);
    });
  });

  // ------------------------------------------------------- /system aliases ---

  describe('/system (api-spec §20)', () => {
    it('GET /system/holidays?year=2026 returns a flat array ordered by date', async () => {
      const response = await get(
        '/system/holidays?year=2026',
        employeeToken,
      ).expect(200);

      const data = successBody<HolidayBody[]>(response).data;
      expect(Array.isArray(data)).toBe(true);
      expect(data).toHaveLength(11);
      expect(data[0].holidayDate).toBe('2026-01-01');
    });

    it('GET /system/leave-types returns only active types', async () => {
      const response = await get('/system/leave-types', employeeToken).expect(
        200,
      );

      const data = successBody<LeaveTypeBody[]>(response).data;
      expect(data.length).toBeGreaterThanOrEqual(9);
      expect(data.every((item) => item.isActive)).toBe(true);
    });

    it('no token → 401', async () => {
      await get('/system/holidays').expect(401);
      await get('/system/leave-types').expect(401);
    });
  });
});
