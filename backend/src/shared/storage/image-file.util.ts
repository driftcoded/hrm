import { BadRequestException } from '@nestjs/common';

export interface ImageKind {
  mime: string;
  extension: string;
}

/**
 * Ảnh avatar được chấp nhận (api-spec.md §3 POST /employees/:id/avatar:
 * JPEG/PNG/WEBP, tối đa 2MB).
 */
export const ALLOWED_AVATAR_MIMES: readonly string[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
];

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

/**
 * Nhận dạng ảnh bằng MAGIC BYTES chứ không tin `originalname` hay `mimetype`
 * do client gửi lên (PLAN §8.1 – "validate magic bytes server-side, không chỉ
 * extension"): đổi tên `shell.php` thành `avatar.jpg` vẫn bị chặn.
 */
export function detectImageKind(buffer: Buffer): ImageKind | null {
  if (buffer.length < 12) {
    return null;
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mime: 'image/jpeg', extension: 'jpg' };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return { mime: 'image/png', extension: 'png' };
  }

  // WEBP: "RIFF" + 4 byte kích thước + "WEBP"
  if (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return { mime: 'image/webp', extension: 'webp' };
  }

  return null;
}

export interface UploadedFileLike {
  buffer?: Buffer;
  size?: number;
  originalname?: string;
  mimetype?: string;
}

export interface ValidatedAvatar {
  kind: ImageKind;
  buffer: Buffer;
}

/**
 * Kiểm tra file upload là ảnh hợp lệ và không vượt quá dung lượng cho phép.
 *
 * Ném 400 với `error.code` riêng (api-spec.md §21 chưa đặt tên nhóm này) thay
 * vì VALIDATION_ERROR: lỗi nằm ở phần multipart chứ không ở field JSON nào nên
 * không dựng được `details[].field` cho đúng format.
 */
export function assertValidAvatar(
  file: UploadedFileLike | undefined,
  maxBytes: number,
): ValidatedAvatar {
  if (!file?.buffer || file.buffer.length === 0) {
    throw new BadRequestException({
      code: 'AVATAR_REQUIRED',
      message: 'Avatar file is required in multipart field "avatar"',
    });
  }

  // `file.size` do multer đếm, `buffer.length` là sự thật – lấy giá trị lớn hơn
  // để client không lách bằng cách khai báo size nhỏ.
  const size = Math.max(file.size ?? 0, file.buffer.length);

  if (size > maxBytes) {
    throw new BadRequestException({
      code: 'AVATAR_TOO_LARGE',
      message: `Avatar must be at most ${maxBytes} bytes, received ${size}`,
    });
  }

  const kind = detectImageKind(file.buffer);

  if (!kind || !ALLOWED_AVATAR_MIMES.includes(kind.mime)) {
    throw new BadRequestException({
      code: 'AVATAR_INVALID_TYPE',
      message:
        'Avatar must be a JPEG, PNG or WEBP image (detected from file content, not from its extension)',
    });
  }

  return { kind, buffer: file.buffer };
}
