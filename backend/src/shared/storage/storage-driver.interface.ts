export interface StoredFile {
  /** Đường dẫn tương đối bên trong kho (key S3 / path đĩa). */
  key: string;
  /** URL dùng được ngay ở frontend (`employees.avatar_url`). */
  url: string;
  driver: 'local' | 's3';
}

export interface PutObjectParams {
  key: string;
  body: Buffer;
  contentType: string;
}

/**
 * Hợp đồng chung của mọi driver lưu trữ. Service nghiệp vụ chỉ biết interface
 * này nên đổi local ↔ S3 không phải sửa code module nào.
 */
export interface StorageDriver {
  readonly kind: 'local' | 's3';
  put(params: PutObjectParams): Promise<StoredFile>;
  /** Xoá file cũ – không được ném lỗi khi file không tồn tại. */
  remove(key: string): Promise<void>;
}
