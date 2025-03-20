import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { AuthService } from './auth.service'; // Sử dụng AuthService để xác minh token

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = request.headers.authorization?.split(' ')[1]; // Lấy token từ header Authorization

    if (!token) {
      throw new Error('Authorization token is required');
    }

    try {
      await this.authService.verifyToken(token); // Xác minh token
      return true;
    } catch (error) {
      throw new Error('Unauthorized' + error.message);
    }
  }
}
