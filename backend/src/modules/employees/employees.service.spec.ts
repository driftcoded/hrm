import { HttpException, HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthenticatedUser } from '@/common/types/authenticated-user';
import { StorageService } from '@/shared/storage/storage.service';
import {
  Contract,
  ContractType,
} from '@/modules/contracts/entities/contract.entity';
import { Department } from '@/modules/departments/entities/department.entity';
import { Position } from '@/modules/positions/entities/position.entity';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { EmployeesRepository } from './employees.repository';
import { EmployeesService } from './employees.service';
import {
  EducationLevel,
  Employee,
  EmployeeStatus,
  Gender,
  MaritalStatus,
} from './entities/employee.entity';

function makeEmployee(overrides: Partial<Employee> = {}): Employee {
  return {
    id: 1,
    employeeCode: 'NV0001',
    lastName: 'Nguyễn',
    firstName: 'Văn An',
    fullName: 'Nguyễn Văn An',
    dateOfBirth: '1995-03-15',
    gender: Gender.MALE,
    maritalStatus: MaritalStatus.SINGLE,
    nationality: 'Việt Nam',
    ethnicity: 'Kinh',
    religion: null,
    placeOfBirth: 'Hà Nội',
    hometown: 'Hà Nam',
    cccdNumber: '001095000001',
    cccdIssueDate: '2021-05-10',
    cccdIssuePlace: 'Cục CS QLHC về TTXH',
    cccdExpiredDate: null,
    taxCode: null,
    socialInsuranceNo: null,
    healthInsuranceNo: null,
    healthInsuranceExp: null,
    permanentAddress: 'Số 1, Hà Nội',
    currentAddress: null,
    provinceCode: '01',
    districtCode: '007',
    wardCode: '00193',
    phone: '0901234567',
    email: 'an.nguyen@company.com',
    personalEmail: null,
    emergencyContactName: null,
    emergencyContactPhone: null,
    emergencyContactRel: null,
    bankAccount: null,
    bankName: null,
    bankBranch: null,
    positionId: 5,
    position: { id: 5, name: 'Developer' } as Position,
    departmentId: 2,
    department: { id: 2, name: 'Phòng Kỹ thuật' } as Department,
    directManagerId: null,
    directManager: null,
    hireDate: '2022-01-10',
    probationStartDate: null,
    probationEndDate: null,
    officialStartDate: null,
    terminationDate: null,
    terminationReason: null,
    terminationType: null,
    status: EmployeeStatus.ACTIVE,
    educationLevel: EducationLevel.UNIVERSITY,
    major: null,
    university: null,
    graduationYear: null,
    avatarUrl: null,
    notes: null,
    createdBy: null,
    creator: null,
    createdAt: new Date('2026-08-19T02:00:00.000Z'),
    updatedAt: new Date('2026-08-19T02:00:00.000Z'),
    deletedAt: null,
    ...overrides,
  };
}

/** DTO tối thiểu hợp lệ; từng test override đúng field nó quan tâm. */
function makeCreateDto(
  overrides: Partial<CreateEmployeeDto> = {},
): CreateEmployeeDto {
  return {
    lastName: 'Nguyễn',
    firstName: 'Văn Bình',
    dateOfBirth: '1998-07-20',
    gender: Gender.MALE,
    placeOfBirth: 'Hà Nội',
    hometown: 'Hà Nam',
    cccdNumber: '001098765432',
    cccdIssueDate: '2021-05-10',
    cccdIssuePlace: 'Cục CS QLHC về TTXH Hà Nội',
    permanentAddress: 'Số 10, Phố Huế, Hà Nội',
    provinceCode: '01',
    districtCode: '007',
    wardCode: '00193',
    phone: '0912345678',
    email: 'Binh.Nguyen@Company.com',
    positionId: 5,
    departmentId: 2,
    hireDate: '2026-06-01',
    ...overrides,
  };
}

const adminUser: AuthenticatedUser = {
  userId: 1,
  username: 'admin',
  role: 'admin',
  employeeId: 1,
  sessionId: 1,
};

