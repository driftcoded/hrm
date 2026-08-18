import { BadRequestException } from '@nestjs/common';
import { rejectUnexpectedNulls } from './reject-null.util';

describe('rejectUnexpectedNulls', () => {
  it('does nothing when no field is null', () => {
    expect(() =>
      rejectUnexpectedNulls({ code: 'HR', isActive: true }, []),
    ).not.toThrow();
  });

  it('ignores fields the client never sent (undefined)', () => {
    expect(() => rejectUnexpectedNulls({ code: undefined }, [])).not.toThrow();
  });

  it('throws a VALIDATION_ERROR for a null non-nullable field', () => {
    expect(() => rejectUnexpectedNulls({ code: null }, [])).toThrow(
      BadRequestException,
    );

    try {
      rejectUnexpectedNulls({ code: null }, []);
    } catch (error) {
      expect((error as BadRequestException).getResponse()).toMatchObject({
        code: 'VALIDATION_ERROR',
        details: [{ field: 'code', code: 'INVALID_TYPE' }],
      });
    }
  });

  it('allows null for fields explicitly listed as nullable', () => {
    expect(() =>
      rejectUnexpectedNulls({ parentId: null }, ['parentId']),
    ).not.toThrow();
  });

  it('reports every offending field, not just the first', () => {
    try {
      rejectUnexpectedNulls({ code: null, name: null, parentId: null }, [
        'parentId',
      ]);
      throw new Error('expected rejectUnexpectedNulls to throw');
    } catch (error) {
      const details = (error as BadRequestException).getResponse() as {
        details: { field: string }[];
      };
      expect(details.details.map((d) => d.field).sort()).toEqual([
        'code',
        'name',
      ]);
    }
  });
});
