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
 * Payload "không phải ảnh" đại diện cho một file thực thi được đổi tên thành
 * .jpg. Cố ý dựng bằng mã byte thay vì viết thẳng chuỗi script vào source:
 * antivirus của Windows quét cả file .ts trong repo và sẽ CÁCH LY file test
 * nếu nó chứa nguyên văn một web shell — mất file, không phải mất test.
 * Ở đây là `<?php ` (0x3c 0x3f 0x70 0x68 0x70 0x20) + phần đệm.
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
  it('nhận diện JPEG / PNG / WEBP theo magic bytes', () => {
    expect(detectImageKind(JPEG)?.mime).toBe('image/jpeg');
    expect(detectImageKind(PNG)?.mime).toBe('image/png');
    expect(detectImageKind(WEBP)?.mime).toBe('image/webp');
  });

  it('trả null cho nội dung không phải ảnh', () => {
    expect(detectImageKind(NON_IMAGE)).toBeNull();
  });

  it('trả null cho buffer quá ngắn để đọc chữ ký', () => {
    expect(detectImageKind(Buffer.from([0xff, 0xd8]))).toBeNull();
  });
});

describe('assertValidAvatar', () => {
  it('lấy đuôi file từ NỘI DUNG, không lấy từ tên file client gửi', () => {
    const result = assertValidAvatar(
      { buffer: PNG, size: PNG.length, originalname: 'anh.jpg' },
      MAX_BYTES,
    );

    expect(result.kind.extension).toBe('png');
  });

  it('thiếu file → 400 AVATAR_REQUIRED', () => {
    expect(errorCode(() => assertValidAvatar(undefined, MAX_BYTES))).toBe(
      'AVATAR_REQUIRED',
    );
  });

  it('file rỗng → 400 AVATAR_REQUIRED', () => {
    expect(
      errorCode(() =>
        assertValidAvatar({ buffer: Buffer.alloc(0), size: 0 }, MAX_BYTES),
      ),
    ).toBe('AVATAR_REQUIRED');
  });

  it('vượt 2MB → 400 AVATAR_TOO_LARGE', () => {
    const big = Buffer.concat([JPEG, Buffer.alloc(MAX_BYTES)]);

    expect(
      errorCode(() =>
        assertValidAvatar({ buffer: big, size: big.length }, MAX_BYTES),
      ),
    ).toBe('AVATAR_TOO_LARGE');
  });

  it('client khai size nhỏ hơn thực tế vẫn bị chặn (lấy max của 2 giá trị)', () => {
    const big = Buffer.concat([JPEG, Buffer.alloc(MAX_BYTES)]);

    expect(
      errorCode(() => assertValidAvatar({ buffer: big, size: 10 }, MAX_BYTES)),
    ).toBe('AVATAR_TOO_LARGE');
  });

  it('file thực thi đổi tên thành .jpg → 400 AVATAR_INVALID_TYPE', () => {
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

  it('đúng ngưỡng 2MB vẫn được chấp nhận', () => {
    const exact = Buffer.concat([JPEG, Buffer.alloc(MAX_BYTES - JPEG.length)]);

    expect(
      assertValidAvatar({ buffer: exact, size: exact.length }, MAX_BYTES).kind
        .mime,
    ).toBe('image/jpeg');
  });
});
