import { Injectable, Req } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { AdminVerification } from '../entities/admin-verification.entity';
import { User } from '../entities/user.entity';
import { MailService } from 'src/mail/mail.service';

@Injectable()
export class AdminVerificationService {
  constructor(private readonly supabase: SupabaseService, private readonly mailService: MailService) {}

  async createVerificationRequest(
    user: User, 
    data: any, 
    idDocuments: string[], 
    hostelProofDocuments: string[]
  ): Promise<AdminVerification> {
    const verificationData = {
      ...data,
      user_id: user.id,
      id_documents: idDocuments,
      hostel_proof_documents: hostelProofDocuments,
      status: 'pending'
    };

    const { data: verification, error } = await this.supabase.client
      .from('admin_verifications')
      .insert([verificationData])
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to create verification request: ${error.message}`);
    }

    return verification;
  }

async getVerifications(status?: string): Promise<AdminVerification[]> {
  let query = this.supabase.client
    .from('admin_verifications')
    .select('*, user:user_id (id, email, name, phone, school_id)');

  if (status && status !== 'all') {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) throw new Error('Failed to fetch verifications');
  return data;
}

  async getPendingVerifications(): Promise<AdminVerification[]> {
    const { data, error } = await this.supabase.client
      .from('admin_verifications')
      .select('*, user:user_id (id, email, school_id)')
      .eq('status', 'pending');

    if (error) throw new Error('Failed to fetch pending verifications');
    return data;
  }

  async updateVerificationStatus(
    id: string, 
    status: 'approved' | 'rejected', 
    reviewedBy: User,
    rejectionReason?: string
  ): Promise<AdminVerification> {
    const updateData: any = {
      status,
      reviewed_by_id: reviewedBy.id,
      reviewed_at: new Date().toISOString()
    };

    if (status === 'rejected' && rejectionReason) {
      updateData.rejection_reason = rejectionReason;
    }

    const { data, error } = await this.supabase.client
      .from('admin_verifications')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw new Error('Failed to update verification status');

    if (status === 'approved') {
      await this.supabase.client
        .from('users')
        .update({ role: 'hostel_admin' })
        .eq('id', data.user_id);

          const { data: user } = await this.supabase.client
    .from('users')
    .select('email')
    .eq('id', data.user_id)
    .single();

  if (user && user.email) {
    await this.mailService.sendVerificationApproval(user.email);
  } else {
    throw new Error('User not found or email missing for approval notification');
  }
} else if (status === 'rejected') {
  const { data: user } = await this.supabase.client
    .from('users')
    .select('email')
    .eq('id', data.user_id)
    .single();
  
  if (user && user.email) {
    await this.mailService.sendVerificationRejection(
      user.email, 
      rejectionReason ?? 'No reason provided'
    );
  } else {
    throw new Error('User not found or email missing for rejection notification');
  }
    }

    return data;
  }

  async getUserVerificationStatus(userId: string): Promise<AdminVerification | null> {
  const { data, error } = await this.supabase.client
    .from('admin_verifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error('Failed to fetch verification status');
  }
  
  return data;
}

}