import { HttpException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthenticatedUser } from '@/common/types/authenticated-user';
import { EmployeesService } from '@/modules/employees/employees.service';
import {
  EmployeeTraining,
  TrainingResult,
} from './entities/employee-training.entity';
import {
  Training,
  TrainingStatus,
  TrainingType,
} from './entities/training.entity';
import { TrainingsRepository } from './trainings.repository';
import { TrainingsService } from './trainings.service';

const TRAINING_ID = 1;

const hrUser: AuthenticatedUser = {
  userId: 2,
  username: 'hr.manager',
  role: 'hr_manager',
  employeeId: 2,
  sessionId: 1,
};

function makeTraining(overrides: Partial<Training> = {}): Training {
  return {
    id: TRAINING_ID,
    code: 'TRN-2026-001',
    name: 'Kỹ năng lãnh đạo',
    type: TrainingType.EXTERNAL,
    description: null,
    startDate: '2026-06-10',
    endDate: '2026-06-12',
    location: 'Hà Nội',
    trainer: null,
    cost: '5000000.00',
    maxParticipants: 20,
    status: TrainingStatus.PLANNED,
    attachmentUrl: null,
    note: null,
    createdBy: 2,
    createdAt: new Date('2026-05-01T02:00:00.000Z'),
    updatedAt: new Date('2026-05-01T02:00:00.000Z'),
    ...overrides,
  } as unknown as Training;
}

