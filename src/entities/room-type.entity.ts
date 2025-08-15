// room-type.entity.ts
import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToMany, JoinColumn, BeforeInsert, BeforeUpdate } from 'typeorm';
import { Hostel } from './hostel.entity';
import { Room } from './room.entity';

export enum RoomGender {
  MALE = 'male',
  FEMALE = 'female',
  MIXED = 'mixed' // For common areas or special cases
}

@Entity('room_types')
export class RoomType {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'hostel_id' })
  hostelId: string;

  @Column({ length: 100 })
  name: string;

  @Column('text', { nullable: true })
  description: string;

  @Column('decimal', { precision: 10, scale: 2, name: 'price_per_semester' })
  pricePerSemester: number;

  @Column('decimal', { precision: 10, scale: 2, name: 'price_per_month' })
  pricePerMonth: number;

  @Column('decimal', { precision: 10, scale: 2, nullable: true, name: 'price_per_week' })
  pricePerWeek?: number;

  @Column('int', { default: 1 })
  capacity: number;

  @Column({
    type: 'enum',
    enum: RoomGender,
    default: RoomGender.MIXED,
    name: 'gender'
  })
  gender: RoomGender;

  @Column('jsonb', { default: [] })
  amenities: string[];

  @Column('int', { default: 0, name: 'total_rooms' })
  totalRooms: number;

  @Column('int', { default: 0, name: 'available_rooms' })
  availableRooms: number;

  @Column('jsonb', { default: [] })
  images: string[];

  // Fixed: Added the missing allowedGenders property
  @Column('simple-array', { 
    nullable: true, 
    name: 'gender',
    comment: 'Gender restrictions for this room type. Options: male, female, mixed, other' 
  })
  allowedGenders: string[];

  @Column('timestamptz', { default: () => 'CURRENT_TIMESTAMP', name: 'created_at' })
  createdAt: Date;

  @Column('timestamptz', { default: () => 'CURRENT_TIMESTAMP', name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Hostel, (hostel) => hostel.roomTypes)
  @JoinColumn({ name: 'hostel_id' })
  hostel: Hostel;

  @OneToMany(() => Room, (room) => room.roomType)
  rooms: Room[];

  @BeforeInsert()
  @BeforeUpdate()
  updateTimestamp() {
    this.updatedAt = new Date();
  }

  // Helper methods
  getOccupiedRooms(): number {
    return this.totalRooms - this.availableRooms;
  }

  getAvailabilityPercentage(): number {
    if (this.totalRooms === 0) return 0;
    return Math.round((this.availableRooms / this.totalRooms) * 100);
  }

  // Gender-related helper methods
  isGenderCompatible(userGender: string): boolean {
    if (this.gender === RoomGender.MIXED) return true;
    return this.gender === userGender.toLowerCase();
  }

  getGenderDisplayName(): string {
    switch (this.gender) {
      case RoomGender.MALE:
        return 'Male Only';
      case RoomGender.FEMALE:
        return 'Female Only';
      case RoomGender.MIXED:
        return 'Mixed Gender';
      default:
        return 'Unknown';
    }
  }
}