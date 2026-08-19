import { useTranslation } from 'react-i18next';
import type { Salary } from '@/types/payroll.types';
import { formatCurrency, formatDate } from '@/utils/format';
import styles from './PayslipPrintSheet.module.css';

/**
 * PHIẾU LƯƠNG để IN — không hiện trên màn hình.
 *
 * Cùng cơ chế với `EmployeePrintSheet`: lớp toàn cục `.hrm-print-sheet` trong
 * `src/index.css` giấu nó trên màn hình và bật lại riêng nó khi in, nên
 * `window.print()` ra đúng tờ phiếu chứ không phải cả trang web kèm sidebar.
 *
 * ================= PHIẾU LƯƠNG KHÁC PHIẾU HỒ SƠ Ở CHỖ NÀO =================
 * `EmployeePrintSheet` cấm in mọi thứ nhạy cảm, kể cả lương. Ở đây thì ngược
 * lại: TIỀN LÀ NỘI DUNG CHÍNH. Phiếu lương là chứng từ trao tận tay người lao
 * động, và Điều 95 khoản 3 BLLĐ 2019 buộc người sử dụng lao động phải thông báo
 * bảng kê trả lương ghi rõ tiền lương, tiền làm thêm giờ và các khoản khấu trừ.
 *
 * NHƯNG KHÔNG PHẢI THỨ GÌ CŨNG IN. Tờ giấy này rời khỏi mọi lớp phân quyền:
 *
 *   - Số tài khoản ngân hàng     → không cần để đọc phiếu, đủ để gian lận
 *   - Số CCCD, mã số thuế cá nhân → định danh, không cần cho việc đối chiếu lương
 *   - Ghi chú nội bộ của nhân sự  → nhận xét, không dành cho người ngoài HR
 *
 * TỪNG KHOẢN PHẢI HIỆN RIÊNG, không gộp thành "tổng thu nhập" và "tổng khấu
 * trừ": người nhận phải cộng lại được bằng tay và ra đúng con số cuối. Một phiếu
 * lương không tự chứng minh được thì không giải quyết được thắc mắc nào.
 */
export interface PayslipPrintSheetProps {
  salary: Salary;
  companyName: string;
}

