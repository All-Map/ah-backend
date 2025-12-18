import { BadRequestException, ConflictException, Injectable, InternalServerErrorException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { SupabaseService } from '../supabase/supabase.service';
import { RegisterDto } from './dto/register.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { User } from 'src/entities/user.entity';
import * as bcrypt from 'bcrypt';
import { MailService } from 'src/mail/mail.service';
import { OnboardingDto } from 'src/obboarding/dto/onboarding.dto';

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
    location: string;
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
  ) {}

  async validateUser(email: string, pass: string): Promise<User | null> {
    const { data: user, error } = await this.supabase
      .client
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !user) return null;

    const isValid = await bcrypt.compare(pass, user.password_hash);
    return isValid ? user : null;
  }

async register(registerDto: RegisterDto): Promise<User> {
    try {
      // Check if terms are accepted
      if (!registerDto.terms_accepted) {
        throw new BadRequestException('You must accept the terms and conditions');
      }

      // Check if user already exists
      const { data: existingUser } = await this.supabase
        .client
        .from('users')
        .select('id, is_verified')
        .eq('email', registerDto.email)
        .single();

      if (existingUser?.is_verified) {
        throw new ConflictException('User already exists');
      }

      const verificationToken = crypto.randomBytes(32).toString('hex');
      const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      const hashedPassword = await bcrypt.hash(registerDto.password_hash, 10);

      const userData = {
        ...registerDto,
        password_hash: hashedPassword,
        verification_token: verificationToken,
        verification_token_expires_at: tokenExpiry.toISOString(),
        is_verified: true,
        terms_accepted: registerDto.terms_accepted,
        terms_accepted_at: registerDto.terms_accepted ? new Date().toISOString() : null,
        created_at: registerDto.created_at ? registerDto.created_at.toISOString() : new Date().toISOString(),
      };

      let user;
      if (existingUser && !existingUser.is_verified) {
        const { data, error } = await this.supabase
          .client
          .from('users')
          .update(userData)
          .eq('email', registerDto.email)
          .select('*')
          .single();

        if (error) throw new InternalServerErrorException(error.message || 'Failed to update user');
        user = data;
      } else {
        const { data, error } = await this.supabase
          .client
          .from('users')
          .insert([userData])
          .select('*')
          .single();
        
        if (error) {
          console.error('Supabase error:', error);
          if (error.code === '23505') {
            throw new ConflictException('User already exists');
          }
          throw new InternalServerErrorException(error.message || 'Failed to create user');
        }
        user = data;
      }

      // Send verification email
      try {
        await this.mailService.sendAdminVerificationEmail(user.email, verificationToken);
      } catch (error) {
        console.error('Failed to send verification email:', error);
        // Don't throw error here to avoid rolling back user creation
      }

      // Remove sensitive data from response
      const { verification_token, verification_token_expires_at, password_hash, ...safeUser } = user;
      return safeUser;
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  }

  async registerStudent(registerDto: RegisterDto): Promise<User> {
    try {
      if (!registerDto.terms_accepted) {
        throw new BadRequestException('You must accept the terms and conditions');
      }

      // Check if user already exists
      const { data: existingUser } = await this.supabase
        .client
        .from('users')
        .select('id, is_verified')
        .eq('email', registerDto.email)
        .single();

      if (existingUser?.is_verified) {
        throw new ConflictException('User already exists');
      }

      const verificationToken = crypto.randomBytes(32).toString('hex');
      const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const hashedPassword = await bcrypt.hash(registerDto.password_hash, 10);

      const userData = {
        ...registerDto,
        password_hash: hashedPassword,
        name: registerDto.name || null,
        gender: registerDto.gender || null,
        verification_token: verificationToken,
        verification_token_expires_at: tokenExpiry.toISOString(),
        is_verified: true,
        onboarding_completed: false,
        terms_accepted: registerDto.terms_accepted,
        terms_accepted_at: registerDto.terms_accepted ? new Date().toISOString() : null,
        created_at: registerDto.created_at ? registerDto.created_at.toISOString() : new Date().toISOString(),
      };

      let user;
      if (existingUser && !existingUser.is_verified) {
        const { data, error } = await this.supabase
          .client
          .from('users')
          .update(userData)
          .eq('email', registerDto.email)
          .select('*')
          .single();

        if (error) throw new InternalServerErrorException(error.message || 'Failed to update user');
        user = data;
      } else {
        const { data, error } = await this.supabase
          .client
          .from('users')
          .insert([userData])
          .select('*')
          .single();
        
        if (error) {
          console.error('Supabase error:', error);
          if (error.code === '23505') {
            throw new ConflictException('User already exists');
          }
          throw new InternalServerErrorException(error.message || 'Failed to create user');
        }
        user = data;
      }

      try {
        await this.mailService.sendVerificationEmail(user.email, verificationToken);
      } catch (error) {
        console.error('Failed to send verification email:', error);
      }

      const { verification_token, verification_token_expires_at, password_hash, ...safeUser } = user;
      return safeUser;
    } catch (error) {
      console.error('Student registration error:', error);
      throw error;
    }
  }

  async completeOnboarding(userId: string, onboardingDto: OnboardingDto): Promise<UserDetails> {
    try {
      // Verify school exists
      const { data: school, error: schoolError } = await this.supabase
        .client
        .from('schools')
        .select('*')
        .eq('id', onboardingDto.school_id)
        .single();

      if (schoolError || !school) {
        throw new BadRequestException('Invalid school selected');
      }

      // Update user with onboarding data
      const { data: updatedUser, error: updateError } = await this.supabase
        .client
        .from('users')
        .update({
          school_id: onboardingDto.school_id,
          emergency_contact_name: onboardingDto.emergency_contact_name,
          emergency_contact_phone: onboardingDto.emergency_contact_phone,
          emergency_contact_relationship: onboardingDto.emergency_contact_relationship,
          emergency_contact_email: onboardingDto.emergency_contact_email || null,
          onboarding_completed: true,
          status: 'verified',
        })
        .eq('id', userId)
        .select('*')
        .single();

      if (updateError) {
        console.error('Onboarding update error:', updateError);
        throw new InternalServerErrorException('Failed to complete onboarding');
      }

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
      const { data: user, error } = await this.supabase.client
        .from('users')
        .select('onboarding_completed, school_id, emergency_contact_name')
        .eq('id', userId)
        .single();

      if (error || !user) {
        throw new NotFoundException('User not found');
      }

      return {
        onboarding_completed: user.onboarding_completed || false,
        school_id: user.school_id,
        has_emergency_contact: !!user.emergency_contact_name,
      };
    } catch (error) {
      console.error('Get onboarding status error:', error);
      throw error;
    }
  }

  async verifyEmail(token: string): Promise<{ message: string; user?: Partial<User> }> {
    try {
      if (!token || typeof token !== 'string') {
        throw new BadRequestException('Token is required');
      }

      const cleanToken = token.trim();
      if (cleanToken.length !== 64) {
        throw new BadRequestException('Invalid verification token format');
      }

      const { data: user, error: userError } = await this.supabase
        .client
        .from('users')
        .select('*')
        .eq('verification_token', cleanToken)
        .single();

      if (userError) {
        if (userError.code === 'PGRST116' || userError.message?.includes('No rows found')) {
          throw new BadRequestException('Invalid verification token');
        }
        throw new InternalServerErrorException('Database error during verification');
      }

      if (user.is_verified) {
        return {
          message: 'Email is already verified. You can proceed to login.',
          user: {
            id: user.id,
            email: user.email,
            is_verified: true
          }
        };
      }

      if (user.verification_token_expires_at) {
        const now = new Date();
        const expiryDate = new Date(user.verification_token_expires_at);
        
        if (now > expiryDate) {
          throw new BadRequestException('Verification token has expired. Please request a new verification email.');
        }
      }

      const updateData = {
        is_verified: true,
        verification_token: null,
        verification_token_expires_at: null,
        verified_at: new Date().toISOString(),
        status: 'verified' as const
      };

      const { data: updatedUser, error: updateError } = await this.supabase
        .client
        .from('users')
        .update(updateData)
        .eq('id', user.id)
        .select('id, email, is_verified, verified_at, onboarding_completed')
        .single();

      if (updateError) {
        console.error('Update error:', updateError);
        throw new InternalServerErrorException('Failed to update user verification status');
      }

      return {
        message: 'Email verified successfully',
        user: updatedUser
      };

    } catch (error) {
      console.error('Verify email error:', error);
      
      if (error instanceof BadRequestException || error instanceof InternalServerErrorException) {
        throw error;
      }
      
      throw new InternalServerErrorException('An unexpected error occurred during verification');
    }
  }

  async login(user: User, inputPassword: string) {
    try {
      const isMatch = await bcrypt.compare(inputPassword, user.password_hash);
      if (!isMatch) {
        throw new UnauthorizedException('Invalid credentials');
      }

      if (user.role !== 'super_admin' && !user.terms_accepted) {
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
          is_verified: user.is_verified,
          name: user.name,
          phone: user.phone,
          gender: user.gender,
          school_id: user.school_id,
          terms_accepted: user.terms_accepted,
          onboarding_completed: user.onboarding_completed || false,
        },
      };
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  async resendVerificationEmail(email: string): Promise<{ message: string }> {
    const { data: user, error } = await this.supabase
      .client
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !user) {
      throw new NotFoundException('User not found');
    }

    if (user.is_verified) {
      throw new BadRequestException('Email is already verified');
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const { error: updateError } = await this.supabase
      .client
      .from('users')
      .update({
        verification_token: verificationToken,
        verification_token_expires_at: tokenExpiry.toISOString()
      })
      .eq('id', user.id);

    if (updateError) {
      throw new InternalServerErrorException('Failed to update verification token');
    }

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
      const { error } = await this.supabase.client
        .from('users')
        .update({ 
          terms_accepted: true,
          terms_accepted_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (error) {
        throw new InternalServerErrorException('Failed to accept terms');
      }

      return { message: 'Terms and conditions accepted successfully' };
    } catch (error) {
      console.error('Accept terms error:', error);
      throw error;
    }
  }

  // Add terms status check method
  async getTermsStatus(userId: string): Promise<{ terms_accepted: boolean; terms_accepted_at?: string }> {
    try {
      const { data: user, error } = await this.supabase.client
        .from('users')
        .select('terms_accepted, terms_accepted_at')
        .eq('id', userId)
        .single();

      if (error || !user) {
        throw new NotFoundException('User not found');
      }

      return {
        terms_accepted: user.terms_accepted || false,
        terms_accepted_at: user.terms_accepted_at
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
  const { data: user, error: userError } = await this.supabase.client
    .from('users')
    .select('id, password_hash')
    .eq('id', userId)
    .single();

  if (userError || !user) {
    throw new NotFoundException('User not found');
  }

  // Verify current password
  const isCurrentPasswordValid = await bcrypt.compare(
    changePasswordDto.currentPassword, 
    user.password_hash
  );

  if (!isCurrentPasswordValid) {
    throw new BadRequestException('Current password is incorrect');
  }

  // Hash new password
  const hashedNewPassword = await bcrypt.hash(changePasswordDto.newPassword, 10);

  // Update password in database
  const { error: updateError } = await this.supabase.client
    .from('users')
    .update({ password_hash: hashedNewPassword })
    .eq('id', userId);

  if (updateError) {
    console.error('Password update error:', updateError);
    throw new InternalServerErrorException('Failed to change password');
  }

  return { message: 'Password changed successfully' };
}

  async requestPasswordReset(email: string) {
    const user = await this.findUserByEmail(email);
    if (!user) return; // Don't reveal if user exists
    
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 3600000); // 1 hour
    
    await this.supabase.client
      .from('users')
      .update({ 
        password_reset_token: resetToken,
        reset_token_expiry: expiry
      })
      .eq('id', user.id);
    
    await this.mailService.sendPasswordResetEmail(email, resetToken);
  }

    async requestAdminPasswordReset(email: string) {
    const user = await this.findUserByEmail(email);
    if (!user) return; // Don't reveal if user exists
    
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 3600000); // 1 hour
    
    await this.supabase.client
      .from('users')
      .update({ 
        password_reset_token: resetToken,
        reset_token_expiry: expiry
      })
      .eq('id', user.id);
    
    await this.mailService.sendAdminPasswordResetEmail(email, resetToken);
  }

async resetPassword(dto: ResetPasswordDto) {
  const user = await this.findUserByResetToken(dto.token);

  if (!user || user.reset_token_expiry < new Date()) {
    throw new BadRequestException('Invalid or expired token');
  }

  const hashedPassword = await bcrypt.hash(dto.newPassword, 10); // 10 is the salt rounds

  await this.supabase.client
    .from('users')
    .update({ 
      password_hash: hashedPassword,
      password_reset_token: null,
      reset_token_expiry: null
    })
    .eq('id', user.id);

  return { message: 'Password has been reset successfully' };
}

  private async findUserByEmail(email: string): Promise<User | null> {
    const { data, error } = await this.supabase
      .client
      .from('users')
      .select('*')
      .eq('email', email)
      .single();
    
    return error ? null : data;
  }

  private async findUserByResetToken(token: string): Promise<User | null> {
    const { data, error } = await this.supabase
      .client
      .from('users')
      .select('*')
      .eq('password_reset_token', token)
      .single();

      console.log('Token received for verification:', token);
    
    return error ? null : data;
  }

// In your AuthService.getUserProfile method, add logging to debug:

async getUserProfile(userId: string): Promise<UserDetails> {
  // Step 1: Get user data
  const { data: user, error: userError } = await this.supabase.client
    .from('users')
    .select('id, name, email, phone, gender, is_verified, role, school_id, terms_accepted, terms_accepted_at, onboarding_completed, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship, emergency_contact_email')
    .eq('id', userId)
    .single();

  console.log('Database user data:', user); // Add this debug line
  console.log('User gender from DB:', user?.gender); // Add this debug line

  if (userError || !user) {
    console.error('User fetch error:', userError);
    throw new NotFoundException('User profile not found');
  }

  // Step 2: Get school data if user has a school_id
  let school: {
    id: string;
    name: string;
    domain: string;
    location: string;
  } | undefined = undefined;
  
  if (user.school_id) {
    const { data: schoolData, error: schoolError } = await this.supabase.client
      .from('schools')
      .select('id, name, domain, location')
      .eq('id', user.school_id)
      .single();

    if (!schoolError && schoolData) {
      school = {
        id: schoolData.id,
        name: schoolData.name,
        domain: schoolData.domain,
        location: schoolData.location,
      };
    }
  }

  // Step 3: Return combined profile
  const profile: UserDetails = {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    gender: user.gender, // Make sure this is included
    is_verified: user.is_verified,
    terms_accepted: user.terms_accepted,
    terms_accepted_at: user.terms_accepted_at,
    role: user.role,
    school_id: user.school_id,
    school,
    onboarding_completed: user.onboarding_completed,
    emergency_contact_name: user.emergency_contact_name,
    emergency_contact_phone: user.emergency_contact_phone,
    emergency_contact_relationship: user.emergency_contact_relationship,
    emergency_contact_email: user.emergency_contact_email,
  };

  console.log('Final profile object:', profile); // Add this debug line
  console.log('Final profile gender:', profile.gender); // Add this debug line

  return profile;
}

async updateProfile(userId: string, updateProfileDto: UpdateProfileDto): Promise<UserDetails> {
  // Get current user data first
  const { data: currentUser, error: fetchError } = await this.supabase.client
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (fetchError || !currentUser) {
    throw new NotFoundException('User not found');
  }

  // Prepare update data (include ALL updatable fields)
  const updateData: any = {};
  
  // Personal info fields
  if (updateProfileDto.name !== undefined) updateData.name = updateProfileDto.name;
  if (updateProfileDto.phone !== undefined) updateData.phone = updateProfileDto.phone;
  if (updateProfileDto.gender !== undefined) updateData.gender = updateProfileDto.gender;
  
  // Emergency contact fields
  if (updateProfileDto.emergency_contact_name !== undefined) {
    updateData.emergency_contact_name = updateProfileDto.emergency_contact_name;
  }
  if (updateProfileDto.emergency_contact_phone !== undefined) {
    updateData.emergency_contact_phone = updateProfileDto.emergency_contact_phone;
  }
  if (updateProfileDto.emergency_contact_relationship !== undefined) {
    updateData.emergency_contact_relationship = updateProfileDto.emergency_contact_relationship;
  }
  if (updateProfileDto.emergency_contact_email !== undefined) {
    updateData.emergency_contact_email = updateProfileDto.emergency_contact_email || null;
  }
  
  // Terms fields
  if (updateProfileDto.terms_accepted !== undefined) {
    updateData.terms_accepted = updateProfileDto.terms_accepted;
  }
  if (updateProfileDto.terms_accepted_at !== undefined) {
    updateData.terms_accepted_at = updateProfileDto.terms_accepted_at;
  }

  // Only update if there's something to update
  if (Object.keys(updateData).length === 0) {
    throw new BadRequestException('No valid fields to update');
  }

  console.log('Updating user with data:', updateData);

  // Update user profile
  const { data: updatedUser, error: updateError } = await this.supabase.client
    .from('users')
    .update(updateData)
    .eq('id', userId)
    .select('id, name, email, phone, gender, is_verified, role, school_id, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship, emergency_contact_email, terms_accepted, terms_accepted_at, onboarding_completed')
    .single();

  if (updateError) {
    console.error('Profile update error:', updateError);
    throw new InternalServerErrorException('Failed to update profile');
  }

  // Get school data if user has a school_id
  let school: {
    id: string;
    name: string;
    domain: string;
    location: string;
  } | undefined = undefined;

  if (updatedUser.school_id) {
    const { data: schoolData, error: schoolError } = await this.supabase.client
      .from('schools')
      .select('id, name, domain, location')
      .eq('id', updatedUser.school_id)
      .single();

    if (!schoolError && schoolData) {
      school = {
        id: schoolData.id,
        name: schoolData.name,
        domain: schoolData.domain,
        location: schoolData.location,
      };
    }
  }

  // Return updated profile with all fields
  const profile: UserDetails = {
    id: updatedUser.id,
    name: updatedUser.name,
    email: updatedUser.email,
    phone: updatedUser.phone,
    gender: updatedUser.gender,
    is_verified: updatedUser.is_verified,
    role: updatedUser.role,
    school_id: updatedUser.school_id,
    terms_accepted: updatedUser.terms_accepted,
    terms_accepted_at: updatedUser.terms_accepted_at,
    onboarding_completed: updatedUser.onboarding_completed,
    emergency_contact_name: updatedUser.emergency_contact_name,
    emergency_contact_phone: updatedUser.emergency_contact_phone,
    emergency_contact_relationship: updatedUser.emergency_contact_relationship,
    emergency_contact_email: updatedUser.emergency_contact_email,
    school,
  };

  console.log('Profile updated successfully:', profile.id);

  return profile;
}
}