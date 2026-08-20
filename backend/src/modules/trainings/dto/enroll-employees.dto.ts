import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsInt,
  Min,
} from 'class-validator';

/** Body của `POST /trainings/:id/participants` — ghi danh nhiều nhân viên một lượt. */
export class EnrollEmployeesDto {
  @ApiProperty({ example: [51, 52, 53], type: [Number] })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(200)
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  employeeIds: number[];
}
