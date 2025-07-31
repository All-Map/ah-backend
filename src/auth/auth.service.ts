import { BadRequestException, ConflictException, Injectable, InternalServerErrorException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { SupabaseService } from '../supabase/supabase.service';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { User } from 'src/entities/user.entity';
import * as bcrypt from 'bcrypt';
import { MailService } from 'src/mail/mail.service';

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

async verifyEmail(token: string): Promise<{ message: string; user?: Partial<User> }> {
  if (!token || token.length !== 64) {
    throw new BadRequestException('Invalid verification token format');
  }

  // Find user with valid token
  const { data: user, error } = await this.supabase
    .client
    .from('users')
    .select('*')
    .eq('verification_token', token)
    .gt('verification_token_expires_at', new Date().toISOString())
    .single();

  if (error || !user) {
    // Check if token exists but is expired
    const { data: expiredUser } = await this.supabase
      .client
      .from('users')
      .select('id')
      .eq('verification_token', token)
      .single();

    if (expiredUser) {
      throw new BadRequestException('Verification token has expired. Please request a new verification email.');
    }
    
    throw new BadRequestException('Invalid or expired verification token');
  }

  if (user.is_verified) {
    throw new BadRequestException('Email is already verified');
  }

  // Update user as verified and clear token
  const { data: updatedUser, error: updateError } = await this.supabase
    .client
    .from('users')
    .update({ 
      is_verified: true, 
      verification_token: null,
      verification_token_expires_at: null,
      verified_at: new Date().toISOString()
    })
    .eq('id', user.id)
    .select('id, email, is_verified, verified_at')
    .single();

  if (updateError) {
    console.log('Supabase update response:', updatedUser, updateError);
    throw new InternalServerErrorException('Failed to verify email');
  }


  return {
    message: 'Email verified successfully',
    user: updatedUser
  };
}

// Add method to resend verification email
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

  // Generate new token
  const verificationToken = crypto.randomBytes(32).toString('hex');
  const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

  // Update user with new token
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

  // Send new verification email
  try {
    const verificationUrl = `${process.env.BACKEND_URL}/auth/verify/${verificationToken}`;
    await this.mailService.sendVerificationEmail(user.email, verificationUrl);
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
}