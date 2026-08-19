import { Avatar } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { EmployeeDetail } from '@/types/employee.types';
import { formatDate, formatDateTime, formatPhone } from '@/utils/format';
import styles from './EmployeePrintSheet.module.css';

/**
 * Phiếu hồ sơ nhân viên để IN — không hiện trên màn hình.
 *
 * VÌ SAO CÓ FILE NÀY: nút "In hồ sơ" trước đó gọi thẳng `window.print()`, tức
 * in nguyên trang web — sidebar, thanh tab, các nút bấm, và cả những trường
 * KHÔNG được phép ra giấy. Ở đây liệt kê tường minh từng trường được in.
 *
 * ===================== DANH SÁCH TRƯỜNG KHÔNG BAO GIỜ IN =====================
 * Nguyên tắc: không in thứ gì cho phép mạo danh hoặc gian lận tài chính, thứ
 * thuộc về NGƯỜI KHÁC, và ghi chú nội bộ. Tờ giấy in ra sẽ nằm trên bàn, trong
 * tủ, trong máy photocopy — nó rời khỏi mọi lớp phân quyền của phần mềm.
 *
 *   - Số CCCD, ngày cấp, nơi cấp   → đủ để mạo danh
 *   - Số tài khoản ngân hàng       → gian lận tài chính
 *   - Mã số thuế, số sổ BHXH/BHYT  → định danh với cơ quan nhà nước
 *   - Lương, phụ cấp               → riêng tư tài chính, và là dữ liệu HĐ
 *   - Người liên hệ khẩn cấp       → dữ liệu cá nhân của NGƯỜI THỨ BA, họ
 *                                    không hề đồng ý cho việc in này
 *   - Email cá nhân                → kênh riêng, không phải kênh công ty
 *   - Ghi chú nhân sự              → nhận xét nội bộ, không dành cho người
 *                                    ngoài bộ phận HR đọc
 *   - Người phụ thuộc              → dữ liệu thuế + thông tin người thứ ba
 *
 * Muốn thêm trường vào phiếu in thì thêm vào JSX bên dưới VÀ cân nhắc lại danh
 * sách này — mặc định của phiếu là không in, không phải in.
 */

export interface EmployeePrintSheetProps {
  employee: EmployeeDetail;
  /** Tên tỉnh/thành đã tra được; rơi về mã nếu danh mục chưa tải. */
  provinceName?: string;
  wardName?: string;
}

export function EmployeePrintSheet({
  employee,
  provinceName,
  wardName,
}: EmployeePrintSheetProps) {
  const { t } = useTranslation();
  const dash = '—';

  const row = (label: string, value: string | number | null | undefined) => (
    <div className={styles.row} key={label}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{value || dash}</span>
    </div>
  );

  const address = [employee.permanentAddress, wardName, provinceName]
    .filter(Boolean)
    .join(', ');

  return (
    // Lớp toàn cục (không phải CSS module) vì quy tắc @media print trong
    // index.css cần bám vào một tên ổn định để ẩn mọi thứ còn lại.
    <div className="hrm-print-sheet" aria-hidden="true">
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('employees.print.title')}</h1>
          <p className={styles.subtitle}>
            {t('employees.print.code')}: <strong>{employee.employeeCode}</strong>
          </p>
        </div>
        <Avatar
          size={84}
          shape="square"
          src={employee.avatarUrl ?? undefined}
          icon={<UserOutlined />}
        />
      </header>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t('employees.detail.sectionPersonal')}</h2>
        <div className={styles.grid}>
          {row(t('employees.fields.fullName'), employee.fullName)}
          {row(t('employees.fields.dateOfBirth'), formatDate(employee.dateOfBirth))}
          {row(t('employees.fields.gender'), t(`employees.gender.${employee.gender}`))}
          {row(
            t('employees.fields.maritalStatus'),
            t(`employees.maritalStatus.${employee.maritalStatus}`),
          )}
          {row(t('employees.fields.nationality'), employee.nationality)}
          {row(t('employees.fields.ethnicity'), employee.ethnicity)}
          {row(t('employees.fields.placeOfBirth'), employee.placeOfBirth)}
          {row(t('employees.fields.hometown'), employee.hometown)}
          {row(t('employees.fields.permanentAddress'), address)}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t('employees.detail.sectionJob')}</h2>
        <div className={styles.grid}>
          {row(t('employees.columns.department'), employee.department?.name)}
          {row(t('employees.columns.position'), employee.position?.name)}
          {row(t('employees.fields.hireDate'), formatDate(employee.hireDate))}
          {row(
            t('employees.fields.officialStart'),
            employee.officialStartDate ? formatDate(employee.officialStartDate) : null,
          )}
          {row(t('employees.columns.status'), t(`employees.status.${employee.status}`))}
          {row(t('employees.fields.directManager'), employee.directManager?.name)}
          {/* Chỉ kênh liên lạc CÔNG TY — email cá nhân không in. */}
          {row(t('employees.fields.email'), employee.email)}
          {row(t('employees.fields.phone'), formatPhone(employee.phone))}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t('employees.detail.sectionEducation')}</h2>
        <div className={styles.grid}>
          {row(
            t('employees.fields.educationLevel'),
            employee.educationLevel ? t(`employees.education.${employee.educationLevel}`) : null,
          )}
          {row(t('employees.fields.university'), employee.university)}
          {row(t('employees.fields.major'), employee.major)}
          {row(t('employees.fields.graduationYear'), employee.graduationYear)}
        </div>
      </section>

      <footer className={styles.footer}>
        <p className={styles.printedAt}>
          {t('employees.print.printedAt', { at: formatDateTime(new Date()) })}
        </p>
      </footer>
    </div>
  );
}
