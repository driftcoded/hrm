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

  it('set/get returns the correct value', async () => {
    await cache.set('k', { a: 1 });
    await expect(cache.get<{ a: number }>('k')).resolves.toEqual({ a: 1 });
  });

  it('get returns undefined when the key does not exist', async () => {
    await expect(cache.get('missing')).resolves.toBeUndefined();
  });

  it('del removes the key', async () => {
    await cache.set('k', 1);
    await cache.del('k');
    await expect(cache.get('k')).resolves.toBeUndefined();
  });

  it('key expires according to its TTL', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-01-01T00:00:00Z'));
    await cache.set('k', 'v', 60);
    jest.setSystemTime(new Date('2026-01-01T00:00:59Z'));
    await expect(cache.get('k')).resolves.toBe('v');
    jest.setSystemTime(new Date('2026-01-01T00:01:01Z'));
    await expect(cache.get('k')).resolves.toBeUndefined();
  });

  it('incr counts up and does NOT extend the TTL after the first call', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-01-01T00:00:00Z'));
    await expect(cache.incr('c', 60)).resolves.toBe(1);
    jest.setSystemTime(new Date('2026-01-01T00:00:30Z'));
    await expect(cache.incr('c', 60)).resolves.toBe(2);
    // Remaining TTL is counted from the first incr call => 30s, not 60s.
    await expect(cache.ttl('c')).resolves.toBe(30);
    jest.setSystemTime(new Date('2026-01-01T00:01:01Z'));
    await expect(cache.get('c')).resolves.toBeUndefined();
  });

  it('ttl returns -2 when the key is missing, -1 when the key has no TTL', async () => {
    await expect(cache.ttl('nope')).resolves.toBe(-2);
    await cache.set('forever', 1);
    await expect(cache.ttl('forever')).resolves.toBe(-1);
  });

  it('reset clears all keys', async () => {
    await cache.set('a', 1);
    await cache.set('b', 2);
    await cache.reset();
    await expect(cache.get('a')).resolves.toBeUndefined();
    await expect(cache.get('b')).resolves.toBeUndefined();
  });
});
