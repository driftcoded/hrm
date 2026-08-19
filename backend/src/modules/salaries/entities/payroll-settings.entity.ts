import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
/*
 * Đường dẫn TƯƠNG ĐỐI, không dùng alias `@/`: `typeorm-ts-node-commonjs` của
 * script migration chạy KHÔNG kèm `tsconfig-paths/register`, nên mọi entity
 * dùng alias sẽ làm `npm run migration:run` chết ngay khi nạp data-source.
 * Các entity khác trong dự án cũng vì thế mà dùng đường dẫn tương đối.
 */
import { MinimumWageRegion } from '../../../common/constants/payroll.constant';
import { User } from '../../users/entities/user.entity';

const money = { type: 'decimal' as const, precision: 15, scale: 2 };

/**
 * Cấu hình lương của CÔNG TY. CHỈ 1 DÒNG (`id` luôn = 1, ràng buộc CHECK ở
 * migration) — không phải danh sách.
 *
 * Ở đây là những thứ giống nhau cho mọi người: vùng lương tối thiểu và các
 * khoản phụ cấp theo chính sách chung. Khoản thoả thuận riêng với từng người
 * (lương cơ bản, lương đóng bảo hiểm, phụ cấp chức vụ) nằm ở HỢP ĐỒNG, không
 * nằm ở đây.
 */
@Entity('payroll_settings')
export class PayrollSettings {
  @PrimaryColumn({ type: 'tinyint', unsigned: true })
  id: number;

  /**
   * Vùng lương tối thiểu của trụ sở — quyết định TRẦN ĐÓNG BHTN
   * (20 × lương tối thiểu vùng), khác trần BHXH/BHYT.
   */
  @Column({ name: 'minimum_wage_region', type: 'tinyint', unsigned: true })
  minimumWageRegion: MinimumWageRegion;

  /** Phụ cấp bữa ăn giữa ca. Miễn thuế TNCN tới 730.000; phần vượt chịu thuế. */
  @Column({ name: 'meal_allowance', ...money })
  mealAllowance: string;

  @Column({ name: 'transport_allowance', ...money })
  transportAllowance: string;

  @Column({ name: 'phone_allowance', ...money })
  phoneAllowance: string;

  /** Phụ cấp chuyên cần — chỉ trả khi tháng đó không có ngày nghỉ không lương. */
  @Column({ name: 'attendance_allowance', ...money })
  attendanceAllowance: string;

  /**
   * Có trả tiền làm thêm giờ suy ra từ chấm công hay không.
   *
   * Tắt được vì không phải nơi nào cũng trả theo giờ máy chấm công: có công ty
   * chốt làm thêm bằng biên bản riêng. Bật/tắt tường minh còn hơn để kế toán
   * phát hiện bảng lương tự cộng thêm một khoản họ không định trả.
   */
  @Column({ name: 'pay_overtime', type: 'boolean' })
  payOvertime: boolean;

  @Column({
    name: 'updated_by',
    type: 'bigint',
    unsigned: true,
    nullable: true,
  })
  updatedBy: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'updated_by' })
  updater: User | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}
