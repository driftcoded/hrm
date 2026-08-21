import { HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  Holiday,
  HolidayCalendar,
  HolidayType,
} from './entities/holiday.entity';
import { HolidaysRepository } from './holidays.repository';
import { HolidaysService } from './holidays.service';

function makeHoliday(overrides: Partial<Holiday> = {}): Holiday {
  return {
    id: 1,
    code: 'NEW_YEAR',
    name: 'Tết Dương lịch',
    type: HolidayType.NATIONAL,
    calendar: HolidayCalendar.SOLAR,
    month: 1,
    day: 1,
    offsetDays: 0,
    durationDays: 1,
    year: null,
    isPaid: true,
    isActive: true,
    sortOrder: 1,
    note: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

describe('HolidaysService', () => {
  let service: HolidaysService;
  let repository: jest.Mocked<HolidaysRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HolidaysService,
        {
          provide: HolidaysRepository,
          useValue: {
            findPaginated: jest.fn().mockResolvedValue([[], 0]),
            findActiveRules: jest.fn().mockResolvedValue([]),
            findAllRules: jest.fn().mockResolvedValue([]),
            findById: jest.fn(),
            findByCodeAndYear: jest.fn().mockResolvedValue(null),
            create: jest.fn(),
            update: jest.fn().mockResolvedValue(undefined),
            delete: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get(HolidaysService);
    repository = module.get(HolidaysRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('filters by year and clamps limit to 100', async () => {
      await service.findAll({ year: 2026, limit: 500 });

      expect(repository.findPaginated).toHaveBeenCalledWith(
        expect.objectContaining({ year: 2026, take: 100, sort: 'sortOrder' }),
      );
    });

    it('returns paginated rule definitions', async () => {
      const rule = makeHoliday({ id: 5 });
      repository.findPaginated.mockResolvedValue([[rule], 1]);
      repository.findById.mockResolvedValue(rule);

      const result = await service.findAll({});

      expect(result.meta.total).toBe(1);
      expect(result.items[0].code).toBe('NEW_YEAR');
    });
  });

  describe('findByYear', () => {
    it('returns empty array when no active rules', async () => {
      repository.findActiveRules.mockResolvedValue([]);

      const result = await service.findByYear(2026);

      expect(result).toEqual([]);
    });

    it('resolves active rules into concrete dates', async () => {
      repository.findActiveRules.mockResolvedValue([
        makeHoliday({ code: 'NEW_YEAR', calendar: HolidayCalendar.SOLAR, month: 1, day: 1 }),
      ]);

      const result = await service.findByYear(2026);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].holidayDate).toBe('2026-01-01');
      expect(result[0].code).toBe('NEW_YEAR');
    });
  });

  describe('create', () => {
    it('inserts a new rule and returns it', async () => {
      const created = makeHoliday({ id: 30, code: 'COMPANY_ANNIV' });
      repository.create.mockResolvedValue(created);
      repository.findById.mockResolvedValue(created);

      const result = await service.create({
        code: 'COMPANY_ANNIV',
        name: 'Ngày thành lập',
        month: 10,
        day: 15,
      });

      expect(repository.findByCodeAndYear).toHaveBeenCalledWith('COMPANY_ANNIV', null, undefined);
      expect(repository.create).toHaveBeenCalled();
      expect(result.code).toBe('COMPANY_ANNIV');
    });

    it('duplicate (code, year) → 409 DUPLICATE_HOLIDAY_CODE', async () => {
      repository.findByCodeAndYear.mockResolvedValue(makeHoliday());

      await expect(
        service.create({ code: 'NEW_YEAR', name: 'Trùng', month: 1, day: 1 }),
      ).rejects.toMatchObject({
        status: HttpStatus.CONFLICT,
        response: { code: 'DUPLICATE_HOLIDAY_CODE' },
      });
      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('updates name without touching code/year', async () => {
      repository.findById.mockResolvedValue(makeHoliday({ id: 3 }));

      await service.update(3, { name: 'Tên mới' });

      expect(repository.update).toHaveBeenCalledWith(3, { name: 'Tên mới' });
    });

    it('id not found → 404 HOLIDAY_NOT_FOUND', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.update(77, { name: 'X' })).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
        response: { code: 'HOLIDAY_NOT_FOUND' },
      });
    });

    it('null on a nullable field (note) is accepted', async () => {
      repository.findById.mockResolvedValue(makeHoliday({ id: 3, note: 'x' }));

      await service.update(3, { note: null });

      expect(repository.update).toHaveBeenCalledWith(3, { note: null });
    });
  });

  describe('remove', () => {
    it('hard delete returns confirmed result', async () => {
      repository.findById.mockResolvedValue(makeHoliday({ id: 12 }));

      const result = await service.remove(12);

      expect(repository.delete).toHaveBeenCalledWith(12);
      expect(result).toEqual({ id: 12, deleted: true });
    });

    it('id not found → 404, nothing deleted', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.remove(12)).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
        response: { code: 'HOLIDAY_NOT_FOUND' },
      });
      expect(repository.delete).not.toHaveBeenCalled();
    });
  });
});
