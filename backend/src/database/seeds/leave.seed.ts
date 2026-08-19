import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '@/app.module';
import { AuthenticatedUser } from '@/common/types/authenticated-user';
import { LeaveHalf } from '@/common/utils/leave.util';
import { LeaveRequestsService } from '@/modules/leave-requests/leave-requests.service';

/**
 * Dữ liệu demo cho phân hệ Phép (PLAN 5.2).
 *
 * VÌ SAO CHẠY QUA SERVICE, KHÔNG INSERT THẲNG SQL. Ghi nhận một đơn nghỉ không
 * chỉ là thêm một dòng: nó giữ chỗ `pending_days` trên quỹ, và lúc duyệt thì
 * chuyển sang `used_days` RỒI ghi những ngày `leave` vào bảng chấm công — tất cả
 * trong cùng một transaction. Seeder tự dựng lại chuỗi đó bằng SQL sẽ là bản thứ
 * hai của luật nghiệp vụ, và nó lệch khỏi bản thật ngay lần sửa đầu tiên. Chạy
 * qua `LeaveRequestsService` nên dữ liệu demo không thể mâu thuẫn với hệ thống,
 * và chính lần chạy này là một lượt kiểm chứng 5.1 + 5.2 đầu-đến-cuối.
 *
 * NGƯỜI GHI KHÁC NGƯỜI DUYỆT. Ghi nhận bằng `hr.manager`, duyệt bằng `admin` —
 * đúng ràng buộc `CANNOT_APPROVE_OWN_RECORD` mà backend đang chặn.
 *
 * KHUNG NGÀY 20/08–30/09/2026 chọn có lý do, không phải cho đẹp:
 *   - SAU 19/08 nên không rơi vào quá khứ (`LEAVE_IN_PAST` sẽ chặn);
 *   - SAU khung của `seed:attendance` (01/07–19/08) nên lúc duyệt, những ngày
 *     `leave` ghi vào bảng chấm công KHÔNG đụng dòng nào đã có. Đụng thì backend
 *     báo `attendanceConflicts` và bỏ qua đúng dòng đó — hành vi đúng, nhưng sẽ
 *     làm dữ liệu demo trông như bị thiếu.
 */

const RECORDER: AuthenticatedUser = {
  userId: 2,
  username: 'hr.manager',
  role: 'hr_manager',
  employeeId: 2,
  sessionId: null,
};

const APPROVER: AuthenticatedUser = {
  userId: 1,
  username: 'admin',
  role: 'admin',
  employeeId: 1,
  sessionId: null,
};

type FinalState = 'approved' | 'pending' | 'rejected';

interface PlannedLeave {
  employeeCode: string;
  leaveTypeCode: string;
  startDate: string;
  endDate: string;
  reason: string;
  finalState: FinalState;
  startHalf?: LeaveHalf;
  endHalf?: LeaveHalf;
  /** Chỉ dùng khi `finalState` là `rejected`. */
  rejectReason?: string;
}

/**
 * Trải đủ các trạng thái và loại phép mà giao diện phải hiển thị khác nhau.
 *
 * Có `pending` thì lối tắt duyệt (`?status=pending`) và hai nút Duyệt/Từ chối mới
 * có thứ để bấm; có `rejected` để thấy nhánh hiện lý do từ chối; có nửa ngày để
 * kiểm cột số ngày ra 0,5 chứ không phải 1.
 *
 * Mỗi nhân viên chỉ xuất hiện một lần: hai đơn chồng ngày của cùng một người sẽ
 * bị `OVERLAPPING_LEAVE` chặn — đúng luật, nhưng làm seeder chết vô ích.
 */
