import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppService, HealthStatus } from './app.service';
import { TestValidationDto } from './test-validation.dto';

@ApiTags('Health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  @ApiOperation({ summary: 'Health check – kiểm tra app + DB còn sống' })
  getHealth(): Promise<HealthStatus> {
    return this.appService.getHealth();
  }

  /**
   * Throwaway endpoint – smoke-test ValidationPipe -> VALIDATION_ERROR
   * -> HttpExceptionFilter. Có thể xoá ở phase sau.
   */
  @Post('health/validate-test')
  @HttpCode(200)
  @ApiOperation({ summary: '[Scaffold-only] Test validation error pipeline' })
  testValidation(@Body() body: TestValidationDto): TestValidationDto {
    return body;
  }
}
