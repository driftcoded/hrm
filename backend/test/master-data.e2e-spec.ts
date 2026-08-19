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
  codeNumber,
  countFixtureEmployee,
  DeleteBody,
  FIXTURE_HOLIDAY_YEAR,
  insertFixtureDepartment,
  insertFixtureEmployee,
  insertFixtureLeaveBalance,
  insertFixtureLeaveType,
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
 * seed data — in particular the nine statutory leave types, which are edited
 * and deleted only on our own `is_system = TRUE` fixture, never on `ANNUAL`.
 *
 * `positions.code` / `leave_types.code` are SERVER-GENERATED (`CV0001`,
 * `NP0001`…) and immutable, so records created through the API carry a generated
 * code rather than an `E2E…` one; cleanup matches their `E2E…` NAME instead.
 * Code assertions are relative (pattern, or `previous + 1`) because generated
 * numbers are never reused and every run consumes some.
 */
describe('Positions / contract types / leave types / holidays (e2e)', () => {
  let context: E2eContext;
  let server: App;

  let adminToken: string;
  let hrManagerToken: string;
  let employeeToken: string;

  let departmentId: number;
  let positionId: number;
  let employeeId: number;

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
    employeeId = await insertFixtureEmployee(
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

    /**
     * The client deliberately sends a `code`: it must be dropped (ValidationPipe
     * `whitelist: true`) and the stored code must be the generated `CV####`, so
     * a user cannot choose their own identifier. PATCH cannot change it either.
     */
    it('POST → PATCH → DELETE full lifecycle, with a server-generated immutable code', async () => {
      const created = successBody<PositionBody>(
        await post('/positions', adminToken)
          .send({
            code: 'CHOSEN_BY_USER',
            name: 'E2E Chức vụ tạm',
            departmentId,
            level: 3,
            minSalary: 20000000,
            maxSalary: 35000000,
          })
          .expect(201),
      ).data;

      expect(created).toMatchObject({
        level: 3,
        minSalary: 20000000,
        maxSalary: 35000000,
      });
      expect(created.code).toMatch(/^CV\d{4}$/);
      expect(created.code).not.toBe('CHOSEN_BY_USER');

      const updated = successBody<PositionBody>(
        await patch(`/positions/${created.id}`, hrManagerToken)
          .send({ level: 4, maxSalary: 50000000, code: 'CV9998' })
          .expect(200),
      ).data;
      expect(updated).toMatchObject({ level: 4, maxSalary: 50000000 });
      // The code in the PATCH body was ignored, the rest of it applied.
      expect(updated.code).toBe(created.code);

      const deleted = successBody<DeleteBody>(
        await del(`/positions/${created.id}`, adminToken).expect(200),
      ).data;
      expect(deleted).toEqual({ id: created.id, deleted: true });

      await get(`/positions/${created.id}`, adminToken).expect(404);
    });

    /**
     * Codes increment and a soft-deleted position keeps its code reserved for
     * good — reusing one would give a new position an identifier that other
     * records still refer to. Relative assertions only: every run permanently
     * consumes numbers.
     */
    it('POST issues consecutive codes, and a soft-deleted position never releases its own', async () => {
      const body = { name: 'E2E Chức vụ mã', departmentId, level: 1 };

      const first = successBody<PositionBody>(
        await post('/positions', adminToken).send(body).expect(201),
      ).data;
      const firstNumber = codeNumber(first.code, 'CV');

      const second = successBody<PositionBody>(
        await post('/positions', adminToken).send(body).expect(201),
      ).data;
      expect(codeNumber(second.code, 'CV')).toBe(firstNumber + 1);

      await del(`/positions/${second.id}`, adminToken).expect(200);

      const third = successBody<PositionBody>(
        await post('/positions', adminToken).send(body).expect(201),
      ).data;
      expect(third.code).not.toBe(second.code);
      expect(codeNumber(third.code, 'CV')).toBe(firstNumber + 2);

      await del(`/positions/${first.id}`, adminToken).expect(200);
      await del(`/positions/${third.id}`, adminToken).expect(200);
    });

    it('POST with a non-existent departmentId → 422 DEPARTMENT_NOT_FOUND', async () => {
      const response = await post('/positions', adminToken)
        .send({
          name: 'E2EM_BAD Sai phòng ban',
          departmentId: 99999999,
          level: 1,
        })
        .expect(422);

      expect(errorBody(response).error.code).toBe('DEPARTMENT_NOT_FOUND');
    });

    it('POST minSalary > maxSalary → 422 INVALID_SALARY_RANGE', async () => {
      const response = await post('/positions', adminToken)
        .send({
          name: 'E2EM_SAL Sai thang lương',
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
        .send({ name: 'E2EM_LVL Level sai', departmentId, level: 9 })
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
        .send({ name: 'E2EM_NO', departmentId, level: 1 })
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

    /**
     * One test covers the whole code contract on purpose: `leave_types.id` is a
     * TINYINT and generated ids are never reused, so each e2e run permanently
     * burns a few of the 255 available. Creating two rows here is enough to
     * prove pattern + "client code ignored" + increment.
     */
    it('POST → PATCH → DELETE full lifecycle, with a server-generated immutable code that increments', async () => {
      const created = successBody<LeaveTypeBody>(
        await post('/leave-types', hrManagerToken)
          .send({
            code: 'ANNUAL', // must be stripped, not honoured (and not a 409)
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
        daysPerYear: 2.5,
        isPaid: false,
        advanceNoticeDays: 0,
        maxConsecutive: 2,
        applicableGender: 'all',
        isSystem: false,
      });
      expect(created.code).toMatch(/^NP\d{4}$/);
      expect(created.code).not.toBe('ANNUAL');

      // The next one gets the following number; the statutory codes (ANNUAL,
      // SICK…) do not match `NP####` and are ignored by the counter.
      const next = successBody<LeaveTypeBody>(
        await post('/leave-types', hrManagerToken)
          .send({ name: 'E2E Nghỉ thử nghiệm 2', daysPerYear: 1 })
          .expect(201),
      ).data;
      expect(codeNumber(next.code, 'NP')).toBe(
        codeNumber(created.code, 'NP') + 1,
      );
      await del(`/leave-types/${next.id}`, adminToken).expect(200);

      const updated = successBody<LeaveTypeBody>(
        await patch(`/leave-types/${created.id}`, adminToken)
          .send({ daysPerYear: 4, isActive: false, code: 'NP9998' })
          .expect(200),
      ).data;
      expect(updated).toMatchObject({ daysPerYear: 4, isActive: false });
      // The code in the PATCH body was ignored, the rest of it applied.
      expect(updated.code).toBe(created.code);

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

    /**
     * `isSystem` is informational only — it blocks nothing. Legislation changes:
     * entitlements are raised and statutory types get repealed (BLLĐ 2019
     * abolished the `seasonal` contract type the same way), so HR must be able to
     * maintain these rows. The ONLY delete guard is LEAVE_TYPE_IN_USE.
     *
     * Exercised on our own `is_system = TRUE` fixture, never on a seeded type:
     * the nine statutory rows are shared data the project owner depends on and
     * must survive the run untouched.
     */
    it('a statutory (isSystem=true) type is editable, and deletable once nothing references it', async () => {
      const systemTypeId = await insertFixtureLeaveType(
        context.dataSource,
        'E2EM_SYS',
        'E2E Nghỉ theo luật',
        true,
      );

      expect(
        successBody<LeaveTypeBody>(
          await get(`/leave-types/${systemTypeId}`, adminToken).expect(200),
        ).data.isSystem,
      ).toBe(true);

      // A leave balance references it → still undeletable, for the right reason.
      await insertFixtureLeaveBalance(
        context.dataSource,
        employeeId,
        systemTypeId,
      );
      const inUse = await del(
        `/leave-types/${systemTypeId}`,
        adminToken,
      ).expect(422);
      expect(errorBody(inUse).error.code).toBe('LEAVE_TYPE_IN_USE');

      // Editable even while in use – "the law raised the entitlement".
      const updated = successBody<LeaveTypeBody>(
        await patch(`/leave-types/${systemTypeId}`, adminToken)
          .send({ daysPerYear: 16 })
          .expect(200),
      ).data;
      expect(updated).toMatchObject({ daysPerYear: 16, isSystem: true });
      // A statutory code predates generation and is left alone.
      expect(updated.code).toBe('E2EM_SYS');

      // Drop the reference → the repealed type can now be retired.
      await context.dataSource.query(
        `DELETE FROM leave_balances WHERE leave_type_id = ?`,
        [systemTypeId],
      );
      expect(
        successBody<DeleteBody>(
          await del(`/leave-types/${systemTypeId}`, adminToken).expect(200),
        ).data,
      ).toEqual({ id: systemTypeId, deleted: true });
      await get(`/leave-types/${systemTypeId}`, adminToken).expect(404);

      // The seeded statutory rows are untouched.
      const remaining = successBody<LeaveTypeBody[]>(
        await get('/leave-types', adminToken).expect(200),
      ).data;
      expect(remaining.find((item) => item.code === 'ANNUAL')).toMatchObject({
        code: 'ANNUAL',
        isSystem: true,
      });
    });

    it('authorization: employee CAN GET, POST → 403', async () => {
      await get('/leave-types', employeeToken).expect(200);
      await post('/leave-types', employeeToken)
        .send({ name: 'E2EM_NO2', daysPerYear: 1 })
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
