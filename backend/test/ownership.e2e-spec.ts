import { Controller, Get, Param } from '@nestjs/common';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import * as cookieParser from 'cookie-parser';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '@/app.module';
import { ApiAuth } from '@/common/decorators/api-auth.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { validationExceptionFactory } from '@/common/pipes/validation-exception.factory';
import { AuthenticatedUser } from '@/common/types/authenticated-user';
import { assertOwnership } from '@/common/utils/assert-ownership';
import { CacheService } from '@/shared/cache/cache.service';
import {
  cleanupSeedRefreshTokens,
  errorBody,
  loginData,
  SEED_PASSWORD,
  SEED_USERS,
  successBody,
} from './support/e2e-app';

/**
 * Controller CHỈ tồn tại trong test này.
 *
 * Lý do: `assertOwnership()` là helper dùng chung, nhưng đến hết Giai đoạn 1.1
 * chưa có endpoint nghiệp vụ nào sở hữu resource của nhân viên (employees/
 * salaries/... nằm ở Giai đoạn 3). Thay vì thêm endpoint "tạm" vào src/ (đúng
 * cái mà checklist go-live cấm), test mount controller probe này vào app thật
 * để kiểm tra helper qua đúng chuỗi JwtAuthGuard -> RolesGuard -> handler ->
 * HttpExceptionFilter với JWT thật.
 */
@Controller('test-ownership')
class OwnershipProbeController {
  /** Giả lập "hồ sơ của nhân viên :employeeId" – chỉ chủ sở hữu / role đặc quyền xem được. */
  @Get('employees/:employeeId')
  @ApiAuth()
  readEmployeeResource(
    @Param('employeeId') employeeId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): { employeeId: number; readBy: string } {
    assertOwnership(user, Number(employeeId), {
      resource: `employee ${employeeId} record`,
    });

    return { employeeId: Number(employeeId), readBy: user.username };
  }

  /** Endpoint chỉ dành cho admin – kiểm tra RolesGuard chạy sau JwtAuthGuard. */
  @Get('admin-only')
  @ApiAuth()
  @Roles('admin')
  adminOnly(): { ok: boolean } {
    return { ok: true };
  }
}

interface OwnershipProbeBody {
  employeeId: number;
  readBy: string;
}

describe('assertOwnership + RolesGuard (e2e)', () => {
  let app: INestApplication;
  let server: App;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [OwnershipProbeController],
    }).compile();

    app = moduleFixture.createNestApplication({ logger: false });
    app.use(cookieParser());
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: false,
        transformOptions: { enableImplicitConversion: true },
        exceptionFactory: validationExceptionFactory,
      }),
    );
    await app.init();

    server = app.getHttpServer() as App;
    await app.get(CacheService).reset();
  });

  afterAll(async () => {
    await app.get(CacheService).reset();
    // Không để lại session rác trong DB dùng chung (hrm_dev).
    await cleanupSeedRefreshTokens(app.get(DataSource));
    await app.close();
  });

  async function loginAs(username: string): Promise<{
    accessToken: string;
    employeeId: number;
    role: string;
  }> {
    const response = await request(server)
      .post('/api/v1/auth/login')
      .send({ username, password: SEED_PASSWORD })
      .expect(200);

    const data = loginData(response);

    return {
      accessToken: data.accessToken,
      employeeId: data.user.employee!.id,
      role: data.user.role,
    };
  }

  const get = (path: string, token?: string) => {
    const req = request(server).get(`/api/v1/${path}`);
    return token ? req.set('Authorization', `Bearer ${token}`) : req;
  };

  it('[14] NV A truy cập resource của NV B → 403 FORBIDDEN', async () => {
    const employeeA = await loginAs(SEED_USERS.employeeA);
    const employeeB = await loginAs(SEED_USERS.employeeB);

    const response = await get(
      `test-ownership/employees/${employeeB.employeeId}`,
      employeeA.accessToken,
    ).expect(403);

    expect(response.body).toMatchObject({
      success: false,
      error: { code: 'FORBIDDEN' },
    });
    expect(errorBody(response).error.message).toContain(
      `employee ${employeeB.employeeId} record`,
    );
  });

  it('[14b] NV A truy cập resource của CHÍNH MÌNH → 200', async () => {
    const employeeA = await loginAs(SEED_USERS.employeeA);

    const response = await get(
      `test-ownership/employees/${employeeA.employeeId}`,
      employeeA.accessToken,
    ).expect(200);

    expect(successBody<OwnershipProbeBody>(response).data).toEqual({
      employeeId: employeeA.employeeId,
      readBy: SEED_USERS.employeeA,
    });
  });

  it.each([SEED_USERS.admin, SEED_USERS.hrManager, SEED_USERS.hrStaff])(
    '[14c] role đặc quyền %s xem được hồ sơ nhân viên khác → 200',
    async (username: string) => {
      const privileged = await loginAs(username);
      const employeeB = await loginAs(SEED_USERS.employeeB);

      await get(
        `test-ownership/employees/${employeeB.employeeId}`,
        privileged.accessToken,
      ).expect(200);
    },
  );

  it('[14d] role manager KHÔNG mặc định đi qua assertOwnership → 403 (quyền theo phòng ban xử lý ở Giai đoạn 3)', async () => {
    const manager = await loginAs(SEED_USERS.manager);
    const employeeB = await loginAs(SEED_USERS.employeeB);

    await get(
      `test-ownership/employees/${employeeB.employeeId}`,
      manager.accessToken,
    ).expect(403);
  });

  it('[14e] không có token → 401 (JwtAuthGuard chặn trước khi tới assertOwnership)', async () => {
    const response = await get('test-ownership/employees/1').expect(401);
    expect(errorBody(response).error.code).toBe('TOKEN_INVALID');
  });

  it('RolesGuard: @Roles("admin") cho admin 200, cho employee 403', async () => {
    const admin = await loginAs(SEED_USERS.admin);
    const employeeA = await loginAs(SEED_USERS.employeeA);

    await get('test-ownership/admin-only', admin.accessToken).expect(200);

    const forbidden = await get(
      'test-ownership/admin-only',
      employeeA.accessToken,
    ).expect(403);
    expect(errorBody(forbidden).error).toMatchObject({
      code: 'FORBIDDEN',
      message: 'Requires one of roles: admin',
    });
  });
});
