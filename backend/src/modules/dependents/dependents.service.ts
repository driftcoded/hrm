import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { AuthenticatedUser } from '@/common/types/authenticated-user';
import {
  toDateOnlyString,
  toIsoString,
  todayDateString,
} from '@/common/utils/date.util';
import { EmployeesService } from '@/modules/employees/employees.service';
import { DependentsRepository } from './dependents.repository';
import { CreateDependentDto } from './dto/create-dependent.dto';
import { DependentResponseDto } from './dto/dependent-response.dto';
import { UpdateDependentDto } from './dto/update-dependent.dto';
import { Dependent, DependentStatus } from './entities/dependent.entity';

/**
 * Người phụ thuộc – hồ sơ giảm trừ gia cảnh (Điều 19 Luật Thuế TNCN).
 *
 * KHÁC với `family_members`: bảng kia là thông tin nhân sự về hộ gia đình,
 * bảng này là đăng ký thuế và có hệ quả tiền bạc — mỗi người phụ thuộc đang
 * hiệu lực làm giảm thu nhập chịu thuế của nhân viên **6.2tr/tháng** (mức từ
 * 01/01/2026, xem backend/CLAUDE.md). Vì vậy ở đây có những ràng buộc mà tab
 * gia đình không có: ngày đăng ký bắt buộc, một người chỉ được khai cho MỘT
 * nhân viên, và ngừng giảm trừ thì phải nêu lý do.
 *
 * Phân quyền dùng lại `EmployeesService.findOne()` y như family members: quyền
 * xem người phụ thuộc = quyền xem hồ sơ nhân viên sở hữu nó.
 */
@Injectable()
export class DependentsService {
  constructor(
    private readonly dependentsRepository: DependentsRepository,
    private readonly employeesService: EmployeesService,
  ) {}

  async findAll(
    employeeId: number,
    user: AuthenticatedUser,
  ): Promise<DependentResponseDto[]> {
    await this.employeesService.findOne(employeeId, user);

    const dependents =
      await this.dependentsRepository.findByEmployee(employeeId);

    return dependents.map((dependent) => this.toResponse(dependent));
  }

  async create(
    employeeId: number,
    dto: CreateDependentDto,
    user: AuthenticatedUser,
  ): Promise<DependentResponseDto> {
    await this.employeesService.findOne(employeeId, user);

    this.assertDateOrder(dto.registrationDate, dto.endDate ?? null);
    this.assertBirthBeforeRegistration(dto.dateOfBirth, dto.registrationDate);
    await this.assertNotClaimedElsewhere(
      dto.cccdNumber ?? null,
      dto.taxCode ?? null,
    );

    const created = await this.dependentsRepository.create({
      employeeId,
      fullName: dto.fullName.trim(),
      relationship: dto.relationship,
      dateOfBirth: dto.dateOfBirth,
      cccdNumber: dto.cccdNumber ?? null,
      taxCode: dto.taxCode ?? null,
      registrationDate: dto.registrationDate,
      endDate: dto.endDate ?? null,
      status: DependentStatus.ACTIVE,
      documentUrl: dto.documentUrl ?? null,
      note: dto.note ?? null,
    });

    return this.toResponse(created);
  }

  async update(
    employeeId: number,
    dependentId: number,
    dto: UpdateDependentDto,
    user: AuthenticatedUser,
  ): Promise<DependentResponseDto> {
    await this.employeesService.findOne(employeeId, user);
    const dependent = await this.getOwnedOrThrow(employeeId, dependentId);

    const patch: Partial<Dependent> = {};

    if (dto.fullName !== undefined) {
      patch.fullName = dto.fullName.trim();
    }
    if (dto.relationship !== undefined) {
      patch.relationship = dto.relationship;
    }
    if (dto.dateOfBirth !== undefined) {
      patch.dateOfBirth = dto.dateOfBirth;
    }
    if (dto.cccdNumber !== undefined) {
      patch.cccdNumber = dto.cccdNumber ?? null;
    }
    if (dto.taxCode !== undefined) {
      patch.taxCode = dto.taxCode ?? null;
    }
    if (dto.registrationDate !== undefined) {
      patch.registrationDate = dto.registrationDate;
    }
    if (dto.endDate !== undefined) {
      patch.endDate = dto.endDate ?? null;
    }
    if (dto.documentUrl !== undefined) {
      patch.documentUrl = dto.documentUrl ?? null;
    }
    if (dto.note !== undefined) {
      patch.note = dto.note ?? null;
    }

    // ---- kiểm tra trên GIÁ TRỊ SAU KHI GỘP ----
    const registrationDate =
      patch.registrationDate ?? dependent.registrationDate;
    const endDate =
      patch.endDate !== undefined ? patch.endDate : dependent.endDate;
    const dateOfBirth = patch.dateOfBirth ?? dependent.dateOfBirth;

    this.assertDateOrder(registrationDate, endDate);
    this.assertBirthBeforeRegistration(dateOfBirth, registrationDate);

    const status = dto.status ?? dependent.status;

    if (status === DependentStatus.INACTIVE) {
      const reason = dto.reasonInactive ?? dependent.reasonInactive;
      if (!reason || reason.trim().length === 0) {
        throw new UnprocessableEntityException({
          code: 'DEPENDENT_REASON_REQUIRED',
          message:
            'reasonInactive is required when setting a dependent to inactive',
        });
      }
      patch.status = DependentStatus.INACTIVE;
      patch.reasonInactive = reason.trim();
    } else if (dto.status === DependentStatus.ACTIVE) {
      // Bật lại: kiểm tra người này chưa bị nhân viên khác khai, rồi xoá lý do
      // ngừng cũ để không còn dòng giải thích mâu thuẫn với trạng thái.
      patch.status = DependentStatus.ACTIVE;
      patch.reasonInactive = null;
    } else if (dto.reasonInactive !== undefined) {
      patch.reasonInactive = dto.reasonInactive ?? null;
    }

    const willBeActive =
      (patch.status ?? dependent.status) === DependentStatus.ACTIVE;
    if (willBeActive) {
      await this.assertNotClaimedElsewhere(
        patch.cccdNumber !== undefined
          ? patch.cccdNumber
          : dependent.cccdNumber,
        patch.taxCode !== undefined ? patch.taxCode : dependent.taxCode,
        dependentId,
      );
    }

    if (Object.keys(patch).length > 0) {
      await this.dependentsRepository.update(dependentId, patch);
    }

    return this.toResponse(await this.getOwnedOrThrow(employeeId, dependentId));
  }

