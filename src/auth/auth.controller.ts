import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { ForgotDto, LoginDto, RefreshDto, RegisterDto, ResetDto } from './auth.dto.js';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}
  @Post('register') register(@Body() d: RegisterDto) { return this.auth.register(d); }
  @Post('login') login(@Body() d: LoginDto) { return this.auth.login(d); }
  @Post('refresh') refresh(@Body() d: RefreshDto) { return this.auth.refresh(d.refreshToken); }
  @Post('forgot-password') forgot(@Body() d: ForgotDto) { return this.auth.forgot(d.email); }
  @Post('reset-password') reset(@Body() d: ResetDto) { return this.auth.reset(d.token, d.password); }
}
