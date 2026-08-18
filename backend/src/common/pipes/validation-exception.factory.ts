import { BadRequestException, ValidationError } from '@nestjs/common';
import {
  HttpExceptionBody,
  VALIDATION_ERROR_CODE,
  ValidationErrorDetail,
} from '../dto/error-response.dto';

/**
 * Maps a class-validator constraint name (camelCase) to a sensible
 * SNAKE_CASE error code. VN-specific business rules (CCCD, tax code, etc.)
 * will use their own custom validator decorators in later phases and can
 * return a custom code through this same mechanism.
 */
const CONSTRAINT_CODE_MAP: Record<string, string> = {
  isNotEmpty: 'REQUIRED',
  isDefined: 'REQUIRED',
  isEmail: 'INVALID_EMAIL',
  isString: 'INVALID_TYPE',
  isNumber: 'INVALID_TYPE',
  isInt: 'INVALID_TYPE',
  isBoolean: 'INVALID_TYPE',
  isArray: 'INVALID_TYPE',
  isDate: 'INVALID_DATE',
  isDateString: 'INVALID_DATE',
  isCalendarDate: 'INVALID_DATE',
  matches: 'INVALID_FORMAT',
  isEnum: 'INVALID_VALUE',
  isIn: 'INVALID_VALUE',
  minLength: 'INVALID_LENGTH',
  maxLength: 'INVALID_LENGTH',
  min: 'OUT_OF_RANGE',
  max: 'OUT_OF_RANGE',
  isPositive: 'OUT_OF_RANGE',
  isPhoneNumber: 'INVALID_PHONE',
  // Validator riêng cho định danh Việt Nam (common/validators/vn-identity.validator.ts).
  // Code lấy đúng theo api-spec.md §21 để frontend lookup i18n bằng code.
  isVnPhone: 'INVALID_PHONE',
  isCccdNumber: 'INVALID_CCCD',
  isTaxCode: 'INVALID_TAX_CODE',
  isSocialInsuranceNo: 'INVALID_SI_NUMBER',
  isHealthInsuranceNo: 'INVALID_HI_NUMBER',
  isVnPersonName: 'INVALID_NAME',
};

function camelToSnakeUpper(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[- ]/g, '_')
    .toUpperCase();
}

function constraintToCode(constraintKey: string): string {
  return CONSTRAINT_CODE_MAP[constraintKey] ?? camelToSnakeUpper(constraintKey);
}

function flattenErrors(
  errors: ValidationError[],
  parentPath = '',
): ValidationErrorDetail[] {
  const details: ValidationErrorDetail[] = [];

  for (const error of errors) {
    const field = parentPath
      ? `${parentPath}.${error.property}`
      : error.property;

    if (error.constraints) {
      for (const [constraintKey, message] of Object.entries(
        error.constraints,
      )) {
        details.push({
          field,
          code: constraintToCode(constraintKey),
          message,
        });
      }
    }

    if (error.children && error.children.length > 0) {
      details.push(...flattenErrors(error.children, field));
    }
  }

  return details;
}

/**
 * Used as the `exceptionFactory` for the global ValidationPipe (main.ts).
 * Throws a BadRequestException with the VALIDATION_ERROR body shape so
 * HttpExceptionFilter recognizes it and passes `details[]` through.
 */
export function validationExceptionFactory(
  errors: ValidationError[],
): BadRequestException {
  const details = flattenErrors(errors);

  const body: HttpExceptionBody = {
    code: VALIDATION_ERROR_CODE,
    message: 'Request validation failed',
    details,
  };

  return new BadRequestException(body);
}
