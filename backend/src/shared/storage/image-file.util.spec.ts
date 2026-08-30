import { HttpException } from '@nestjs/common';
import { assertValidAvatar, detectImageKind } from './image-file.util';

const JPEG = Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
  Buffer.alloc(16),
]);
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(16),
]);
const WEBP = Buffer.concat([
  Buffer.from('RIFF', 'ascii'),
  Buffer.alloc(4),
  Buffer.from('WEBP', 'ascii'),
  Buffer.alloc(16),
]);

/**
 * A "non-image" payload representing an executable file renamed to .jpg.
 * Deliberately built from raw byte codes instead of embedding the literal
 * script string in source: Windows antivirus scans .ts files in the repo
 * and will QUARANTINE the test file if it contains a literal web shell
 * signature — losing the file, not just failing the test.
 * This is `<?php ` (0x3c 0x3f 0x70 0x68 0x70 0x20) plus padding.
 */
const NON_IMAGE = Buffer.concat([
  Buffer.from([0x3c, 0x3f, 0x70, 0x68, 0x70, 0x20]),
  Buffer.alloc(32, 0x41),
]);

const MAX_BYTES = 2 * 1024 * 1024;

function errorCode(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    const body = (error as HttpException).getResponse() as { code: string };
    return body.code;
  }

  throw new Error('Expected the call to throw, but it returned');
}

describe('detectImageKind', () => {
  it('detects JPEG / PNG / WEBP by magic bytes', () => {
    expect(detectImageKind(JPEG)?.mime).toBe('image/jpeg');
    expect(detectImageKind(PNG)?.mime).toBe('image/png');
    expect(detectImageKind(WEBP)?.mime).toBe('image/webp');
  });

  it('returns null for non-image content', () => {
    expect(detectImageKind(NON_IMAGE)).toBeNull();
  });

  it('returns null when the buffer is too short to read a signature', () => {
    expect(detectImageKind(Buffer.from([0xff, 0xd8]))).toBeNull();
  });
});

describe('assertValidAvatar', () => {
  it('derives the file extension from CONTENT, not the client-supplied filename', () => {
    const result = assertValidAvatar(
      { buffer: PNG, size: PNG.length, originalname: 'anh.jpg' },
      MAX_BYTES,
    );

    expect(result.kind.extension).toBe('png');
  });

  it('missing file → 400 AVATAR_REQUIRED', () => {
    expect(errorCode(() => assertValidAvatar(undefined, MAX_BYTES))).toBe(
      'AVATAR_REQUIRED',
    );
  });

  it('empty file → 400 AVATAR_REQUIRED', () => {
    expect(
      errorCode(() =>
        assertValidAvatar({ buffer: Buffer.alloc(0), size: 0 }, MAX_BYTES),
      ),
    ).toBe('AVATAR_REQUIRED');
  });

  it('exceeds 2MB → 400 AVATAR_TOO_LARGE', () => {
    const big = Buffer.concat([JPEG, Buffer.alloc(MAX_BYTES)]);

    expect(
      errorCode(() =>
        assertValidAvatar({ buffer: big, size: big.length }, MAX_BYTES),
      ),
    ).toBe('AVATAR_TOO_LARGE');
  });

  it('client declaring a smaller size than actual is still blocked (uses the max of the two)', () => {
    const big = Buffer.concat([JPEG, Buffer.alloc(MAX_BYTES)]);

    expect(
      errorCode(() => assertValidAvatar({ buffer: big, size: 10 }, MAX_BYTES)),
    ).toBe('AVATAR_TOO_LARGE');
  });

  it('executable file renamed to .jpg → 400 AVATAR_INVALID_TYPE', () => {
    expect(
      errorCode(() =>
        assertValidAvatar(
          {
            buffer: NON_IMAGE,
            size: NON_IMAGE.length,
            originalname: 'avatar.jpg',
            mimetype: 'image/jpeg',
          },
          MAX_BYTES,
        ),
      ),
    ).toBe('AVATAR_INVALID_TYPE');
  });

  it('accepted exactly at the 2MB threshold', () => {
    const exact = Buffer.concat([JPEG, Buffer.alloc(MAX_BYTES - JPEG.length)]);

    expect(
      assertValidAvatar({ buffer: exact, size: exact.length }, MAX_BYTES).kind
        .mime,
    ).toBe('image/jpeg');
  });
});
