import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Employee } from '../../employees/entities/employee.entity';
import { User } from '../../users/entities/user.entity';

export enum DocumentType {
  CCCD = 'cccd',
  CV = 'cv',
  DEGREE = 'degree',
  CONTRACT = 'contract',
  HEALTH_CHECK = 'health_check',
  BACKGROUND = 'background',
  PHOTO_3X4 = 'photo_3x4',
  FAMILY_BOOK = 'family_book',
  RESIGNATION = 'resignation',
  OTHER = 'other',
}

@Entity('documents')
export class Document {
  @PrimaryGeneratedColumn('increment', { type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'employee_id', type: 'bigint', unsigned: true })
  employeeId: number;

  @ManyToOne(() => Employee, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @Column({ type: 'enum', enum: DocumentType })
  type: DocumentType;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({ name: 'file_name', type: 'varchar', length: 255 })
  fileName: string;

  @Column({ name: 'file_url', type: 'varchar', length: 500 })
  fileUrl: string;

  /** Size in bytes; max 10MB */
  @Column({ name: 'file_size', type: 'int', unsigned: true, nullable: true })
  fileSize: number | null;

  @Column({
    name: 'mime_type',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  mimeType: string | null;

  @Column({ name: 'issue_date', type: 'date', nullable: true })
  issueDate: string | null;

  @Column({ name: 'expiry_date', type: 'date', nullable: true })
  expiryDate: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  note: string | null;

  @Column({
    name: 'uploaded_by',
    type: 'bigint',
    unsigned: true,
    nullable: true,
  })
  uploadedBy: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'uploaded_by' })
  uploader: User | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;
}
