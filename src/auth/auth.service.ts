import { BadRequestException, ConflictException, Inject, Injectable, InternalServerErrorException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtUser } from './types/jwt-user';
import * as bcrypt from 'bcrypt';
import { MailService } from 'src/mail/mail.service';
import { OnboardingDto } from 'src/obboarding/dto/onboarding.dto';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

export interface UserDetails {
  id: string;
  name: string;
  email: string;
  phone: string;
  gender?: string;
  is_verified: boolean;
  role: string;
  school_id: string;
  onboarding_completed: boolean;
  terms_accepted: boolean;
  terms_accepted_at?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  emergency_contact_relationship?: string;
  emergency_contact_email?: string;
  school?: {
    id: string;
    name: string;
    domain: string;
  };
}

@Injectable()
export class AuthService {
  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
  ) {}

  async validateUser(email: string, pass: string): Promise<any | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) return null;

    const isValid = await bcrypt.compare(pass, user.passwordHash);
    return isValid ? user : null;
  }

  async validateGoogleUser(googleUser: any): Promise<any> {
    const { email, google_id, name } = googleUser;

    // Check if user exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      // If user exists but doesn't have google_id, update it
      if (!existingUser.googleId) {
        return await this.prisma.user.update({
          where: { id: existingUser.id },
          data: { googleId: google_id },
        });
      }
      return existingUser;
    }

    // Create new user
    return await this.prisma.user.create({
      data: {
        email,
        googleId: google_id,
        name,
        passwordHash: 'GOOGLE_AUTH_USER', // Placeholder for required field
        role: 'student',
        isVerified: true, // Google emails are verified
        onboardingCompleted: false,
        status: 'verified',
      },
    });
  }

