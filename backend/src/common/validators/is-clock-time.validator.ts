import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

const CLOCK_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

/**
 * `true` nếu là chuỗi giờ `HH:mm` hoặc `HH:mm:ss` hợp lệ.
 *
 * VÌ SAO CÓ VALIDATOR RIÊNG: cột `TIME` của MySQL nhận cả những giá trị mà
 * nghiệp vụ chấm công không có nghĩa gì — `'838:59:59'`, `'-12:00'`, `'25:00'`
 * — hoặc âm thầm cắt bớt, để lại một bản ghi chấm công sai giờ mà không ai báo
 * lỗi. Chặn ở tầng DTO thì client nhận VALIDATION_ERROR đúng chuẩn
 * (api-spec.md §21) thay vì một bản ghi rác hoặc lỗi 500 từ driver.
 *
 * Giây được CHO PHÉP vì máy chấm công xuất ra `08:00:59`, nhưng mọi phép tính
 * chỉ dùng tới phút — xem `parseTimeToMinutes` trong work-hours.util.ts.
 */
export function isClockTime(value: unknown): boolean {
  return typeof value === 'string' && CLOCK_TIME_PATTERN.test(value);
}

/** Giờ trong ngày dạng `HH:mm` (hoặc `HH:mm:ss`), từ 00:00 đến 23:59. */
export function IsClockTime(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return (target: object, propertyKey: string | symbol): void => {
    registerDecorator({
      name: 'isClockTime',
      target: target.constructor,
      propertyName: propertyKey as string,
      options: validationOptions,
      validator: {
        validate: (value: unknown): boolean => isClockTime(value),
        defaultMessage: (args: ValidationArguments): string =>
          `${args.property} must be a time in HH:mm format between 00:00 and 23:59`,
      },
    });
  };
}
