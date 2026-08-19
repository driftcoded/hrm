import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { EMPLOYEE_WRITE_ROLES } from '@/common/constants/roles.constant';
import { ApiAuth } from '@/common/decorators/api-auth.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { DeleteResponseDto } from '@/common/dto/delete-response.dto';
import { AuthenticatedUser } from '@/common/types/authenticated-user';
import { CreateFamilyMemberDto } from './dto/create-family-member.dto';
import { FamilyMemberResponseDto } from './dto/family-member-response.dto';
import { UpdateFamilyMemberDto } from './dto/update-family-member.dto';
import { FamilyMembersService } from './family-members.service';

/**
 * Route lồng dưới `/employees/:employeeId` đúng như api-spec.md §10 — thành
 * viên gia đình không tồn tại độc lập với nhân viên (FK CASCADE).
 *
 * GET không khai báo `@Roles()`: nhân viên phải xem được người nhà của chính
 * mình; service kiểm tra phạm vi. Ghi/xoá dành cho nhóm HR (api-spec.md §10).
 */
@ApiTags('Family Members')
@Controller('employees/:employeeId/family-members')
export class FamilyMembersController {
  constructor(private readonly familyMembersService: FamilyMembersService) {}

  @Get()
  @ApiAuth()
  @ApiOperation({ summary: 'Danh sách thành viên gia đình của một nhân viên' })
  @ApiOkResponse({ type: [FamilyMemberResponseDto] })
  @ApiNotFoundResponse({ description: 'EMPLOYEE_NOT_FOUND' })
  @ApiForbiddenResponse({ description: 'FORBIDDEN – ngoài phạm vi của role' })
  findAll(
    @Param('employeeId', ParseIntPipe) employeeId: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<FamilyMemberResponseDto[]> {
    return this.familyMembersService.findAll(employeeId, user);
  }

  @Post()
  @Roles(...EMPLOYEE_WRITE_ROLES)
  @ApiAuth()
  @ApiOperation({ summary: 'Thêm thành viên gia đình' })
  @ApiCreatedResponse({ type: FamilyMemberResponseDto })
  @ApiNotFoundResponse({ description: 'EMPLOYEE_NOT_FOUND' })
  create(
    @Param('employeeId', ParseIntPipe) employeeId: number,
    @Body() dto: CreateFamilyMemberDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<FamilyMemberResponseDto> {
    return this.familyMembersService.create(employeeId, dto, user);
  }

  @Patch(':memberId')
  @Roles(...EMPLOYEE_WRITE_ROLES)
  @ApiAuth()
  @ApiOperation({ summary: 'Cập nhật thành viên gia đình (partial update)' })
  @ApiOkResponse({ type: FamilyMemberResponseDto })
  @ApiNotFoundResponse({
    description: 'EMPLOYEE_NOT_FOUND / FAMILY_MEMBER_NOT_FOUND',
  })
  update(
    @Param('employeeId', ParseIntPipe) employeeId: number,
    @Param('memberId', ParseIntPipe) memberId: number,
    @Body() dto: UpdateFamilyMemberDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<FamilyMemberResponseDto> {
    return this.familyMembersService.update(employeeId, memberId, dto, user);
  }

  @Delete(':memberId')
  @Roles(...EMPLOYEE_WRITE_ROLES)
  @ApiAuth()
  @ApiOperation({
    summary: 'Xoá thành viên gia đình',
    description:
      'Bảng `family_members` không có cột xoá mềm (schema §3.1) nên đây là xoá vật lý.',
  })
  @ApiOkResponse({ type: DeleteResponseDto })
  @ApiNotFoundResponse({
    description: 'EMPLOYEE_NOT_FOUND / FAMILY_MEMBER_NOT_FOUND',
  })
  remove(
    @Param('employeeId', ParseIntPipe) employeeId: number,
    @Param('memberId', ParseIntPipe) memberId: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DeleteResponseDto> {
    return this.familyMembersService.remove(employeeId, memberId, user);
  }
}
