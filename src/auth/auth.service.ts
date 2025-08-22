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

export interface UserDetails {
  id: string;
  name: string;
  email: string;
  phone: string;
  gender?: string;
  is_verified: boolean;
  role: string;
  school_id: string;
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
  // Verify school domain
  // const domain = registerDto.email.split('@')[1];
  // const { data: school, error: schoolError } = await this.supabase
  //   .client
  //   .from('schools')
  //   .select('id')
  //   .eq('domain', domain)
  //   .single();
  
  // if (schoolError || !school) {
  //   throw new BadRequestException('Invalid school email domain');
  // }

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
  // school_id: school.id,
  verification_token: verificationToken,
  verification_token_expires_at: tokenExpiry.toISOString(),
  is_verified: false
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
    // In your AuthService
    await this.mailService.sendVerificationEmail(user.email, verificationToken);
  } catch (error) {
    console.error('Failed to send verification email:', error);
    // Don't throw error here to avoid rolling back user creation
  }

  // Remove sensitive data from response
  const { verification_token, verification_token_expires_at, ...safeUser } = user;
  return safeUser;
}

async registerStudent(registerDto: RegisterDto): Promise<User> {
  // Verify school domain
  const domain = registerDto.email.split('@')[1];
  const { data: school, error: schoolError } = await this.supabase
    .client
    .from('schools')
    .select('id')
    .eq('domain', domain)
    .single();
  
  if (schoolError || !school) {
    throw new BadRequestException('Invalid school email domain');
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
  school_id: school.id,
  name: registerDto.name || null,
  gender: registerDto.gender || null,
  verification_token: verificationToken,
  verification_token_expires_at: tokenExpiry.toISOString(),
  is_verified: false
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
    // In your AuthService
    await this.mailService.sendVerificationEmail(user.email, verificationToken);
  } catch (error) {
    console.error('Failed to send verification email:', error);
    // Don't throw error here to avoid rolling back user creation
  }

  // Remove sensitive data from response
  const { verification_token, verification_token_expires_at, ...safeUser } = user;
  return safeUser;
}

async verifyEmail(token: string): Promise<{ message: string; user?: Partial<User> }> {
  console.log('=== EMAIL VERIFICATION DEBUG ===');
  console.log('Received token:', token);
  console.log('Token length:', token.length);

  if (!token || token.length !== 64) {
    console.log('Invalid token format');
    throw new BadRequestException('Invalid verification token format');
  }

  // First, let's check if the token exists at all (ignoring expiry for debugging)
  const { data: tokenCheck, error: tokenCheckError } = await this.supabase
    .client
    .from('users')
    .select('id, email, verification_token, verification_token_expires_at, is_verified')
    .eq('verification_token', token)
    .single();

  console.log('Token check result:', tokenCheck);
  console.log('Token check error:', tokenCheckError);

  if (tokenCheckError && tokenCheckError.code !== 'PGRST116') {
    console.error('Database error during token check:', tokenCheckError);
    throw new InternalServerErrorException('Database error during verification');
  }

  if (!tokenCheck) {
    console.log('Token not found in database');
    throw new BadRequestException('Invalid verification token');
  }

  // Check if already verified
  if (tokenCheck.is_verified) {
    console.log('User already verified');
    throw new BadRequestException('Email is already verified');
  }

  // Check expiry
  const now = new Date();
  const expiryDate = new Date(tokenCheck.verification_token_expires_at);
  console.log('Current time:', now.toISOString());
  console.log('Token expiry:', expiryDate.toISOString());
  console.log('Token expired?', now > expiryDate);

  if (now > expiryDate) {
    console.log('Token has expired');
    throw new BadRequestException('Verification token has expired. Please request a new verification email.');
  }

  // Now update the user
  console.log('Updating user with ID:', tokenCheck.id);
  const { data: updatedUser, error: updateError } = await this.supabase
    .client
    .from('users')
    .update({ 
      is_verified: true, 
      verification_token: null,
      verification_token_expires_at: null,
      verified_at: new Date().toISOString()
    })
    .eq('id', tokenCheck.id)
    .select('id, email, is_verified, verified_at')
    .single();

  console.log('Update result:', updatedUser);
  console.log('Update error:', updateError);

  if (updateError) {
    console.error('Failed to update user:', updateError);
    throw new InternalServerErrorException('Failed to verify email');
  }

  if (!updatedUser) {
    console.error('Update returned no data');
    throw new InternalServerErrorException('Verification update failed');
  }

  console.log('=== VERIFICATION SUCCESSFUL ===');
  return {
    message: 'Email verified successfully',
    user: updatedUser
  };
}

