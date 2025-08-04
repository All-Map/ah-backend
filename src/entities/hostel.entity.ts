import { Entity, Column, PrimaryGeneratedColumn, OneToMany, BeforeInsert, BeforeUpdate } from 'typeorm';
import { RoomType } from './room-type.entity';
import { Room } from './room.entity';

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
  };

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
    if (!this.roomTypes?.length) return 0;
    return Math.min(...this.roomTypes.map(type => type.pricePerSemester));
  }

  getHighestPrice(): number {
    if (!this.roomTypes?.length) return 0;
    return Math.max(...this.roomTypes.map(type => type.pricePerSemester));
  }
}