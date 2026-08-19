import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { Public } from './common/decorators/public.decorator';
import { AppService, HealthStatus } from './app.service';

@ApiTags('Health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /**
   * `@Res({ passthrough: true })` so the HTTP **status** can reflect the result
   * while the body still goes through the global TransformInterceptor.
   *
   * The status code is the whole point of this endpoint: load balancers and
   * uptime monitors decide on it and never read the body. Returning 200 with
   * `{"status":"error","database":"down"}` — which is what this did — means a
   * dead database still looks healthy to the balancer, so it keeps routing
   * traffic to an instance that cannot serve a single query.
   */
  @Public()
  @Get('health')
  @ApiOperation({ summary: 'Health check – kiểm tra app + DB còn sống' })
  @ApiResponse({ status: 200, description: 'App và DB đều bình thường' })
  @ApiResponse({
    status: 503,
    description: 'Không truy vấn được DB – instance KHÔNG nên nhận traffic',
  })
  async getHealth(
    @Res({ passthrough: true }) response: Response,
  ): Promise<HealthStatus> {
    const health = await this.appService.getHealth();

    response.status(
      health.database === 'up' ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE,
    );

    return health;
  }
}
