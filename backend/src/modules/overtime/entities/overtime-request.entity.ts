import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { OvertimeRateType } from '@/common/utils/overtime.util';
import { Employee } from '../../employees/entities/employee.entity';

/**
 * Loại ngày làm thêm — quyết định hệ số Điều 98 BLLĐ 2019.
 * Suy ra từ `work_date` lúc tạo đơn, không do người nộp tự chọn.
 *
 * Định nghĩa nằm ở `overtime.util.ts` và được XUẤT LẠI ở đây. Hai enum song
 * song cùng giá trị buộc service phải ép kiểu hai lần giữa chúng, và ngày ai đó
 * thêm một loại ngày vào một bên thì phép ép kiểu đó im lặng nói dối.
 */
export { OvertimeRateType } from '@/common/utils/overtime.util';

/** Dùng chung 4 giá trị với `leave_requests.status` — cùng một vòng đời đơn từ. */
export enum OvertimeRequestStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
}

/**
 * Đơn đăng ký làm thêm giờ.
 *
 * Đây là căn cứ DUY NHẤT để trả tiền làm thêm (Giai đoạn 6).
 * `attendances.overtime_hours` là số giờ đã ở lại thực tế — xem ghi chú dài ở
 * migration `CreateOvertimeRequests` về việc vì sao hai con số phải tách rời.
 */
@Entity('overtime_requests')
@Index('idx_overtime_employee_date', ['employeeId', 'workDate'])
@Index('idx_overtime_status', ['status'])
export class OvertimeRequest {
  @PrimaryGeneratedColumn('increment', { type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'employee_id', type: 'bigint', unsigned: true })
  employeeId: number;

  @ManyToOne(() => Employee, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @Column({ name: 'work_date', type: 'date' })
  workDate: string;

  @Column({ name: 'start_time', type: 'time' })
  startTime: string;

  @Column({ name: 'end_time', type: 'time' })
  endTime: string;

  /**
   * Tổng số giờ xin làm thêm.
   *
   * Kiểu `string` vì driver mysql trả `DECIMAL` dưới dạng chuỗi để không mất
   * chính xác — đây là số dùng để nhân ra tiền lương, ép sang `number` ở tầng
   * entity sẽ đưa sai số dấu phẩy động vào tận phiếu lương.
   */
  @Column({ name: 'total_hours', type: 'decimal', precision: 4, scale: 2 })
  totalHours: string;

  /** Phần giờ rơi vào khung 22h–6h, để cộng phụ cấp ca đêm. Là tập con của `totalHours`. */
  @Column({
    name: 'night_hours',
    type: 'decimal',
    precision: 4,
    scale: 2,
    default: 0,
  })
  nightHours: string;

  @Column({ name: 'rate_type', type: 'enum', enum: OvertimeRateType })
  rateType: OvertimeRateType;

  /** Hệ số Điều 98 đã CHỐT (1.5 / 2.0 / 3.0) — không đọc lại hằng số khi tính lương. */
  @Column({ type: 'decimal', precision: 3, scale: 1 })
  rate: string;

  /** Phụ trội ca đêm đã chốt (0 hoặc 0.3), CỘNG vào `rate` cho phần `nightHours`. */
  @Column({
    name: 'night_rate_surcharge',
    type: 'decimal',
    precision: 3,
    scale: 1,
    default: 0,
  })
  nightRateSurcharge: string;

  @Column({ type: 'text' })
  reason: string;

  @Column({
    type: 'enum',
    enum: OvertimeRequestStatus,
    default: OvertimeRequestStatus.PENDING,
  })
  status: OvertimeRequestStatus;

  /** `employees.id` của người duyệt — không phải `users.id`, khớp `leave_requests`. */
  @Column({
    name: 'approved_by',
    type: 'bigint',
    unsigned: true,
    nullable: true,
  })
  approvedBy: number | null;

  @ManyToOne(() => Employee, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'approved_by' })
  approver: Employee | null;

  @Column({ name: 'approved_at', type: 'timestamp', nullable: true })
  approvedAt: Date | null;

  @Column({ name: 'rejected_reason', type: 'text', nullable: true })
  rejectedReason: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}
