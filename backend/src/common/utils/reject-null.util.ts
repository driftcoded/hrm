import { BadRequestException } from '@nestjs/common';
import { VALIDATION_ERROR_CODE } from '../dto/error-response.dto';

/**
 * `PartialType()` makes every inherited field `@IsOptional()`, and
 * class-validator's `@IsOptional()` skips ALL validators when a value is
 * either `undefined` OR `null` — not just when the field is missing. So a
 * PATCH body like `{"code": null}` sails straight through `ValidationPipe`
 * even for fields whose real type has no `| null`, and only fails later
 * (a `TypeError`, or a raw DB `NOT NULL` violation) as an opaque 500 instead
 * of a clean 400. Call this at the top of a service's `update()` — after
 * `Object.keys()` only sees fields the client actually sent, so omitted
 * fields (real "no change") are unaffected.
 */
export function rejectUnexpectedNulls<T extends object>(
  dto: T,
  nullableFields: readonly (keyof T)[],
): void {
  const details = (Object.keys(dto) as (keyof T)[])
    .filter((field) => dto[field] === null && !nullableFields.includes(field))
    .map((field) => ({
      field: String(field),
      code: 'INVALID_TYPE',
      message: `${String(field)} must not be null`,
    }));

  if (details.length > 0) {
    throw new BadRequestException({
      code: VALIDATION_ERROR_CODE,
      message: 'Request validation failed',
      details,
    });
  }
}
