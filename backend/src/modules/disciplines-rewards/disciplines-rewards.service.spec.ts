import { HttpException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthenticatedUser } from '@/common/types/authenticated-user';
import { EmployeesService } from '@/modules/employees/employees.service';
import { DisciplinesRewardsRepository } from './disciplines-rewards.repository';
import { DisciplinesRewardsService } from './disciplines-rewards.service';
import {
  DisciplineReward,
  DisciplineRewardType,
} from './entities/discipline-reward.entity';

const EMPLOYEE_ID = 51;

const hrUser: AuthenticatedUser = {
  userId: 2,
  username: 'hr.manager',
  role: 'hr_manager',
  employeeId: 2,
  sessionId: 1,
};

function makeRecord(
  overrides: Partial<DisciplineReward> = {},
): DisciplineReward {
  return {
    id: 7,
    employeeId: EMPLOYEE_ID,
    type: DisciplineRewardType.REWARD,
    category: 'Thưởng KPI',
    title: 'Hoàn thành xuất sắc Q1/2026',
    description: 'Vượt KPI 120%',
    decisionNumber: 'QD-2026-001',
    decisionDate: '2026-04-01',
    effectiveDate: '2026-04-01',
    amount: '5000000.00',
    issuedBy: 3,
    issuer: null,
    documentUrl: null,
    note: null,
    createdAt: new Date('2026-04-01T02:00:00.000Z'),
    updatedAt: new Date('2026-04-01T02:00:00.000Z'),
    ...overrides,
  } as unknown as DisciplineReward;
}

function makeDto(overrides: Record<string, unknown> = {}) {
  return {
    type: DisciplineRewardType.REWARD,
    category: 'Thưởng KPI',
    title: 'Hoàn thành xuất sắc Q1/2026',
    description: 'Vượt KPI 120%',
    decisionDate: '2026-04-01',
    effectiveDate: '2026-04-01',
    ...overrides,
  } as never;
}

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

