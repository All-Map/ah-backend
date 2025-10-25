import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class MailService {
  private resend: Resend;

  constructor(private readonly config: ConfigService) {
    this.resend = new Resend(this.config.get('RESEND_API_KEY'));
  }

  private renderTemplate(templateName: string, variables: Record<string, string>) {
    // Always resolve from project root, works for both src and dist
    const templatePath = path.join(
      process.cwd(),
      'src',
      'mail',
      'templates',
      `${templateName}.html`
    );
    let template = fs.readFileSync(templatePath, 'utf8');
    for (const [key, value] of Object.entries(variables)) {
      template = template.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }
    return template;
  }

  async sendVerificationEmail(email: string, token: string) {
    const verificationUrl = `${this.config.get('FRONTEND_URL')}/verify-email?token=${token}`;
    const html = this.renderTemplate('verify', { verificationUrl });

    try {
      const { data, error } = await this.resend.emails.send({
        from: this.config.get('EMAIL_FROM') || 'Acme <onboarding@resend.dev>',
        to: email,
        subject: 'Verify Your Email',
        html,
      });

      if (error) {
        throw new Error(`Failed to send verification email: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Error sending verification email:', error);
      throw error;
    }
  }

    async sendAdminVerificationEmail(email: string, token: string) {
    const verificationUrl = `${this.config.get('ADMIN_FRONTEND_URL')}/verify-email?token=${token}`;
    const html = this.renderTemplate('verify', { verificationUrl });

    try {
      const { data, error } = await this.resend.emails.send({
        from: this.config.get('EMAIL_FROM') || 'Acme <onboarding@resend.dev>',
        to: email,
        subject: 'Verify Your Email',
        html,
      });

      if (error) {
        throw new Error(`Failed to send verification email: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Error sending verification email:', error);
      throw error;
    }
  }

  async sendAdminPasswordResetEmail(email: string, token: string) {
    const resetUrl = `${this.config.get('ADMIN_FRONTEND_URL')}/reset-password?token=${token}`;
    const html = this.renderTemplate('reset', { resetUrl });

    try {
      const { data, error } = await this.resend.emails.send({
        from: this.config.get('EMAIL_FROM') || 'Acme <onboarding@resend.dev>',
        to: email,
        subject: 'Password Reset Request',
        html,
      });

      if (error) {
        throw new Error(`Failed to send password reset email: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Error sending password reset email:', error);
      throw error;
    }
  }


  async sendPasswordResetEmail(email: string, token: string) {
    const resetUrl = `${this.config.get('FRONTEND_URL')}/reset-password?token=${token}`;
    const html = this.renderTemplate('reset', { resetUrl });

    try {
      const { data, error } = await this.resend.emails.send({
        from: this.config.get('EMAIL_FROM') || 'Acme <onboarding@resend.dev>',
        to: email,
        subject: 'Password Reset Request',
        html,
      });

      if (error) {
        throw new Error(`Failed to send password reset email: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Error sending password reset email:', error);
      throw error;
    }
  }

  async sendVerificationApproval(email: string): Promise<void> {
    const subject = 'Admin Verification Approved';
    const html = `<p>Your admin verification request has been approved. You can now access the admin dashboard.</p>`;
    
    try {
      const { data, error } = await this.resend.emails.send({
        from: this.config.get('EMAIL_FROM') || 'Acme <onboarding@resend.dev>',
        to: email,
        subject,
        html,
      });

      if (error) {
        throw new Error(`Failed to send verification approval email: ${error.message}`);
      }
    } catch (error) {
      console.error('Error sending verification approval email:', error);
      throw error;
    }
  }

  async sendVerificationRejection(email: string, reason: string): Promise<void> {
    const subject = 'Admin Verification Rejected';
    const html = `<p>Your admin verification request was rejected. Reason: ${reason}</p>`;
    
    try {
      const { data, error } = await this.resend.emails.send({
        from: this.config.get('EMAIL_FROM') || 'Acme <onboarding@resend.dev>',
        to: email,
        subject,
        html,
      });

      if (error) {
        throw new Error(`Failed to send verification rejection email: ${error.message}`);
      }
    } catch (error) {
      console.error('Error sending verification rejection email:', error);
      throw error;
    }
  }

  async sendNewVerificationRequest(email: string): Promise<void> {
    const subject = 'New Admin Verification Request';
    const html = `<p>A new admin verification request needs your review.</p>`;
    
    try {
      const { data, error } = await this.resend.emails.send({
        from: this.config.get('EMAIL_FROM') || 'Acme <onboarding@resend.dev>',
        to: email,
        subject,
        html,
      });

      if (error) {
        throw new Error(`Failed to send new verification request email: ${error.message}`);
      }
    } catch (error) {
      console.error('Error sending new verification request email:', error);
      throw error;
    }
  }

  // Generic email method using Resend
  private async sendEmail(email: string, subject: string, html: string): Promise<void> {
    try {
      const { data, error } = await this.resend.emails.send({
        from: this.config.get('EMAIL_FROM') || 'Acme <onboarding@resend.dev>',
        to: email,
        subject,
        html,
      });

      if (error) {
        throw new Error(`Failed to send email: ${error.message}`);
      }
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  }
}