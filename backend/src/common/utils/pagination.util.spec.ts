import { MAX_PAGE_LIMIT } from '../dto/pagination.dto';
import { resolvePagination } from './pagination.util';

describe('resolvePagination', () => {
  it('defaults to page=1, limit=20', () => {
    expect(resolvePagination({})).toEqual({ page: 1, limit: 20, skip: 0 });
  });

  it('computes skip from page/limit', () => {
    expect(resolvePagination({ page: 3, limit: 10 })).toEqual({
      page: 3,
      limit: 10,
      skip: 20,
    });
  });

  it.each([101, 1000, 999_999])(
    'caps limit=%s at the ceiling of 100 (PLAN §8.1)',
    (limit: number) => {
      expect(resolvePagination({ limit }).limit).toBe(MAX_PAGE_LIMIT);
    },
  );

  it('limit = 100 is kept as-is', () => {
    expect(resolvePagination({ limit: 100 }).limit).toBe(100);
  });

  it.each([0, -5, Number.NaN, Number.POSITIVE_INFINITY])(
    'nonsensical value (%s) → falls back to the default',
    (limit: number) => {
      expect(resolvePagination({ limit }).limit).toBe(20);
    },
  );

  it('page less than 1 → becomes 1', () => {
    expect(resolvePagination({ page: 0 })).toEqual({
      page: 1,
      limit: 20,
      skip: 0,
    });
  });

  it('truncates the decimal part instead of rounding (skip is always an integer)', () => {
    expect(resolvePagination({ page: 2.9, limit: 10.7 })).toEqual({
      page: 2,
      limit: 10,
      skip: 10,
    });
  });
});
