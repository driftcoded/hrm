import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

/**
 * Validator cho các định danh theo chuẩn Việt Nam
 * (CLAUDE.md §"Validation chuẩn Việt Nam" + database-schema.md §2.3).
 *
 * Mỗi decorator ở đây dùng một tên constraint riêng để
 * `validation-exception.factory.ts` map sang đúng `error.details[].code` mà
 * api-spec.md §21 đã đặt tên (INVALID_CCCD, INVALID_PHONE, ...) — frontend
 * lookup i18n bằng code chứ không đọc message tiếng Anh.
 */

/** CCCD: đúng 12 chữ số. */
export const CCCD_PATTERN = /^\d{12}$/;

/** MST cá nhân: 10 số, hoặc 10 số + `-` + 3 số (MST phụ thuộc). */
export const TAX_CODE_PATTERN = /^\d{10}(-\d{3})?$/;

/** Số sổ BHXH: đúng 10 chữ số. */
export const SOCIAL_INSURANCE_PATTERN = /^\d{10}$/;

/**
 * Số thẻ BHYT: 15 ký tự, 2 chữ cái mã đối tượng + 1 số mức hưởng + 12 số.
 * Ví dụ: `DN4010000123456`.
 */
export const HEALTH_INSURANCE_PATTERN = /^[A-Za-z]{2}\d{13}$/;

/**
 * SĐT Việt Nam: `0` + 9 chữ số, hoặc `+84` + 9 chữ số.
 * Cho phép khoảng trắng/dấu chấm/gạch khi nhập — chuẩn hoá trước khi so khớp.
 */
export const VN_PHONE_PATTERN = /^(0\d{9}|\+84\d{9})$/;

/** Bỏ khoảng trắng và các dấu phân cách người dùng hay gõ trong SĐT. */
export function normalizePhone(value: string): string {
  return value.replace(/[\s.\-()]/g, '');
}

function buildValidator(
  name: string,
  test: (value: unknown) => boolean,
  message: (property: string) => string,
) {
  return (validationOptions?: ValidationOptions): PropertyDecorator =>
    (target: object, propertyKey: string | symbol): void => {
      registerDecorator({
        name,
        target: target.constructor,
        propertyName: propertyKey as string,
        options: validationOptions,
        validator: {
          validate: (value: unknown): boolean => test(value),
          defaultMessage: (args?: ValidationArguments): string =>
            message(args?.property ?? 'value'),
        },
      });
    };
}

const isStringMatching =
  (pattern: RegExp) =>
  (value: unknown): boolean =>
    typeof value === 'string' && pattern.test(value);

export const isCccdNumber = isStringMatching(CCCD_PATTERN);
export const isTaxCode = isStringMatching(TAX_CODE_PATTERN);
export const isSocialInsuranceNo = isStringMatching(SOCIAL_INSURANCE_PATTERN);
export const isHealthInsuranceNo = isStringMatching(HEALTH_INSURANCE_PATTERN);

export const isVnPhone = (value: unknown): boolean =>
  typeof value === 'string' && VN_PHONE_PATTERN.test(normalizePhone(value));

export const IsCccdNumber = buildValidator(
  'isCccdNumber',
  isCccdNumber,
  (property) => `${property} must be exactly 12 digits`,
);

export const IsTaxCode = buildValidator(
  'isTaxCode',
  isTaxCode,
  (property) => `${property} must be 10 digits, optionally followed by -XXX`,
);

export const IsSocialInsuranceNo = buildValidator(
  'isSocialInsuranceNo',
  isSocialInsuranceNo,
  (property) => `${property} must be exactly 10 digits`,
);

export const IsHealthInsuranceNo = buildValidator(
  'isHealthInsuranceNo',
  isHealthInsuranceNo,
  (property) =>
    `${property} must be 15 characters: 2 letters followed by 13 digits`,
);

export const IsVnPhone = buildValidator(
  'isVnPhone',
  isVnPhone,
  (property) =>
    `${property} must be a Vietnamese phone number (0xxxxxxxxx or +84xxxxxxxxx)`,
);

/**
 * Một thành phần họ/tên người Việt: chữ cái (có dấu) và khoảng trắng.
 * Chặn chữ số + ký tự đặc biệt (`<script>` …) ngay từ tầng validate.
 */
export const VN_NAME_PATTERN = /^[A-Za-zÀ-ỹ]+(?:[ ][A-Za-zÀ-ỹ]+)*$/;

export const isVnPersonName = (value: unknown): boolean =>
  typeof value === 'string' && VN_NAME_PATTERN.test(value.trim());

export const IsVnPersonName = buildValidator(
  'isVnPersonName',
  isVnPersonName,
  (property) =>
    `${property} must contain only letters (Vietnamese diacritics allowed) and single spaces`,
);
