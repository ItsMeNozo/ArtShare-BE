import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CorsService {
  constructor(private readonly configService: ConfigService) {}

  getAllowedOrigins(): string[] {
    return [
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173',
      this.configService.get<string>('ADMIN_FRONTEND_URL') ||
        'http://localhost:1574',
      'https://artsharezone-black.vercel.app',
    ];
  }

  isProduction(): boolean {
    return this.configService.get<string>('NODE_ENV') === 'production';
  }

  // Static helper for WebSocket CORS (used at decorator level)
  static getAllowedOriginsStatic(): string[] {
    return [
      process.env.FRONTEND_URL || 'http://localhost:5173',
      process.env.ADMIN_FRONTEND_URL || 'http://localhost:1574',
      'https://artsharezone-black.vercel.app',
    ];
  }

  static isProductionStatic(): boolean {
    return process.env.NODE_ENV === 'production';
  }
}
