import { Controller, Post, Body, UseGuards, Get, Param, UnauthorizedException, Res, Request, Put, Patch, BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Roles } from './decorators/roles.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { User } from 'src/entities/user.entity';
import { RolesGuard } from './guards/roles.guard';
import { ProfileService } from 'src/profile/profile.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService, private readonly profileService: ProfileService) {};

  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    try {
      return await this.authService.register(registerDto);
    } catch (error) {
      throw new BadRequestException(
        error.message || 'Registration failed. Please try again.'
      );
    }
  }

  @Post('register-student')
  async registerStudent(@Body() registerDto: RegisterDto) {
    try {
      return await this.authService.registerStudent(registerDto);
    } catch (error) {
      throw new BadRequestException(
        error.message || 'Student registration failed. Please try again.'
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('user-profile')
  async getUserProfile(@CurrentUser() user: User) {
    try {
      return await this.authService.getUserProfile(user.id);
    } catch (error) {
      throw new BadRequestException(
        error.message || 'Failed to fetch user profile'
      );
    }
  }

  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    try {
      const user = await this.authService.validateUser(loginDto.email, loginDto.password);
      if (!user) {
        throw new UnauthorizedException('Invalid email or password');
      }

      if (!user.is_verified) {
        await this.authService.resendVerificationEmail(user.email);
        throw new UnauthorizedException('Please verify your email first. Check your inbox for verification instructions.');
      }

      return await this.authService.login(user, loginDto.password);
    } catch (error) {
      // Preserve specific error messages but ensure proper error type
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Login failed. Please try again.');
    }
  }

  @UseGuards(JwtAuthGuard)
  @Patch('update-profile')
  async updateProfile(
    @CurrentUser() user: any,
    @Body() updateProfileDto: UpdateProfileDto,
  ) {
    try {
      console.log('Update profile endpoint hit:', user, updateProfileDto);
      return await this.authService.updateProfile(user.id, updateProfileDto);
    } catch (error) {
      throw new BadRequestException(
        error.message || 'Failed to update profile'
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  async changePassword(
    @CurrentUser() user: any,
    @Body() changePasswordDto: { currentPassword: string; newPassword: string },
  ) {
    try {
      return await this.authService.changePassword(user.id, changePasswordDto);
    } catch (error) {
      throw new BadRequestException(
        error.message || 'Failed to change password'
      );
    }
  }

  @Post('request-reset')
  async requestReset(@Body('email') email: string) {
    try {
      await this.authService.requestPasswordReset(email);
      return { message: 'Reset instructions sent if email exists' };
    } catch (error) {
      throw new BadRequestException(
        error.message || 'Failed to process password reset request'
      );
    }
  }

    @Post('admin/request-reset')
    async requestAdminReset(@Body('email') email: string) {
    try {
      await this.authService.requestAdminPasswordReset(email);
      return { message: 'Reset instructions sent if email exists' };
    } catch (error) {
      throw new BadRequestException(
        error.message || 'Failed to process password reset request'
      );
    }
  }

  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    try {
      await this.authService.resetPassword(dto);
      return { 
        success: true, 
        message: 'Password has been reset successfully' 
      };
    } catch (error) {
      throw new BadRequestException(
        error.message || 'Failed to reset password'
      );
    }
  }

  @Get('verify-email/:token')
  async verifyEmail(@Param('token') token: string) {
    try {
      const result = await this.authService.verifyEmail(token);
      return result;
    } catch (error) {
      throw new BadRequestException(
        error.message || 'Email verification failed'
      );
    }
  }

  @Post('resend-verification')
  async resendVerificationEmail(@Body() { email }: { email: string }) {
    try {
      return await this.authService.resendVerificationEmail(email);
    } catch (error) {
      throw new BadRequestException(
        error.message || 'Failed to resend verification email'
      );
    }
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

  // New endpoint to accept terms
  @UseGuards(JwtAuthGuard)
  @Post('accept-terms')
  async acceptTerms(@CurrentUser() user: any) {
    try {
      return await this.authService.acceptTerms(user.id);
    } catch (error) {
      throw new BadRequestException(
        error.message || 'Failed to accept terms'
      );
    }
  }

  // New endpoint to check terms status
  @UseGuards(JwtAuthGuard)
  @Get('terms-status')
  async getTermsStatus(@CurrentUser() user: any) {
    try {
      return await this.authService.getTermsStatus(user.id);
    } catch (error) {
      throw new BadRequestException(
        error.message || 'Failed to fetch terms status'
      );
    }
  }
}