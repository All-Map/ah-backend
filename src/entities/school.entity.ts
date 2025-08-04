import { Entity, Column, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { Hostel } from './hostel.entity';

@Entity('schools')
export class School {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  domain: string;

  @Column('geometry', {
    spatialFeatureType: 'Point',
    srid: 4326,
  })
  location: string; // POINT(long lat)

  @Column('timestamptz', { default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

//   @OneToMany(() => Hostel, (hostel) => hostel.school)
//   hostels: Hostel[];
}