const employeeUser: AuthenticatedUser = {
  userId: 5,
  username: 'an.hoang',
  role: 'employee',
  employeeId: 5,
  sessionId: 2,
};

const managerUser: AuthenticatedUser = {
  userId: 4,
  username: 'manager',
  role: 'manager',
  employeeId: 4,
  sessionId: 3,
};

/** Trả về status HTTP + error.code của exception mà service ném ra. */
async function captureError(
  run: () => Promise<unknown>,
): Promise<{ status: number; code: string }> {
  try {
    await run();
  } catch (error) {
    const exception = error as HttpException;
    const body = exception.getResponse() as { code: string };
    return { status: exception.getStatus(), code: body.code };
  }

  throw new Error('Expected the call to throw, but it resolved');
}

describe('EmployeesService', () => {
  let service: EmployeesService;
  let repository: jest.Mocked<EmployeesRepository>;
  let storage: jest.Mocked<StorageService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployeesService,
        {
          provide: EmployeesRepository,
          useValue: {
            findPaginated: jest.fn().mockResolvedValue([[], 0]),
            findById: jest.fn().mockResolvedValue(makeEmployee()),
            findByIdWithDeleted: jest.fn(),
            findByUniqueField: jest.fn().mockResolvedValue(null),
            findMaxEmployeeCodeNumber: jest.fn().mockResolvedValue(6),
            findActiveBaseSalaries: jest.fn().mockResolvedValue([]),
            countAll: jest.fn().mockResolvedValue(0),
            countByStatus: jest.fn().mockResolvedValue([]),
            countByGender: jest.fn().mockResolvedValue([]),
            countHiredWithinDays: jest.fn().mockResolvedValue(0),
            countProbationEndingWithinDays: jest.fn().mockResolvedValue(0),
            countContractsExpiringWithinDays: jest.fn().mockResolvedValue(0),
            findAverages: jest.fn().mockResolvedValue({
              averageAge: null,
              averageTenureYears: null,
            }),
            countByDepartment: jest.fn().mockResolvedValue([]),
            findUpcomingBirthdays: jest.fn().mockResolvedValue([]),
            countById: jest.fn().mockResolvedValue(1),
            countActiveDependents: jest.fn().mockResolvedValue(0),
            findActiveContract: jest.fn().mockResolvedValue(null),
            findDepartmentById: jest
              .fn()
              .mockResolvedValue({ id: 2, name: 'Phòng Kỹ thuật' }),
            findPositionById: jest
              .fn()
              .mockResolvedValue({ id: 5, name: 'Developer', departmentId: 2 }),
            findManagedDepartmentIds: jest.fn().mockResolvedValue([]),
            create: jest.fn().mockResolvedValue(makeEmployee({ id: 7 })),
            update: jest.fn().mockResolvedValue(undefined),
            softDelete: jest.fn().mockResolvedValue(undefined),
            restore: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: StorageService,
          useValue: {
            avatarMaxBytes: 2 * 1024 * 1024,
            driverKind: 'local',
            putEmployeeAvatar: jest.fn().mockResolvedValue({
              key: 'avatars/1/abc.jpg',
              url: '/api/v1/uploads/avatars/1/abc.jpg',
              driver: 'local',
            }),
            removeByUrl: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get(EmployeesService);
    repository = module.get(EmployeesRepository);
    storage = module.get(StorageService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ------------------------------------------------------------- findAll ---

  describe('findAll', () => {
    it('trả về envelope phân trang chuẩn', async () => {
      repository.findPaginated.mockResolvedValue([[makeEmployee()], 1]);

      const result = await service.findAll({ page: 1, limit: 20 }, adminUser);

      expect(result.meta).toEqual({
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      });
      expect(result.items[0].employeeCode).toBe('NV0001');
      // Danh sách KHÔNG lộ CCCD.
      expect(result.items[0]).not.toHaveProperty('cccdNumber');
    });

    it('kẹp limit ở trần 100 dù service được gọi trực tiếp', async () => {
      await service.findAll({ page: 1, limit: 5000 }, adminUser);

      expect(repository.findPaginated).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      );
    });

    it('truyền filter phòng ban / trạng thái xuống repository', async () => {
      await service.findAll(
        { departmentId: 2, status: EmployeeStatus.ACTIVE },
        adminUser,
      );

      expect(repository.findPaginated).toHaveBeenCalledWith(
        expect.objectContaining({
          departmentId: 2,
          status: EmployeeStatus.ACTIVE,
        }),
      );
    });

    it('role employee bị 403, phải dùng /employees/me', async () => {
      const error = await captureError(() => service.findAll({}, employeeUser));

      expect(error).toEqual({
        status: HttpStatus.FORBIDDEN,
        code: 'FORBIDDEN',
      });
    });

    it('manager bị giới hạn trong phòng ban mình phụ trách', async () => {
      repository.findManagedDepartmentIds.mockResolvedValue([9]);
      repository.findById.mockResolvedValue(
        makeEmployee({ id: 4, departmentId: 2 }),
      );

      await service.findAll({}, managerUser);

      const call = repository.findPaginated.mock.calls[0][0];
      expect(call.departmentScope?.sort()).toEqual([2, 9]);
    });

    it('onlyDeleted=true chuyển sang danh sách hồ sơ đã xoá', async () => {
      await service.findAll({ onlyDeleted: true }, adminUser);

      expect(repository.findPaginated).toHaveBeenCalledWith(
        expect.objectContaining({ onlyDeleted: true }),
      );
    });
  });

  // -------------------------------------------------------------- create ---

  describe('create', () => {
    it('tự sinh employeeCode kế tiếp và ghép fullName', async () => {
      await service.create(makeCreateDto(), 1);

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          employeeCode: 'NV0007',
          fullName: 'Nguyễn Văn Bình',
        }),
      );
    });

    it('hạ email về chữ thường trước khi ghi', async () => {
      await service.create(makeCreateDto(), 1);

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'binh.nguyen@company.com' }),
      );
    });

    it('bỏ dấu phân cách trong số điện thoại', async () => {
      await service.create(makeCreateDto({ phone: '0912 345 678' }), 1);

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ phone: '0912345678' }),
      );
    });

    it('CCCD trùng → 409 DUPLICATE_CCCD', async () => {
      repository.findByUniqueField.mockImplementation((field) =>
        Promise.resolve(
          field === 'cccdNumber' ? makeEmployee({ id: 3 }) : null,
        ),
      );

      const error = await captureError(() =>
        service.create(makeCreateDto(), 1),
      );

      expect(error).toEqual({
        status: HttpStatus.CONFLICT,
        code: 'DUPLICATE_CCCD',
      });
    });

    it('email trùng → 409 DUPLICATE_EMAIL', async () => {
      repository.findByUniqueField.mockImplementation((field) =>
        Promise.resolve(field === 'email' ? makeEmployee({ id: 3 }) : null),
      );

      const error = await captureError(() =>
        service.create(makeCreateDto(), 1),
      );

      expect(error).toEqual({
        status: HttpStatus.CONFLICT,
        code: 'DUPLICATE_EMAIL',
      });
    });

    it('CCCD trùng với hồ sơ ĐÃ XOÁ MỀM cũng bị chặn, message chỉ dẫn khôi phục', async () => {
      repository.findByUniqueField.mockImplementation((field) =>
        Promise.resolve(
          field === 'cccdNumber'
            ? makeEmployee({ id: 3, deletedAt: new Date() })
            : null,
        ),
      );

      await expect(service.create(makeCreateDto(), 1)).rejects.toThrow(
        /soft-deleted employee 3/,
      );
    });

    it('tuổi dưới 15 → 422 INVALID_DATE_OF_BIRTH', async () => {
      const error = await captureError(() =>
        service.create(makeCreateDto({ dateOfBirth: '2020-01-01' }), 1),
      );

      expect(error).toEqual({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        code: 'INVALID_DATE_OF_BIRTH',
      });
    });

    it('tuổi trên 70 → 422 INVALID_DATE_OF_BIRTH', async () => {
      const error = await captureError(() =>
        service.create(makeCreateDto({ dateOfBirth: '1940-01-01' }), 1),
      );

      expect(error.code).toBe('INVALID_DATE_OF_BIRTH');
    });

    it('ngày vào làm sớm hơn ngày sinh + 15 năm → 422 INVALID_HIRE_DATE', async () => {
      const error = await captureError(() =>
        service.create(
          makeCreateDto({ dateOfBirth: '2008-07-20', hireDate: '2020-01-01' }),
          1,
        ),
      );

      expect(error).toEqual({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        code: 'INVALID_HIRE_DATE',
      });
    });

    it('chức vụ không thuộc phòng ban được gán → 422 POSITION_DEPARTMENT_MISMATCH', async () => {
      repository.findPositionById.mockResolvedValue({
        id: 5,
        name: 'Developer',
        departmentId: 99,
      } as Position);

      const error = await captureError(() =>
        service.create(makeCreateDto(), 1),
      );

      expect(error).toEqual({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        code: 'POSITION_DEPARTMENT_MISMATCH',
      });
    });

    it('phòng ban không tồn tại → 422 DEPARTMENT_NOT_FOUND', async () => {
      repository.findDepartmentById.mockResolvedValue(null);

      const error = await captureError(() =>
        service.create(makeCreateDto(), 1),
      );

      expect(error.code).toBe('DEPARTMENT_NOT_FOUND');
    });

    it('thử lại với mã kế tiếp khi bị request khác giành mất employee_code', async () => {
      repository.create
        .mockRejectedValueOnce(
          Object.assign(new Error('duplicate'), {
            code: 'ER_DUP_ENTRY',
            message: "Duplicate entry 'NV0007' for key 'employee_code'",
          }),
        )
        .mockResolvedValueOnce(makeEmployee({ id: 8 }));
      repository.findMaxEmployeeCodeNumber
        .mockResolvedValueOnce(6)
        .mockResolvedValueOnce(7);

      await service.create(makeCreateDto(), 1);

      expect(repository.create).toHaveBeenCalledTimes(2);
      expect(repository.create.mock.calls[1][0]).toEqual(
        expect.objectContaining({ employeeCode: 'NV0008' }),
      );
    });
  });

  // -------------------------------------------------------------- update ---

  describe('update', () => {
    it('chỉ ghi những field có mặt trong body', async () => {
      await service.update(1, { notes: 'ghi chú mới' });

      expect(repository.update).toHaveBeenCalledWith(1, {
        notes: 'ghi chú mới',
      });
    });

    it('đổi họ hoặc tên thì fullName được ghép lại', async () => {
      await service.update(1, { firstName: 'Văn Bình' });

      expect(repository.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          firstName: 'Văn Bình',
          fullName: 'Nguyễn Văn Bình',
        }),
      );
    });

    it('không tính là trùng khi giá trị UNIQUE thuộc về chính hồ sơ đó', async () => {
      repository.findByUniqueField.mockResolvedValue(makeEmployee({ id: 1 }));

      await expect(
        service.update(1, { email: 'an.nguyen@company.com' }),
      ).resolves.toBeDefined();
    });

    it('tự làm quản lý của chính mình → 422 EMPLOYEE_SELF_MANAGER', async () => {
      const error = await captureError(() =>
        service.update(1, { directManagerId: 1 }),
      );

      expect(error).toEqual({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        code: 'EMPLOYEE_SELF_MANAGER',
      });
    });

    it('ngày nghỉ việc trước ngày vào làm → 422 INVALID_DATE_RANGE', async () => {
      const error = await captureError(() =>
        service.update(1, { terminationDate: '2020-01-01' }),
      );

      expect(error.code).toBe('INVALID_DATE_RANGE');
    });

    it('hồ sơ không tồn tại → 404 EMPLOYEE_NOT_FOUND', async () => {
      repository.findById.mockResolvedValue(null);

      const error = await captureError(() => service.update(99, {}));

      expect(error).toEqual({
        status: HttpStatus.NOT_FOUND,
        code: 'EMPLOYEE_NOT_FOUND',
      });
    });
  });

  // ------------------------------------------------------ remove/restore ---

  describe('remove & restore', () => {
    it('xoá mềm, KHÔNG xoá vật lý', async () => {
      const result = await service.remove(1);

      expect(repository.softDelete).toHaveBeenCalledWith(1);
      expect(result).toEqual({ id: 1, deleted: true });
    });

    it('khôi phục hồ sơ đã xoá mềm', async () => {
      repository.findByIdWithDeleted.mockResolvedValue(
        makeEmployee({ deletedAt: new Date() }),
      );

      const result = await service.restore(1);

      expect(repository.restore).toHaveBeenCalledWith(1);
      expect(result).toEqual({ id: 1, restored: true });
    });

    it('khôi phục hồ sơ chưa bị xoá → 422 EMPLOYEE_NOT_DELETED', async () => {
      repository.findByIdWithDeleted.mockResolvedValue(makeEmployee());

      const error = await captureError(() => service.restore(1));

      expect(error).toEqual({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        code: 'EMPLOYEE_NOT_DELETED',
      });
    });
  });

  // -------------------------------------------------------- uploadAvatar ---

  describe('uploadAvatar', () => {
    const file = { buffer: Buffer.alloc(20), size: 20 };

    it('lưu URL mới vào hồ sơ', async () => {
      const result = await service.uploadAvatar(1, file, adminUser);

      expect(repository.update).toHaveBeenCalledWith(1, {
        avatarUrl: '/api/v1/uploads/avatars/1/abc.jpg',
      });
      expect(result.avatarUrl).toBe('/api/v1/uploads/avatars/1/abc.jpg');
    });

    it('xoá ảnh cũ SAU khi đã ghi URL mới', async () => {
      repository.findById.mockResolvedValue(
        makeEmployee({ avatarUrl: '/api/v1/uploads/avatars/1/old.jpg' }),
      );

      await service.uploadAvatar(1, file, adminUser);

      expect(storage.removeByUrl).toHaveBeenCalledWith(
        '/api/v1/uploads/avatars/1/old.jpg',
      );
      const updateOrder = repository.update.mock.invocationCallOrder[0];
      const removeOrder = storage.removeByUrl.mock.invocationCallOrder[0];
      expect(updateOrder).toBeLessThan(removeOrder);
    });

    it('nhân viên khác upload hộ → 403 FORBIDDEN', async () => {
      repository.findById.mockResolvedValue(makeEmployee({ id: 6 }));

      const error = await captureError(() =>
        service.uploadAvatar(6, file, employeeUser),
      );

      expect(error).toEqual({
        status: HttpStatus.FORBIDDEN,
        code: 'FORBIDDEN',
      });
    });
  });

  // ----------------------------------------------------------- summary ----

  describe('findSummary', () => {
    it('trả DECIMAL của hợp đồng dưới dạng number (api-spec §1.5)', async () => {
      repository.findActiveContract.mockResolvedValue({
        id: 3,
        contractNumber: 'HDLD-2026-001',
        contractType: ContractType.FIXED_TERM,
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        baseSalary: '15000000.00',
        insuranceSalary: '15000000.00',
        positionAllowance: '500000.00',
        otherAllowance: '0.00',
        workingHours: '8.00',
        workingDays: 5,
      } as Contract);
      repository.countActiveDependents.mockResolvedValue(2);

      const summary = await service.findSummary(1, adminUser);

      expect(summary.activeContract?.baseSalary).toBe(15000000);
      expect(summary.activeContract?.workingHours).toBe(8);
      expect(summary.activeDependents).toBe(2);
    });

    it('chưa có hợp đồng hiệu lực → activeContract = null', async () => {
      const summary = await service.findSummary(1, adminUser);

      expect(summary.activeContract).toBeNull();
    });
  });

  // ---------------------------------------------------------- findStats ----

  describe('findStats', () => {
    it('mọi trạng thái đều có mặt, kể cả khi bằng 0', async () => {
      repository.countByStatus.mockResolvedValue([
        { status: EmployeeStatus.ACTIVE, count: 4 },
      ]);

      const stats = await service.findStats(adminUser);

      expect(stats.byStatus).toEqual({
        probation: 0,
        active: 4,
        on_leave: 0,
        suspended: 0,
        resigned: 0,
        terminated: 0,
      });
    });

    it('làm tròn tuổi / thâm niên trung bình về 1 chữ số', async () => {
      repository.findAverages.mockResolvedValue({
        averageAge: 29.37219,
        averageTenureYears: 2.14985,
      });

      const stats = await service.findStats(adminUser);

      expect(stats.averageAge).toBe(29.4);
      expect(stats.averageTenureYears).toBe(2.1);
    });

    it('chưa có nhân viên nào → trung bình là null, không phải 0', async () => {
      const stats = await service.findStats(adminUser);

      expect(stats.averageAge).toBeNull();
      expect(stats.averageTenureYears).toBeNull();
    });

    it('manager: mọi truy vấn đều bị giới hạn theo phòng ban', async () => {
      repository.findManagedDepartmentIds.mockResolvedValue([9]);
      repository.findById.mockResolvedValue(
        makeEmployee({ id: 4, departmentId: 2 }),
      );

      await service.findStats(managerUser);

      // Nếu thiếu scope ở BẤT KỲ truy vấn nào thì tổng công ty sẽ rò rỉ.
      for (const call of [
        repository.countAll,
        repository.countByStatus,
        repository.countByGender,
        repository.countByDepartment,
      ]) {
        expect(call).toHaveBeenCalledWith(expect.arrayContaining([2, 9]));
      }
    });

    it('role employee → 403 FORBIDDEN', async () => {
      const error = await captureError(() => service.findStats(employeeUser));

      expect(error).toEqual({
        status: HttpStatus.FORBIDDEN,
        code: 'FORBIDDEN',
      });
    });
  });

  // --------------------------------------------------------- baseSalary ----

  describe('findAll baseSalary', () => {
    it('gắn lương cơ bản của hợp đồng đang hiệu lực vào từng dòng', async () => {
      repository.findPaginated.mockResolvedValue([
        [makeEmployee({ id: 7 })],
        1,
      ]);
      repository.findActiveBaseSalaries.mockResolvedValue([
        { employeeId: 7, baseSalary: 19500000 },
      ]);

      const result = await service.findAll({}, adminUser);

      expect(result.items[0].baseSalary).toBe(19500000);
    });

    it('không có hợp đồng active → null, KHÔNG phải 0', async () => {
      repository.findPaginated.mockResolvedValue([
        [makeEmployee({ id: 7 })],
        1,
      ]);

      const result = await service.findAll({}, adminUser);

      expect(result.items[0].baseSalary).toBeNull();
    });

    it('chỉ một truy vấn lương cho cả trang, không phải mỗi dòng một truy vấn', async () => {
      repository.findPaginated.mockResolvedValue([
        [
          makeEmployee({ id: 1 }),
          makeEmployee({ id: 2 }),
          makeEmployee({ id: 3 }),
        ],
        3,
      ]);

      await service.findAll({}, adminUser);

      expect(repository.findActiveBaseSalaries).toHaveBeenCalledTimes(1);
      expect(repository.findActiveBaseSalaries).toHaveBeenCalledWith([1, 2, 3]);
    });
  });

  // ------------------------------------------------------------ findMe ----

  describe('findMe', () => {
    it('tài khoản chưa gắn hồ sơ → 404 EMPLOYEE_NOT_FOUND', async () => {
      const error = await captureError(() =>
        service.findMe({ ...employeeUser, employeeId: null }),
      );

      expect(error).toEqual({
        status: HttpStatus.NOT_FOUND,
        code: 'EMPLOYEE_NOT_FOUND',
      });
    });
  });

  // ------------------------------------------------------------ findOne ----

  describe('findOne', () => {
    it('nhân viên A xem hồ sơ nhân viên B → 403 FORBIDDEN', async () => {
      repository.findById.mockResolvedValue(makeEmployee({ id: 6 }));

      const error = await captureError(() => service.findOne(6, employeeUser));

      expect(error).toEqual({
        status: HttpStatus.FORBIDDEN,
        code: 'FORBIDDEN',
      });
    });

    it('nhân viên xem hồ sơ của chính mình → OK', async () => {
      repository.findById.mockResolvedValue(makeEmployee({ id: 5 }));

      await expect(service.findOne(5, employeeUser)).resolves.toMatchObject({
        id: 5,
      });
    });
  });
});
