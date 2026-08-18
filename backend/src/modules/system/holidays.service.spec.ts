import { HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Holiday, HolidayType } from './entities/holiday.entity';
import { HolidaysRepository } from './holidays.repository';
import { HolidaysService } from './holidays.service';

function makeHoliday(overrides: Partial<Holiday> = {}): Holiday {
  return {
    id: 1,
    name: 'Tết Dương lịch',
    holidayDate: '2026-01-01',
    type: HolidayType.NATIONAL,
    year: 2026,
    isPaid: true,
    note: null,
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
            findByYear: jest.fn().mockResolvedValue([]),
            findById: jest.fn(),
            findByDate: jest.fn().mockResolvedValue(null),
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
        expect.objectContaining({ year: 2026, take: 100, sort: 'holidayDate' }),
      );
    });

    it('normalizes holidayDate to YYYY-MM-DD even when the driver returns a Date', async () => {
      repository.findPaginated.mockResolvedValue([
        [makeHoliday({ holidayDate: new Date(2026, 1, 17) as never })],
        1,
      ]);

      const result = await service.findAll({});

      expect(result.items[0].holidayDate).toBe('2026-02-17');
    });
  });

  describe('findByYear', () => {
    it('no year provided → uses the current year in Vietnam time (UTC+7)', async () => {
      const nowUtc = new Date('2026-12-31T18:30:00.000Z'); // 2027-01-01 01:30 Vietnam time
      jest.useFakeTimers().setSystemTime(nowUtc);

      await service.findByYear();

      expect(repository.findByYear).toHaveBeenCalledWith(2027);

      jest.useRealTimers();
    });

    it('year provided → uses the given year as-is, without deriving it', async () => {
      await service.findByYear(2020);

      expect(repository.findByYear).toHaveBeenCalledWith(2020);
    });
  });

  describe('create', () => {
    it('derives year from holidayDate (does not accept year from the client)', async () => {
      repository.create.mockResolvedValue(makeHoliday({ id: 30 }));
      repository.findById.mockResolvedValue(makeHoliday({ id: 30 }));

      await service.create({
        name: ' Ngày lễ mới ',
        holidayDate: '2027-05-01',
      });

      expect(repository.create).toHaveBeenCalledWith({
        name: 'Ngày lễ mới',
        holidayDate: '2027-05-01',
        year: 2027,
        type: HolidayType.NATIONAL,
        isPaid: true,
        note: null,
      });
    });

    it('duplicate date → 409 DUPLICATE_HOLIDAY_DATE', async () => {
      repository.findByDate.mockResolvedValue(makeHoliday());

      await expect(
        service.create({ name: 'Trùng', holidayDate: '2026-01-01' }),
      ).rejects.toMatchObject({
        status: HttpStatus.CONFLICT,
        response: { code: 'DUPLICATE_HOLIDAY_DATE' },
      });
      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('changing holidayDate → recomputes year, excludes itself from the duplicate check', async () => {
      repository.findById.mockResolvedValue(makeHoliday({ id: 3 }));

      await service.update(3, { holidayDate: '2028-09-02' });

      expect(repository.findByDate).toHaveBeenCalledWith('2028-09-02', 3);
      expect(repository.update).toHaveBeenCalledWith(3, {
        holidayDate: '2028-09-02',
        year: 2028,
      });
    });

    it('id not found → 404 HOLIDAY_NOT_FOUND', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.update(77, { name: 'X' })).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
        response: { code: 'HOLIDAY_NOT_FOUND' },
      });
    });

    it('explicit null on a non-nullable field (name) → 400 VALIDATION_ERROR, no update', async () => {
      repository.findById.mockResolvedValue(makeHoliday({ id: 3 }));

      await expect(
        service.update(3, { name: null } as never),
      ).rejects.toMatchObject({
        status: HttpStatus.BAD_REQUEST,
        response: { code: 'VALIDATION_ERROR' },
      });
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('null on a nullable field (note) is still accepted', async () => {
      repository.findById.mockResolvedValue(makeHoliday({ id: 3, note: 'x' }));

      await service.update(3, { note: null });

      expect(repository.update).toHaveBeenCalledWith(3, { note: null });
    });
  });

  describe('remove', () => {
    it('hard delete (holidays table has no deleted_at)', async () => {
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