// Replace your resendVerificationEmail method with this enhanced debug version

async resendVerificationEmail(email: string): Promise<{ message: string }> {
  console.log('=== RESEND VERIFICATION DEBUG ===');
  console.log('Email:', email);

  const { data: user, error } = await this.supabase
    .client
    .from('users')
    .select('*')
    .eq('email', email)
    .single();

  console.log('User found:', !!user);
  console.log('User ID:', user?.id);
  console.log('User verified status:', user?.is_verified);
  console.log('Current verification token:', user?.verification_token);

  if (error || !user) {
    console.log('User not found error:', error);
    throw new NotFoundException('User not found');
  }

  if (user.is_verified) {
    console.log('Email already verified');
    throw new BadRequestException('Email is already verified');
  }

  // Generate new token
  const verificationToken = crypto.randomBytes(32).toString('hex');
  const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

  console.log('New verification token:', verificationToken);
  console.log('Token expiry:', tokenExpiry.toISOString());

  // Update user with new token
  const { data: updateResult, error: updateError } = await this.supabase
    .client
    .from('users')
    .update({
      verification_token: verificationToken,
      verification_token_expires_at: tokenExpiry.toISOString()
    })
    .eq('id', user.id)
    .select('id, email, verification_token, verification_token_expires_at'); // Return updated data

  console.log('Update result:', updateResult);
  console.log('Update error:', updateError);

  if (updateError) {
    console.error('Failed to update token:', updateError);
    throw new InternalServerErrorException('Failed to update verification token');
  }

  // Verify the token was actually saved
  console.log('=== VERIFYING TOKEN WAS SAVED ===');
  const { data: verifyUpdate, error: verifyError } = await this.supabase
    .client
    .from('users')
    .select('id, email, verification_token, verification_token_expires_at')
    .eq('id', user.id)
    .single();

  console.log('Verification check result:', verifyUpdate);
  console.log('Verification check error:', verifyError);
  console.log('Token saved correctly?', verifyUpdate?.verification_token === verificationToken);

  // Also check if we can find it by token
  const { data: tokenLookup, error: tokenLookupError } = await this.supabase
    .client
    .from('users')
    .select('id, email, verification_token')
    .eq('verification_token', verificationToken)
    .single();

  console.log('Token lookup result:', tokenLookup);
  console.log('Token lookup error:', tokenLookupError);

  // Send new verification email
  try {
    console.log('Sending verification email...');
    await this.mailService.sendVerificationEmail(user.email, verificationToken);
    console.log('Verification email sent successfully');
  } catch (error) {
    console.error('Failed to send verification email:', error);
    throw new InternalServerErrorException('Failed to send verification email');
  }

  return { message: 'Verification email sent successfully' };
}

async login(user: User, inputPassword: string) {
  const isMatch = await bcrypt.compare(inputPassword, user.password_hash);
  if (!isMatch) {
    throw new UnauthorizedException('Invalid credentials');
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
    },
  };
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
    .select('id, name, email, phone, gender, is_verified, role, school_id')
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
    role: user.role,
    school_id: user.school_id,
    school,
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

      // Prepare update data (only include fields that are provided)
      const updateData: any = {};
      if (updateProfileDto.name !== undefined) updateData.name = updateProfileDto.name;
      if (updateProfileDto.phone !== undefined) updateData.phone = updateProfileDto.phone;
      if (updateProfileDto.gender !== undefined) updateData.gender = updateProfileDto.gender;

      // Only update if there's something to update
      if (Object.keys(updateData).length === 0) {
        throw new BadRequestException('No valid fields to update');
      }

      // Update user profile
      const { data: updatedUser, error: updateError } = await this.supabase.client
        .from('users')
        .update(updateData)
        .eq('id', userId)
        .select('id, name, email, phone, gender, is_verified, role, school_id')
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

      // Return updated profile
      const profile: UserDetails = {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        phone: updatedUser.phone,
        gender: updatedUser.gender,
        is_verified: updatedUser.is_verified,
        role: updatedUser.role,
        school_id: updatedUser.school_id,
        school,
      };

      return profile;
    }
}