const PLAN: PlannedLeave[] = [
  // ---- đã duyệt: hiện trên lịch nghỉ và sinh ngày công `leave` ----
  {
    employeeCode: 'NV0007',
    leaveTypeCode: 'ANNUAL',
    startDate: '2026-08-20',
    endDate: '2026-08-21',
    reason: 'Nghỉ phép năm, về quê thăm gia đình',
    finalState: 'approved',
  },
  {
    employeeCode: 'NV0008',
    leaveTypeCode: 'ANNUAL',
    startDate: '2026-08-24',
    endDate: '2026-08-28',
    reason: 'Du lịch cùng gia đình, đã bàn giao công việc',
    finalState: 'approved',
  },
  {
    employeeCode: 'NV0009',
    leaveTypeCode: 'SICK',
    startDate: '2026-08-25',
    endDate: '2026-08-26',
    reason: 'Điều trị theo chỉ định của bác sĩ, có giấy nghỉ bệnh',
    finalState: 'approved',
  },
  {
    employeeCode: 'NV0010',
    leaveTypeCode: 'ANNUAL',
    startDate: '2026-08-27',
    endDate: '2026-08-28',
    reason: 'Giải quyết việc gia đình',
    finalState: 'approved',
  },
  {
    employeeCode: 'NV0011',
    leaveTypeCode: 'MARRIAGE',
    startDate: '2026-09-03',
    endDate: '2026-09-04',
    reason: 'Nghỉ kết hôn theo Điều 115 BLLĐ 2019',
    finalState: 'approved',
  },
  {
    employeeCode: 'NV0013',
    leaveTypeCode: 'ANNUAL',
    startDate: '2026-09-07',
    endDate: '2026-09-11',
    reason: 'Nghỉ phép năm, kế hoạch đã chốt với trưởng phòng',
    finalState: 'approved',
  },
  {
    employeeCode: 'NV0014',
    leaveTypeCode: 'BEREAVEMENT',
    startDate: '2026-08-31',
    endDate: '2026-08-31',
    reason: 'Nghỉ tang, việc gia đình',
    finalState: 'approved',
  },
  {
    employeeCode: 'NV0015',
    leaveTypeCode: 'ANNUAL',
    startDate: '2026-09-14',
    endDate: '2026-09-16',
    reason: 'Nghỉ phép năm',
    finalState: 'approved',
  },

  // ---- còn chờ duyệt: để lối tắt duyệt có việc ----
  {
    employeeCode: 'NV0016',
    leaveTypeCode: 'ANNUAL',
    startDate: '2026-09-21',
    endDate: '2026-09-25',
    reason: 'Nghỉ phép năm, xin duyệt trước một tháng',
    finalState: 'pending',
  },
  {
    employeeCode: 'NV0017',
    leaveTypeCode: 'ANNUAL',
    startDate: '2026-08-28',
    endDate: '2026-08-28',
    reason: 'Xin nghỉ buổi chiều để đi khám sức khoẻ định kỳ',
    finalState: 'pending',
    startHalf: LeaveHalf.AFTERNOON,
    endHalf: LeaveHalf.AFTERNOON,
  },
  {
    employeeCode: 'NV0019',
    leaveTypeCode: 'SICK',
    startDate: '2026-09-17',
    endDate: '2026-09-18',
    reason: 'Nghỉ ốm, đang chờ kết quả xét nghiệm',
    finalState: 'pending',
  },
  {
    employeeCode: 'NV0020',
    leaveTypeCode: 'UNPAID',
    startDate: '2026-09-28',
    endDate: '2026-09-30',
    reason: 'Nghỉ không lương, đã dùng hết phép năm',
    finalState: 'pending',
  },
  {
    employeeCode: 'NV0021',
    leaveTypeCode: 'CHILD_MARRIAGE',
    startDate: '2026-09-11',
    endDate: '2026-09-11',
    reason: 'Nghỉ dự lễ cưới của con',
    finalState: 'pending',
  },

  // ---- bị từ chối: để thấy nhánh hiện lý do từ chối ----
  {
    employeeCode: 'NV0022',
    leaveTypeCode: 'ANNUAL',
    startDate: '2026-09-01',
    endDate: '2026-09-04',
    reason: 'Nghỉ phép năm',
    finalState: 'rejected',
    rejectReason: 'Trùng kỳ chốt sổ đầu tháng, đề nghị dời sang tuần sau',
  },
  {
    employeeCode: 'NV0023',
    leaveTypeCode: 'ANNUAL',
    startDate: '2026-08-24',
    endDate: '2026-08-25',
    reason: 'Nghỉ phép năm',
    finalState: 'rejected',
    rejectReason: 'Phòng đang thiếu người trong tuần này',
  },
];

async function idByCode(
  dataSource: DataSource,
  table: 'employees' | 'leave_types',
  code: string,
): Promise<number> {
  const column = table === 'employees' ? 'employee_code' : 'code';
  const rows = await dataSource.query<Array<{ id: string | number }>>(
    `SELECT id FROM ${table} WHERE ${column} = ? LIMIT 1`,
    [code],
  );

  if (rows.length === 0) {
    throw new Error(
      `${table}.${column} = "${code}" không tồn tại — chạy "npm run seed" và "npm run seed:demo" trước.`,
    );
  }

  return Number(rows[0].id);
}