async register(registerDto: RegisterDto): Promise<any> {
    try {
      // Check if terms are accepted
      if (!registerDto.terms_accepted) {
        throw new BadRequestException('You must accept the terms and conditions');
      }

      // Check if user already exists
      const existingUser = await this.prisma.user.findUnique({
        where: { email: registerDto.email },
        select: { id: true, isVerified: true }
      });

      if (existingUser?.isVerified) {
        throw new ConflictException('User already exists');
      }

      const verificationToken = crypto.randomBytes(32).toString('hex');
      const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      const hashedPassword = await bcrypt.hash(registerDto.password_hash, 10);

      const userData: any = {
        email: registerDto.email,
        name: registerDto.name,
        phone: registerDto.phone,
        passwordHash: hashedPassword,
        verificationToken: verificationToken,
        verificationTokenExpiresAt: tokenExpiry,
        isVerified: true, // Auto-verify for now as per previous logic
        termsAccepted: registerDto.terms_accepted,
        termsAcceptedAt: registerDto.terms_accepted ? new Date() : null,
      };

      let user;
      if (existingUser && !existingUser.isVerified) {
        user = await this.prisma.user.update({
          where: { id: existingUser.id },
          data: userData,
        });
      } else {
        user = await this.prisma.user.create({
          data: userData,
        });
      }

      // Send verification email
      try {
        await this.mailService.sendAdminVerificationEmail(user.email, verificationToken);
      } catch (error) {
        console.error('Failed to send verification email:', error);
      }

      // Remove sensitive data from response
      const { verificationToken: vt, verificationTokenExpiresAt: vtea, passwordHash, ...safeUser } = user;
      return safeUser;
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  }

  async registerStudent(registerDto: RegisterDto): Promise<any> {
    try {
      if (!registerDto.terms_accepted) {
        throw new BadRequestException('You must accept the terms and conditions');
      }

      // Check if user already exists
      const existingUser = await this.prisma.user.findUnique({
        where: { email: registerDto.email },
        select: { id: true, isVerified: true }
      });

      if (existingUser?.isVerified) {
        throw new ConflictException('User already exists');
      }

      const verificationToken = crypto.randomBytes(32).toString('hex');
      const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const hashedPassword = await bcrypt.hash(registerDto.password_hash, 10);

      const userData: any = {
        email: registerDto.email,
        name: registerDto.name || null,
        phone: registerDto.phone || null,
        gender: registerDto.gender || null,
        passwordHash: hashedPassword,
        verificationToken: verificationToken,
        verificationTokenExpiresAt: tokenExpiry,
        isVerified: true,
        onboardingCompleted: false,
        termsAccepted: registerDto.terms_accepted,
        termsAcceptedAt: registerDto.terms_accepted ? new Date() : null,
      };

      let user;
      if (existingUser && !existingUser.isVerified) {
        user = await this.prisma.user.update({
          where: { id: existingUser.id },
          data: userData,
        });
      } else {
        user = await this.prisma.user.create({
          data: userData,
        });
      }

      try {
        await this.mailService.sendVerificationEmail(user.email, verificationToken);
      } catch (error) {
        console.error('Failed to send verification email:', error);
      }

      const { verificationToken: vt, verificationTokenExpiresAt: vtea, passwordHash, ...safeUser } = user;
      return safeUser;
    } catch (error) {
      console.error('Student registration error:', error);
      throw error;
    }
  }

  async completeOnboarding(userId: string, onboardingDto: OnboardingDto): Promise<any> {
    try {
      const updateData: any = { ...onboardingDto };
      
      // Clear cache for this user immediately to prevent stale profile reads
      const cacheKey = `user_profile:${userId}`;
      await this.cacheManager.del(cacheKey);
      
      // If school_id is provided, verify it
      if (onboardingDto.school_id) {
        const school = await this.prisma.school.findUnique({
          where: { id: onboardingDto.school_id }
        });

        if (!school) {
          throw new BadRequestException('Invalid school selected');
        }
      }

      // Check current completion status
      const currentUser = await this.prisma.user.findUnique({
        where: { id: userId }
      });

      if (!currentUser) throw new NotFoundException('User not found');

      // Map DTO fields to Prisma fields for consistent check
      const merged = {
        name: updateData.name ?? currentUser.name,
        phone: updateData.phone ?? currentUser.phone,
        gender: updateData.gender ?? currentUser.gender,
        schoolId: updateData.school_id ?? currentUser.schoolId,
        emergencyContactName: updateData.emergency_contact_name ?? currentUser.emergencyContactName,
        emergencyContactPhone: updateData.emergency_contact_phone ?? currentUser.emergencyContactPhone,
        emergencyContactRelationship: updateData.emergency_contact_relationship ?? currentUser.emergencyContactRelationship,
      };

      const isComplete = !!(
        merged.name &&
        merged.phone &&
        merged.gender &&
        merged.schoolId &&
        merged.emergencyContactName &&
        merged.emergencyContactPhone &&
        merged.emergencyContactRelationship
      );

      const prismaUpdateData: any = {};
      if (updateData.name) prismaUpdateData.name = updateData.name;
      if (updateData.phone) prismaUpdateData.phone = updateData.phone;
      if (updateData.gender) prismaUpdateData.gender = updateData.gender;
      if (updateData.school_id) prismaUpdateData.schoolId = updateData.school_id;
      if (updateData.emergency_contact_name) prismaUpdateData.emergencyContactName = updateData.emergency_contact_name;
      if (updateData.emergency_contact_phone) prismaUpdateData.emergencyContactPhone = updateData.emergency_contact_phone;
      if (updateData.emergency_contact_relationship) prismaUpdateData.emergencyContactRelationship = updateData.emergency_contact_relationship;
      if (updateData.emergency_contact_email) prismaUpdateData.emergencyContactEmail = updateData.emergency_contact_email;
      if (updateData.last_onboarding_step) prismaUpdateData.lastOnboardingStep = updateData.last_onboarding_step;
      
      if (isComplete) {
        prismaUpdateData.onboardingCompleted = true;
        prismaUpdateData.status = 'verified';
      }

      await this.prisma.user.update({
        where: { id: userId },
        data: prismaUpdateData,
      });

      return this.getUserProfile(userId);
    } catch (error) {
      console.error('Complete onboarding error:', error);
      throw error;
    }
  }

  async getOnboardingStatus(userId: string): Promise<{ 
    onboarding_completed: boolean; 
    school_id?: string;
    has_emergency_contact: boolean;
  }> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          onboardingCompleted: true,
          schoolId: true,
          emergencyContactName: true
        }
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      return {
        onboarding_completed: user.onboardingCompleted || false,
        school_id: user.schoolId || undefined,
        has_emergency_contact: !!user.emergencyContactName,
      };
    } catch (error) {
      console.error('Get onboarding status error:', error);
      throw error;
    }
  }

  async verifyEmail(token: string): Promise<{ message: string; user?: any }> {
    try {
      if (!token || typeof token !== 'string') {
        throw new BadRequestException('Token is required');
      }

      const cleanToken = token.trim();
      if (cleanToken.length !== 64) {
        throw new BadRequestException('Invalid verification token format');
      }

      const user = await this.prisma.user.findFirst({
        where: { verificationToken: cleanToken }
      });

      if (!user) {
        throw new BadRequestException('Invalid verification token');
      }

      if (user.isVerified) {
        return {
          message: 'Email is already verified. You can proceed to login.',
          user: {
            id: user.id,
            email: user.email,
            isVerified: true
          }
        };
      }

      if (user.verificationTokenExpiresAt) {
        const now = new Date();
        const expiryDate = new Date(user.verificationTokenExpiresAt);
        
        if (now > expiryDate) {
          throw new BadRequestException('Verification token has expired. Please request a new verification email.');
        }
      }

      const updatedUser = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          isVerified: true,
          verificationToken: null,
          verificationTokenExpiresAt: null,
          verifiedAt: new Date(),
          status: 'verified'
        },
        select: {
          id: true,
          email: true,
          isVerified: true,
          verifiedAt: true,
          onboardingCompleted: true
        }
      });

      return {
        message: 'Email verified successfully',
        user: updatedUser
      };

    } catch (error) {
      console.error('Verify email error:', error);
      throw error;
    }
  }

  async login(user: any, inputPassword?: string) {
    try {
      if (inputPassword) {
        const isMatch = await bcrypt.compare(inputPassword, user.passwordHash);
        if (!isMatch) {
          throw new UnauthorizedException('Invalid credentials');
        }
      } else if (!user.googleId) {
        throw new UnauthorizedException('Invalid credentials');
      }

      if (user.role !== 'super_admin' && !user.termsAccepted) {
        throw new UnauthorizedException('Please accept the terms and conditions to continue');
      }

      const payload = {
        sub: user.id,
        email: user.email,
        role: user.role,
      };

      return {
        access_token: this.jwtService.sign(payload),
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          is_verified: user.isVerified,
          name: user.name || undefined,
          phone: user.phone || undefined,
          gender: user.gender || undefined,
          school_id: user.schoolId || undefined,
          terms_accepted: user.termsAccepted,
          onboarding_completed: user.onboardingCompleted || false,
        },
      };
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  async resendVerificationEmail(email: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.isVerified) {
      throw new BadRequestException('Email is already verified');
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        verificationToken,
        verificationTokenExpiresAt: tokenExpiry
      }
    });

    try {
      await this.mailService.sendVerificationEmail(user.email, verificationToken);
    } catch (error) {
      console.error('Failed to send verification email:', error);
      throw new InternalServerErrorException('Failed to send verification email');
    }

    return { message: 'Verification email sent successfully' };
  }

  // Add terms acceptance method
  async acceptTerms(userId: string): Promise<{ message: string }> {
    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: { 
          termsAccepted: true,
          termsAcceptedAt: new Date()
        }
      });

      return { message: 'Terms and conditions accepted successfully' };
    } catch (error) {
      console.error('Accept terms error:', error);
      throw error;
    }
  }

  // Add terms status check method
  async getTermsStatus(userId: string): Promise<{ terms_accepted: boolean; terms_accepted_at?: Date }> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { termsAccepted: true, termsAcceptedAt: true }
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      return {
        terms_accepted: user.termsAccepted || false,
        terms_accepted_at: user.termsAcceptedAt || undefined
      };
    } catch (error) {
      console.error('Get terms status error:', error);
      throw error;
    }
  }

