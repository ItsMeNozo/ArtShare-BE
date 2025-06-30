import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppService } from './app.service';
import { CorsService } from './common/cors.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly configService: ConfigService,
    private readonly corsService: CorsService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('debug/cors-config')
  getCorsDebugInfo() {
    // Restrict access to non-production environments for security
    if (this.corsService.isProduction()) {
      throw new HttpException(
        'Debug endpoint not available in production',
        HttpStatus.FORBIDDEN,
      );
    }

    return {
      nodeEnv: this.configService.get<string>('NODE_ENV'),
      isProduction: this.corsService.isProduction(),
      frontendUrl: this.configService.get<string>('FRONTEND_URL'),
      adminFrontendUrl: this.configService.get<string>('ADMIN_FRONTEND_URL'),
      allowedOrigins: this.corsService.getAllowedOrigins(),
      timestamp: new Date().toISOString(),
    };
  }
}
