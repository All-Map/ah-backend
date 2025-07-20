import { BadRequestException, Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
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
    const domain = registerDto.email.split('@')[1];
    const { data: school } = await this.supabase
      .client
      .from('schools')
      .select('id')
      .eq('domain', domain)
      .single();
    
    if (!school) throw new BadRequestException('Invalid school email domain');

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const user = {
      ...registerDto,
      school_id: school.id,
      verification_token: verificationToken,
      is_verified: false
    };

    const { data, error } = await this.supabase
      .client
      .from('users')
      .insert([user])
      .single();

    if (error) throw new InternalServerErrorException(error.message);

    // Send verification email
    await this.mailService.sendVerificationEmail(
      user.email,
      verificationToken
    );

    return data;
  }

  async login(user: User) {
    const payload = { 
      sub: user.id,
      email: user.email,
      role: user.role 
    };
    
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        is_verified: user.is_verified
      }
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
    
    await this.supabase.client
      .from('users')
      .update({ 
        password_hash: dto.newPassword,
        password_reset_token: null,
        reset_token_expiry: null
      })
      .eq('id', user.id);
  }

  async verifyEmail(token: string) {
    const { data: user, error } = await this.supabase
      .client
      .from('users')
      .update({ is_verified: true, verification_token: null })
      .eq('verification_token', token)
      .single();
    
    if (error || !user) throw new BadRequestException('Invalid token');
    return user;
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
    
    return error ? null : data;
  }
}