function makeParticipant(
  overrides: Partial<EmployeeTraining> = {},
): EmployeeTraining {
  return {
    id: 15,
    employeeId: 51,
    trainingId: TRAINING_ID,
    registrationDate: '2026-05-20',
    completionDate: null,
    result: null,
    score: null,
    certificateUrl: null,
    note: null,
    employee: { id: 51, employeeCode: 'NV0051', fullName: 'Nguyễn Văn Bình' },
    ...overrides,
  } as unknown as EmployeeTraining;
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

describe('TrainingsService', () => {
  let module: TestingModule;
  let service: TrainingsService;
  let repository: jest.Mocked<TrainingsRepository>;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        TrainingsService,
        {
          provide: TrainingsRepository,
          useValue: {
            findPaginated: jest.fn().mockResolvedValue([[], 0]),
            findById: jest.fn().mockResolvedValue(makeTraining()),
            findByCode: jest.fn().mockResolvedValue(null),
            createTraining: jest.fn().mockResolvedValue(makeTraining()),
            saveTraining: jest.fn((training: Training) =>
              Promise.resolve(training),
            ),
            removeTraining: jest.fn().mockResolvedValue({ affected: 1 }),
            findParticipants: jest.fn().mockResolvedValue([]),
            countParticipants: jest.fn().mockResolvedValue(0),
            countByTrainings: jest.fn().mockResolvedValue(new Map()),
            findEnrolled: jest.fn().mockResolvedValue([]),
            findParticipant: jest.fn().mockResolvedValue(makeParticipant()),
            enroll: jest.fn().mockResolvedValue([]),
            saveParticipant: jest.fn((row: EmployeeTraining) =>
              Promise.resolve(row),
            ),
            removeParticipant: jest.fn().mockResolvedValue({ affected: 1 }),
            findByEmployee: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: EmployeesService,
          useValue: { findOne: jest.fn().mockResolvedValue({ id: 51 }) },
        },
      ],
    }).compile();

    service = module.get(TrainingsService);
    repository = module.get(TrainingsRepository);
  });

  afterEach(async () => {
    await module.close();
  });

  describe('vòng đời khoá học', () => {
    it.each([
      [TrainingStatus.PLANNED, TrainingStatus.ONGOING],
      [TrainingStatus.PLANNED, TrainingStatus.CANCELLED],
      [TrainingStatus.ONGOING, TrainingStatus.COMPLETED],
    ])('allows %s -> %s', async (from, to) => {
      repository.findById.mockResolvedValue(makeTraining({ status: from }));

      await service.update(TRAINING_ID, { status: to });

      expect(repository.saveTraining).toHaveBeenCalledWith(
        expect.objectContaining({ status: to }),
      );
    });

    // `completed` và `cancelled` là điểm cuối — chứng chỉ đã cấp không quay lại dở dang.
    it.each([
      [TrainingStatus.COMPLETED, TrainingStatus.ONGOING],
      [TrainingStatus.CANCELLED, TrainingStatus.PLANNED],
      [TrainingStatus.COMPLETED, TrainingStatus.CANCELLED],
    ])('refuses %s -> %s', async (from, to) => {
      repository.findById.mockResolvedValue(makeTraining({ status: from }));

      const error = await captureError(() =>
        service.update(TRAINING_ID, { status: to }),
      );

      expect(error).toEqual({
        status: 409,
        code: 'TRAINING_INVALID_TRANSITION',
      });
    });
  });

  describe('sức chứa', () => {
    it('refuses an enrolment that would exceed the cap', async () => {
      repository.findById.mockResolvedValue(
        makeTraining({ maxParticipants: 3 }),
      );
      repository.countParticipants.mockResolvedValue(2);

      const error = await captureError(() =>
        service.enroll(TRAINING_ID, { employeeIds: [51, 52] }, hrUser),
      );

      expect(error).toEqual({ status: 422, code: 'TRAINING_FULL' });
      expect(repository.enroll).not.toHaveBeenCalled();
    });

    it('allows an enrolment that exactly fills the course', async () => {
      repository.findById.mockResolvedValue(
        makeTraining({ maxParticipants: 3 }),
      );
      repository.countParticipants.mockResolvedValue(1);

      const result = await service.enroll(
        TRAINING_ID,
        { employeeIds: [51, 52] },
        hrUser,
      );

      expect(result.enrolled).toBe(2);
    });

    it('ignores the cap when there is none', async () => {
      repository.findById.mockResolvedValue(
        makeTraining({ maxParticipants: null }),
      );
      repository.countParticipants.mockResolvedValue(500);

      const result = await service.enroll(
        TRAINING_ID,
        { employeeIds: [51] },
        hrUser,
      );

      expect(result.enrolled).toBe(1);
    });

    it('refuses to set the cap below the number already enrolled', async () => {
      repository.countParticipants.mockResolvedValue(12);

      const error = await captureError(() =>
        service.update(TRAINING_ID, { maxParticipants: 10 }),
      );

      expect(error).toEqual({
        status: 422,
        code: 'TRAINING_CAPACITY_BELOW_ENROLLED',
      });
    });
  });

  describe('ghi danh', () => {
    // Ghi danh lại cả phòng sau khi thêm người mới là việc thường ngày.
    it('skips employees already on the course instead of failing the batch', async () => {
      repository.findEnrolled.mockResolvedValue([
        makeParticipant({ employeeId: 51 }),
      ]);

      const result = await service.enroll(
        TRAINING_ID,
        { employeeIds: [51, 52] },
        hrUser,
      );

      expect(result.enrolled).toBe(1);
      expect(result.alreadyEnrolled).toEqual(['NV0051']);
      expect(repository.enroll).toHaveBeenCalledWith([
        expect.objectContaining({ employeeId: 52 }),
      ]);
    });

    it('collapses a list that repeats the same employee', async () => {
      await service.enroll(TRAINING_ID, { employeeIds: [51, 51, 52] }, hrUser);

      expect(repository.enroll).toHaveBeenCalledWith([
        expect.objectContaining({ employeeId: 51 }),
        expect.objectContaining({ employeeId: 52 }),
      ]);
    });

    it.each([TrainingStatus.COMPLETED, TrainingStatus.CANCELLED])(
      'refuses to enrol on a %s course',
      async (status) => {
        repository.findById.mockResolvedValue(makeTraining({ status }));

        const error = await captureError(() =>
          service.enroll(TRAINING_ID, { employeeIds: [51] }, hrUser),
        );

        expect(error).toEqual({ status: 409, code: 'TRAINING_CLOSED' });
      },
    );
  });

  describe('kết quả học', () => {
    it('falls back to the course end date when no completion date is given', async () => {
      await service.complete(TRAINING_ID, 51, {
        result: TrainingResult.PASSED,
      });

      expect(repository.saveParticipant).toHaveBeenCalledWith(
        expect.objectContaining({ completionDate: '2026-06-12' }),
      );
    });

    it('keeps the completion date the caller gave', async () => {
      await service.complete(TRAINING_ID, 51, {
        result: TrainingResult.PASSED,
        completionDate: '2026-06-20',
      });

      expect(repository.saveParticipant).toHaveBeenCalledWith(
        expect.objectContaining({ completionDate: '2026-06-20' }),
      );
    });

    it('reports an employee who is not on the course', async () => {
      repository.findParticipant.mockResolvedValue(null);

      const error = await captureError(() =>
        service.complete(TRAINING_ID, 99, { result: TrainingResult.PASSED }),
      );

      expect(error).toEqual({
        status: 404,
        code: 'TRAINING_PARTICIPANT_NOT_FOUND',
      });
    });

    // Đã có kết quả là một dòng lịch sử đào tạo, có khi kèm chứng chỉ.
    it('refuses to remove a participant who already has a result', async () => {
      repository.findParticipant.mockResolvedValue(
        makeParticipant({ result: TrainingResult.PASSED }),
      );

      const error = await captureError(() => service.unenroll(TRAINING_ID, 51));

      expect(error).toEqual({ status: 422, code: 'TRAINING_RESULT_RECORDED' });
      expect(repository.removeParticipant).not.toHaveBeenCalled();
    });

    it('removes a participant who has not been graded', async () => {
      await service.unenroll(TRAINING_ID, 51);

      expect(repository.removeParticipant).toHaveBeenCalledWith(15);
    });
  });

  describe('xoá khoá học', () => {
    // FK là ON DELETE CASCADE nên xoá khoá sẽ kéo theo lịch sử đào tạo.
    it('refuses to delete a course that has participants', async () => {
      repository.countParticipants.mockResolvedValue(4);

      const error = await captureError(() => service.remove(TRAINING_ID));

      expect(error).toEqual({
        status: 422,
        code: 'TRAINING_HAS_PARTICIPANTS',
      });
      expect(repository.removeTraining).not.toHaveBeenCalled();
    });

    it('deletes a course nobody signed up for', async () => {
      await service.remove(TRAINING_ID);

      expect(repository.removeTraining).toHaveBeenCalledWith(TRAINING_ID);
    });
  });

  describe('mã khoá và khoảng ngày', () => {
    it('refuses a duplicate course code', async () => {
      repository.findByCode.mockResolvedValue(makeTraining());

      const error = await captureError(() =>
        service.create(
          {
            code: 'TRN-2026-001',
            name: 'Khoá khác',
            type: TrainingType.INTERNAL,
          },
          hrUser,
        ),
      );

      expect(error).toEqual({ status: 409, code: 'TRAINING_CODE_TAKEN' });
    });

    it('uppercases the course code', async () => {
      await service.create(
        { code: 'trn-2026-002', name: 'Khoá mới', type: TrainingType.INTERNAL },
        hrUser,
      );

      expect(repository.createTraining).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'TRN-2026-002' }),
      );
    });

    it('refuses an end date before the start date', async () => {
      const error = await captureError(() =>
        service.create(
          {
            code: 'TRN-2026-003',
            name: 'Khoá lỗi ngày',
            type: TrainingType.INTERNAL,
            startDate: '2026-06-10',
            endDate: '2026-06-01',
          },
          hrUser,
        ),
      );

      expect(error).toEqual({ status: 422, code: 'INVALID_TRAINING_RANGE' });
    });
  });
});
