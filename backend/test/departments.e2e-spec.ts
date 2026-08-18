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
  findDepartmentDeletedAt,
  insertFixtureDepartment,
  insertFixtureEmployee,
  insertFixturePosition,
  loginAs,
  PaginatedBody,
} from './support/master-data-fixtures';

interface DepartmentBody {
  id: number;
  code: string;
  name: string;
  description: string | null;
  parentId: number | null;
  manager: { id: number; fullName: string } | null;
  employeeCount: number;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface DepartmentTreeBody extends DepartmentBody {
  children: DepartmentTreeBody[];
}

/**
 * Phase 2.1 – `/departments`.
 *
 * Fixture: tree E2ED_ROOT → E2ED_CHILD → E2ED_GRAND, one position E2ED_POS
 * under E2ED_GRAND, one employee E2E9001 under E2ED_CHILD. Everything uses the
 * E2E prefix and is deleted in beforeAll + afterAll so the suite is rerunnable
 * and never touches seed data.
 */
describe('Departments master data (e2e)', () => {
  let context: E2eContext;
  let server: App;

  let adminToken: string;
  let hrStaffToken: string;
  let managerToken: string;
  let employeeToken: string;

  let rootId: number;
  let childId: number;
  let grandChildId: number;
  let positionId: number;
  let employeeId: number;

  const EMPLOYEE_SUFFIX = '9001';

  beforeAll(async () => {
    context = await createE2eApp();
    server = context.app.getHttpServer() as App;
    await context.cache.reset();
    await cleanupMasterDataFixtures(context.dataSource);

    rootId = await insertFixtureDepartment(
      context.dataSource,
      'E2ED_ROOT',
      'E2E Khối gốc',
    );
    childId = await insertFixtureDepartment(
      context.dataSource,
      'E2ED_CHILD',
      'E2E Phòng con',
      rootId,
    );
    grandChildId = await insertFixtureDepartment(
      context.dataSource,
      'E2ED_GRAND',
      'E2E Nhóm cháu',
      childId,
    );
    positionId = await insertFixturePosition(
      context.dataSource,
      'E2ED_POS',
      'E2E Chức vụ',
      grandChildId,
    );
    employeeId = await insertFixtureEmployee(
      context.dataSource,
      EMPLOYEE_SUFFIX,
      childId,
      positionId,
    );

    adminToken = await loginAs(server, SEED_USERS.admin);
    hrStaffToken = await loginAs(server, SEED_USERS.hrStaff);
    managerToken = await loginAs(server, SEED_USERS.manager);
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

  // ------------------------------------------------------------------ READ ---

  it('GET /departments returns the standard paginated envelope (api-spec §1.1)', async () => {
    const response = await get(
      '/departments?search=E2ED&limit=50',
      adminToken,
    ).expect(200);

    const body = successBody<PaginatedBody<DepartmentBody>>(response);
    expect(body.success).toBe(true);
    expect(typeof body.timestamp).toBe('string');
    expect(body).not.toHaveProperty('message');
    expect(body.data.meta).toMatchObject({ page: 1, limit: 50 });
    expect(body.data.meta.total).toBeGreaterThanOrEqual(3);

    const child = body.data.items.find((item) => item.code === 'E2ED_CHILD');
    expect(child).toMatchObject({
      id: childId,
      parentId: rootId,
      employeeCount: 1,
      isActive: true,
    });
    expect(child).not.toHaveProperty('deletedAt');
  });

  it('GET /departments/tree nests exactly 3 levels deep', async () => {
    const response = await get('/departments/tree', adminToken).expect(200);
    const tree = successBody<DepartmentTreeBody[]>(response).data;

    const root = tree.find((node) => node.code === 'E2ED_ROOT');
    expect(root).toBeDefined();
    const child = root!.children.find((node) => node.code === 'E2ED_CHILD');
    expect(child).toBeDefined();
    expect(child!.children.map((node) => node.code)).toEqual(['E2ED_GRAND']);
  });

  it('GET /departments?tree=true returns a tree array (api-spec §4)', async () => {
    const response = await get('/departments?tree=true', adminToken).expect(
      200,
    );
    const data = successBody<DepartmentTreeBody[]>(response).data;

    expect(Array.isArray(data)).toBe(true);
    expect(
      data.some(
        (node) => node.code === 'E2ED_ROOT' && node.children.length > 0,
      ),
    ).toBe(true);
  });

  it('GET /departments/:id for a non-existent id → 404 DEPARTMENT_NOT_FOUND', async () => {
    const response = await get('/departments/99999999', adminToken).expect(404);

    expect(errorBody(response)).toMatchObject({
      success: false,
      error: { code: 'DEPARTMENT_NOT_FOUND' },
    });
    expect(errorBody(response).error).not.toHaveProperty('details');
  });

  it('GET /departments?limit=1000 → 400 VALIDATION_ERROR (limit cap is 100)', async () => {
    const response = await get('/departments?limit=1000', adminToken).expect(
      400,
    );

    expect(errorBody(response).error.code).toBe('VALIDATION_ERROR');
    expect(errorBody(response).error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'limit', code: 'OUT_OF_RANGE' }),
      ]),
    );
  });

