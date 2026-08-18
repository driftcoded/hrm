import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Position } from '../../positions/entities/position.entity';
import { Department } from '../../departments/entities/department.entity';
import { User } from '../../users/entities/user.entity';

export enum Gender {
  MALE = 'male',
  FEMALE = 'female',
  OTHER = 'other',
}

export enum MaritalStatus {
  SINGLE = 'single',
  MARRIED = 'married',
  DIVORCED = 'divorced',
  WIDOWED = 'widowed',
}

export enum TerminationType {
  RESIGNED = 'resigned',
  FIRED = 'fired',
  CONTRACT_ENDED = 'contract_ended',
  RETIRED = 'retired',
  DECEASED = 'deceased',
}

export enum EmployeeStatus {
  PROBATION = 'probation',
  ACTIVE = 'active',
  ON_LEAVE = 'on_leave',
  SUSPENDED = 'suspended',
  RESIGNED = 'resigned',
  TERMINATED = 'terminated',
}

export enum EducationLevel {
  HIGH_SCHOOL = 'high_school',
  COLLEGE = 'college',
  UNIVERSITY = 'university',
  MASTER = 'master',
  PHD = 'phd',
  OTHER = 'other',
}

@Entity('employees')
export class Employee {
  @PrimaryGeneratedColumn('increment', { type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'employee_code', type: 'varchar', length: 20, unique: true })
  employeeCode: string;

  // ---- Thông tin cá nhân ----
  @Column({ name: 'last_name', type: 'varchar', length: 50 })
  lastName: string;

  @Column({ name: 'first_name', type: 'varchar', length: 50 })
  firstName: string;

  @Column({ name: 'full_name', type: 'varchar', length: 100 })
  fullName: string;

  @Column({ name: 'date_of_birth', type: 'date' })
  dateOfBirth: string;

  @Column({ type: 'enum', enum: Gender })
  gender: Gender;

  @Column({
    name: 'marital_status',
    type: 'enum',
    enum: MaritalStatus,
    default: MaritalStatus.SINGLE,
  })
  maritalStatus: MaritalStatus;

  @Column({ type: 'varchar', length: 50, default: 'Việt Nam' })
  nationality: string;

  @Column({ type: 'varchar', length: 50, default: 'Kinh' })
  ethnicity: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  religion: string | null;

  @Column({ name: 'place_of_birth', type: 'varchar', length: 255 })
  placeOfBirth: string;

  @Column({ type: 'varchar', length: 255 })
  hometown: string;

  // ---- Giấy tờ tuỳ thân ----
  @Column({ name: 'cccd_number', type: 'varchar', length: 12, unique: true })
  cccdNumber: string;

  @Column({ name: 'cccd_issue_date', type: 'date' })
  cccdIssueDate: string;

  @Column({ name: 'cccd_issue_place', type: 'varchar', length: 255 })
  cccdIssuePlace: string;

  @Column({ name: 'cccd_expired_date', type: 'date', nullable: true })
  cccdExpiredDate: string | null;

  // ---- Mã số thuế & Bảo hiểm ----
  @Column({
    name: 'tax_code',
    type: 'varchar',
    length: 13,
    nullable: true,
    unique: true,
  })
  taxCode: string | null;

  @Column({
    name: 'social_insurance_no',
    type: 'varchar',
    length: 15,
    nullable: true,
    unique: true,
  })
  socialInsuranceNo: string | null;

  @Column({
    name: 'health_insurance_no',
    type: 'varchar',
    length: 15,
    nullable: true,
    unique: true,
  })
  healthInsuranceNo: string | null;

  @Column({ name: 'health_insurance_exp', type: 'date', nullable: true })
  healthInsuranceExp: string | null;

  // ---- Địa chỉ ----
  @Column({ name: 'permanent_address', type: 'varchar', length: 500 })
  permanentAddress: string;

  @Column({
    name: 'current_address',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  currentAddress: string | null;

  @Column({ name: 'province_code', type: 'varchar', length: 10 })
  provinceCode: string;

  @Column({ name: 'district_code', type: 'varchar', length: 10 })
  districtCode: string;

  @Column({ name: 'ward_code', type: 'varchar', length: 10 })
  wardCode: string;

  // ---- Liên lạc ----
  @Column({ type: 'varchar', length: 15 })
  phone: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  email: string;

  @Column({
    name: 'personal_email',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  personalEmail: string | null;

  @Column({
    name: 'emergency_contact_name',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  emergencyContactName: string | null;

  @Column({
    name: 'emergency_contact_phone',
    type: 'varchar',
    length: 15,
    nullable: true,
  })
  emergencyContactPhone: string | null;

  @Column({
    name: 'emergency_contact_rel',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  emergencyContactRel: string | null;

  // ---- Ngân hàng ----
  @Column({ name: 'bank_account', type: 'varchar', length: 30, nullable: true })
  bankAccount: string | null;

  @Column({ name: 'bank_name', type: 'varchar', length: 100, nullable: true })
  bankName: string | null;

  @Column({ name: 'bank_branch', type: 'varchar', length: 200, nullable: true })
  bankBranch: string | null;

  // ---- Thông tin công việc ----
  @Column({ name: 'position_id', type: 'bigint', unsigned: true })
  positionId: number;

  @ManyToOne(() => Position, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'position_id' })
  position: Position;

  @Column({ name: 'department_id', type: 'bigint', unsigned: true })
  departmentId: number;

  @ManyToOne(() => Department, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'department_id' })
  department: Department;

  @Column({
    name: 'direct_manager_id',
    type: 'bigint',
    unsigned: true,
    nullable: true,
  })
  directManagerId: number | null;

  @ManyToOne(() => Employee, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'direct_manager_id' })
  directManager: Employee | null;

  @Column({ name: 'hire_date', type: 'date' })
  hireDate: string;

  @Column({ name: 'probation_start_date', type: 'date', nullable: true })
  probationStartDate: string | null;

  @Column({ name: 'probation_end_date', type: 'date', nullable: true })
  probationEndDate: string | null;

  @Column({ name: 'official_start_date', type: 'date', nullable: true })
  officialStartDate: string | null;

  @Column({ name: 'termination_date', type: 'date', nullable: true })
  terminationDate: string | null;

  @Column({ name: 'termination_reason', type: 'text', nullable: true })
  terminationReason: string | null;

  @Column({
    name: 'termination_type',
    type: 'enum',
    enum: TerminationType,
    nullable: true,
  })
  terminationType: TerminationType | null;

  @Column({
    type: 'enum',
    enum: EmployeeStatus,
    default: EmployeeStatus.PROBATION,
  })
  status: EmployeeStatus;

  // ---- Học vấn ----
  @Column({
    name: 'education_level',
    type: 'enum',
    enum: EducationLevel,
    nullable: true,
  })
  educationLevel: EducationLevel | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  major: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  university: string | null;

  @Column({ name: 'graduation_year', type: 'smallint', nullable: true })
  graduationYear: number | null;

  // ---- Metadata ----
  @Column({ name: 'avatar_url', type: 'varchar', length: 500, nullable: true })
  avatarUrl: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({
    name: 'created_by',
    type: 'bigint',
    unsigned: true,
    nullable: true,
  })
  createdBy: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  creator: User | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamp', nullable: true })
  deletedAt: Date | null;
}