describe('DisciplinesRewardsService', () => {
  let module: TestingModule;
  let service: DisciplinesRewardsService;
  let repository: jest.Mocked<DisciplinesRewardsRepository>;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        DisciplinesRewardsService,
        {
          provide: DisciplinesRewardsRepository,
          useValue: {
            findByEmployee: jest.fn().mockResolvedValue([]),
            findById: jest.fn().mockResolvedValue(makeRecord()),
            create: jest.fn().mockResolvedValue(makeRecord()),
            save: jest.fn((record: DisciplineReward) =>
              Promise.resolve(record),
            ),
            remove: jest.fn().mockResolvedValue({ affected: 1 }),
          },
        },
        {
          provide: EmployeesService,
          useValue: {
            findOne: jest.fn().mockResolvedValue({ id: EMPLOYEE_ID }),
          },
        },
      ],
    }).compile();

    service = module.get(DisciplinesRewardsService);
    repository = module.get(DisciplinesRewardsRepository);
  });

  afterEach(async () => {
    await module.close();
  });

  describe('Điều 128 BLLĐ — kỷ luật không kèm tiền', () => {
    /*
     * Điều 128 BLLĐ 2019 CẤM phạt tiền và cấm trừ lương thay cho kỷ luật. Cột
     * `amount` có mặt vì khen thưởng cần nó; để nó nhận giá trị trên một dòng
     * kỷ luật là để sẵn một khoản phạt trái luật, có số quyết định đàng hoàng.
     */
    it('refuses an amount on a discipline record', async () => {
      const error = await captureError(() =>
        service.create(
          EMPLOYEE_ID,
          makeDto({
            type: DisciplineRewardType.DISCIPLINE,
            amount: 500_000,
          }),
          hrUser,
        ),
      );

      expect(error).toEqual({
        status: 422,
        code: 'DISCIPLINE_CANNOT_CARRY_AMOUNT',
      });
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('allows an amount on a reward', async () => {
      await service.create(
        EMPLOYEE_ID,
        makeDto({ type: DisciplineRewardType.REWARD, amount: 5_000_000 }),
        hrUser,
      );

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ amount: '5000000.00' }),
      );
    });

    it('allows a discipline with no amount at all', async () => {
      await service.create(
        EMPLOYEE_ID,
        makeDto({
          type: DisciplineRewardType.DISCIPLINE,
          category: 'Khiển trách',
        }),
        hrUser,
      );

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ amount: null }),
      );
    });

    /*
     * Kiểm trên bản ĐÃ GHÉP: đổi riêng `type` sang kỷ luật mà giữ nguyên số tiền
     * cũ vẫn là một khoản phạt, và chỉ nhìn phần sửa thì không thấy điều đó.
     */
    it('catches a reward with money being flipped into a discipline', async () => {
      repository.findById.mockResolvedValue(
        makeRecord({ type: DisciplineRewardType.REWARD, amount: '5000000.00' }),
      );

      const error = await captureError(() =>
        service.update(
          EMPLOYEE_ID,
          7,
          { type: DisciplineRewardType.DISCIPLINE },
          hrUser,
        ),
      );

      expect(error).toEqual({
        status: 422,
        code: 'DISCIPLINE_CANNOT_CARRY_AMOUNT',
      });
    });

    /*
     * PHẢI CÓ ĐƯỜNG XOÁ SỐ TIỀN, nếu không một khen thưởng có tiền sẽ không bao
     * giờ sửa được thành kỷ luật: ràng buộc Điều 128 chặn vĩnh viễn, và người
     * dùng chỉ còn cách xoá bản ghi rồi nhập lại, mất luôn số quyết định gốc.
     */
    it.each([[0], [null]])(
      'lets the flip through when the money is cleared with %p',
      async (amount) => {
        repository.findById.mockResolvedValue(
          makeRecord({
            type: DisciplineRewardType.REWARD,
            amount: '5000000.00',
          }),
        );

        await service.update(
          EMPLOYEE_ID,
          7,
          {
            type: DisciplineRewardType.DISCIPLINE,
            amount: amount as unknown as number,
          },
          hrUser,
        );

        expect(repository.save).toHaveBeenCalledWith(
          expect.objectContaining({
            type: DisciplineRewardType.DISCIPLINE,
            amount: null,
          }),
        );
      },
    );
  });

  describe('ngày quyết định và ngày hiệu lực', () => {
    /*
     * Hiệu lực trước ngày ký là kỷ luật hồi tố — không đứng vững ở bất kỳ cuộc
     * thanh tra nào.
     */
    it('refuses an effective date before the decision date', async () => {
      const error = await captureError(() =>
        service.create(
          EMPLOYEE_ID,
          makeDto({ decisionDate: '2026-05-20', effectiveDate: '2026-05-01' }),
          hrUser,
        ),
      );

      expect(error).toEqual({ status: 422, code: 'EFFECTIVE_BEFORE_DECISION' });
    });

    it('accepts a decision that takes effect later', async () => {
      await service.create(
        EMPLOYEE_ID,
        makeDto({ decisionDate: '2026-05-20', effectiveDate: '2026-06-01' }),
        hrUser,
      );

      expect(repository.create).toHaveBeenCalled();
    });
  });

  describe('bản ghi phải thuộc đúng nhân viên', () => {
    /*
     * Thiếu bước này thì `/employees/1/disciplines-rewards/999` sẽ sửa được
     * quyết định của nhân viên 42, chỉ vì người gọi xem được hồ sơ nhân viên 1.
     */
    it('refuses to touch a record belonging to someone else', async () => {
      repository.findById.mockResolvedValue(makeRecord({ employeeId: 99 }));

      const error = await captureError(() =>
        service.update(EMPLOYEE_ID, 7, { title: 'Sửa trộm' }, hrUser),
      );

      expect(error).toEqual({
        status: 404,
        code: 'DISCIPLINE_REWARD_NOT_FOUND',
      });
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('applies the same check when deleting', async () => {
      repository.findById.mockResolvedValue(makeRecord({ employeeId: 99 }));

      const error = await captureError(() =>
        service.remove(EMPLOYEE_ID, 7, hrUser),
      );

      expect(error).toEqual({
        status: 404,
        code: 'DISCIPLINE_REWARD_NOT_FOUND',
      });
      expect(repository.remove).not.toHaveBeenCalled();
    });
  });
});