export function PayslipPrintSheet({
  salary,
  companyName,
}: PayslipPrintSheetProps) {
  const { t } = useTranslation();

  const money = (label: string, value: number, hideZero = true) =>
    hideZero && value === 0 ? null : (
      <div className={styles.row} key={label}>
        <span className={styles.label}>{label}</span>
        <span className={styles.value}>{formatCurrency(value)}</span>
      </div>
    );

  const totalIncome = salary.grossSalary;
  const totalDeduction =
    salary.totalInsurance +
    salary.personalIncomeTax +
    salary.advanceDeduction +
    salary.otherDeductions;

  return (
    <section className="hrm-print-sheet">
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('payroll.payslip.title')}</h1>
          <p className={styles.subtitle}>
            {t('payroll.periodLabel', {
              month: salary.month,
              year: salary.year,
            })}
          </p>
        </div>
        <div className={styles.company}>{companyName}</div>
      </header>

      <section className={styles.section}>
        <div className={styles.row}>
          <span className={styles.label}>{t('payroll.payslip.employee')}</span>
          <span className={styles.value}>
            {salary.employee.fullName} ({salary.employee.employeeCode})
          </span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>{t('payroll.payslip.department')}</span>
          <span className={styles.value}>
            {salary.employee.departmentName ?? '—'}
            {salary.employee.positionName
              ? ` · ${salary.employee.positionName}`
              : ''}
          </span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>{t('payroll.payslip.workingDays')}</span>
          <span className={styles.value}>
            {t('payroll.payslip.workingDaysValue', {
              actual: salary.actualWorkingDays,
              standard: salary.standardWorkingDays,
              paidLeave: salary.paidLeaveDays,
              unpaid: salary.unpaidLeaveDays,
            })}
          </span>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t('payroll.payslip.income')}</h2>
        {money(t('payroll.fields.baseSalary'), salary.baseSalary, false)}
        {money(t('payroll.fields.positionAllowance'), salary.positionAllowance)}
        {money(
          t('payroll.fields.attendanceAllowance'),
          salary.attendanceAllowance,
        )}
        {money(t('payroll.fields.mealAllowance'), salary.mealAllowance)}
        {money(t('payroll.fields.transportAllowance'), salary.transportAllowance)}
        {money(t('payroll.fields.phoneAllowance'), salary.phoneAllowance)}
        {money(t('payroll.fields.otherAllowances'), salary.otherAllowances)}
        {/*
          Giờ làm thêm hiện KÈM số giờ, không chỉ số tiền: Điều 95 buộc ghi rõ
          tiền làm thêm giờ, và người nhận cần đối chiếu được với bảng công của
          chính mình.
        */}
        {salary.overtimePay > 0 && (
          <div className={styles.row}>
            <span className={styles.label}>
              {t('payroll.payslip.overtimeWithHours', {
                hours: salary.overtimeHours,
              })}
            </span>
            <span className={styles.value}>
              {formatCurrency(salary.overtimePay)}
            </span>
          </div>
        )}
        {money(t('payroll.fields.performanceBonus'), salary.performanceBonus)}
        {money(t('payroll.fields.otherIncome'), salary.otherIncome)}

        <div className={`${styles.row} ${styles.subtotal}`}>
          <span className={styles.label}>{t('payroll.fields.grossSalary')}</span>
          <span className={styles.value}>{formatCurrency(totalIncome)}</span>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t('payroll.payslip.deduction')}</h2>
        <div className={styles.note}>
          {t('payroll.payslip.insuranceBase', {
            amount: formatCurrency(salary.insuranceBaseSalary),
          })}
        </div>
        {money(t('payroll.fields.socialInsurance'), salary.socialInsurance)}
        {money(t('payroll.fields.healthInsurance'), salary.healthInsurance)}
        {money(
          t('payroll.fields.unemploymentInsurance'),
          salary.unemploymentInsurance,
        )}
        {money(t('payroll.fields.personalIncomeTax'), salary.personalIncomeTax)}
        {money(t('payroll.fields.advanceDeduction'), salary.advanceDeduction)}
        {money(t('payroll.fields.otherDeductions'), salary.otherDeductions)}

        <div className={`${styles.row} ${styles.subtotal}`}>
          <span className={styles.label}>
            {t('payroll.payslip.totalDeduction')}
          </span>
          <span className={styles.value}>{formatCurrency(totalDeduction)}</span>
        </div>
      </section>

      {/*
        Căn cứ tính thuế in ra để người nhận kiểm được con số thuế, không phải
        chỉ nhận một số trừ không giải thích. Số người phụ thuộc là thông tin
        của chính họ đã đăng ký, không phải dữ liệu người thứ ba.
      */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t('payroll.payslip.taxBasis')}</h2>
        <div className={styles.row}>
          <span className={styles.label}>{t('payroll.fields.selfDeduction')}</span>
          <span className={styles.value}>
            {formatCurrency(salary.selfDeduction)}
          </span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>
            {t('payroll.payslip.dependentDeduction', {
              count: salary.dependentCount,
            })}
          </span>
          <span className={styles.value}>
            {formatCurrency(salary.dependentDeduction)}
          </span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>{t('payroll.fields.taxableIncome')}</span>
          <span className={styles.value}>
            {formatCurrency(salary.taxableIncome)}
          </span>
        </div>
      </section>

      <section className={`${styles.section} ${styles.netBlock}`}>
        <span className={styles.netLabel}>{t('payroll.fields.netSalary')}</span>
        <span className={styles.netValue}>{formatCurrency(salary.netSalary)}</span>
      </section>

      <footer className={styles.footer}>
        <div className={styles.signature}>
          <span>{t('payroll.payslip.signEmployee')}</span>
        </div>
        <div className={styles.signature}>
          <span>{t('payroll.payslip.signEmployer')}</span>
        </div>
      </footer>

      <p className={styles.printedAt}>
        {t('payroll.payslip.printedAt', { date: formatDate(new Date()) })}
      </p>
    </section>
  );
}
