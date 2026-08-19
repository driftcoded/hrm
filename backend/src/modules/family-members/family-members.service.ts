import { Injectable, NotFoundException } from '@nestjs/common';
import { AuthenticatedUser } from '@/common/types/authenticated-user';
import { toDateOnlyString, toIsoString } from '@/common/utils/date.util';
import { normalizePhone } from '@/common/validators/vn-identity.validator';
import { EmployeesService } from '@/modules/employees/employees.service';
import { CreateFamilyMemberDto } from './dto/create-family-member.dto';
import { FamilyMemberResponseDto } from './dto/family-member-response.dto';
import { UpdateFamilyMemberDto } from './dto/update-family-member.dto';
import { FamilyMember } from './entities/family-member.entity';
import { FamilyMembersRepository } from './family-members.repository';

/**
 * Thành viên gia đình luôn thuộc về đúng MỘT nhân viên, nên mọi thao tác đều
 * bắt đầu bằng việc kiểm tra quyền truy cập hồ sơ nhân viên đó qua
 * `EmployeesService.findOne()` — nhân viên xem được người nhà của chính mình,
 * HR xem được của mọi người, manager giới hạn trong phòng ban của mình
 * (architecture.md §7.3).
 */
@Injectable()
export class FamilyMembersService {
  constructor(
    private readonly familyMembersRepository: FamilyMembersRepository,
    private readonly employeesService: EmployeesService,
  ) {}

  async findAll(
    employeeId: number,
    user: AuthenticatedUser,
  ): Promise<FamilyMemberResponseDto[]> {
    await this.employeesService.findOne(employeeId, user);

    const members =
      await this.familyMembersRepository.findByEmployee(employeeId);

    return members.map((member) => this.toResponse(member));
  }

  async create(
    employeeId: number,
    dto: CreateFamilyMemberDto,
    user: AuthenticatedUser,
  ): Promise<FamilyMemberResponseDto> {
    await this.employeesService.findOne(employeeId, user);

    const created = await this.familyMembersRepository.create({
      employeeId,
      fullName: dto.fullName.trim(),
      relationship: dto.relationship,
      dateOfBirth: dto.dateOfBirth ?? null,
      occupation: dto.occupation?.trim() || null,
      phone: dto.phone ? normalizePhone(dto.phone) : null,
      cccdNumber: dto.cccdNumber ?? null,
      note: dto.note ?? null,
    });

    return this.toResponse(created);
  }

  async update(
    employeeId: number,
    memberId: number,
    dto: UpdateFamilyMemberDto,
    user: AuthenticatedUser,
  ): Promise<FamilyMemberResponseDto> {
    await this.employeesService.findOne(employeeId, user);
    await this.getOwnedOrThrow(employeeId, memberId);

    const patch: Partial<FamilyMember> = {};

    if (dto.fullName !== undefined) {
      patch.fullName = dto.fullName.trim();
    }
    if (dto.relationship !== undefined) {
      patch.relationship = dto.relationship;
    }
    if (dto.dateOfBirth !== undefined) {
      patch.dateOfBirth = dto.dateOfBirth ?? null;
    }
    if (dto.occupation !== undefined) {
      patch.occupation = dto.occupation?.trim() || null;
    }
    if (dto.phone !== undefined) {
      patch.phone = dto.phone ? normalizePhone(dto.phone) : null;
    }
    if (dto.cccdNumber !== undefined) {
      patch.cccdNumber = dto.cccdNumber ?? null;
    }
    if (dto.note !== undefined) {
      patch.note = dto.note ?? null;
    }

    if (Object.keys(patch).length > 0) {
      await this.familyMembersRepository.update(memberId, patch);
    }

    return this.toResponse(await this.getOwnedOrThrow(employeeId, memberId));
  }

  async remove(
    employeeId: number,
    memberId: number,
    user: AuthenticatedUser,
  ): Promise<{ id: number; deleted: boolean }> {
    await this.employeesService.findOne(employeeId, user);
    await this.getOwnedOrThrow(employeeId, memberId);

    await this.familyMembersRepository.remove(memberId);

    return { id: memberId, deleted: true };
  }

  /**
   * Bản ghi phải thuộc đúng nhân viên trên URL.
   *
   * Không có kiểm tra này thì `PATCH /employees/1/family-members/999` sẽ sửa
   * được người nhà của nhân viên khác chỉ vì tài khoản có quyền trên nhân viên
   * 1 — đúng dạng lỗi IDOR trong checklist OWASP của dự án.
   */
  private async getOwnedOrThrow(
    employeeId: number,
    memberId: number,
  ): Promise<FamilyMember> {
    const member = await this.familyMembersRepository.findById(memberId);

    if (!member || Number(member.employeeId) !== employeeId) {
      throw new NotFoundException({
        code: 'FAMILY_MEMBER_NOT_FOUND',
        message: `Cannot find family member ${memberId} for employee ${employeeId}`,
      });
    }

    return member;
  }

  private toResponse(member: FamilyMember): FamilyMemberResponseDto {
    return {
      id: Number(member.id),
      employeeId: Number(member.employeeId),
      fullName: member.fullName,
      relationship: member.relationship,
      dateOfBirth:
        member.dateOfBirth === null
          ? null
          : toDateOnlyString(member.dateOfBirth),
      occupation: member.occupation,
      phone: member.phone,
      cccdNumber: member.cccdNumber,
      note: member.note,
      createdAt: toIsoString(member.createdAt),
      updatedAt: toIsoString(member.updatedAt),
    };
  }
}
