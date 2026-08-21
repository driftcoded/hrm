/**
 * Hai nhóm màn hình cấu hình, TÁCH RIÊNG vì chúng phục vụ hai loại người dùng.
 *
 * `CATALOG_SECTIONS` là dữ liệu danh mục của nghiệp vụ — phòng ban, chức vụ,
 * loại phép… Nhân sự sửa chúng trong lúc làm việc hằng ngày, và nhiều phân hệ
 * cùng dùng chung (ngày lễ vừa vào chấm công, vừa vào nghỉ phép, vừa vào lương),
 * nên chúng đứng thành một nhóm riêng ở sidebar chứ không nằm trong Cài đặt.
 *
 * `SETTINGS_SECTIONS` là cấu hình HỆ THỐNG — thương hiệu, email. Cài một lần
 * lúc dựng hệ thống, chỉ admin đụng tới.
 *
 * Mỗi registry là nguồn duy nhất cho sidebar, bảng tiêu đề route và trang chỉ
 * mục của nó, nên thêm một màn hình là sửa một chỗ.
 */
export interface NavSection {
  /** Đoạn cuối của path — cũng là khoá của bảng icon ở trang chỉ mục. */
  id: string;
  path: string;
  titleKey: string;
  descriptionKey: string;
  /**
   * `true` = chỉ hiện với `useCanManageSettings()` (admin), thay vì nhóm rộng
   * hơn `useCanWriteMasterData()`.
   */
  adminOnly?: boolean;
}

/** Dữ liệu danh mục dùng chung giữa các phân hệ. */
export const CATALOG_SECTIONS: readonly NavSection[] = [
  {
    id: 'departments',
    path: '/catalog/departments',
    titleKey: 'nav.departments',
    descriptionKey: 'settings.index.departments',
  },
  {
    id: 'positions',
    path: '/catalog/positions',
    titleKey: 'nav.positions',
    descriptionKey: 'settings.index.positions',
  },
  {
    id: 'contract-types',
    path: '/catalog/contract-types',
    titleKey: 'nav.contractTypes',
    descriptionKey: 'settings.index.contractTypes',
  },
  {
    id: 'leave-types',
    path: '/catalog/leave-types',
    titleKey: 'nav.leaveTypes',
    descriptionKey: 'settings.index.leaveTypes',
  },
  {
    id: 'holidays',
    path: '/catalog/holidays',
    titleKey: 'nav.holidays',
    descriptionKey: 'settings.index.holidays',
  },
];

/** Cấu hình hệ thống — chỉ admin. */
export const SETTINGS_SECTIONS: readonly NavSection[] = [
  {
    id: 'branding',
    path: '/settings/branding',
    titleKey: 'nav.branding',
    descriptionKey: 'settings.index.branding',
    adminOnly: true,
  },
  {
    id: 'mail',
    path: '/settings/mail',
    titleKey: 'nav.mailSettings',
    descriptionKey: 'settings.index.mail',
    adminOnly: true,
  },
];

/**
 * Đường dẫn cũ `/settings/<id>` → đường dẫn mới, dùng để dựng redirect.
 *
 * Giữ link cũ sống: bookmark, tab đang mở và mọi link đã gửi cho nhau vẫn tới
 * đúng màn hình thay vì rơi về trang chủ.
 */
export const MOVED_SETTINGS_PATHS: ReadonlyArray<{ from: string; to: string }> =
  CATALOG_SECTIONS.map((section) => ({
    from: `/settings/${section.id}`,
    to: section.path,
  }));
