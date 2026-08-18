import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Returns `true` if value is a `YYYY-MM-DD` string AND a real calendar date.
 * `@IsDateString()` would accept something like `2026-02-31` (MySQL would
 * then throw → 500), so this dedicated validator exists to return a proper
 * VALIDATION_ERROR per api-spec.md §21.
 */
export function isCalendarDate(value: unknown): boolean {
  if (typeof value !== 'string' || !ISO_DATE_PATTERN.test(value)) {
    return false;
  }

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/** Date in `YYYY-MM-DD` format (api-spec.md §1.4) that must be a real calendar date. */
export function IsCalendarDate(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return (target: object, propertyKey: string | symbol): void => {
    registerDecorator({
      name: 'isCalendarDate',
      target: target.constructor,
      propertyName: propertyKey as string,
      options: validationOptions,
      validator: {
        validate: (value: unknown): boolean => isCalendarDate(value),
        defaultMessage: (args?: ValidationArguments): string =>
          `${args?.property ?? 'value'} must be a real date in YYYY-MM-DD format`,
      },
    });
  };
}