async changePassword(
  userId: string, 
  changePasswordDto: { currentPassword: string; newPassword: string }
): Promise<{ message: string }> {
  // Get the current user
  const user = await this.prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, passwordHash: true }
  });

  if (!user) {
    throw new NotFoundException('User not found');
  }

  // Verify current password
  const isCurrentPasswordValid = await bcrypt.compare(
    changePasswordDto.currentPassword, 
    user.passwordHash
  );

  if (!isCurrentPasswordValid) {
    throw new BadRequestException('Current password is incorrect');
  }

  // Hash new password
  const hashedNewPassword = await bcrypt.hash(changePasswordDto.newPassword, 10);

  // Update password in database
  await this.prisma.user.update({
    where: { id: userId },
    data: { passwordHash: hashedNewPassword }
  });

  return { message: 'Password changed successfully' };
}

  async requestPasswordReset(email: string) {
    const user = await this.findUserByEmail(email);
    if (!user) return; // Don't reveal if user exists
    
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 3600000); // 1 hour
    
    await this.prisma.user.update({
      where: { id: user.id },
      data: { 
        passwordResetToken: resetToken,
        resetTokenExpiry: expiry
      }
    });
    
    await this.mailService.sendPasswordResetEmail(email, resetToken);
  }

    async requestAdminPasswordReset(email: string) {
    const user = await this.findUserByEmail(email);
    if (!user) return; // Don't reveal if user exists
    
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 3600000); // 1 hour
    
    await this.prisma.user.update({
      where: { id: user.id },
      data: { 
        passwordResetToken: resetToken,
        resetTokenExpiry: expiry
      }
    });
    
    await this.mailService.sendAdminPasswordResetEmail(email, resetToken);
  }

