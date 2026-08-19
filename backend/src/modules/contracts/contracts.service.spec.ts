import { HttpException, HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthenticatedUser } from '@/common/types/authenticated-user';
import { EmployeesService } from '@/modules/employees/employees.service';
import { Employee } from '@/modules/employees/entities/employee.entity';
import { ContractsRepository } from './contracts.repository';
import { ContractsService } from './contracts.service';
import { CreateContractDto } from './dto/create-contract.dto';
import {
  Contract,
  ContractStatus,
  ContractType,
} from './entities/contract.entity';

function makeContract(overrides: Partial<Contract> = {}): Contract {
  return {
    id: 1,
    employeeId: 51,
    employee: {
      id: 51,
      employeeCode: 'NV0051',
      fullName: 'Nguyễn Văn Bình',
    } as Employee,
    contractNumber: 'HDLD-2026-051',
    contractType: ContractType.FIXED_TERM,
    startDate: '2026-08-01',
    endDate: '2027-07-31',
    signDate: '2026-07-28',
    baseSalary: '15000000.00',
    insuranceSalary: '15000000.00',
    positionAllowance: '500000.00',
    otherAllowance: '0.00',
    workingHours: '8.00',
    workingDays: 5,
    probationSalaryPct: null,
    status: ContractStatus.DRAFT,
    terminatedDate: null,
    terminatedReason: null,
    fileUrl: null,
    note: null,
    createdBy: null,
    creator: null,
    createdAt: new Date('2026-08-19T02:00:00.000Z'),
    updatedAt: new Date('2026-08-19T02:00:00.000Z'),
    ...overrides,
  };
}

function makeCreateDto(
  overrides: Partial<CreateContractDto> = {},
): CreateContractDto {
  return {
    employeeId: 51,
    contractNumber: 'HDLD-2026-051',
    contractType: ContractType.FIXED_TERM,
    startDate: '2026-08-01',
    endDate: '2027-07-31',
    signDate: '2026-07-28',
    baseSalary: 15000000,
    insuranceSalary: 15000000,
    ...overrides,
  };
}

const hrUser: AuthenticatedUser = {
  userId: 2,
  username: 'hr.manager',
  role: 'hr_manager',
  employeeId: 2,
  sessionId: 1,
};

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

