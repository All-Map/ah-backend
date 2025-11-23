import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, BeforeInsert, BeforeUpdate, OneToMany } from 'typeorm';
import { Room } from './room.entity';
import { Hostel } from './hostel.entity';
import { Payment } from './payment.entity';

export enum BookingStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  CHECKED_IN = 'checked_in',
  CHECKED_OUT = 'checked_out',
  CANCELLED = 'cancelled',
  NO_SHOW = 'no_show'
}

export enum BookingType {
  SEMESTER = 'semester',
  MONTHLY = 'monthly',
  WEEKLY = 'weekly'
}

export enum PaymentStatus {
  PENDING = 'pending',
  PARTIAL = 'partial',
  PAID = 'paid',
  CANCELLED = 'cancelled',
  OVERDUE = 'overdue'
}

@Entity('bookings')
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'hostel_id' })
  hostelId: string;

  @Column({ name: 'room_id' })
  roomId: string;

  @Column({ name: 'student_id', nullable: true })
  studentId: string;

  @Column({ name: 'student_name', length: 100 })
  studentName: string;

  @Column({ name: 'student_email' })
  studentEmail: string;

  @Column({ name: 'student_phone', length: 20 })
  studentPhone: string;

  @Column('enum', { enum: BookingType, name: 'booking_type' })
  bookingType: BookingType;

  @Column('enum', { enum: BookingStatus, default: BookingStatus.PENDING })
  status: BookingStatus;

  @Column('enum', { enum: PaymentStatus, default: PaymentStatus.PENDING, name: 'payment_status' })
  paymentStatus: PaymentStatus;

  @Column('date', { name: 'check_in_date' })
  checkInDate: Date;

  @Column('date', { name: 'check_out_date' })
  checkOutDate: Date;

  @Column('decimal', { precision: 10, scale: 2, name: 'total_amount', transformer: {
    to: (value: number) => value,
    from: (value: string) => parseFloat(value)
  }})
  totalAmount: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0, name: 'amount_paid', transformer: {
    to: (value: number) => value,
    from: (value: string) => parseFloat(value)
  }})
  amountPaid: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0, name: 'deposit_amount', transformer: {
    to: (value: number) => value,
    from: (value: string) => parseFloat(value)
  }})
  depositAmount: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0, name: 'amount_due', transformer: {
    to: (value: number) => value,
    from: (value: string) => parseFloat(value)
  }})
  amountDue: number;

  @Column('date', { nullable: true, name: 'payment_due_date' })
  paymentDueDate: Date;

  // New payment tracking fields
  @Column('decimal', { precision: 10, scale: 2, default: 70, name: 'booking_fee', transformer: {
    to: (value: number) => value,
    from: (value: string) => parseFloat(value)
  }})
  bookingFee: number;

  @Column('boolean', { default: false, name: 'booking_fee_paid' })
  bookingFeePaid: boolean;

  @Column('timestamptz', { nullable: true, name: 'auto_cancel_at' })
  autoCancelAt: Date;

  @Column('boolean', { default: false, name: 'auto_cancel_notified' })
  autoCancelNotified: boolean;

  @Column({ nullable: true, name: 'payment_reference' })
  paymentReference: string;

  @Column('timestamptz', { nullable: true, name: 'booking_fee_paid_at' })
  bookingFeePaidAt: Date;

  @Column('text', { nullable: true, name: 'special_requests' })
  specialRequests: string;

  @Column('text', { nullable: true })
  notes: string;

  @Column('jsonb', { default: [], name: 'emergency_contacts' })
  emergencyContacts: Array<{
    name: string;
    relationship: string;
    phone: string;
    email?: string;
  }>;

  @Column('timestamptz', { nullable: true, name: 'confirmed_at' })
  confirmedAt: Date;

  @Column('timestamptz', { nullable: true, name: 'checked_in_at' })
  checkedInAt: Date;

  @Column('timestamptz', { nullable: true, name: 'checked_out_at' })
  checkedOutAt: Date;

  @Column('timestamptz', { nullable: true, name: 'cancelled_at' })
  cancelledAt: Date;

  @Column('text', { nullable: true, name: 'cancellation_reason' })
  cancellationReason: string;

  @Column('timestamptz', { default: () => 'CURRENT_TIMESTAMP', name: 'created_at' })
  createdAt: Date;

  @Column('timestamptz', { default: () => 'CURRENT_TIMESTAMP', name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Hostel)
  @JoinColumn({ name: 'hostel_id' })
  hostel: Hostel;

  @OneToMany(() => Payment, payment => payment.booking)
  payments: Payment[];

  @ManyToOne(() => Room)
  @JoinColumn({ name: 'room_id' })
  room: Room;

  @BeforeInsert()
  @BeforeUpdate()
  updateTimestamp() {
    this.updatedAt = new Date();
    // Only calculate amountDue if totalAmount and amountPaid are properly set
    if (typeof this.totalAmount === 'number' && typeof this.amountPaid === 'number') {
      this.amountDue = Math.max(0, this.totalAmount - this.amountPaid);
    }
  }

  // Helper methods

  shouldAutoCancel(): boolean {
    if (this.status !== BookingStatus.CONFIRMED) {
      return false;
    }

    if (!this.autoCancelAt) {
      return false;
    }

    // Check if current time is past auto-cancel deadline
    return new Date() > this.autoCancelAt;
  }

  // Calculate required minimum payment (50% of semester fee)
  getRequiredMinPayment(): number {
    return this.totalAmount * 0.5; // 50% of semester fee
  }

  // Check if minimum payment requirement is met
  hasMetMinPaymentRequirement(): boolean {
    const minRequired = this.getRequiredMinPayment();
    return this.amountPaid >= minRequired;
  }

  // Set auto-cancel deadline (7 days from creation)
  setAutoCancelDeadline(): void {
    const cancelDate = new Date(this.createdAt);
    cancelDate.setDate(cancelDate.getDate() + 7);
    this.autoCancelAt = cancelDate;
  }

  getDurationInDays(): number {
    const checkIn = new Date(this.checkInDate);
    const checkOut = new Date(this.checkOutDate);
    return Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
  }

  isOverdue(): boolean {
    if (!this.paymentDueDate || this.paymentStatus === PaymentStatus.PAID) {
      return false;
    }
    return new Date() > new Date(this.paymentDueDate);
  }

  canCancel(): boolean {
    return [BookingStatus.PENDING, BookingStatus.CONFIRMED].includes(this.status);
  }

  canCheckIn(): boolean {
    return this.status === BookingStatus.CONFIRMED && 
           new Date() >= new Date(this.checkInDate) &&
           this.paymentStatus === PaymentStatus.PAID;
  }

  canCheckOut(): boolean {
    return this.status === BookingStatus.CHECKED_IN;
  }

  getRemainingBalance(): number {
    return Math.max(0, this.totalAmount - this.amountPaid);
  }

  getPaymentProgress(): number {
    // Calculate progress including booking fee
    const totalCost = this.totalAmount + this.bookingFee;
    return totalCost > 0 ? (this.amountPaid / totalCost) * 100 : 0;
  }

  // Get total cost including booking fee
  getTotalCost(): number {
    return this.totalAmount + this.bookingFee;
  }

  // Check if booking fee is paid
  isBookingFeePaid(): boolean {
    return this.bookingFeePaid && typeof this.paymentReference === 'string' && this.paymentReference.length > 0;
  }

  // Check if room payment is complete
  isRoomPaymentComplete(): boolean {
    return this.amountDue <= 0;
  }

  // Check if full payment is complete
  isFullyPaid(): boolean {
    return this.isBookingFeePaid() && this.isRoomPaymentComplete();
  }

  // Get payment summary
  getPaymentSummary() {
    return {
      totalCost: this.getTotalCost(),
      bookingFee: this.bookingFee,
      roomAmount: this.totalAmount,
      amountPaid: this.amountPaid,
      amountDue: this.amountDue,
      bookingFeePaid: this.bookingFeePaid,
      roomPaymentComplete: this.isRoomPaymentComplete(),
      fullyPaid: this.isFullyPaid(),
      paymentProgress: this.getPaymentProgress()
    };
  }
}