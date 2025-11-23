import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, BeforeInsert, BeforeUpdate } from 'typeorm';
import { User } from './user.entity';

export enum DepositStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded'
}

export enum DepositType {
  BOOKING_DEPOSIT = 'booking_deposit',
  ROOM_BALANCE = 'room_balance',
  ACCOUNT_CREDIT = 'account_credit'
}

@Entity('deposits')
export class Deposit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column('decimal', { precision: 10, scale: 2 })
  amount: number;

  @Column('enum', { enum: DepositStatus, default: DepositStatus.PENDING })
  status: DepositStatus;

  @Column('enum', { enum: DepositType, default: DepositType.ACCOUNT_CREDIT })
  depositType: DepositType;

  @Column({ name: 'payment_reference', unique: true })
  paymentReference: string;

  @Column({ name: 'paystack_reference', nullable: true })
  paystackReference: string;

  @Column({ name: 'transaction_id', nullable: true })
  transactionId: string;

  @Column('text', { nullable: true })
  notes: string;

  @Column('jsonb', { default: {}, name: 'payment_details' })
  paymentDetails: Record<string, any>;

  @Column('timestamptz', { name: 'payment_date', nullable: true })
  paymentDate: Date;

  @Column('timestamptz', { name: 'verified_at', nullable: true })
  verifiedAt: Date;

  @Column('timestamptz', { name: 'expires_at', nullable: true })
  expiresAt: Date;

  @Column('timestamptz', { default: () => 'CURRENT_TIMESTAMP', name: 'created_at' })
  createdAt: Date;

  @Column('timestamptz', { default: () => 'CURRENT_TIMESTAMP', name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @BeforeInsert()
  @BeforeUpdate()
  updateTimestamp() {
    this.updatedAt = new Date();
    
    // Set expiry date (30 days from creation for pending deposits)
    if (!this.expiresAt && this.status === DepositStatus.PENDING) {
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + 30);
      this.expiresAt = expiry;
    }
  }

  // Helper methods
  isExpired(): boolean {
    return this.expiresAt ? new Date() > this.expiresAt : false;
  }

  canRefund(): boolean {
    return this.status === DepositStatus.COMPLETED && 
           !this.isExpired() &&
           new Date().getTime() - this.paymentDate.getTime() <= 30 * 24 * 60 * 60 * 1000; // 30 days
  }

  getFormattedAmount(): string {
    return new Intl.NumberFormat('en-GH', {
      style: 'currency',
      currency: 'GHS',
    }).format(this.amount);
  }
}