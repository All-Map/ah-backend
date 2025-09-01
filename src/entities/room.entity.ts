
// room.entity.ts
import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, BeforeInsert, BeforeUpdate } from 'typeorm';
import { Hostel } from './hostel.entity';
import { RoomType } from './room-type.entity';

export enum RoomStatus {
  AVAILABLE = 'available',
  OCCUPIED = 'occupied',
  MAINTENANCE = 'maintenance',
  RESERVED = 'reserved'
}

@Entity('rooms')
export class Room {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'hostel_id' })
  hostelId: string;

  @Column({ name: 'room_type_id' })
  roomTypeId: string;

  @Column({ length: 20, name: 'room_number' })
  roomNumber: string;

  @Column('int', { nullable: true })
  floor: number;

  // @Column('enum', { enum: RoomStatus, default: RoomStatus.AVAILABLE })
  // status: RoomStatus;

@Column({
  type: 'text', // or 'varchar' if you really want
})
status: string;


  @Column('int', { default: 0, name: 'current_occupancy' })
  currentOccupancy: number;

  @Column('int', { name: 'max_occupancy' })
  maxOccupancy: number;

  @Column('text', { nullable: true })
  notes: string;

  @Column('timestamptz', { default: () => 'CURRENT_TIMESTAMP', name: 'created_at' })
  createdAt: Date;

  @Column('timestamptz', { default: () => 'CURRENT_TIMESTAMP', name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Hostel, (hostel) => hostel.rooms)
  @JoinColumn({ name: 'hostel_id' })
  hostel: Hostel;

  @ManyToOne(() => RoomType, (roomType) => roomType.rooms)
  @JoinColumn({ name: 'room_type_id' })
  roomType: RoomType;

  @BeforeInsert()
  @BeforeUpdate()
  updateTimestamp() {
    this.updatedAt = new Date();
  }

  isAvailable(): boolean {
  return this.status === RoomStatus.AVAILABLE && this.currentOccupancy < this.maxOccupancy;
}

  hasSpace(): boolean {
    return this.currentOccupancy < this.maxOccupancy;
  }

  getRemainingCapacity(): number {
    return this.maxOccupancy - this.currentOccupancy;
  }
}