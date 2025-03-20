import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard'; // Guard bảo vệ các route

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Route đăng ký người dùng mới
  @Post('register')
  async signup(
    @Body() body: { email: string; password: string; username: string },
  ) {
    return this.authService.signup(body.email, body.password, body.username);
  }

  // Route đăng nhập người dùng
  @Post('login')
  async login(@Body() body: { token: string }) {
    return this.authService.login(body.token);
  }

  // Route đăng xuất người dùng
  @Post('signout')
  async signout(@Body() body: { uid: string }) {
    return this.authService.signout(body.uid);
  }

  // Route xác minh token (bảo vệ route)
  @UseGuards(AuthGuard)
  @Post('verify-token')
  async verifyToken(@Body() body: { token: string }) {
    return this.authService.verifyToken(body.token);
  }
}
