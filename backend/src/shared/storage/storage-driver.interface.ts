export interface StoredFile {
  /** Relative path within the store (S3 key / disk path). */
  key: string;
  /** URL usable directly by the frontend (`employees.avatar_url`). */
  url: string;
  driver: 'local' | 's3';
}

export interface PutObjectParams {
  key: string;
  body: Buffer;
  contentType: string;
}

/**
 * Common contract for all storage drivers. Business services only depend on
 * this interface, so switching between local and S3 doesn't require
 * changing any module's code.
 */
export interface StorageDriver {
  readonly kind: 'local' | 's3';
  put(params: PutObjectParams): Promise<StoredFile>;
  /** Removes an old file — must not throw when the file doesn't exist. */
  remove(key: string): Promise<void>;
}
