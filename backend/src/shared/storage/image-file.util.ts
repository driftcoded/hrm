import { BadRequestException } from '@nestjs/common';

export interface ImageKind {
  mime: string;
  extension: string;
}

/**
 * Accepted avatar image types (api-spec.md §3 POST /employees/:id/avatar:
 * JPEG/PNG/WEBP, max 2MB).
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
 * Detects image type from MAGIC BYTES rather than trusting the
 * client-supplied `originalname` or `mimetype` (PLAN §8.1 – "validate magic
 * bytes server-side, not just the extension"): renaming `shell.php` to
 * `avatar.jpg` is still rejected.
 */
export function detectImageKind(buffer: Buffer): ImageKind | null {
  if (buffer.length < 12) {
    return null;
  }

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mime: 'image/jpeg', extension: 'jpg' };
  }

  if (buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return { mime: 'image/png', extension: 'png' };
  }

  // WEBP container: "RIFF" tag + 4-byte chunk size (skipped) + "WEBP" tag
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
 * Validates that an uploaded file is a valid image within the allowed size.
 *
 * Throws 400 with a dedicated `error.code` (api-spec.md §21 does not name
 * this group yet) instead of VALIDATION_ERROR: the failure is in the
 * multipart part, not in a JSON field, so there's no `details[].field` to
 * build in the standard format.
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

  // `file.size` is what multer reports, `buffer.length` is the ground truth –
  // use whichever is larger so a client can't bypass the limit by declaring
  // a smaller size.
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

/**
 * Generalized version of `assertValidAvatar` for other system images (logo,
 * favicon): same rules (magic bytes, JPEG/PNG/WEBP, size limit) but with
 * caller-specific error codes/field names instead of the hardcoded
 * `AVATAR_*` prefix.
 */
export function assertValidImage(
  file: UploadedFileLike | undefined,
  maxBytes: number,
  options: { errorCodePrefix: string; label: string; multipartField: string },
): ValidatedAvatar {
  if (!file?.buffer || file.buffer.length === 0) {
    throw new BadRequestException({
      code: `${options.errorCodePrefix}_REQUIRED`,
      message: `${options.label} file is required in multipart field "${options.multipartField}"`,
    });
  }

  const size = Math.max(file.size ?? 0, file.buffer.length);

  if (size > maxBytes) {
    throw new BadRequestException({
      code: `${options.errorCodePrefix}_TOO_LARGE`,
      message: `${options.label} must be at most ${maxBytes} bytes, received ${size}`,
    });
  }

  const kind = detectImageKind(file.buffer);

  if (!kind || !ALLOWED_AVATAR_MIMES.includes(kind.mime)) {
    throw new BadRequestException({
      code: `${options.errorCodePrefix}_INVALID_TYPE`,
      message: `${options.label} must be a JPEG, PNG or WEBP image (detected from file content, not from its extension)`,
    });
  }

  return { kind, buffer: file.buffer };
}