describe('ContractsService', () => {
  let service: ContractsService;
  let repository: jest.Mocked<ContractsRepository>;
  let employeesService: jest.Mocked<EmployeesService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContractsService,
        {
          provide: ContractsRepository,
          useValue: {
            findPaginated: jest.fn().mockResolvedValue([[], 0]),
            findById: jest.fn().mockResolvedValue(makeContract()),
            findByContractNumber: jest.fn().mockResolvedValue(null),
            findActiveByEmployee: jest.fn().mockResolvedValue(null),
            countSignedFixedTerm: jest.fn().mockResolvedValue(0),
            findEmployeeById: jest.fn().mockResolvedValue({ id: 51 }),
            create: jest.fn().mockResolvedValue(makeContract({ id: 9 })),
            update: jest.fn().mockResolvedValue(undefined),
            remove: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: EmployeesService,
          useValue: {
            resolveScope: jest.fn().mockResolvedValue({ kind: 'all' }),
            findOne: jest.fn().mockResolvedValue({ id: 51 }),
          },
        },
      ],
    }).compile();

    service = module.get(ContractsService);
    repository = module.get(ContractsRepository);
    employeesService = module.get(EmployeesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ------------------------------------------------------------- findAll ---

  describe('findAll', () => {
    it('nhân viên thường chỉ thấy hợp đồng của chính mình, bỏ qua employeeId trên query', async () => {
      employeesService.resolveScope.mockResolvedValue({
        kind: 'self',
        employeeId: 5,
      });

      await service.findAll({ employeeId: 99 }, hrUser);

      expect(repository.findPaginated).toHaveBeenCalledWith(
        expect.objectContaining({ employeeId: 5 }),
      );
    });

    it('expiringDays dựng khoảng [hôm nay, hôm nay + N ngày]', async () => {
      await service.findAll({ expiringDays: 30 }, hrUser);

      const call = repository.findPaginated.mock.calls[0][0];
      expect(call.expiring).toBeDefined();
      expect(call.expiring!.to > call.expiring!.from).toBe(true);
    });

    it('DECIMAL được trả về dạng number (api-spec §1.5)', async () => {
      repository.findPaginated.mockResolvedValue([[makeContract()], 1]);

      const result = await service.findAll({}, hrUser);

      expect(result.items[0].baseSalary).toBe(15000000);
      expect(result.items[0].positionAllowance).toBe(500000);
    });
  });

  // -------------------------------------------------------------- create ---

  describe('create', () => {
    it('chuẩn hoá số hợp đồng về chữ hoa và ghi DECIMAL dạng chuỗi', async () => {
      await service.create(
        makeCreateDto({ contractNumber: 'hdld-2026-051' }),
        2,
      );

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          contractNumber: 'HDLD-2026-051',
          baseSalary: '15000000.00',
        }),
      );
    });

    it('mặc định status = draft', async () => {
      await service.create(makeCreateDto(), 2);

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: ContractStatus.DRAFT }),
      );
    });

    it('số hợp đồng trùng → 409 DUPLICATE_CONTRACT_NUMBER', async () => {
      repository.findByContractNumber.mockResolvedValue(
        makeContract({ id: 4 }),
      );

      const error = await captureError(() =>
        service.create(makeCreateDto(), 2),
      );

      expect(error).toEqual({
        status: HttpStatus.CONFLICT,
        code: 'DUPLICATE_CONTRACT_NUMBER',
      });
    });

    it('nhân viên không tồn tại → 422 EMPLOYEE_NOT_FOUND', async () => {
      repository.findEmployeeById.mockResolvedValue(null);

      const error = await captureError(() =>
        service.create(makeCreateDto(), 2),
      );

      expect(error).toEqual({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        code: 'EMPLOYEE_NOT_FOUND',
      });
    });

    it('HĐ không xác định thời hạn mà có endDate → 422 INVALID_CONTRACT_PERIOD', async () => {
      const error = await captureError(() =>
        service.create(
          makeCreateDto({
            contractType: ContractType.INDEFINITE,
            endDate: '2027-01-01',
          }),
          2,
        ),
      );

      expect(error).toEqual({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        code: 'INVALID_CONTRACT_PERIOD',
      });
    });

    it('HĐ xác định thời hạn thiếu endDate → 422 INVALID_CONTRACT_PERIOD', async () => {
      const error = await captureError(() =>
        service.create(makeCreateDto({ endDate: null }), 2),
      );

      expect(error.code).toBe('INVALID_CONTRACT_PERIOD');
    });

    it('HĐ xác định thời hạn quá 36 tháng → 422 (Điều 20.1.b BLLĐ 2019)', async () => {
      const error = await captureError(() =>
        service.create(makeCreateDto({ endDate: '2030-08-01' }), 2),
      );

      expect(error.code).toBe('INVALID_CONTRACT_PERIOD');
    });

    it('đúng 36 tháng vẫn hợp lệ', async () => {
      await expect(
        service.create(makeCreateDto({ endDate: '2029-08-01' }), 2),
      ).resolves.toBeDefined();
    });

    it('thử việc quá 180 ngày → 422 (Điều 25 BLLĐ 2019)', async () => {
      const error = await captureError(() =>
        service.create(
          makeCreateDto({
            contractType: ContractType.PROBATION,
            startDate: '2026-08-01',
            endDate: '2027-08-01',
          }),
          2,
        ),
      );

      expect(error.code).toBe('INVALID_CONTRACT_PERIOD');
    });

    it('thử việc 60 ngày → hợp lệ, tự đặt probationSalaryPct = 85', async () => {
      await service.create(
        makeCreateDto({
          contractType: ContractType.PROBATION,
          startDate: '2026-08-01',
          endDate: '2026-09-30',
        }),
        2,
      );

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ probationSalaryPct: '85.00' }),
      );
    });

    it('ngày ký sau ngày hiệu lực → 422 INVALID_SIGN_DATE', async () => {
      const error = await captureError(() =>
        service.create(makeCreateDto({ signDate: '2026-09-01' }), 2),
      );

      expect(error.code).toBe('INVALID_SIGN_DATE');
    });

    it('đã có hợp đồng active mà tạo tiếp bản active → 409 CONTRACT_ALREADY_ACTIVE', async () => {
      repository.findActiveByEmployee.mockResolvedValue(
        makeContract({ id: 3, status: ContractStatus.ACTIVE }),
      );

      const error = await captureError(() =>
        service.create(makeCreateDto({ status: ContractStatus.ACTIVE }), 2),
      );

      expect(error).toEqual({
        status: HttpStatus.CONFLICT,
        code: 'CONTRACT_ALREADY_ACTIVE',
      });
    });

    it('bản draft KHÔNG bị chặn bởi hợp đồng active đang có', async () => {
      repository.findActiveByEmployee.mockResolvedValue(
        makeContract({ id: 3, status: ContractStatus.ACTIVE }),
      );

      await expect(service.create(makeCreateDto(), 2)).resolves.toBeDefined();
    });

    it('đã ký 2 HĐ xác định thời hạn → 422 CONTRACT_TYPE_LIMIT', async () => {
      repository.countSignedFixedTerm.mockResolvedValue(2);

      const error = await captureError(() =>
        service.create(makeCreateDto({ status: ContractStatus.ACTIVE }), 2),
      );

      expect(error).toEqual({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        code: 'CONTRACT_TYPE_LIMIT',
      });
    });

    it('đã ký 2 HĐ xác định thời hạn nhưng ký loại không xác định → hợp lệ', async () => {
      repository.countSignedFixedTerm.mockResolvedValue(2);

      await expect(
        service.create(
          makeCreateDto({
            contractType: ContractType.INDEFINITE,
            endDate: null,
            status: ContractStatus.ACTIVE,
          }),
          2,
        ),
      ).resolves.toBeDefined();
    });

    it('không cho đặt thẳng status = expired/terminated', async () => {
      const error = await captureError(() =>
        service.create(makeCreateDto({ status: ContractStatus.EXPIRED }), 2),
      );

      expect(error.code).toBe('INVALID_CONTRACT_STATUS');
    });
  });

  // ----------------------------------------------------------- terminate ---

  describe('terminate', () => {
    it('đặt status = terminated kèm ngày + lý do', async () => {
      repository.findById.mockResolvedValue(
        makeContract({ status: ContractStatus.ACTIVE }),
      );

      await service.terminate(1, {
        terminatedDate: '2026-10-31',
        terminatedReason: 'Nhân viên xin thôi việc',
      });

      expect(repository.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          status: ContractStatus.TERMINATED,
          terminatedDate: '2026-10-31',
          terminatedReason: 'Nhân viên xin thôi việc',
        }),
      );
    });

    it('hợp đồng nháp không chấm dứt được → 422 CONTRACT_NOT_SIGNED', async () => {
      const error = await captureError(() =>
        service.terminate(1, {
          terminatedDate: '2026-10-31',
          terminatedReason: 'x',
        }),
      );

      expect(error.code).toBe('CONTRACT_NOT_SIGNED');
    });

    it('chấm dứt lần hai → 422 CONTRACT_ALREADY_TERMINATED', async () => {
      repository.findById.mockResolvedValue(
        makeContract({
          status: ContractStatus.TERMINATED,
          terminatedDate: '2026-09-01',
        }),
      );

      const error = await captureError(() =>
        service.terminate(1, {
          terminatedDate: '2026-10-31',
          terminatedReason: 'x',
        }),
      );

      expect(error.code).toBe('CONTRACT_ALREADY_TERMINATED');
    });

    it('ngày chấm dứt trước ngày bắt đầu → 422 INVALID_DATE_RANGE', async () => {
      repository.findById.mockResolvedValue(
        makeContract({ status: ContractStatus.ACTIVE }),
      );

      const error = await captureError(() =>
        service.terminate(1, {
          terminatedDate: '2026-01-01',
          terminatedReason: 'x',
        }),
      );

      expect(error.code).toBe('INVALID_DATE_RANGE');
    });
  });

  // -------------------------------------------------------------- remove ---

  describe('remove', () => {
    it('xoá được hợp đồng nháp', async () => {
      const result = await service.remove(1);

      expect(repository.remove).toHaveBeenCalledWith(1);
      expect(result).toEqual({ id: 1, deleted: true });
    });

    it('hợp đồng đã ký không xoá được → 422 CONTRACT_NOT_DELETABLE', async () => {
      repository.findById.mockResolvedValue(
        makeContract({ status: ContractStatus.ACTIVE }),
      );

      const error = await captureError(() => service.remove(1));

      expect(error).toEqual({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        code: 'CONTRACT_NOT_DELETABLE',
      });
      expect(repository.remove).not.toHaveBeenCalled();
    });

    it('hợp đồng không tồn tại → 404 CONTRACT_NOT_FOUND', async () => {
      repository.findById.mockResolvedValue(null);

      const error = await captureError(() => service.remove(99));

      expect(error).toEqual({
        status: HttpStatus.NOT_FOUND,
        code: 'CONTRACT_NOT_FOUND',
      });
    });
  });

  // ------------------------------------------------------------- findOne ---

  describe('findOne', () => {
    it('kiểm tra quyền qua hồ sơ nhân viên ký hợp đồng', async () => {
      await service.findOne(1, hrUser);

      expect(employeesService.findOne).toHaveBeenCalledWith(51, hrUser);
    });
  });
});
