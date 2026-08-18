import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export enum HolidayType {
  NATIONAL = 'national',
  COMPANY = 'company',
  OTHER = 'other',
}

@Entity('holidays')
export class Holiday {
  @PrimaryGeneratedColumn('increment', { type: 'smallint', unsigned: true })
  id: number;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ name: 'holiday_date', type: 'date', unique: true })
  holidayDate: string;

  @Column({ type: 'enum', enum: HolidayType, default: HolidayType.NATIONAL })
  type: HolidayType;

  @Column({ type: 'smallint' })
  year: number;

  @Column({ name: 'is_paid', type: 'boolean', default: true })
  isPaid: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  note: string | null;
}