async resetPassword(dto: ResetPasswordDto) {
  const user = await this.findUserByResetToken(dto.token);

  const tokenExpiry = user?.resetTokenExpiry;
  if (!user || !tokenExpiry || new Date(tokenExpiry) < new Date()) {
    throw new BadRequestException('Invalid or expired token');
  }

  const hashedPassword = await bcrypt.hash(dto.newPassword, 10);

  await this.prisma.user.update({
    where: { id: user.id },
    data: { 
      passwordHash: hashedPassword,
      passwordResetToken: null,
      resetTokenExpiry: null
    }
  });

  return { message: 'Password has been reset successfully' };
}

  private async findUserByEmail(email: string): Promise<any | null> {
    return await this.prisma.user.findUnique({
      where: { email }
    });
  }

  private async findUserByResetToken(token: string): Promise<any | null> {
    return await this.prisma.user.findFirst({
      where: { passwordResetToken: token }
    });
  }

// In your AuthService.getUserProfile method, add logging to debug:

  async getUserProfile(userId: string): Promise<any> {
    const cacheKey = `user_profile:${userId}`;
    const cachedProfile = await this.cacheManager.get<any>(cacheKey);
    if (cachedProfile) {
      return cachedProfile;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        gender: true,
        isVerified: true,
        role: true,
        schoolId: true,
        termsAccepted: true,
        termsAcceptedAt: true,
        onboardingCompleted: true,
        emergencyContactName: true,
        emergencyContactPhone: true,
        emergencyContactRelationship: true,
        emergencyContactEmail: true,
        lastOnboardingStep: true
      }
    });

    if (!user) {
      throw new NotFoundException('User profile not found');
    }

    let school: any = undefined;
    if (user.schoolId) {
      school = await this.prisma.school.findUnique({
        where: { id: user.schoolId },
        select: { id: true, name: true, domain: true }
      });
    }

    const profile = this.mapUserToResponse(user, school);

    // Cache the profile for future requests
    await this.cacheManager.set(cacheKey, profile, 300); // Cache for 5 minutes

    return profile;
  }

  private mapUserToResponse(user: any, school?: any): any {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      gender: user.gender,
      role: user.role,
      is_verified: user.isVerified ?? user.is_verified,
      terms_accepted: user.termsAccepted ?? user.terms_accepted,
      terms_accepted_at: user.termsAcceptedAt ?? user.terms_accepted_at,
      onboarding_completed: user.onboardingCompleted ?? user.onboarding_completed,
      school_id: user.schoolId ?? user.school_id,
      emergency_contact_name: user.emergencyContactName ?? user.emergency_contact_name,
      emergency_contact_phone: user.emergencyContactPhone ?? user.emergency_contact_phone,
      emergency_contact_relationship: user.emergencyContactRelationship ?? user.emergency_contact_relationship,
      emergency_contact_email: user.emergencyContactEmail ?? user.emergency_contact_email,
      last_onboarding_step: user.lastOnboardingStep ?? user.last_onboarding_step,
      school: school ? {
        id: school.id,
        name: school.name,
        domain: school.domain,
      } : undefined,
    };
  }

async updateProfile(userId: string, updateProfileDto: UpdateProfileDto): Promise<any> {
  // Get current user data first
  const currentUser = await this.prisma.user.findUnique({
    where: { id: userId }
  });

  if (!currentUser) {
    throw new NotFoundException('User not found');
  }

  // Prepare update data
  const updateData: any = {};
  
  if (updateProfileDto.name !== undefined) updateData.name = updateProfileDto.name;
  if (updateProfileDto.phone !== undefined) updateData.phone = updateProfileDto.phone;
  if (updateProfileDto.gender !== undefined) updateData.gender = updateProfileDto.gender;
  
  if (updateProfileDto.emergency_contact_name !== undefined) {
    updateData.emergencyContactName = updateProfileDto.emergency_contact_name;
  }
  if (updateProfileDto.emergency_contact_phone !== undefined) {
    updateData.emergencyContactPhone = updateProfileDto.emergency_contact_phone;
  }
  if (updateProfileDto.emergency_contact_relationship !== undefined) {
    updateData.emergencyContactRelationship = updateProfileDto.emergency_contact_relationship;
  }
  if (updateProfileDto.emergency_contact_email !== undefined) {
    updateData.emergencyContactEmail = updateProfileDto.emergency_contact_email || null;
  }
  
  if (updateProfileDto.terms_accepted !== undefined) {
    updateData.termsAccepted = updateProfileDto.terms_accepted;
  }
  if (updateProfileDto.terms_accepted_at !== undefined) {
    updateData.termsAcceptedAt = updateProfileDto.terms_accepted_at;
  }

  if (Object.keys(updateData).length === 0) {
    throw new BadRequestException('No valid fields to update');
  }

  // Update user profile
  await this.prisma.user.update({
    where: { id: userId },
    data: updateData
  });

  return this.getUserProfile(userId);
}
}