  it('GET /departments?limit=100 is still valid', async () => {
    const response = await get('/departments?limit=100', adminToken).expect(
      200,
    );

    expect(
      successBody<PaginatedBody<DepartmentBody>>(response).data.meta.limit,
    ).toBe(100);
  });

  // ----------------------------------------------------------------- CREATE ---

  it('POST /departments creates a new department, normalizing code to UPPERCASE', async () => {
    const response = await post('/departments', adminToken)
      .send({
        code: 'e2ed_new',
        name: 'E2E Phòng tạo mới',
        description: 'tạo bởi e2e',
        sortOrder: 7,
      })
      .expect(201);

    const created = successBody<DepartmentBody>(response).data;
    expect(created).toMatchObject({
      code: 'E2ED_NEW',
      name: 'E2E Phòng tạo mới',
      parentId: null,
      manager: null,
      employeeCount: 0,
      sortOrder: 7,
      isActive: true,
    });

    // Delete immediately so the suite stays rerunnable (and to verify DELETE succeeds).
    const deleted = await del(`/departments/${created.id}`, adminToken).expect(
      200,
    );
    expect(successBody<DeleteBody>(deleted).data).toEqual({
      id: created.id,
      deleted: true,
    });

    // A soft-deleted record must NOT appear in the detail view or the list.
    await get(`/departments/${created.id}`, adminToken).expect(404);
    const list = await get('/departments?search=E2ED_NEW', adminToken).expect(
      200,
    );
    expect(
      successBody<PaginatedBody<DepartmentBody>>(list).data.items,
    ).toHaveLength(0);
  });

  it('POST /departments with a duplicate code → 409 DUPLICATE_DEPARTMENT_CODE', async () => {
    const response = await post('/departments', adminToken)
      .send({ code: 'E2ED_ROOT', name: 'Trùng mã' })
      .expect(409);

    expect(errorBody(response).error.code).toBe('DUPLICATE_DEPARTMENT_CODE');
  });

