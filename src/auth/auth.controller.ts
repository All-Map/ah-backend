import { Controller, Post, Body, UseGuards, Get, Param, UnauthorizedException, Res } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Roles } from './decorators/roles.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { User } from 'src/entities/user.entity';
import { RolesGuard } from './guards/roles.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

@Post('login')
async login(@Body() loginDto: LoginDto) {
  const user = await this.authService.validateUser(loginDto.email, loginDto.password);
  if (!user) throw new UnauthorizedException();

    if (!user.is_verified) {
    throw new UnauthorizedException('Please verify your email first');
  }

  return this.authService.login(user, loginDto.password);
}

  @Post('request-reset')
  async requestReset(@Body('email') email: string) {
    await this.authService.requestPasswordReset(email);
    return { message: 'Reset instructions sent if email exists' };
  }

@Post('reset-password')
async resetPassword(@Body() dto: ResetPasswordDto) {
  await this.authService.resetPassword(dto);
  return { 
    success: true, 
    message: 'Password has been reset successfully' 
  };
}

    @Get('verify/:token')
    async verifyEmail(@Param('token') token: string) {
      const result = await this.authService.verifyEmail(token);
      return result; // Return JSON, not a redirect
    }

  @Post('resend-verification')
  async resendVerificationEmail(@Body() { email }: { email: string }) {
    return this.authService.resendVerificationEmail(email);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@CurrentUser() user: User) {
    return user;
  }

  @Roles('hostel_admin', 'super_admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('admin')
  adminRoute() {
    return { message: 'Admin access granted' };
  }
}

