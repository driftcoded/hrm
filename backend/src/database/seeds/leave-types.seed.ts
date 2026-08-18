import { DataSource } from 'typeorm';
import {
  LeaveApplicableGender,
  LeaveType,
} from '../../modules/leaves/entities/leave-type.entity';

interface LeaveTypeSeedRow {
  code: string;
  name: string;
  daysPerYear: number;
  isPaid: boolean;
  requireApproval: boolean;
  minDays: number;
  maxConsecutive: number | null;
  advanceNoticeDays: number;
  applicableGender: LeaveApplicableGender;
  description: string;
  sortOrder: number;
}

/**
 * 9 leave types from the seed table in docs/database-schema.md §5.2.
 * Phase 5 (leave requests + leave balances) depends directly on these rows.
 *
 * Notes on values NOT specified in the docs (the docs only give days/year +
 * paid/unpaid + legal basis):
 *  - `advance_notice_days`: 0 for types that can't be planned ahead (sick
 *    leave, bereavement, paternity leave); 3 for annual/unpaid leave; 7 for
 *    marriage leave (known in advance).
 *  - `max_consecutive`: set to exactly the number of days the law allows per
 *    occurrence for event-based types (marriage/bereavement/child's
 *    marriage); `null` = unlimited.
 *  - `min_days`: 0.5 (half a day) for types taken by the hour/partial day,
 *    1 for event-based types.
 */