  it('POST /departments with missing/invalid fields → 400 VALIDATION_ERROR + details[]', async () => {
    const response = await post('/departments', adminToken)
      .send({ code: 'x', name: '' })
      .expect(400);

    const error = errorBody(response).error;
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'code' }),
        expect.objectContaining({ field: 'name' }),
      ]),
    );
    // Each detail must include all 3 fields: field + code + message (api-spec.md §21).
    for (const detail of error.details ?? []) {
      expect(typeof detail.field).toBe('string');
      expect(typeof detail.code).toBe('string');
      expect(typeof detail.message).toBe('string');
      expect(detail.code.length).toBeGreaterThan(0);
    }
  });

  it('POST /departments with a non-existent parentId → 422 PARENT_DEPARTMENT_NOT_FOUND', async () => {
    const response = await post('/departments', adminToken)
      .send({
        code: 'E2ED_BADP',
        name: 'Cha không tồn tại',
        parentId: 99999999,
      })
      .expect(422);

    expect(errorBody(response).error.code).toBe('PARENT_DEPARTMENT_NOT_FOUND');
  });

  // ----------------------------------------------------------------- UPDATE ---

  it('PATCH /departments/:id assigns the fixture employee as manager', async () => {
    const response = await patch(`/departments/${grandChildId}`, hrStaffToken)
      .send({ managerId: employeeId, name: 'E2E Nhóm cháu (đã sửa)' })
      .expect(200);

    expect(successBody<DepartmentBody>(response).data).toMatchObject({
      id: grandChildId,
      name: 'E2E Nhóm cháu (đã sửa)',
      manager: { id: employeeId, fullName: 'Nguyễn Fixture' },
    });
  });

  it('PATCH with a managerId that is not an employee → 422 EMPLOYEE_NOT_FOUND', async () => {
    const response = await patch(`/departments/${grandChildId}`, adminToken)
      .send({ managerId: 99999999 })
      .expect(422);

    expect(errorBody(response).error.code).toBe('EMPLOYEE_NOT_FOUND');
  });

  it('PATCH setting a department as its own parent → 422 DEPARTMENT_CYCLE', async () => {
    const response = await patch(`/departments/${childId}`, adminToken)
      .send({ parentId: childId })
      .expect(422);

    expect(errorBody(response).error.code).toBe('DEPARTMENT_CYCLE');
  });

  it('PATCH setting a descendant department as the parent → 422 DEPARTMENT_CYCLE and the tree stays intact', async () => {
    const response = await patch(`/departments/${rootId}`, adminToken)
      .send({ parentId: grandChildId })
      .expect(422);

    expect(errorBody(response).error.code).toBe('DEPARTMENT_CYCLE');

    // The original structure is unchanged: root is still the root, grand is still a child of child.
    const root = await get(`/departments/${rootId}`, adminToken).expect(200);
    expect(successBody<DepartmentBody>(root).data.parentId).toBeNull();

    const grand = await get(`/departments/${grandChildId}`, adminToken).expect(
      200,
    );
    expect(successBody<DepartmentBody>(grand).data.parentId).toBe(childId);
  });

  // ----------------------------------------------------------------- DELETE ---

  it('DELETE a department that STILL HAS EMPLOYEES → 422 DEPARTMENT_HAS_EMPLOYEES and the employee is NOT deleted', async () => {
    const response = await del(`/departments/${childId}`, adminToken).expect(
      422,
    );

    expect(errorBody(response).error.code).toBe('DEPARTMENT_HAS_EMPLOYEES');
    expect(errorBody(response).error.message).toContain('employee(s)');

    // No cascade: both the employee and the department remain intact.
    expect(
      await countFixtureEmployee(context.dataSource, EMPLOYEE_SUFFIX),
    ).toBe(1);
    expect(
      await findDepartmentDeletedAt(context.dataSource, childId),
    ).toBeNull();
  });

  it('DELETE a department that STILL HAS CHILD DEPARTMENTS → 422 DEPARTMENT_HAS_CHILDREN', async () => {
    const response = await del(`/departments/${rootId}`, adminToken).expect(
      422,
    );

    expect(errorBody(response).error.code).toBe('DEPARTMENT_HAS_CHILDREN');
    expect(
      await findDepartmentDeletedAt(context.dataSource, rootId),
    ).toBeNull();
  });

  it('DELETE a department that STILL HAS POSITIONS → 422 DEPARTMENT_HAS_POSITIONS', async () => {
    const response = await del(
      `/departments/${grandChildId}`,
      adminToken,
    ).expect(422);

    expect(errorBody(response).error.code).toBe('DEPARTMENT_HAS_POSITIONS');
    expect(
      await findDepartmentDeletedAt(context.dataSource, grandChildId),
    ).toBeNull();
  });

  // ---------------------------------------------------------- AUTHORIZATION ---

  describe('authorization (architecture §7.3 + PLAN 2.1)', () => {
    it('no token → 401 TOKEN_INVALID', async () => {
      const response = await get('/departments').expect(401);
      expect(errorBody(response).error.code).toBe('TOKEN_INVALID');
    });

    it.each([
      ['employee', () => employeeToken],
      ['manager', () => managerToken],
    ])(
      'role %s CAN READ the list + tree',
      async (_role, token: () => string) => {
        await get('/departments', token()).expect(200);
        await get('/departments/tree', token()).expect(200);
        await get(`/departments/${childId}`, token()).expect(200);
      },
    );

    it('role employee CANNOT POST/PATCH/DELETE → 403 FORBIDDEN', async () => {
      const created = await post('/departments', employeeToken)
        .send({ code: 'E2ED_NOPE', name: 'Không được tạo' })
        .expect(403);
      expect(errorBody(created).error.code).toBe('FORBIDDEN');

      await patch(`/departments/${childId}`, employeeToken)
        .send({ name: 'hack' })
        .expect(403);

      await del(`/departments/${childId}`, employeeToken).expect(403);

      // Nothing was created/modified/deleted.
      const list = await get(
        '/departments?search=E2ED_NOPE',
        adminToken,
      ).expect(200);
      expect(
        successBody<PaginatedBody<DepartmentBody>>(list).data.items,
      ).toHaveLength(0);
    });

    it('role manager CANNOT write master data → 403 FORBIDDEN', async () => {
      await post('/departments', managerToken)
        .send({ code: 'E2ED_MGR', name: 'Manager tạo' })
        .expect(403);
    });

    it('role hr_staff CAN write (PLAN 2.1) → 201, then cleaned up', async () => {
      const response = await post('/departments', hrStaffToken)
        .send({ code: 'E2ED_HRS', name: 'HR staff tạo' })
        .expect(201);

      const created = successBody<DepartmentBody>(response).data;
      await del(`/departments/${created.id}`, hrStaffToken).expect(200);
    });
  });
});
