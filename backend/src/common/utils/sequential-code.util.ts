import { ConflictException, Logger } from '@nestjs/common';
import { ObjectLiteral, Repository } from 'typeorm';

/**
 * Server-generated record codes (`PB0001`, `CV0001`, `NP0001`, `NV0001`…).
 *
 * Codes used to be typed in by hand. That is a poor deal for the user — they
 * have to invent an identifier before they can save anything — and it produces
 * inconsistent data (`IT`, `it`, `CNTT`, `IT_DEPT` for one department). The
 * server owns them now, and the API no longer accepts a code on create.
 *
 * Two properties this helper guarantees:
 *
 * 1. **Codes are never reused.** The next number comes from the highest code
 *    ever issued *including soft-deleted rows*, so a deleted department cannot
 *    hand its code to a new one. This also avoids resurrecting an identifier
 *    that still appears on paperwork or in another system.
 * 2. **Concurrent creates cannot collide.** `MAX(...) + 1` alone is a race: two
 *    requests reading at the same moment compute the same number. The database
 *    UNIQUE index is the real arbiter, so a duplicate-key error is caught, the
 *    number recomputed, and the insert retried.
 */

export const DEFAULT_CODE_DIGITS = 4;
export const DEFAULT_CODE_MAX_ATTEMPTS = 5;

export interface SequentialCodeConfig {
  /** Short entity prefix, e.g. `PB` for phòng ban. */
  prefix: string;
  /** Zero-padded width of the numeric part. */
  digits?: number;
  /** How many times to retry when another request steals the code. */
  maxAttempts?: number;
  /**
   * The DB column carrying the UNIQUE code (snake_case). Used to tell "someone
   * took my generated code" apart from an unrelated duplicate-key error, which
   * must not be swallowed by a retry.
   */
  uniqueColumn: string;
}

/**
 * Highest number currently issued for `<prefix><digits>` codes in a table.
 *
 * Only rows matching the generated pattern are considered, so legacy or
 * statutory codes that predate generation (`ADM`, `ANNUAL`, `STAFF`) are
 * ignored rather than breaking `CAST(...)`.
 *
 * @param softDeletable pass `true` for tables with `deleted_at` so deleted rows
 *   still reserve their code. TypeORM would otherwise filter them out and the
 *   next create would collide with a soft-deleted row that still holds the code.
 */
export async function findMaxCodeNumber<T extends ObjectLiteral>(
  repository: Repository<T>,
  alias: string,
  column: string,
  prefix: string,
  softDeletable: boolean,
): Promise<number> {
  const query = repository.createQueryBuilder(alias);

  if (softDeletable) {
    query.withDeleted();
  }

  const row = await query
    .select(
      `MAX(CAST(SUBSTRING(${alias}.${column}, ${prefix.length + 1}) AS UNSIGNED))`,
      'maxNumber',
    )
    .where(`${alias}.${column} REGEXP :pattern`, {
      pattern: `^${prefix}[0-9]+$`,
    })
    .getRawOne<{ maxNumber: string | number | null }>();

  return row?.maxNumber ? Number(row.maxNumber) : 0;
}

/** `('PB', 4, 7)` -> `'PB0007'`. */
export function formatSequentialCode(
  prefix: string,
  digits: number,
  value: number,
): string {
  return `${prefix}${String(value).padStart(digits, '0')}`;
}

/** True when MySQL rejected the insert because `column` already holds this value. */
export function isDuplicateKeyError(
  error: unknown,
  column: string,
): error is { code: string; message: string } {
  const driverError = error as { code?: string; message?: string } | null;

  return (
    driverError?.code === 'ER_DUP_ENTRY' &&
    (driverError.message ?? '').includes(column)
  );
}

/**
 * Allocates the next code and inserts, retrying if a concurrent request wins
 * the race for it.
 *
 * @param findMaxNumber Highest number issued so far — MUST include
 *   soft-deleted rows, or a code can be reused.
 * @param insert Performs the insert with the allocated code. Any error other
 *   than a duplicate on `uniqueColumn` propagates untouched.
 */
export async function createWithSequentialCode<T>(
  config: SequentialCodeConfig,
  findMaxNumber: () => Promise<number>,
  insert: (code: string) => Promise<T>,
  logger?: Logger,
): Promise<T> {
  const digits = config.digits ?? DEFAULT_CODE_DIGITS;
  const maxAttempts = config.maxAttempts ?? DEFAULT_CODE_MAX_ATTEMPTS;

  let nextNumber = (await findMaxNumber()) + 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const code = formatSequentialCode(config.prefix, digits, nextNumber);

    try {
      return await insert(code);
    } catch (error) {
      if (!isDuplicateKeyError(error, config.uniqueColumn)) {
        throw error;
      }

      logger?.warn(
        `Code ${code} was taken by a concurrent request (attempt ${attempt}); allocating the next one`,
      );
      nextNumber = (await findMaxNumber()) + 1;
    }
  }

  throw new ConflictException({
    code: 'CODE_ALLOCATION_FAILED',
    message: `Cannot allocate a unique ${config.prefix} code after ${maxAttempts} attempts`,
  });
}
