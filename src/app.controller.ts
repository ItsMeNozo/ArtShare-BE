import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('debug/cors-config')
  getCorsDebugInfo() {
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';

    return {
      nodeEnv: this.configService.get<string>('NODE_ENV'),
      isProduction,
      frontendUrl: this.configService.get<string>('FRONTEND_URL'),
      adminFrontendUrl: this.configService.get<string>('ADMIN_FRONTEND_URL'),
      allowedOrigins: [
        this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173',
        this.configService.get<string>('ADMIN_FRONTEND_URL') || 'http://localhost:1574',
        'https://artsharezone-black.vercel.app',
      ],
      timestamp: new Date().toISOString(),
    };
  }
}
