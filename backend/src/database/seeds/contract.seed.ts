import { DataSource } from 'typeorm';
import { AppDataSource } from '../data-source';
import { toDateOnlyString } from '../../common/utils/date.util';
import {
  Contract,
  ContractStatus,
  ContractType,
} from '../../modules/contracts/entities/contract.entity';

/**
 * CONTRACT demo seed — một hợp đồng lao động còn hiệu lực cho từng nhân viên
 * demo, để phân hệ LƯƠNG có căn cứ tính.
 *
 *   npm run seed:contract            # chạy một lần (không làm gì nếu đã seed)
 *   npm run seed:contract -- --reset # xoá phần seed này rồi seed lại
 *
 * Cố ý KHÔNG nằm trong `npm run seed`: đó là dữ liệu nền mà bộ e2e đối chiếu,
 * thêm 60 hợp đồng vào sẽ đổi thế giới ở mỗi lần chạy test. Cùng lý do với
 * `demo.seed.ts` và `attendance.seed.ts`, và file này đi theo đúng hình dạng
 * của chúng (khoanh vùng bằng marker, ngắn mạch khi đã seed, có `--reset`).
 *
 * ======================== QUY TẮC DUY NHẤT ========================
 * LƯƠNG LẤY TỪ KHUNG LƯƠNG CỦA CHỨC VỤ (`positions.min_salary`/`max_salary`),
 * không phải một con số gõ tay. Chức vụ chưa khai khung lương thì dùng
 * `FALLBACK_SALARY`. Seed một mức lương mâu thuẫn với khung lương của chính chức
 * vụ đó sẽ khiến màn hình nhân sự trông như đang hỏng.
 *
 * `insurance_salary` = `base_salary`: đúng luật thì lương đóng bảo hiểm là lương
 * ghi trong hợp đồng, và tách hai con số ra ở dữ liệu demo chỉ tạo ra một câu
 * hỏi không ai trả lời được.
 *
 * PHẠM VI: bảng `contracts`, chỉ cho nhân viên có email công việc
 * `@vietphattech.vn` — tức nhân viên do `demo.seed.ts` tạo. `NV0001`–`NV0006`
 * (các tài khoản `admin` / `hr.manager` / …) KHÔNG bị đụng tới.
 *
 * Xoá tay nếu không muốn chạy script:
 *
 *   DELETE c FROM contracts c
 *     JOIN employees e ON e.id = c.employee_id
 *    WHERE e.email LIKE '%@vietphattech.vn';
 */

/** Marker phạm vi — cùng một marker `demo.seed.ts` dùng. */
const DEMO_EMAIL_DOMAIN = '@vietphattech.vn';

/** Ngày hợp đồng bắt đầu nếu nhân viên vào làm trước mốc này. */
const CONTRACT_EPOCH = '2026-01-01';

/** Chức vụ chưa khai khung lương thì dùng mức này. */
const FALLBACK_SALARY = 12_000_000;

/** Phụ cấp chức vụ theo cấp bậc của vị trí (`positions.level`). */
const POSITION_ALLOWANCE_BY_LEVEL: Record<number, number> = {
  1: 0,
  2: 1_000_000,
  3: 2_000_000,
  4: 4_000_000,
  5: 6_000_000,
};

interface EmployeeRow {
  id: number;
  employeeCode: string;
  /**
   * Driver MySQL trả cột `DATE` về dưới dạng `Date` của JavaScript, KHÔNG phải
   * chuỗi — `String(value).slice(0, 10)` sẽ cho ra `"Mon Jan 01"` và MySQL lưu
   * lại thành `0000-00-00` mà không báo lỗi gì.
   */
  hireDate: Date | string;
  status: string;
  positionLevel: number | null;
  minSalary: string | null;
  maxSalary: string | null;
}

/**
 * Mức lương trong khung của chức vụ, ổn định theo mã nhân viên.
 *
 * KHÔNG dùng số ngẫu nhiên: chạy lại seed phải ra đúng bộ số cũ, nếu không thì
 * hai lần chạy cho hai bảng lương khác nhau và không ai lần ra vì sao.
 */
