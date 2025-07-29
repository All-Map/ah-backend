import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;

constructor(private readonly config: ConfigService) {
  this.transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: this.config.get('EMAIL_USER'),
      pass: this.config.get('EMAIL_PASSWORD'),
    },
  });
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

    await this.transporter.sendMail({
      from: this.config.get('EMAIL_FROM'),
      to: email,
      subject: 'Verify Your Email',
      html,
    });
  }

  async sendPasswordResetEmail(email: string, token: string) {
    const resetUrl = `${this.config.get('FRONTEND_URL')}/reset-password?token=${token}`;
    const html = this.renderTemplate('reset', { resetUrl });

    await this.transporter.sendMail({
      from: this.config.get('EMAIL_FROM'),
      to: email,
      subject: 'Password Reset Request',
      html,
    });
  }

  async sendVerificationApproval(email: string): Promise<void> {
  const subject = 'Admin Verification Approved';
  const html = `<p>Your admin verification request has been approved. You can now access the admin dashboard.</p>`;
  await this.sendEmail(email, subject, html);
}

async sendVerificationRejection(email: string, reason: string): Promise<void> {
  const subject = 'Admin Verification Rejected';
  const html = `<p>Your admin verification request was rejected. Reason: ${reason}</p>`;
  await this.sendEmail(email, subject, html);
}

  async sendNewVerificationRequest(email: string): Promise<void> {
  const subject = 'New Admin Verification Request';
  const html = `<p>A new admin verification request needs your review.</p>`;
  await this.sendEmail(email, subject, html);
}

  private async sendEmail(email: string, subject: string, html: string): Promise<void> {
    await this.transporter.sendMail({
      from: this.config.get('EMAIL_FROM'),
      to: email,
      subject,
      html,
    });
  }
}