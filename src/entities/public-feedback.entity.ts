import { 
  Entity, 
  Column, 
  PrimaryGeneratedColumn, 
  CreateDateColumn, 
  UpdateDateColumn,
  BeforeInsert,
  BeforeUpdate
} from 'typeorm';

@Entity('public_feedback')
export class PublicFeedback {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: false })
  name: string;

  @Column({ nullable: false })
  email: string;

  @Column({ nullable: false })
  subject: string;

  @Column('text', { nullable: false })
  message: string;

  @Column({
    type: 'enum',
    enum: ['general', 'bug', 'feature', 'feedback', 'support'],
    default: 'general'
  })
  category: string;

  @Column({
    type: 'enum',
    enum: ['pending', 'reviewed', 'resolved', 'archived'],
    default: 'pending'
  })
  status: string;

  @Column('text', { nullable: true, name: 'admin_notes' })
  adminNotes: string;

  @CreateDateColumn({ 
    name: 'created_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP'
  })
  createdAt: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP'
  })
  updatedAt: Date;

  @Column({ name: 'ip_address', nullable: true })
  ipAddress: string;

  @Column({ name: 'user_agent', nullable: true, type: 'text' })
  userAgent: string;

  @Column({ nullable: true, default: false })
  responded: boolean;

  @Column({ name: 'responded_at', type: 'timestamptz', nullable: true })
  respondedAt: Date;

  @BeforeInsert()
  @BeforeUpdate()
  updateTimestamps() {
    this.updatedAt = new Date();
    
    // If status is changed to 'responded' and not already marked as responded
    if ((this.status === 'resolved' || this.status === 'reviewed') && !this.responded) {
      this.responded = true;
      this.respondedAt = new Date();
    }
  }

  // Helper method to get formatted date
  getFormattedDate(): string {
    return this.createdAt.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // Helper method to get category label
  getCategoryLabel(): string {
    const labels: Record<string, string> = {
      'general': 'General Inquiry',
      'bug': 'Bug Report',
      'feature': 'Feature Request',
      'feedback': 'Feedback',
      'support': 'Support Request'
    };
    return labels[this.category] || this.category;
  }

  // Helper method to get status label
  getStatusLabel(): string {
    const labels: Record<string, string> = {
      'pending': 'Pending Review',
      'reviewed': 'Under Review',
      'resolved': 'Resolved',
      'archived': 'Archived'
    };
    return labels[this.status] || this.status;
  }

  // Helper method to check if email is valid format
  isEmailValid(): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(this.email);
  }

  // Helper method to anonymize email for display
  getAnonymizedEmail(): string {
    if (!this.email) return '';
    const [local, domain] = this.email.split('@');
    if (local.length <= 2) return `***@${domain}`;
    return `${local[0]}***${local[local.length - 1]}@${domain}`;
  }

  // Helper method to get message preview
  getMessagePreview(maxLength: number = 100): string {
    if (!this.message) return '';
    if (this.message.length <= maxLength) return this.message;
    return this.message.substring(0, maxLength) + '...';
  }
}

export enum PublicFeedbackCategory {
  GENERAL = 'general',
  BUG = 'bug',
  FEATURE = 'feature',
  FEEDBACK = 'feedback',
  SUPPORT = 'support'
}

export enum PublicFeedbackStatus {
  PENDING = 'pending',
  REVIEWED = 'reviewed',
  RESOLVED = 'resolved',
  ARCHIVED = 'archived'
}

export interface PublicFeedbackStats {
  total: number;
  pending: number;
  reviewed: number;
  resolved: number;
  archived: number;
  byCategory: Record<string, number>;
  today: number;
  thisWeek: number;
  thisMonth: number;
  responded: number;
  avgResponseTime: number; // in hours
}