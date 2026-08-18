import { applyDecorators } from '@nestjs/common';
import { Transform, Type } from 'class-transformer';
import { IsBoolean } from 'class-validator';

/**
 * Converts `"true"/"false"/"1"/"0"` (query string, form input) to a boolean
 * before validating.
 *
 * ⚠️ Do NOT use `@IsBoolean()` alone on a boolean field: the global
 * ValidationPipe has `enableImplicitConversion: true` enabled, and under that
 * setting class-transformer implicitly coerces booleans via `Boolean(value)`
 * — so `?isActive=false` becomes `true` and silently produces the wrong
 * filter. `@Type(() => String)` blocks that implicit coercion, and the
 * `@Transform` below then decides the actual boolean value.
 *
 * Unrecognized values (`"yes"`, `2`, …) are not "guessed": they are passed
 * through unchanged so `@IsBoolean()` returns a VALIDATION_ERROR.
 */
export const IsBooleanValue = (): PropertyDecorator =>
  applyDecorators(
    Type(() => String),
    Transform(({ value }: { value: unknown }) => toBooleanValue(value)),
    IsBoolean(),
  );

export function toBooleanValue(value: unknown): unknown {
  if (typeof value === 'boolean' || value === undefined || value === null) {
    return value;
  }

  if (value === 'true' || value === '1') {
    return true;
  }

  if (value === 'false' || value === '0') {
    return false;
  }

  return value;
}