  async remove(
    employeeId: number,
    dependentId: number,
    user: AuthenticatedUser,
  ): Promise<{ id: number; deleted: boolean }> {
    await this.employeesService.findOne(employeeId, user);
    await this.getOwnedOrThrow(employeeId, dependentId);

    await this.dependentsRepository.remove(dependentId);

    return { id: dependentId, deleted: true };
  }

  // -------------------------------------------------------- internals ----

  /**
   * Bản ghi phải thuộc đúng nhân viên trên URL — cùng lý do như family
   * members: nếu không, `PATCH /employees/1/dependents/999` sửa được người phụ
   * thuộc của nhân viên khác chỉ vì tài khoản có quyền trên nhân viên 1 (IDOR).
   */
  private async getOwnedOrThrow(
    employeeId: number,
    dependentId: number,
  ): Promise<Dependent> {
    const dependent = await this.dependentsRepository.findById(dependentId);

    if (!dependent || Number(dependent.employeeId) !== employeeId) {
      throw new NotFoundException({
        code: 'DEPENDENT_NOT_FOUND',
        message: `Cannot find dependent ${dependentId} for employee ${employeeId}`,
      });
    }

    return dependent;
  }

  /**
   * Một người chỉ được tính giảm trừ cho MỘT người nộp thuế (Điều 19 Luật Thuế
   * TNCN). Nhận diện qua CCCD hoặc MST — hai giá trị duy nhất định danh được
   * một con người; trùng họ tên thì không kết luận được gì.
   */
  private async assertNotClaimedElsewhere(
    cccdNumber: string | null,
    taxCode: string | null,
    excludeId?: number,
  ): Promise<void> {
    const candidates: Array<['cccdNumber' | 'taxCode', string | null]> = [
      ['cccdNumber', cccdNumber],
      ['taxCode', taxCode],
    ];

    for (const [field, value] of candidates) {
      if (!value) {
        continue;
      }

      const existing = await this.dependentsRepository.findActiveDuplicate(
        field,
        value,
        excludeId,
      );

      if (existing) {
        const owner = existing.employee
          ? `employee ${existing.employee.id} (${existing.employee.employeeCode})`
          : `employee ${existing.employeeId}`;

        throw new ConflictException({
          code: 'DEPENDENT_ALREADY_CLAIMED',
          message: `A dependent with ${field} "${value}" is already actively claimed by ${owner}; one person can only be claimed by a single taxpayer (Article 19, Personal Income Tax Law)`,
        });
      }
    }
  }

  private assertDateOrder(
    registrationDate: string,
    endDate: string | null,
  ): void {
    if (!endDate) {
      return;
    }

    if (toDateOnlyString(endDate) < toDateOnlyString(registrationDate)) {
      throw new UnprocessableEntityException({
        code: 'INVALID_DATE_RANGE',
        message: `endDate must not be earlier than registrationDate`,
      });
    }
  }

  /** Không ai được đăng ký giảm trừ trước khi người phụ thuộc ra đời. */
  private assertBirthBeforeRegistration(
    dateOfBirth: string,
    registrationDate: string,
  ): void {
    if (toDateOnlyString(registrationDate) < toDateOnlyString(dateOfBirth)) {
      throw new UnprocessableEntityException({
        code: 'INVALID_DATE_RANGE',
        message: `registrationDate must not be earlier than the dependent's dateOfBirth`,
      });
    }
  }

  private toResponse(dependent: Dependent): DependentResponseDto {
    const today = todayDateString();
    const registrationDate = toDateOnlyString(dependent.registrationDate);
    const endDate =
      dependent.endDate === null ? null : toDateOnlyString(dependent.endDate);

    return {
      id: Number(dependent.id),
      employeeId: Number(dependent.employeeId),
      fullName: dependent.fullName,
      relationship: dependent.relationship,
      dateOfBirth: toDateOnlyString(dependent.dateOfBirth),
      cccdNumber: dependent.cccdNumber,
      taxCode: dependent.taxCode,
      registrationDate,
      endDate,
      status: dependent.status,
      reasonInactive: dependent.reasonInactive,
      documentUrl: dependent.documentUrl,
      note: dependent.note,
      isCurrentlyDeductible:
        dependent.status === DependentStatus.ACTIVE &&
        registrationDate <= today &&
        (endDate === null || endDate >= today),
      createdAt: toIsoString(dependent.createdAt),
      updatedAt: toIsoString(dependent.updatedAt),
    };
  }
}