const LEAVE_TYPES: LeaveTypeSeedRow[] = [
  {
    code: 'ANNUAL',
    name: 'Nghỉ phép năm',
    daysPerYear: 12,
    isPaid: true,
    requireApproval: true,
    minDays: 0.5,
    maxConsecutive: null,
    advanceNoticeDays: 3,
    applicableGender: LeaveApplicableGender.ALL,
    description:
      'Điều 113 BLLĐ 2019: 12 ngày làm việc/năm với người làm việc đủ 12 tháng trong điều kiện bình thường; cứ 5 năm làm việc được thêm 1 ngày (Điều 114).',
    sortOrder: 1,
  },
  {
    code: 'SICK',
    name: 'Nghỉ ốm',
    daysPerYear: 30,
    isPaid: true,
    requireApproval: true,
    minDays: 0.5,
    maxConsecutive: null,
    advanceNoticeDays: 0,
    applicableGender: LeaveApplicableGender.ALL,
    description:
      'Luật BHXH: tối đa 30 ngày/năm khi đã đóng BHXH dưới 15 năm (40 ngày nếu 15–30 năm, 60 ngày nếu từ 30 năm). Do quỹ BHXH chi trả 75%, không phải doanh nghiệp trả lương.',
    sortOrder: 2,
  },
  {
    code: 'MATERNITY',
    name: 'Nghỉ thai sản (mẹ)',
    daysPerYear: 180,
    isPaid: true,
    requireApproval: true,
    minDays: 1,
    maxConsecutive: 180,
    advanceNoticeDays: 30,
    applicableGender: LeaveApplicableGender.FEMALE,
    description:
      'Điều 34 Luật BHXH + Điều 139 BLLĐ 2019: lao động nữ nghỉ 6 tháng (180 ngày); sinh đôi trở lên thì từ con thứ 2 mỗi con thêm 1 tháng. Quỹ BHXH chi trả 100% mức bình quân tiền lương đóng BHXH.',
    sortOrder: 3,
  },
  {
    code: 'PATERNITY',
    name: 'Nghỉ thai sản (cha)',
    // The docs state "5-14 days" but the days_per_year column only holds ONE
    // number → we use the LEGAL MINIMUM of 5 working days (the normal case:
    // a single child, vaginal delivery). The higher tiers (7 days for a
    // C-section or a premature birth before 32 weeks, 10 days for twins, 14
    // days for twins delivered by C-section) depend on the specific
    // delivery, so HR grants the extra days case by case; defaulting to 14
    // would over-grant leave to most employees, while max_consecutive = 14
    // still lets an approval reach the legal ceiling when supporting
    // documents are provided.
    daysPerYear: 5,
    isPaid: true,
    requireApproval: true,
    minDays: 1,
    maxConsecutive: 14,
    advanceNoticeDays: 0,
    applicableGender: LeaveApplicableGender.MALE,
    description:
      'Điều 34 khoản 2 Luật BHXH: lao động nam đang đóng BHXH khi vợ sinh con được nghỉ 5 ngày làm việc (7 ngày nếu sinh mổ hoặc sinh non dưới 32 tuần, 10 ngày nếu sinh đôi, 14 ngày nếu sinh đôi kèm sinh mổ) trong 30 ngày đầu kể từ ngày vợ sinh.',
    sortOrder: 4,
  },
  {
    code: 'MARRIAGE',
    name: 'Nghỉ kết hôn',
    daysPerYear: 3,
    isPaid: true,
    requireApproval: true,
    minDays: 1,
    maxConsecutive: 3,
    advanceNoticeDays: 7,
    applicableGender: LeaveApplicableGender.ALL,
    description:
      'Điều 115 khoản 1 điểm a BLLĐ 2019: nghỉ việc riêng hưởng nguyên lương 3 ngày khi bản thân kết hôn.',
    sortOrder: 5,
  },
  {
    code: 'CHILD_MARRIAGE',
    name: 'Nghỉ con kết hôn',
    daysPerYear: 1,
    isPaid: true,
    requireApproval: true,
    minDays: 1,
    maxConsecutive: 1,
    advanceNoticeDays: 7,
    applicableGender: LeaveApplicableGender.ALL,
    description:
      'Điều 115 khoản 1 điểm b BLLĐ 2019: nghỉ việc riêng hưởng nguyên lương 1 ngày khi con đẻ/con nuôi kết hôn.',
    sortOrder: 6,
  },
  {
    code: 'BEREAVEMENT',
    name: 'Nghỉ tang',
    daysPerYear: 3,
    isPaid: true,
    requireApproval: true,
    minDays: 1,
    maxConsecutive: 3,
    advanceNoticeDays: 0,
    applicableGender: LeaveApplicableGender.ALL,
    description:
      'Điều 115 khoản 1 điểm c BLLĐ 2019: nghỉ việc riêng hưởng nguyên lương 3 ngày khi cha/mẹ (kể cả cha mẹ vợ, cha mẹ chồng, cha mẹ nuôi), vợ/chồng, con đẻ/con nuôi qua đời.',
    sortOrder: 7,
  },
  {
    code: 'UNPAID',
    name: 'Nghỉ không lương',
    daysPerYear: 0,
    isPaid: false,
    requireApproval: true,
    minDays: 0.5,
    maxConsecutive: null,
    advanceNoticeDays: 3,
    applicableGender: LeaveApplicableGender.ALL,
    description:
      'Điều 115 khoản 2 & 3 BLLĐ 2019: nghỉ không hưởng lương 1 ngày khi ông bà, anh chị em ruột qua đời / cha mẹ hoặc anh chị em ruột kết hôn; các trường hợp khác do hai bên thoả thuận. days_per_year = 0 nghĩa là không có định mức sẵn, xét theo từng đơn.',
    sortOrder: 8,
  },
  {
    code: 'COMPENSATORY',
    name: 'Nghỉ bù',
    daysPerYear: 0,
    isPaid: true,
    requireApproval: true,
    minDays: 0.5,
    maxConsecutive: null,
    advanceNoticeDays: 1,
    applicableGender: LeaveApplicableGender.ALL,
    description:
      'Nghỉ bù cho thời gian làm thêm vào ngày nghỉ lễ/ngày nghỉ hằng tuần (Điều 107, 111, 112 BLLĐ 2019). Số ngày phát sinh theo giờ làm thêm thực tế nên không có định mức năm.',
    sortOrder: 9,
  },
];

/**
 * Idempotent: matched by `code`; if a row already exists it is SKIPPED (not
 * overwritten) so we don't clobber policy tweaks HR already made in a dev
 * environment.
 */
export async function seedLeaveTypes(dataSource: DataSource): Promise<void> {
  const repo = dataSource.getRepository(LeaveType);

  let inserted = 0;
  for (const row of LEAVE_TYPES) {
    const existing = await repo.findOne({ where: { code: row.code } });
    if (existing) {
      continue;
    }

    await repo.insert({
      code: row.code,
      name: row.name,
      // DECIMAL column: write as a string to avoid decimal drift.
      daysPerYear: row.daysPerYear.toFixed(1),
      isPaid: row.isPaid,
      requireApproval: row.requireApproval,
      minDays: row.minDays.toFixed(1),
      maxConsecutive: row.maxConsecutive,
      advanceNoticeDays: row.advanceNoticeDays,
      applicableGender: row.applicableGender,
      description: row.description,
      isActive: true,
      sortOrder: row.sortOrder,
      isSystem: true,
    });
    inserted++;
  }

  console.log(
    `  - leave_types: OK (${inserted} inserted / ${LEAVE_TYPES.length} total)`,
  );
}
