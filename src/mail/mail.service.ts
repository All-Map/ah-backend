import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class MailService {
  constructor(private readonly supabase: SupabaseService) {}

  async sendVerificationEmail(email: string, token: string) {
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;
    
    await this.supabase.client.functions.invoke('send-email', {
      body: JSON.stringify({
        to: email,
        subject: 'Verify Your Email',
        html: `<a href="${verificationUrl}">Click here to verify your email</a>`
      })
    });
  }

  async sendPasswordResetEmail(email: string, token: string) {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
    
    await this.supabase.client.functions.invoke('send-email', {
      body: JSON.stringify({
        to: email,
        subject: 'Password Reset Request',
        html: `<a href="${resetUrl}">Click here to reset your password</a>`
      })
    });
  }
}