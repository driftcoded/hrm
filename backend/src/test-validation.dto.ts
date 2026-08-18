import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

/**
 * DTO throwaway – chỉ dùng để smoke-test pipeline
 * ValidationPipe -> validationExceptionFactory -> HttpExceptionFilter
 * (chứng minh VALIDATION_ERROR + details[] hoạt động end-to-end).
 * Có thể xoá cùng với AppController#testValidation ở phase sau.
 */
export class TestValidationDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsEmail()
  email: string;
}
