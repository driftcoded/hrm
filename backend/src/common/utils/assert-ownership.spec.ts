import { ForbiddenException, HttpStatus } from '@nestjs/common';
import { AuthenticatedUser } from '../types/authenticated-user';
import {
  assertOwnership,
  EMPLOYEE_RECORD_PRIVILEGED_ROLES,
  isOwnerOrPrivileged,
} from './assert-ownership';

function makeUser(
  overrides: Partial<AuthenticatedUser> = {},
): AuthenticatedUser {
  return {
    userId: 10,
    username: 'an.nguyen',
    role: 'employee',
    employeeId: 4,
    sessionId: 1,
    ...overrides,
  };
}

describe('assertOwnership', () => {
  it('cho qua khi employee truy cập resource của chính mình', () => {
    expect(() => assertOwnership(makeUser(), 4)).not.toThrow();
  });

  it('ném 403 FORBIDDEN khi NV A truy cập resource của NV B', () => {
    expect.assertions(3);
    try {
      assertOwnership(makeUser({ employeeId: 4 }), 5, {
        resource: 'salary 99',
      });
    } catch (error) {
      expect(error).toBeInstanceOf(ForbiddenException);
      const exception = error as ForbiddenException;
      expect(exception.getStatus()).toBe(HttpStatus.FORBIDDEN);
      expect(exception.getResponse()).toMatchObject({ code: 'FORBIDDEN' });
    }
  });

  it.each(EMPLOYEE_RECORD_PRIVILEGED_ROLES)(
    'cho qua với role đặc quyền "%s" dù không phải chủ resource',
    (role) => {
      expect(() => assertOwnership(makeUser({ role }), 999)).not.toThrow();
    },
  );

  it('KHÔNG cho manager đi qua theo mặc định (cần kiểm tra theo phòng ban ở tầng service)', () => {
    expect(() => assertOwnership(makeUser({ role: 'manager' }), 999)).toThrow(
      ForbiddenException,
    );
  });

  it('cho manager đi qua khi endpoint truyền privilegedRoles tường minh', () => {
    expect(() =>
      assertOwnership(makeUser({ role: 'manager' }), 999, {
        privilegedRoles: ['admin', 'manager'],
      }),
    ).not.toThrow();
  });

  it('ném 403 khi request chưa đăng nhập (fail closed)', () => {
    expect(() => assertOwnership(undefined, 4)).toThrow(ForbiddenException);
    expect(() => assertOwnership(null, 4)).toThrow(ForbiddenException);
  });

  it('ném 403 khi resource không có chủ sở hữu (null/undefined) và user không đặc quyền', () => {
    expect(() => assertOwnership(makeUser(), null)).toThrow(ForbiddenException);
    expect(() => assertOwnership(makeUser(), undefined)).toThrow(
      ForbiddenException,
    );
  });

  it('cho qua role đặc quyền dù resource không có chủ sở hữu', () => {
    expect(() =>
      assertOwnership(makeUser({ role: 'admin' }), null),
    ).not.toThrow();
  });

  it('ném 403 khi user chưa liên kết hồ sơ nhân viên', () => {
    expect(() => assertOwnership(makeUser({ employeeId: null }), 4)).toThrow(
      ForbiddenException,
    );
  });

  it('KHÔNG coi employeeId null của user là "khớp" với resource không chủ', () => {
    expect(() => assertOwnership(makeUser({ employeeId: null }), null)).toThrow(
      ForbiddenException,
    );
  });

  it('so khớp đúng khi id đến từ DB dưới dạng string (bigint MySQL)', () => {
    expect(() =>
      assertOwnership(makeUser({ employeeId: 4 }), '4'),
    ).not.toThrow();
    expect(() => assertOwnership(makeUser({ employeeId: 4 }), '5')).toThrow(
      ForbiddenException,
    );
  });

  it('message chứa đủ ngữ cảnh để debug nhưng không lộ dữ liệu nhạy cảm', () => {
    try {
      assertOwnership(makeUser(), 5, { resource: 'employee 5 profile' });
      throw new Error('should have thrown');
    } catch (error) {
      const body = (error as ForbiddenException).getResponse() as {
        code: string;
        message: string;
      };
      expect(body.message).toContain('employee 5 profile');
      expect(body.message).toContain('User 10');
    }
  });
});

describe('isOwnerOrPrivileged', () => {
  it('trả true/false thay vì ném lỗi', () => {
    expect(isOwnerOrPrivileged(makeUser(), 4)).toBe(true);
    expect(isOwnerOrPrivileged(makeUser(), 5)).toBe(false);
    expect(isOwnerOrPrivileged(makeUser({ role: 'hr_staff' }), 5)).toBe(true);
    expect(isOwnerOrPrivileged(undefined, 5)).toBe(false);
  });
});