function salaryFor(row: EmployeeRow): number {
  const min = Number(row.minSalary ?? 0) || FALLBACK_SALARY;
  const max = Number(row.maxSalary ?? 0) || min;

  if (max <= min) {
    return roundToThousand(min);
  }

  // Chữ số cuối của mã nhân viên trải đều vị trí trong khung lương.
  const digits = row.employeeCode.replace(/\D/g, '');
  const seed = Number(digits.slice(-2) || '0') % 10;

  return roundToThousand(min + ((max - min) * seed) / 9);
}

function roundToThousand(amount: number): number {
  return Math.round(amount / 1000) * 1000;
}

function contractTypeFor(status: string): ContractType {
  return status === 'probation'
    ? ContractType.PROBATION
    : ContractType.FIXED_TERM;
}

async function alreadySeeded(dataSource: DataSource): Promise<boolean> {
  const rows: { total: string }[] = await dataSource.query(
    `SELECT COUNT(*) AS total
       FROM contracts c
       JOIN employees e ON e.id = c.employee_id
      WHERE e.email LIKE ?`,
    [`%${DEMO_EMAIL_DOMAIN}`],
  );

  return Number(rows[0]?.total ?? 0) > 0;
}

async function wipe(dataSource: DataSource): Promise<number> {
  const result: { affectedRows?: number } = await dataSource.query(
    `DELETE c FROM contracts c
       JOIN employees e ON e.id = c.employee_id
      WHERE e.email LIKE ?`,
    [`%${DEMO_EMAIL_DOMAIN}`],
  );

  return result?.affectedRows ?? 0;
}

async function seedContracts(dataSource: DataSource): Promise<void> {
  const rows: EmployeeRow[] = await dataSource.query(
    `SELECT e.id            AS id,
            e.employee_code  AS employeeCode,
            e.hire_date      AS hireDate,
            e.status         AS status,
            p.level          AS positionLevel,
            p.min_salary     AS minSalary,
            p.max_salary     AS maxSalary
       FROM employees e
       LEFT JOIN positions p ON p.id = e.position_id
      WHERE e.email LIKE ?
        AND e.deleted_at IS NULL
      ORDER BY e.employee_code`,
    [`%${DEMO_EMAIL_DOMAIN}`],
  );

  if (rows.length === 0) {
    console.log('No demo employees found — run `npm run seed:demo` first.');
    return;
  }

  const repository = dataSource.getRepository(Contract);
  const contracts: Partial<Contract>[] = [];

  for (const row of rows) {
    const baseSalary = salaryFor(row);
    const hireDate = toDateOnlyString(row.hireDate);
    const startDate = hireDate < CONTRACT_EPOCH ? CONTRACT_EPOCH : hireDate;

    contracts.push({
      employeeId: Number(row.id),
      contractNumber: `HD-${row.employeeCode}-01`,
      contractType: contractTypeFor(row.status),
      startDate,
      // Hợp đồng xác định thời hạn 24 tháng — còn hiệu lực suốt các kỳ demo.
      endDate: addYears(startDate, 2),
      signDate: startDate,
      baseSalary: baseSalary.toFixed(2),
      insuranceSalary: baseSalary.toFixed(2),
      positionAllowance: (
        POSITION_ALLOWANCE_BY_LEVEL[Number(row.positionLevel ?? 1)] ?? 0
      ).toFixed(2),
      otherAllowance: '0.00',
      workingHours: '8.00',
      workingDays: 5,
      status: ContractStatus.ACTIVE,
    });
  }

  await repository.save(repository.create(contracts));

  console.log(`Seeded ${contracts.length} contracts.`);
}

function addYears(date: string, years: number): string {
  const [year, month, day] = date.split('-').map(Number);

  return `${year + years}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

async function main(): Promise<void> {
  const dataSource = await AppDataSource.initialize();
  const reset = process.argv.includes('--reset');

  try {
    if (reset) {
      console.log(`Wiped ${await wipe(dataSource)} demo contracts.`);
    } else if (await alreadySeeded(dataSource)) {
      console.log(
        'Demo contracts already present — nothing to do. Use `-- --reset` to re-seed.',
      );
      return;
    }

    await seedContracts(dataSource);
    console.log('Contract seed completed successfully.');
  } finally {
    await dataSource.destroy();
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(
      'Contract seed failed:',
      error instanceof Error ? error.message : error,
    );
    process.exit(1);
  });
}