/** Các đơn do seeder này tạo, nhận diện bằng cặp (nhân viên, ngày bắt đầu). */
async function findSeededIds(dataSource: DataSource): Promise<number[]> {
  const ids: number[] = [];

  for (const item of PLAN) {
    const employeeId = await idByCode(
      dataSource,
      'employees',
      item.employeeCode,
    );
    const rows = await dataSource.query<Array<{ id: string | number }>>(
      'SELECT id FROM leave_requests WHERE employee_id = ? AND start_date = ?',
      [employeeId, item.startDate],
    );

    ids.push(...rows.map((row) => Number(row.id)));
  }

  return ids;
}

async function run(): Promise<void> {
  /*
   * `logger: ['error', 'warn']` chỉ để dập tiếng ồn lúc Nest dựng toàn bộ
   * AppModule. Phần báo cáo của seeder đi qua `console.log` — nó là đầu ra của
   * một câu lệnh CLI, người chạy phải thấy dù cấu hình logger có là gì.
   */
  const context = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const dataSource = context.get(DataSource);
    const service = context.get(LeaveRequestsService);
    const reset = process.argv.includes('--reset');
    const existing = await findSeededIds(dataSource);

    if (existing.length > 0 && !reset) {
      console.log(
        `  - dữ liệu demo phép đã có (${existing.length} đơn); không làm gì.`,
      );
      console.log('    Dựng lại từ đầu: npm run seed:leave -- --reset');

      return;
    }

    if (existing.length > 0) {
      /*
       * Xoá qua service, KHÔNG phải `DELETE FROM`: nó hoàn lại `used_days` /
       * `pending_days` và gỡ đúng những ngày `leave` khỏi bảng chấm công. Xoá
       * bằng SQL sẽ để lại quỹ bị trừ và ngày công mồ côi.
       */
      for (const id of existing) {
        await service.remove(id, APPROVER);
      }

      console.log(
        `  - đã xoá ${existing.length} đơn cũ của seeder (quỹ và bảng công đã hoàn)`,
      );
    }

    let approved = 0;
    let pending = 0;
    let rejected = 0;
    let attendanceDays = 0;
    const conflicts: string[] = [];

    for (const item of PLAN) {
      const employeeId = await idByCode(
        dataSource,
        'employees',
        item.employeeCode,
      );
      const leaveTypeId = await idByCode(
        dataSource,
        'leave_types',
        item.leaveTypeCode,
      );

      const created = await service.create(
        {
          employeeId,
          leaveTypeId,
          startDate: item.startDate,
          endDate: item.endDate,
          startHalf: item.startHalf,
          endHalf: item.endHalf,
          reason: item.reason,
        },
        RECORDER,
      );

      if (item.finalState === 'approved') {
        const result = await service.approve(Number(created.id), APPROVER);
        approved += 1;
        attendanceDays += result.attendanceDaysWritten;
        conflicts.push(...result.attendanceConflicts);
      } else if (item.finalState === 'rejected') {
        await service.reject(
          Number(created.id),
          { reason: item.rejectReason ?? 'Không đủ nhân sự trong kỳ' },
          APPROVER,
        );
        rejected += 1;
      } else {
        pending += 1;
      }
    }

    console.log(
      `  - đơn nghỉ: OK (${PLAN.length} đơn — ${approved} đã duyệt, ` +
        `${pending} chờ duyệt, ${rejected} bị từ chối)`,
    );
    console.log(
      `  - ngày công "leave" ghi khi duyệt: ${attendanceDays} dòng, mỗi dòng gắn đúng đơn của nó`,
    );
    console.log(
      '  - khung ngày: 2026-08-20..2026-09-30 (sau seed:attendance nên không ghi đè ngày công nào)',
    );

    if (conflicts.length > 0) {
      console.warn(
        `  - CẢNH BÁO: ngày đã có dữ liệu chấm công nên KHÔNG ghi đè: ${conflicts.join(', ')}`,
      );
    }

    console.log('Leave seed completed successfully.');
  } finally {
    await context.close();
  }
}

void run().catch((error: unknown) => {
  console.error(
    `  - THẤT BẠI: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
});
