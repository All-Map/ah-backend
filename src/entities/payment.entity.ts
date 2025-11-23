import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, BeforeInsert, BeforeUpdate } from 'typeorm';
import { Booking } from './booking.entity';

export enum PaymentMethod {
  CASH = 'cash',
  BANK_TRANSFER = 'bank_transfer',
  MOBILE_MONEY = 'mobile_money',
  CARD = 'card',
  CHEQUE = 'cheque',
  ACCOUNT_CREDIT = 'account_credit'
}

export enum PaymentType {
  BOOKING_PAYMENT = 'booking_payment',
  DEPOSIT = 'deposit',
  REFUND = 'refund',
  PENALTY = 'penalty'
}

export enum PaymentStatus {
  PENDING = 'pending',
  PARTIAL = 'partial',
  PAID = 'paid',
  REFUNDED = 'refunded',
  OVERDUE = 'overdue'
}

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'booking_id' })
  bookingId: string;

  @Column('decimal', { precision: 10, scale: 2 })
  amount: number;

  @Column('enum', { enum: PaymentMethod, name: 'payment_method' })
  paymentMethod: PaymentMethod;

  @Column('enum', { enum: PaymentType, name: 'payment_type' })
  paymentType: PaymentType;

  @Column({ name: 'transaction_ref', nullable: true })
  transactionRef: string;

  @Column('text', { nullable: true })
  notes: string;

  @Column('timestamptz', { name: 'payment_date', default: () => 'CURRENT_TIMESTAMP' })
  paymentDate: Date;

  @Column({ name: 'received_by', nullable: true })
  receivedBy: string;

  @Column('jsonb', { default: {}, name: 'metadata' })
  metadata: Record<string, any>;

  @Column('timestamptz', { default: () => 'CURRENT_TIMESTAMP', name: 'created_at' })
  createdAt: Date;

  @Column('timestamptz', { default: () => 'CURRENT_TIMESTAMP', name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Booking)
  @JoinColumn({ name: 'booking_id' })
  booking: Booking;

  @BeforeInsert()
  @BeforeUpdate()
  updateTimestamp() {
    this.updatedAt = new Date();
  }
}