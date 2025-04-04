import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service'; // Sử dụng AuthService để xác minh token

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = request.headers.authorization?.split(' ')[1]; // Lấy token từ header Authorization

    if (!token) {
      throw new UnauthorizedException('Authorization token is required');
    }

    try {
      const { user_id, email } = await this.authService.verifyToken(token); // Xác minh token
      console.log(`verify token from authguard: ${user_id} ${email}`);
      request.user = { id: user_id, email };
      return true;
    } catch (error) {
      console.error(error);
      throw new UnauthorizedException(
        `'You are not authroized to access this resource`,
      );
    }
  }
}
