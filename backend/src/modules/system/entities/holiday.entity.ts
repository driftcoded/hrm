import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

export enum HolidayType {
  NATIONAL = 'national',
  COMPANY = 'company',
  OTHER = 'other',
}

/** Ngày neo của một kỳ nghỉ được tính theo lịch nào. */
export enum HolidayCalendar {
  SOLAR = 'solar',
  LUNAR = 'lunar',
}

/**
 * ĐỊNH NGHĨA một kỳ nghỉ, không phải một ngày cụ thể.
 *
 * Bảng này trước đây chứa từng ngày của từng năm: 11 dòng cho 2025, 11 dòng cho
 * 2026, và thêm một năm nghĩa là ngồi tra lịch âm rồi gõ tay. Giờ nó chứa QUY
 * TẮC — sáu dòng cho toàn bộ ngày lễ pháp định — còn ngày cụ thể của từng năm
 * do `HolidaysService` suy ra khi cần.
 *
 * Cách mô tả một kỳ nghỉ: neo vào (`calendar`, `month`, `day`), dịch đi
 * `offsetDays` ngày, rồi kéo dài `durationDays` ngày.
 *
 *   Quốc khánh   → dương 02/9, offset −1, dài 2  ⇒ 01/9 + 02/9
 *   Tết Nguyên đán → âm 01/01, offset −1, dài 5  ⇒ 29 Chạp + mùng 1…4
 *   Giỗ Tổ        → âm 10/3, offset 0, dài 1
 *
 * `year` = NULL nghĩa là áp dụng MỌI NĂM. Năm nào Chính phủ chốt khác lệ thường
 * thì thêm một dòng cùng `code` mang đúng năm đó — dòng có năm thắng dòng mọi
 * năm, nên không phải sửa quy tắc chung chỉ vì một năm ngoại lệ.
 */
@Entity('holidays')
@Unique('uq_holiday_code_year', ['code', 'year'])
export class Holiday {
  @PrimaryGeneratedColumn('increment', { type: 'smallint', unsigned: true })
  id: number;

  /** Định danh kỳ nghỉ, dùng để dòng của một năm ghi đè dòng mọi năm. */
  @Column({ type: 'varchar', length: 40 })
  code: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'enum', enum: HolidayType, default: HolidayType.NATIONAL })
  type: HolidayType;

  @Column({
    name: 'anchor_calendar',
    type: 'enum',
    enum: HolidayCalendar,
    default: HolidayCalendar.SOLAR,
  })
  calendar: HolidayCalendar;

  @Column({ name: 'anchor_month', type: 'tinyint', unsigned: true })
  month: number;

  @Column({ name: 'anchor_day', type: 'tinyint', unsigned: true })
  day: number;

  /** Số ngày dịch so với ngày neo; âm là nghỉ sớm hơn. */
  @Column({ name: 'offset_days', type: 'smallint', default: 0 })
  offsetDays: number;

  @Column({ name: 'duration_days', type: 'smallint', unsigned: true, default: 1 })
  durationDays: number;

  /** NULL = áp dụng mọi năm; có giá trị = chỉ năm đó, và đè lên dòng mọi năm. */
  @Column({ type: 'smallint', nullable: true })
  year: number | null;

  @Column({ name: 'is_paid', type: 'boolean', default: true })
  isPaid: boolean;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'sort_order', type: 'smallint', default: 0 })
  sortOrder: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  note: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}
