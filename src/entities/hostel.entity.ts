import { Entity, Column, PrimaryGeneratedColumn, OneToMany, BeforeInsert, BeforeUpdate } from 'typeorm';
import { RoomType } from './room-type.entity';
import { Room } from './room.entity';

export enum PaymentMethod {
  BANK = 'bank',
  MOMO = 'momo',
  BOTH = 'both'
}

@Entity('hostels')
export class Hostel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  email: string;

  @Column()
  phone: string;

  @Column()
  SecondaryNumber: string;

  @Column('text')
  description: string;

  @Column('geometry', {
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: true,
  })
  location: string;

  @Column('text')
  address: string;

  @Column({ name: 'admin_id' })
  adminId: string;

  @Column('jsonb', { default: [] })
  images: string[];

  @Column('jsonb', { default: {} })
  amenities: {
    wifi: boolean;
    laundry: boolean;
    cafeteria: boolean;
    parking: boolean;
    security: boolean;
    gym: boolean;
    studyRoom: boolean;
    kitchen: boolean;
    ac: boolean;
    generator: boolean;
  };

  // New fields for pricing and payment
  @Column('decimal', { precision: 10, scale: 2 })
  base_price: number;

  @Column({
    type: 'enum',
    enum: PaymentMethod,
    default: PaymentMethod.BOTH
  })
  payment_method: PaymentMethod;

  @Column('jsonb', { nullable: true })
  bank_details: {
    bank_name: string;
    account_name: string;
    account_number: string;
    branch: string;
  } | null;

  @Column('jsonb', { nullable: true })
  momo_details: {
    provider: string; // MTN, Vodafone, AirtelTigo
    number: string;
    name: string;
  } | null;

  // Additional hostel information
  @Column({ default: 0 })
  max_occupancy: number;

  @Column('text', { nullable: true })
  house_rules: string;

  @Column('jsonb', { default: [] })
  nearby_facilities: string[]; // Schools, hospitals, markets, etc.

  @Column('time', { nullable: true })
  check_in_time: string;

  @Column('time', { nullable: true })
  check_out_time: string;

  @Column({ default: false })
  is_verified: boolean;

  @Column({ default: true })
  is_active: boolean;

  // NEW: Booking availability field
  @Column({ default: true })
  accepting_bookings: boolean;

  @Column('decimal', { precision: 2, scale: 1, default: 0 })
  rating: number;

  @Column({ default: 0 })
  total_reviews: number;

  @Column('timestamptz', { default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column('timestamptz', { default: () => 'CURRENT_TIMESTAMP' })
  updated_at: Date;

  // Relations
  @OneToMany(() => RoomType, (roomType) => roomType.hostel)
  roomTypes: RoomType[];

  @OneToMany(() => Room, (room) => room.hostel)
  rooms: Room[];

  @BeforeInsert()
  @BeforeUpdate()
  updateTimestamp() {
    this.updated_at = new Date();
  }

  // Helper method to get coordinates
  getCoordinates(): [number, number] | null {
    if (!this.location) return null;
    const match = this.location.match(/POINT\(([\d.-]+) ([\d.-]+)\)/);
    return match ? [parseFloat(match[1]), parseFloat(match[2])] : null;
  }

  // Helper methods for room management
  getTotalRooms(): number {
    return this.roomTypes?.reduce((total, type) => total + type.totalRooms, 0) || 0;
  }

  getAvailableRooms(): number {
    return this.roomTypes?.reduce((total, type) => total + type.availableRooms, 0) || 0;
  }

  getLowestPrice(): number {
    if (!this.roomTypes?.length) return this.base_price;
    return Math.min(...this.roomTypes.map(type => type.pricePerSemester), this.base_price);
  }

  getHighestPrice(): number {
    if (!this.roomTypes?.length) return this.base_price;
    return Math.max(...this.roomTypes.map(type => type.pricePerSemester), this.base_price);
  }

  // Payment method helpers
  acceptsBankPayments(): boolean {
    return this.payment_method === PaymentMethod.BANK || this.payment_method === PaymentMethod.BOTH;
  }

  acceptsMomoPayments(): boolean {
    return this.payment_method === PaymentMethod.MOMO || this.payment_method === PaymentMethod.BOTH;
  }

  getBankDetails() {
    return this.acceptsBankPayments() ? this.bank_details : null;
  }

  getMomoDetails() {
    return this.acceptsMomoPayments() ? this.momo_details : null;
  }

  // NEW: Booking availability helper methods
  isAcceptingBookings(): boolean {
    return this.accepting_bookings && this.is_active;
  }

  canAcceptBookings(): boolean {
    return this.is_active && this.is_verified;
  }

  getBookingStatus(): 'accepting' | 'closed' | 'inactive' | 'unverified' {
    if (!this.is_active) return 'inactive';
    if (!this.is_verified) return 'unverified';
    return this.accepting_bookings ? 'accepting' : 'closed';
  }

  getBookingStatusMessage(): string {
    const status = this.getBookingStatus();
    switch (status) {
      case 'accepting':
        return 'Currently accepting bookings';
      case 'closed':
        return 'Not accepting bookings at this time';
      case 'inactive':
        return 'Hostel is currently inactive';
      case 'unverified':
        return 'Hostel pending verification';
      default:
        return 'Booking status unknown';
    }
  }
}