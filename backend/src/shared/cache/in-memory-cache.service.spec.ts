import { InMemoryCacheService } from './in-memory-cache.service';

describe('InMemoryCacheService', () => {
  let cache: InMemoryCacheService;

  beforeEach(() => {
    cache = new InMemoryCacheService();
  });

  afterEach(() => {
    cache.onModuleDestroy();
    jest.useRealTimers();
  });

  it('set/get trả lại đúng value', async () => {
    await cache.set('k', { a: 1 });
    await expect(cache.get<{ a: number }>('k')).resolves.toEqual({ a: 1 });
  });

  it('get trả undefined khi key không tồn tại', async () => {
    await expect(cache.get('missing')).resolves.toBeUndefined();
  });

  it('del xoá key', async () => {
    await cache.set('k', 1);
    await cache.del('k');
    await expect(cache.get('k')).resolves.toBeUndefined();
  });

  it('key hết hạn theo TTL', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-01-01T00:00:00Z'));
    await cache.set('k', 'v', 60);
    jest.setSystemTime(new Date('2026-01-01T00:00:59Z'));
    await expect(cache.get('k')).resolves.toBe('v');
    jest.setSystemTime(new Date('2026-01-01T00:01:01Z'));
    await expect(cache.get('k')).resolves.toBeUndefined();
  });

  it('incr đếm tăng dần và KHÔNG gia hạn TTL sau lần đầu', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-01-01T00:00:00Z'));
    await expect(cache.incr('c', 60)).resolves.toBe(1);
    jest.setSystemTime(new Date('2026-01-01T00:00:30Z'));
    await expect(cache.incr('c', 60)).resolves.toBe(2);
    // TTL còn lại tính từ lần incr đầu tiên => 30s, không phải 60s.
    await expect(cache.ttl('c')).resolves.toBe(30);
    jest.setSystemTime(new Date('2026-01-01T00:01:01Z'));
    await expect(cache.get('c')).resolves.toBeUndefined();
  });

  it('ttl trả -2 khi thiếu key, -1 khi key không có TTL', async () => {
    await expect(cache.ttl('nope')).resolves.toBe(-2);
    await cache.set('forever', 1);
    await expect(cache.ttl('forever')).resolves.toBe(-1);
  });

  it('reset xoá toàn bộ key', async () => {
    await cache.set('a', 1);
    await cache.set('b', 2);
    await cache.reset();
    await expect(cache.get('a')).resolves.toBeUndefined();
    await expect(cache.get('b')).resolves.toBeUndefined();
  });
});
