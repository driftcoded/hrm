import { ConflictException } from '@nestjs/common';
import {
  createWithSequentialCode,
  formatSequentialCode,
  isDuplicateKeyError,
} from './sequential-code.util';

const CONFIG = { prefix: 'PB', digits: 4, uniqueColumn: 'code' };

function duplicateError(column = 'code'): Error & { code: string } {
  return Object.assign(
    new Error(`ER_DUP_ENTRY: Duplicate entry 'PB0001' for key '${column}'`),
    { code: 'ER_DUP_ENTRY' },
  );
}

describe('formatSequentialCode', () => {
  it('zero-pads to the configured width', () => {
    expect(formatSequentialCode('PB', 4, 7)).toBe('PB0007');
    expect(formatSequentialCode('NV', 4, 1234)).toBe('NV1234');
  });

  it('does not truncate a number wider than the padding', () => {
    // Better to issue a longer code than to hand out a duplicate.
    expect(formatSequentialCode('PB', 4, 12345)).toBe('PB12345');
  });
});

describe('isDuplicateKeyError', () => {
  it('recognises a duplicate on the watched column', () => {
    expect(isDuplicateKeyError(duplicateError(), 'code')).toBe(true);
  });

  it('ignores a duplicate on a different column', () => {
    // A duplicate CCCD must surface to the user, not trigger a code retry.
    expect(isDuplicateKeyError(duplicateError('cccd_number'), 'code')).toBe(
      false,
    );
  });

  it('ignores unrelated errors and non-errors', () => {
    expect(isDuplicateKeyError(new Error('connection lost'), 'code')).toBe(
      false,
    );
    expect(isDuplicateKeyError(null, 'code')).toBe(false);
    expect(isDuplicateKeyError(undefined, 'code')).toBe(false);
  });
});

describe('createWithSequentialCode', () => {
  it('allocates max + 1', async () => {
    const insert = jest.fn().mockResolvedValue('created');

    const result = await createWithSequentialCode(
      CONFIG,
      () => Promise.resolve(6),
      insert,
    );

    expect(result).toBe('created');
    expect(insert).toHaveBeenCalledWith('PB0007');
  });

  it('starts at 1 when nothing has been issued yet', async () => {
    const insert = jest.fn().mockResolvedValue('created');

    await createWithSequentialCode(CONFIG, () => Promise.resolve(0), insert);

    expect(insert).toHaveBeenCalledWith('PB0001');
  });

  it('retries with the next code when a concurrent request steals it', async () => {
    const findMaxNumber = jest
      .fn()
      .mockResolvedValueOnce(1) // -> PB0002, stolen
      .mockResolvedValueOnce(2); // -> PB0003, succeeds
    const insert = jest
      .fn()
      .mockRejectedValueOnce(duplicateError())
      .mockResolvedValueOnce('created');

    const result = await createWithSequentialCode(
      CONFIG,
      findMaxNumber,
      insert,
    );

    expect(result).toBe('created');
    expect(insert).toHaveBeenNthCalledWith(1, 'PB0002');
    expect(insert).toHaveBeenNthCalledWith(2, 'PB0003');
  });

  it('propagates an unrelated error without retrying', async () => {
    const insert = jest.fn().mockRejectedValue(new Error('connection lost'));

    await expect(
      createWithSequentialCode(CONFIG, () => Promise.resolve(0), insert),
    ).rejects.toThrow('connection lost');
    expect(insert).toHaveBeenCalledTimes(1);
  });

  it('propagates a duplicate on another column without retrying', async () => {
    const insert = jest.fn().mockRejectedValue(duplicateError('cccd_number'));

    await expect(
      createWithSequentialCode(CONFIG, () => Promise.resolve(0), insert),
    ).rejects.toMatchObject({ code: 'ER_DUP_ENTRY' });
    expect(insert).toHaveBeenCalledTimes(1);
  });

  it('gives up with CODE_ALLOCATION_FAILED after the attempt limit', async () => {
    const insert = jest.fn().mockRejectedValue(duplicateError());

    await expect(
      createWithSequentialCode(
        { ...CONFIG, maxAttempts: 3 },
        () => Promise.resolve(0),
        insert,
      ),
    ).rejects.toThrow(ConflictException);
    expect(insert).toHaveBeenCalledTimes(3);
  });
});
