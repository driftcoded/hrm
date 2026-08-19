import { ForbiddenException, HttpException, HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthenticatedUser } from '@/common/types/authenticated-user';
import { EmployeesService } from '@/modules/employees/employees.service';
import {
  FamilyMember,
  FamilyRelationship,
} from './entities/family-member.entity';
import { FamilyMembersRepository } from './family-members.repository';
import { FamilyMembersService } from './family-members.service';

function makeMember(overrides: Partial<FamilyMember> = {}): FamilyMember {
  return {
    id: 1,
    employeeId: 51,
    employee: undefined,
    fullName: 'Nguyễn Thị Vợ',
    relationship: FamilyRelationship.SPOUSE,
    dateOfBirth: '1998-03-10',
    occupation: 'Giáo viên',
    phone: '0912345678',
    cccdNumber: null,
    note: null,
    createdAt: new Date('2026-08-19T02:00:00.000Z'),
    updatedAt: new Date('2026-08-19T02:00:00.000Z'),
    ...overrides,
  } as FamilyMember;
}

const hrUser: AuthenticatedUser = {
  userId: 3,
  username: 'hr.staff',
  role: 'hr_staff',
  employeeId: 3,
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

describe('FamilyMembersService', () => {
  let service: FamilyMembersService;
  let repository: jest.Mocked<FamilyMembersRepository>;
  let employeesService: jest.Mocked<EmployeesService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FamilyMembersService,
        {
          provide: FamilyMembersRepository,
          useValue: {
            findByEmployee: jest.fn().mockResolvedValue([makeMember()]),
            findById: jest.fn().mockResolvedValue(makeMember()),
            create: jest.fn().mockResolvedValue(makeMember({ id: 2 })),
            update: jest.fn().mockResolvedValue(undefined),
            remove: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: EmployeesService,
          useValue: { findOne: jest.fn().mockResolvedValue({ id: 51 }) },
        },
      ],
    }).compile();

    service = module.get(FamilyMembersService);
    repository = module.get(FamilyMembersRepository);
    employeesService = module.get(EmployeesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('kiểm tra quyền trên hồ sơ nhân viên trước khi trả dữ liệu', async () => {
      await service.findAll(51, hrUser);

      expect(employeesService.findOne).toHaveBeenCalledWith(51, hrUser);
    });

    it('không có quyền trên hồ sơ nhân viên → lỗi được đẩy lên nguyên vẹn', async () => {
      employeesService.findOne.mockRejectedValue(
        new ForbiddenException({ code: 'FORBIDDEN', message: 'nope' }),
      );

      const error = await captureError(() => service.findAll(51, hrUser));

      expect(error).toEqual({
        status: HttpStatus.FORBIDDEN,
        code: 'FORBIDDEN',
      });
      expect(repository.findByEmployee).not.toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('gắn employeeId lấy từ URL, không lấy từ body', async () => {
      await service.create(
        51,
        {
          fullName: 'Nguyễn Văn Con',
          relationship: FamilyRelationship.CHILD,
        },
        hrUser,
      );

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ employeeId: 51 }),
      );
    });

    it('chuẩn hoá số điện thoại', async () => {
      await service.create(
        51,
        {
          fullName: 'Nguyễn Thị Mẹ',
          relationship: FamilyRelationship.MOTHER,
          phone: '0912 345 678',
        },
        hrUser,
      );

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ phone: '0912345678' }),
      );
    });
  });

  describe('update', () => {
    it('chỉ ghi field có mặt trong body', async () => {
      await service.update(51, 1, { occupation: 'Nội trợ' }, hrUser);

      expect(repository.update).toHaveBeenCalledWith(1, {
        occupation: 'Nội trợ',
      });
    });

    it('gửi null cho field nullable = xoá giá trị', async () => {
      await service.update(51, 1, { phone: null }, hrUser);

      expect(repository.update).toHaveBeenCalledWith(1, { phone: null });
    });

    it('bản ghi thuộc nhân viên khác → 404, KHÔNG sửa (chống IDOR)', async () => {
      repository.findById.mockResolvedValue(makeMember({ employeeId: 99 }));

      const error = await captureError(() =>
        service.update(51, 1, { occupation: 'x' }, hrUser),
      );

      expect(error).toEqual({
        status: HttpStatus.NOT_FOUND,
        code: 'FAMILY_MEMBER_NOT_FOUND',
      });
      expect(repository.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('xoá bản ghi thuộc đúng nhân viên', async () => {
      const result = await service.remove(51, 1, hrUser);

      expect(repository.remove).toHaveBeenCalledWith(1);
      expect(result).toEqual({ id: 1, deleted: true });
    });

    it('bản ghi thuộc nhân viên khác → 404, KHÔNG xoá (chống IDOR)', async () => {
      repository.findById.mockResolvedValue(makeMember({ employeeId: 99 }));

      const error = await captureError(() => service.remove(51, 1, hrUser));

      expect(error.code).toBe('FAMILY_MEMBER_NOT_FOUND');
      expect(repository.remove).not.toHaveBeenCalled();
    });
  });
});
